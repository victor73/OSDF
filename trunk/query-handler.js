var _ = require('lodash');
var path = require('path');
var auth = require('auth_enforcer');
var elasticsearch = require('elasticsearch');
var osdf_utils = require('osdf_utils');
var util = require('util');
var logger = osdf_utils.get_logger();
var es_river_name = "osdf";
var sprintf = require('sprintf').sprintf;

// Load configuration parameters
var c = Config.get_instance(osdf_utils.get_config());
var base_url = c.value('global', 'base_url');
var port = c.value('global', 'port');
var page_size = c.value('global', 'pagesize');

var osdf_error = osdf_utils.send_error;
var elastic_client;

// This initializes the handler. The things we need to do before the
// handler is ready to begin its work are: establish a connection to the
// ElasticSearch server and determine if the OSDF river (listening for
// changes from CouchDB changes feed) is available.
exports.init = function (emitter) {
    logger.debug("In " + path.basename(__filename) + " init().");

    require('config');

    var elasticsearch_address = c.value('elasticsearch', 'elasticsearch_address');
    var elasticsearch_port = c.value('elasticsearch', 'elasticsearch_port');

    elastic_client = new elasticsearch.Client({ host: elasticsearch_address + ":" + elasticsearch_port  });

    // Abort the server start-up if ElasticSearch or the index we need isn't there.
    elastic_client.indices.existsType({index: 'osdf',
                                       type: 'osdf' },
                                       function (err, result) {
          if (err) {
              var err_msg = 'Unable to determine if ElasticSearch CouchDB river exists.';
              logger.error(err_msg);
              emitter.emit('query_handler_aborted', err_msg);
          }

          if (result === true) {
              logger.debug("Connected to ElasticSearch at " +
                          elasticsearch_address + ":" + elasticsearch_port);

              // Emit an event to notify of successful initialization.
              emitter.emit('query_handler_initialized');

          } else {
              emitter.emit('query_handler_aborted', "ElasticSearch CouchDB river '" +
                  es_river_name + "' doesn't seem to exist.");
          }
    });
};

// This is the method that handles querying elastic search
exports.perform_query = function (request, response) {
    logger.debug("In perform_query");

    var perms_handler = require('perms-handler');
    var user = auth.get_user(request);
    var namespace = request.params.ns;

    // Parse int for later calculations
    var requested_page = request.params.page ?
                             parseInt(request.params.page, 10) : undefined;
    var user_acls = perms_handler.get_user_acls(namespace, user);
    var content = request.rawBody;

    var user_query;

    try {
        user_query = JSON.parse(content);
    } catch (err) {
        logger.error("Bad query json provided.  " + err);
        osdf_error(response, 'Bad query json provided. ' + err, 422);
        return;
    }

    var elastic_query = build_empty_filtered_query(namespace, user_acls);

    // Insert the client supplied query into the basic filtered query
    elastic_query["query"]["filtered"]["query"] = user_query['query'];

    if (user_query.hasOwnProperty("aggregations") || user_query.hasOwnProperty("aggs")) {
        logger.debug("User query specified aggregations.");
        if (user_query.hasOwnProperty("aggregations")) {
            elastic_query["aggregations"] = user_query['aggregations'];
        } else {
            elastic_query["aggregations"] = user_query['aggs'];
        }
    }

    // If user specified sort, insert the sort element into the elastic query
    if (user_query.hasOwnProperty("sort")) {
        logger.debug("User query specified a sort.");
        elastic_query['sort'] = user_query['sort'];
    }

    // If user requested a specific page number, ignore any from and size vars
    // in the query that was sent and set from to the first result of the
    // requested page
    if (requested_page) {
        // Calculate the first result number to return for the top of this page
        elastic_query["from"] = (requested_page - 1) * page_size;
        logger.debug("User requested page " + requested_page +
                     " so setting elastic_query['from'] to " + elastic_query["from"]);
    } else if (user_query["from"]) {
        // If user specified from (begin index for pagination)
        elastic_query["from"] = user_query["from"];
    }

    if (user_query.hasOwnProperty("size")) {
        logger.info("User specified size.");
        // Check against max page size allowed
        elastic_query["size"] = (user_query["size"] > page_size ?
                                    page_size : user_query["size"]);
    } else {
        elastic_query["size"] = page_size;
    }

    logger.debug("Submitting elastic_query:\n" + util.inspect(elastic_query, true, null));

    try {
        // `err` is an Error, or `null` on success.
        // `results` is an object containing the search results.
        elastic_client.search({ index: "osdf",
                                body: elastic_query },
                                function (err, results) {
            if (err) {
                logger.error("Error running query. " + err);
                osdf_error(response, err, 500);
            } else {
                var partial_result = false;
                var next_page_url;

                // Determine if this is a partial result response
                var first_result_number = elastic_query["from"] || 0;
                if (first_result_number + results.hits.length < results.total) {
                    // Only count this as a partial result if the user did
                    // not specify both from and size in the query
                    if (! user_query["from"] && ! user_query["size"]) {
                        partial_result = true;
                        // If there was no page requested in this url
                        // then it would be page 1, so return 2
                        next_page_url = base_url + ':' + port +
                            '/nodes/query/' + namespace + '/page/' +
                            (requested_page ? requested_page + 1 : 2);
                    }
                }

                format_query_results(results, requested_page);

                logger.info("Returning " + results.result_count +
                            " of " + results.search_result_total +
                            " search results; page " + results.page);

                if (partial_result) {
                    response.set('X-OSDF-Query-ResultSet', next_page_url);
                    response.jsonp(206, results);
                } else {
                    response.jsonp(200, results);
                }
            }
        });
    } catch (e) {
        logger.error("Error running query. " + e);
        osdf_error(response, 'Error running query: ' + e, 500);
        return;
    }
};

function build_empty_filtered_query(namespace, user_acls) {
    // Return a skeletal query filtered on namespace and read acl
    var elastic_query = {
        "query" : {
            "filtered" : {
                "filter" : {
                    "and" : [
                        {
                            term : { "ns" : namespace }
                        },
                        {
                            terms : { "acl.read" : user_acls }
                        }
                    ]
                }
            }
        }
    };
    return elastic_query;
}

function format_query_results(results, requested_page) {
    if (results['hits'].hasOwnProperty('total')) {
        results["search_result_total"] = results['hits']['total'];
    } else {
        results["search_result_total"] = 0;
    }

    // Convert hits from couchdb format to OSDF format
    //results.hits = _.map(results.hits.hits, function (hit) {
    results.results = _.map(results.hits.hits, function (hit) {
        return osdf_utils.fix_keys(hit._source);
    });

    //results["results"] = results.hits;
    results["result_count"] = results.length;
    results["page"] = (requested_page || 1);

    delete results.hits;
    delete results._shards;
    delete results.max_score;
    delete results.total;
    delete results.timed_out;
    delete results.took;
}
