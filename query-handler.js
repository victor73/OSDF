var path = require('path');
var elastical = require('elastical');
var osdf_utils = require('osdf_utils');
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

    logger.debug("Connected to Elastic Search at " + elasticsearch_address + ":" + elasticsearch_port);

    // Setup all the JSON validators for the namespaces and their node types.
    emitter.emit('query_handler_initialized');
}

// This is the method that handles node creation.
exports.perform_query = function (request, response) {
    logger.debug("In get_query_results.");

    var content = request.rawBody;
    var query;
    try {
        query = JSON.parse(content);
    } catch (err) {
        logger.error("Bad query json provided.");
        response.json('', {'X-OSDF-Error': "Bad query json provided."}, 500);
        return;
    }

    // Check if the user is attempting to do too much
    if ( 'fields' in query ) {
        logger.warn("User attempted to control the fields to search.");
        delete query['fields'];
    }
    // Set the fields that in the node document that are queryable.
    query['fields'] = [ 'meta', 'node_type', 'linkage', 'acl' ];

    logger.debug("Submitting search to Elastic Search.");
    try {
        eclient.search( query, function(err, results, res) {
            if (err) {
                logger.error(err);
                response.json('',  {'X-OSDF-Error': err.error}, 500);
            }

            var hit_count = results['total'];
            logger.info("Got back " + hit_count + " search " + ((hit_count == 1) ? "result." : "results."));

            response.json(results, 200);
        });
    } catch (err) {
        logger.error(err);
        response.json('', {'X-OSDF-Error': err.error}, 500);
    }
}

exports.get_query_results = function (request, response) {
    logger.debug("In post_query.");
    response.json("Not implemented yet.", {'X-OSDF-Error': "Not implemented yet."}, 500);
}
