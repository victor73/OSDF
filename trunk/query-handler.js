var path = require('path');
var auth = require('auth_enforcer');
var elastical = require('elastical');
var osdf_utils = require('osdf_utils');
var util = require('util');
var logger = osdf_utils.get_logger();

var eclient;

// This initializes the handler. The things we need to do before the
// handler is ready to begin its work are: establish a connection to the
// CouchDB server, determine what the installed namespaces are, and create
// the various validators for each of the node types inside each namespace.

exports.init = function(emitter) {
    logger.debug("In " + path.basename(__filename) + " init().");

    require('config');
    var c = Config.get_instance(osdf_utils.get_config());
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
exports.perform_query = function (request, response) {
    logger.debug("In perform_query");

    var perms_handler = require('perms-handler');
	var user = auth.get_user(request);
	var namespace = request.params.ns;
	var user_acls = perms_handler.get_user_acls(namespace, user);
    var content = request.rawBody;
    
    //build a skeletal query with filters
    var elastic_query =
    {
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
    
    var user_query;
    
    try {
    	user_query = JSON.parse(content);
    } catch (err) {
        logger.error("Bad query json provided.  " + err);
        response.json('', {'X-OSDF-Error': "Bad query json provided. " + err}, 422);
        return;
    }
	
    //insert the client supplied query into the filtered skeletal query
    elastic_query["query"]["filtered"]["query"] = user_query['query'];
    
    if (user_query["sort"]) //if user specified sort, insert the sort element into the elastic query 
    	elastic_query["sort"] = user_query["sort"];
    if (user_query["from"]) //if user specified from (begin index for pagination)
    	elastic_query["from"] = user_query["from"];
    if (user_query["size"]) //if user specified size (total size for pagination)
    	elastic_query["size"] = user_query["size"];
    
    logger.debug("submitting elastic_query:\n" + util.inspect(elastic_query, true, null));
    
    try {
		// from the elastical docs:
		// `err` is an Error, or `null` on success.
	    // `results` is an object containing search hits.
	    // `res` is the full parsed ElasticSearch response data.
    	eclient.search(elastic_query, function (err, results, res) {
    		if (err) {
    			logger.error("Error running query. " + err);
    			response.json('',  {'X-OSDF-Error': err}, 500);    			
    		}
    		else {
    			if (results.total != results.hits.length) {
    				logger.debug("Number of results returned was: "
    						+ results.hits.length + " though a total of "
    						+ results.total + " were found.");
    			}
    			else {
    				logger.debug("Number of results found was: " + results.total);
    			}
    			response.json(results, 200);
    		}
    	});
    } catch (err) {
        logger.error("Error running query. " + err);
        response.json('', {'X-OSDF-Error': "Error running query: " + err}, 500);
        return;
    }  
};
