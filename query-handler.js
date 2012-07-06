var _ = require('underscore');
var path = require('path');
var auth = require('auth_enforcer');
var elastical = require('elastical');
var osdf_utils = require('osdf_utils');
var util = require('util');
var logger = osdf_utils.get_logger();

//Load configuration parameters
var c = Config.get_instance(osdf_utils.get_config());
var base_url = c.value('global', 'base_url');
var port = c.value('global', 'port');
var page_size = c.value('global', 'pagesize');

var eclient;


// This initializes the handler. The things we need to do before the
// handler is ready to begin its work are: establish a connection to the
// CouchDB server, determine what the installed namespaces are, and create
// the various validators for each of the node types inside each namespace.

exports.init = function(emitter) {
	logger.debug("In " + path.basename(__filename) + " init().");

	require('config');

	var elasticsearch_address = c.value('elasticsearch', 'elasticsearch_address');
	var elasticsearch_port = c.value('elasticsearch', 'elasticsearch_port');

	
	
	logger.info("Creating elasticsearch connection.");

	// Establish the connection to the ElasticSearch server
	eclient = new elastical.Client(elasticsearch_address, {port: elasticsearch_port});

	logger.debug("Connected to Elastic Search at " + 
					elasticsearch_address + ":" + elasticsearch_port);

	// Setup all the JSON validators for the namespaces and their node types.
	emitter.emit('query_handler_initialized');
};


// This is the method that handles querying elastic search
exports.perform_query = function(request, response) {
	logger.debug("In perform_query");

	var perms_handler = require('perms-handler');
	var user = auth.get_user(request);
	var namespace = request.params.ns;
	var requested_page = request.params.page ? parseInt(request.params.page) : undefined; //parse int for later calculations
	var user_acls = perms_handler.get_user_acls(namespace, user);
	var content = request.rawBody;

	var user_query;

	try {
		user_query = JSON.parse(content);
	} catch (err) {
		logger.error("Bad query json provided.  " + err);
		response.json('', {'X-OSDF-Error': "Bad query json provided. " + err}, 422);
		return;
	}

	var elastic_query = build_empty_filtered_query(namespace, user_acls);
	
	//insert the client supplied query into the basic filtered query
	elastic_query["query"]["filtered"]["query"] = user_query['query'];

	if (user_query["sort"]) //if user specified sort, insert the sort element into the elastic query 
		elastic_query["sort"] = user_query["sort"];
	
	if (requested_page) { //if user requested a specific page number, ignore any from and size vars in the query that was sent and set from to the first result of the requested page
		elastic_query["from"] = (requested_page - 1) * page_size; //calculate the first result number to return for the top of this page
		logger.debug("User requested page " + requested_page + " so setting elastic_query['from'] to " + elastic_query["from"]);
	}	
	else if (user_query["from"]) //if user specified from (begin index for pagination)
		elastic_query["from"] = user_query["from"];
	
	if (!user_query["size"])
		elastic_query["size"] = page_size;
	else
		elastic_query["size"] = (user_query["size"] > page_size ? page_size : user_query["size"]); //check against max page size allowed

	logger.debug("submitting elastic_query:\n" + util.inspect(elastic_query, true, null));

	try {
		// from the elastical docs:
		// `err` is an Error, or `null` on success.
		// `results` is an object containing search hits.
		// `res` is the full parsed ElasticSearch response data.
		eclient.search(elastic_query, function(err, results, res) {
			if (err) {
				logger.error("Error running query. " + err);
				response.json('', {'X-OSDF-Error' :err}, 500);
			}
			else {
				var partial_result = false;
				var next_page_url;
				
				//determine if this is a partial result response
				var first_result_number = (elastic_query["from"] ? elastic_query["from"] : 0);
				if (first_result_number + results.hits.length < results.total) {
					//only count this as a partial result if the user did not specify both from and size in the query
					if (!user_query["from"] && !user_query["size"]) { 
						partial_result = true;
						next_page_url = base_url + ':' + port + '/nodes/query/' + namespace + '/page/' + (requested_page ? requested_page + 1 : 2);  //if there was no page requested in this url, then it would be page 1, so return 2
					}
				}
				
				format_query_results(results, requested_page);
				
				logger.info("Returning " + results.result_count + " of " + results.search_result_total + " search results; page " + results.page);

				if (partial_result)
					response.json(results, {'X-OSDF-Query-ResultSet': next_page_url}, 206);
				else
					response.json(results, 200);
			}
		});
	} catch (err) {
		logger.error("Error running query. " + err);
		response.json('', {'X-OSDF-Error': "Error running query: " + err}, 500);
		return;
	}
};

function build_empty_filtered_query(namespace, user_acls) {
	//return a skeletal query filtered on namespace and read acl
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
	//convert hits from couchdb format to osdf format
	results.hits = _.map(results.hits, function(hit) {
        return osdf_utils.fix_keys(hit._source);
    });
	
	results["results"] = results.hits 
	results["result_count"] = results.hits.length;
	results["search_result_total"] = results.total;
	results["page"] = (requested_page ? requested_page : 1);

	delete results.hits;
	delete results.total;
	delete results.max_score;
}
