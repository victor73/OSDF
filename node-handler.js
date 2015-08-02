// lodash - for generic utility functions
// cradle - for interactions with CouchDB
// tv4 - Used for JSON validation with JSON-Schema
// async - For handling complicated async workflows

var util = require('util');
var _ = require('lodash');
var async = require('async');
var cradle = require('cradle');
var http = require('http');
var fs = require('fs');
var osdf_utils = require('osdf_utils');
var schema_utils = require('schema_utils');
var path = require('path');
var tv4 = require('tv4');
var config = require('config');
var perms = require('perms-handler');
var auth = require('auth_enforcer');
var sprintf = require('sprintf').sprintf;
var linkage_controller = require('linkage-controller');

var c = Config.get_instance(osdf_utils.get_config());

// Load some important configuration parameters.
var base_url = c.value('global', 'base_url');
var port = c.value('global', 'port');
var couch_address = c.value('global', 'couch_address');
var couch_port = c.value('global', 'couch_port');
var couch_user = c.value('global', 'couch_user');
var couch_pass = c.value('global', 'couch_pass');

var dbname = c.value('global', 'couch_dbname');

var logger = osdf_utils.get_logger();
var osdf_error = osdf_utils.send_error;

// An array to hold the namespaces.
var namespaces = [];
var validators = {};
var working_dir;
var db;

// This initializes the handler. The things we need to do before the
// handler is ready to begin its work are: establish a connection to the
// CouchDB server, determine what the installed namespaces are, and create
// the various validators for each of the node types inside each namespace.
exports.init = function(emitter, working_dir_custom) {
    logger.debug("In " + path.basename(__filename) + " init().");

    working_dir = osdf_utils.get_working_dir();

    logger.info("Creating couchdb connection. Using db: " + dbname);

    // Establish the connection parameters, including the application's
    // CouchDB credentials.
    var couch_conn = new(cradle.Connection)('http://' + couch_address, couch_port, {
        auth: { username: couch_user, password: couch_pass },
        cache: false,
        raw: false
    });

    // Create the CouchDB connection using the configured database name.
    db = couch_conn.database(dbname);
    db.exists( function(err, exists) {
        // Here we emit the error to abort the server startup process.
        if (err) {
            msg = sprintf("Error connecting to CouchDB database at %s:%s. " +
                          "Check settings & credentials in %s.",
                  couch_address,
                  couch_port,
                  osdf_utils.get_config() );
            emitter.emit('node_handler_aborted', msg);
        }

        if (! exists) {
            emitter.emit('node_handler_aborted', "CouchDB database '" + dbname + "' doesn't exist.");
        }
    });

    async.waterfall([
        function(callback) {
            // The linkage controller needs its own ability to interact with CouchDB,
            // to validate nodes, so we give it the connection we established.
            linkage_controller.set_db_connection(db);

            osdf_utils.get_namespace_names(function(names) {
                logger.info("Namespaces: ", names);
                callback(null, names);
            });
        }, function(names, callback) {
            namespaces = names;
            populate_validators( function() {
                callback(null);
            });
        }, function(callback) {
            establish_linkage_controls( function(err) {
                if (err) {
                    logger.error(err);
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }], function (err) {
            if (err) {
                emitter.emit('node_handler_aborted', err);
            } else {
                emitter.emit('node_handler_initialized');
            }
        }
    );
};

// This function handles the deletion of nodes. We must check that the
// node exists and that the user has write permissions to it.
exports.delete_node = function(request, response) {
    logger.debug("In delete_node.");

    // Check that we actually have the id in the request...
    var node_id = null;

    if (request.hasOwnProperty('params') && request.params.hasOwnProperty('id')) {
        node_id = request.params.id;
    } else {
        var msg = "No node ID provided.";
        logger.error(msg);
        throw msg;
    }

    try {
        // Check if this node has other nodes pointing to it.
        has_dependent_nodes(node_id, function(err, has_dependencies) {
            if (err) {
                logger.error(err);
                throw err;
            }

            if (has_dependencies) {
                osdf_error(response, "Node has dependencies on it.", 409);
            } else {
                logger.debug("No dependencies, so clear to delete.");
                // Get the user that is making the deletion request.
                var user = auth.get_user(request);
                delete_helper(user, node_id, response);
            }
        });
    } catch (e) {
        osdf_error(response, "Unable to delete node.", 500);
    }
};

// This is the method that handles node retrieval. It is called when users HTTP
// GET the node.
exports.get_node = function (request, response) {
    logger.debug("In get_node.");

    db.get(request.params.id, function(err, node_data) {
        node_retrieval_helper(request, response, err, node_data);
    });
};

// This is the method that handles node retrieval by version number. It is
// called when users HTTP GET the node and supply a specific version number in
// the url.
exports.get_node_by_version = function (request, response) {
    logger.debug("In get_node_by_version.");

    var node_id = request.params.id;
    var requested_version = parseInt(request.params.ver, 10);

    if (requested_version <= 0) {
        logger.warn("User asked for invalid version number of node.");
        osdf_error(response, "Invalid version number.", 422);
    } else if ( isNaN(requested_version) ) {
        logger.warn("User didn't provide a valid number for the version number.");
        osdf_error(response, "Invalid version number.", 422);
    } else {
        var version = request.params.ver.toString();
        var stream = db.getAttachment(node_id + "_hist", version);
        var data = "";

        stream.on('data', function(chunk) {
            data += chunk;
        });

        stream.on('end', function() {
            logger.debug("CouchDB request for attachment complete.");
            var couch_response = null;
            try {
                couch_response = JSON.parse(data);
            } catch (err) {
                logger.error(err, data);
            }

            if (couch_response === null) {
                osdf_error(response, "Unable to retrieve node version.", 422);
            } else {
                logger.info("Got a valid CouchDB response.");

                if (couch_response.hasOwnProperty("error")) {
                    logger.info("CouchDB response indicated an error occurred.");

                    get_couch_doc(node_id, function(err, current_node) {
                        if (err) {
                            logger.error(err);
                            osdf_error(response, "Unable to retrieve node.", 500);
                        } else {
                            var current_node_version = parse_version(current_node['_rev']);

                            // The user may be using this method to get the current version.
                            // They 'should' use the regular node retrieval method, but here
                            // they are using the 'by version' method to get the current
                            // version.
                            if (requested_version === current_node_version) {
                                response.jsonp(osdf_utils.fix_keys(current_node));
                            } else {
                                osdf_error(response, "Unable to retrieve node version.", 404);
                            }
                        }
                    });
                } else {
                    response.jsonp(couch_response);
                }
            }
            return;
        });
    }
};

// Retrieve the nodes that a particular node links to
exports.get_out_linkage = function(request, response) {
    logger.debug("In get_linkage.");

    // Check that we actually have the id in the request...
    var node_id = null;

    if (request.hasOwnProperty('params') && request.params.hasOwnProperty('id')) {
        node_id = request.params.id;
    } else {
        var msg = "No node ID provided.";
        logger.error(msg);
        throw msg;
    }

    try {
        // This needs to query a view, not issue N queries...
        db.view('linkage/out',
            {include_docs: true, startkey: [node_id], endkey:[node_id, {}]},
            function(err, results) {
            if (err) {
                logger.error(err);
                throw err;
            }

            // The first entry is the node itself. Subsequent elements in the
            // array are the nodes that we are linking to
            results.shift();

            // Remove duplicates. A node can actually link to other nodes
            // multiple times, but the API says we only report it once.
            var seen_list = [];

            logger.debug("Filtering duplicates from the result list.");
            var filtered = _.select(results, function(result) {
                if ( _.include(seen_list, result['doc']['_id'])) {
                    return false;
                } else {
                    seen_list.push( result['doc']['_id'] );
                    return true;
                }
            });

            // Move the structure up a level.
            filtered = _.map(filtered, function(filtered_result) {
                return filtered_result['doc'];
            });

            // Fix the couch docs to look like an OSDF doc
            filtered = _.map(filtered, function(filtered_result) {
                return osdf_utils.fix_keys(filtered_result);
            });

            // Exclude nodes that we do not have read permission for
            var user = auth.get_user(request);
            filtered = _.select(filtered, function(node) {
                return perms.has_read_permission(user, node);
            });

            // Assemble the final document for transmission
            var report = { "result_count": filtered.length,
                           "page": 1,
                           "results": []
                         };

            _.each(filtered, function(filtered_result) {
                report['results'].push( filtered_result );
            });

            response.jsonp(report);
        });
    } catch (e) {
        logger.error(e);
        osdf_error(response, 'Unable to retrieve node linkages.', 500);
    }
};

// Retrieve the nodes that point to this node.
exports.get_in_linkage = function(request, response) {
    logger.debug("In get_in_linkage.");

    // Check that we actually have the id in the request...
    var node_id = request.params.id;
    if (node_id === null || node_id === "") {
        osdf_error(response, 'Invalid or missing node id.', 422);
        return;
    }

    try {
        // This needs to query a view, not issue N queries...
        db.view('linkage/in', {include_docs: true, key: node_id}, function(err, results) {
            if (err) {
                logger.error(err);
                throw err;
            }

            // Remove duplicates. A node can actually link to other nodes multiple times, but
            // the API says we only report it once.
            var seen_list = [];

            logger.debug("Filtering duplicates from the result list.");
            var filtered = _.select(results, function(result) {
                if ( _.include(seen_list, result['doc']['_id'])) {
                    return false;
                } else {
                    seen_list.push( result['doc']['_id'] );
                    return true;
                }
            });

            // Move the structure up a level.
            filtered = _.map(filtered, function(filtered_result) {
                return filtered_result['doc'];
            });

            // Fix the CouchDB doc to look like an OSDF doc
            filtered = _.map(filtered, function(filtered_result) {
                return osdf_utils.fix_keys(filtered_result);
            });

            // Exclude nodes that we do not have read permission for
            var user = auth.get_user(request);
            filtered = _.select(filtered, function(node) {
                return perms.has_read_permission(user, node);
            });

            // Assemble the final document for transmission
            var report = { "result_count": filtered.length,
                           "page": 1,
                           "results": []
                         };

            _.each(filtered, function(filtered_result) {
                report['results'].push( filtered_result );
            });

            response.jsonp(report);
        });
    } catch (e) {
        logger.error(e);
        osdf_error(response, 'Unable to retrieve node linkages.', 500);
    }
};

// This is the method that handles node creation.
exports.insert_node = function (request, response) {
    logger.debug("In insert_node.");

    var content = request.rawBody;

    async.waterfall([
        function(callback) {
            try {
                var node_data = JSON.parse(content);
                callback(null, node_data);
            } catch (err) {
                callback({err: "Invalid JSON data.", code: 422}, null);
            }
        },
        function(node_data, callback) {
            validate_incoming_node(content, function(err, report) {
                if (err) {
                    logger.error(err);
                    callback({err: err, code: 422});
                } else {
                    callback(null, report, node_data);
                }
            });
        },
        function(report, node_data, callback) {
            if (successful_validation_report(report)) {
                logger.info("Node validated properly.");
                callback(null, node_data);
            } else {
                if (report !== null && report.errors !== null && report.errors.length > 0) {
                    var first_err = report.errors[0];
                    logger.info("Node does not validate. Error: " + first_err);
                    callback({err: first_err, code: 422});
                } else {
                    callback({err: "Node does not validate.", code: 422});
                }
            }
        },
        function(node_data, callback) {
            logger.debug("Saving node to CouchDB.");
            db.save(node_data, function(err, couch_response) {
                if (err) {
                    logger.error(err);
                    callback(err);
                } else {
                    logger.debug("Successfully saved node to CouchDB.");
                    callback(null, couch_response, node_data);
                }
            });
        }, function(couch_response, node_data, callback) {
            var node_id = couch_response.id;

            if (couch_response.ok === true) {
                // Save the history
                node_data['id'] = node_id;
                node_data['ver'] = 1;
                save_history(node_id, node_data, function(err) {
                    if (err) {
                        logger.error(err);
                        callback({err: err, code: 500});
                    } else {
                        var node_url = base_url + ':' + port + '/nodes/' + node_id;
                        callback(null, node_url);
                    }
                });
            } else {
                // This shouldn't happen, but...
                logger.error("No error, but CouchDB response was not 'ok'.");
                callback({err: "Unable to save data.", code: 500});
            }
        }],
        function (err, node_url) {
            if (err) {
                if (_.isPlainObject(err) && err.hasOwnProperty('err') &&
                    err.hasOwnProperty('code')) {
                   osdf_error(response, err['err'], err['code']);
                } else {
                    logger.error(err);
                    osdf_error(response, "Unable to save node.", 500);
                }
            } else {
                logger.info("Successful insertion: " + node_url);
                response.location(node_url);
                response.status(201).send('');
            }
        }
    );
};

// This is the function that handles edits/modifications to nodes.
exports.update_node = function(request, response) {
    logger.debug("In update_node.");

    var node_id = request.params.id;
    var content = request.rawBody;

    async.waterfall([
        function(callback) {
            // Check that we have been provided valid JSON
            try {
                var node_data = JSON.parse(content);
                callback(null, node_data);
            } catch (err) {
                callback({err: "Invalid JSON data.", code: 422}, null);
            }
        },
        function(node_data, callback) {
            // Check that the version has been supplied.
            if (node_data !== null && node_data.hasOwnProperty("ver")) {
                callback(null, node_data);
            } else {
                callback({err: "Incoming node data does not supply the node version.",
                          code: 422 });
            }
        },
        function(node_data, callback) {
            validate_incoming_node(content, function(err, report) {
                if (err) {
                    callback({err: err, code: 422});
                } else {
                    callback(null, report, node_data);
                }
            });
        },
        function(report, node_data, callback) {
            if (successful_validation_report(report)) {
                logger.info("Node validated properly.");
                callback(null, node_data);
            } else {
                if (report !== null && report.errors !== null && report.errors.length > 0) {
                    var first_err = report.errors[0];
                    logger.info("Node does not validate. Error: " + first_err);
                    callback({err: first_err, code: 422});
                } else {
                    callback({err: "Node does not validate.", code: 422});
                }
            }
        },
        function(node_data, callback) {
            // If here, then we're okay to attempt the update
            update_node_helper(node_id, node_data, function(err, update_result) {
                if (err) {
                    logger.error("Unable to update data in CouchDB.", err);
                    var msg = update_result['msg'];
                    var code = update_result['code'];
                    callback({'err': msg, 'code': code});
                } else {
                    callback(null);
                }
            });
        }],
        function(err) {
            if (err) {
                if (_.isPlainObject(err) && err.hasOwnProperty('err') &&
                    err.hasOwnProperty('code')) {
                   osdf_error(response, err['err'], err['code']);
                } else {
                    logger.error(err);
                    osdf_error(response, "Unable to update node.", 500);
                }
            } else {
                logger.info("Successful update for node id: " + node_id);
                response.status(200).send('');
            }
        }
    );
};

// Just validate a node against a schema if it has one
// assigned for the specified node_type. If it does NOT
// then then only a check for well-formedness and basic
// OSDF structure is performed.
exports.validate_node = function(request, response) {
    logger.debug("In validate_node.");

    var content = request.rawBody;

    var report; // To hold the results of validation

    async.waterfall([
        function(callback) {
            try {
                var node_data = JSON.parse(content);
                callback(null, node_data);
            } catch (err) {
                callback({err: "Invalid JSON provided.", code: 422 });
            }
        },
        function(node_data, callback) {
            validate_incoming_node(content, function(err, report) {
            //validate_incoming_node(node_data, function(err, report) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, report);
                }
            });
        },
        function(report, callback) {
            if (successful_validation_report(report)) {
                // If here, then we're valid
                logger.info("Detected a valid node.");
                callback(null);
            } else {
                var first_err = report.errors[0];

                logger.info("Invalid node. First error: ", first_err);

                var error_text = "";
                for (var errIdx = 0; errIdx < report.errors.length; errIdx++) {
                    var err = report.errors[errIdx];
                    error_text = error_text.concat( err + "\n" );
                }
                error_text = error_text.trim() + "\n";

                var err_object = { err: first_err,
                                   code: 422,
                                   content: error_text
                                 };
                callback(err_object);
            }
        }],
        function(err, result) {
            if (err) {
                // If here, then it's because the node data didn't validate
                // or some other problem occurred.
                if (_.isPlainObject(err) && err.hasOwnProperty('err') &&
                    err.hasOwnProperty('code')) {
                    // Here we do not simply use the osdf_error() function because
                    // we actually want to list all the error messages without the
                    // user having to inspect HTTP headers. The first error message
                    // will still be in the headers though...
                    response.set('X-OSDF-Error', err['err']);
                    response.status(err['code']);

                    if (err.hasOwnProperty('content')) {
                        response.send(err['content']);
                    } else {
                        response.send('');
                    }
                } else {
                    osdf_error(response, "Could not validate node.", 500);
                }
            } else {
                logger.debug("Valid node detected.");
                response.status(200).send('');
            }
        }
    );
};

// This message is used to process auxiliary schema deletion events
// that are relayed to this process from the master process by worker.js.
exports.process_aux_schema_change = function (msg) {
    logger.debug("In process_aux_schema_change.");

    var aux_schema_json;

    if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'aux_schema_change') {
        var namespace = msg['ns'];
        var aux_schema_name = msg['name'];

        if (msg.hasOwnProperty('type') && msg['type'] === 'insertion') {
            logger.debug("Got an auxiliary schema insertion.");
            aux_schema_json = msg['json'];
            insert_aux_schema_helper(namespace, aux_schema_name, aux_schema_json);
        } else if (msg.hasOwnProperty('type') && msg['type'] === 'update') {
            logger.debug("Got an auxiliary schema update.");
            aux_schema_json = msg['json'];
            update_aux_schema_helper(namespace, aux_schema_name, aux_schema_json);
        } else if (msg.hasOwnProperty('type') && msg['type'] === 'deletion') {
            logger.debug("Got an auxiliary schema deletion.");
            delete_aux_schema_helper(namespace, aux_schema_name);
        }
    }
};

// This message is used to process schema deletion events that are relayed to
// this process from the master process by worker.js.
exports.process_schema_change = function (msg) {
    logger.debug("In process_schema_change.");

    if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'schema_change') {
        var namespace = msg['ns'];
        var schema_name = msg['name'];

        if (msg.hasOwnProperty('type') && msg['type'] === 'insertion') {
            var json = msg['json'];
            insert_schema_helper(namespace, schema_name, json);
        } else if (msg.hasOwnProperty('type') && msg['type'] === 'deletion') {
            delete_schema_helper(namespace, schema_name);
        }
    }
};

// Validates the data presented based on the json-schema of the node type.
// Returns a report with validation results, or throws an exception if we
// are unable to get that far, for instance, if the content can't be parsed
// into a JSON data structure.
function validate_incoming_node(node_string, callback) {
    logger.debug("In validate_incoming_node.");

    var node;

    if (typeof node_string === 'string') {
        try {
            node = JSON.parse(node_string);
        } catch (e) {
            var msg = 'Unable to parse content into JSON.';
            logger.debug(msg);
            callback(msg, null);
            return;
        }
    }

    // Do a rudimentary check for whether the JSON document has the required keys.
    if (! node.ns || ! node.acl || ! node.node_type || ! node.meta || ! node.linkage ) {
        var msg = "Node JSON does not possess the correct structure.";
        logger.debug(msg);
        callback(msg, null);
        return;
    }

    if (! (node.acl.hasOwnProperty('read') && node.acl['read'] instanceof Array)) {
        var msg = "Node acl object doesn't have a correctly defined 'read' key.";
        logger.debug(msg);
        callback(msg, null);
        return;
    }

    if (! (node.acl.hasOwnProperty('write') && node.acl['write'] instanceof Array)) {
        var msg = "Node acl object doesn't have a correctly defined 'write' key.";
        logger.debug(msg);
        callback(msg, null);
        return;
    }

    async.waterfall([
        function(callback) {
            var errors = [];
            if (! osdf_utils.contains(node.ns, namespaces)) {
                var msg = "Node belongs to an unrecognized namespace.";
                logger.error(msg);
                errors.push(msg);
            }
            callback(null, errors);
        },
        function(errors, callback) {
            // Check if the linkages look okay...
            linkage_controller.valid_linkage(node, function(err, valid) {
                if (err) {
                    logger.error("Error when checking for linkage validity: " + err);
                    callback("Unable to check linkage validity.");
                } else {
                    if (! valid) {
                        errors.push("Invalid linkage detected for node.");
                    }

                    callback(null, errors, valid);
                }
            });
        },
        function(errors, linkage_validity, callback) {
            logger.debug("Linkage validity: " + linkage_validity);

            var report = null;

            if ( validators.hasOwnProperty(node.ns) &&
                     validators[node.ns].hasOwnProperty(node.node_type) ) {
                // Look up the schema for this node type from our validators
                // data structure.
                var schema = validators[node.ns][node.node_type]['schema'];

                // So, we don't validate the whole node against the JSON schema,
                // just the 'meta' portion.
                var meta = node['meta'];

                // And validate...
                var tv4 = validators[node.ns]['val'];

                var result = tv4.validateMultiple(meta, schema);

                _.each(result.errors, function(validation_error) {
                    var err_msg = validation_error.message + " on path " +
                                  validation_error.dataPath;
                    errors.push(err_msg);
                });

                // We have to consider BOTH linkage validity AND JSON-Schema
                // validity
                var combined_validity = linkage_validity && result.valid;

                report = { valid: combined_validity,
                           errors: errors };
            } else {
                logger.debug("No validator found for namespace/node_type of " +
                            node.ns + "/" + node.node_type + ".");

                // Since there is no JSON-Schema validation to check, the only
                // validity to consider at this point is the linkage validity.
                report = { valid: linkage_validity,
                           errors: errors };
            }

            callback(null, report);
        }], function (err, report) {
            if (err) {
                logger.error(err);
                callback(err, null);
            } else {
                callback(null, report);
            }
        }
    );
}

// A function to parse the version of a CouchDB document out
// from its native CouchDB representation as a string to a
// numeric form.
// Parameters: CouchDB (string)
// Returns: int
function parse_version(couchdb_version) {
    logger.debug("In parse_version.");

    if (couchdb_version === null) {
        throw "Invalid CouchDB version provided.";
    }
    var couchdb_version_int = parseInt(couchdb_version.split('-')[0], 10);
    return couchdb_version_int;
}

function get_node_version(node_id, callback) {
    logger.debug("In get_node_version.");

    db.get(node_id, function(err, data) {
        if (err) {
            callback("Unable to retrieve node operation.", null);
        } else {
            var couchdb_version = data['_rev'];
            var version = parse_version(couchdb_version);
            callback(null, version);
        }
    });
}

// Simple function to retrieve a document from CouchDB backing database It then
// calls the user provided callback with an error flag, and the document which
// is null if an error was encountered.
// Parameters: couchdb_id (string), callback (function)
// Returns: none
function get_couch_doc(couchdb_id, callback) {
    logger.debug("In get_couch_doc.");

    db.get(couchdb_id, function(err, data) {
        if (err) {
            callback("Unable to retrieve CouchDB doc.", null);
        } else {
            callback(null, data);
        }
    });
}

function update_node_helper(node_id, node_data, callback) {
    logger.debug("In update_node_helper.");

    var node_version = node_data.ver;
    var result = {};  // What we will send back through the callback

    async.waterfall([
        function(callback) {
            get_couch_doc(node_id, function(err, data) {
                if (err) {
                    result['msg'] = "Unable to perform update operation.";
                    result['code'] = 500;

                    // This should stop the waterfall...
                    callback(err);
                } else {
                    callback(null, data);
                }
            });
        },
        function(data, callback) {
            var previous_node = data;
            var couchdb_version = previous_node['_rev'];
            var version = parse_version(couchdb_version);

            if ( node_version !== version ) {
                var msg = "Version provided (" + node_version + ") doesn't match " +
                          "saved (" + version + ").";

                result['msg'] = msg;
                result['code'] = 422;

                // This should stop the waterfall...
                callback(msg);
            } else {
                callback(null, previous_node, couchdb_version);
            }
        },
        function(previous_node, couchdb_version, callback) {
            node_data['ver'] = node_data['ver']++;

            // Okay to proceed with the update because the versions match
            db.save(node_id, couchdb_version, node_data, function(err, couch_response) {
                if (err) {
                    result['msg'] = err.error;
                    result['code'] = 500;

                    callback(err);
                }

                if (! couch_response.ok) {
                    result['msg'] =  "Unable to save node data.";
                    result['code'] = 500;

                    callback(result['msg']);
                }

                logger.info("Successful update for node id: " + node_id);
                callback(null, previous_node);
            });
        },
        function(previous_node, callback) {
            // Save the history
            logger.debug("Saving node history for node: " + node_id);

            previous_node = osdf_utils.fix_keys(previous_node);

            if (previous_node['ver'] !== 1) {
                save_history(node_id, previous_node, function(err) {
                    if (err) {
                        logger.error(err);

                         result['msg'] = err.error;
                         result['code'] = 500;

                         callback(err);
                    } else {
                         result['msg'] = '';
                         result['code'] = 200;

                         callback(null);
                    }
                });
            } else {
                result['msg'] = '';
                result['code'] = 200;

                callback(null);
            }
        }
    ], function(err) {
        // In both cases (failure and success) the caller is going to need
        // 'result' so we know what error code and message to return back
        // to the client.
        if (err) {
            callback(err, result);
        } else {
            callback(null, result);
        }
    });
}

function define_namespace_validators(namespace, define_cb) {
    logger.debug("In define_namespace_validators: " + namespace);
    var file_idx;

    var schema_registrar = function(callback) {
        var schema_dir = path.join(ns2working(namespace), 'schemas');

        // Scan the working area for the namespace for JSON schema files for the node_types.
        // Each .json file in there is basenamed with the name of the node_type.
        fs.readdir(schema_dir, function(err, files) {
            if (err) {
                throw err;
            }

            if (files.length === 0) {
                validators[namespace] = {};
                callback();
            } else {
                for (file_idx = 0; file_idx < files.length; file_idx++) {
                    var node_type_schema = files[file_idx];

                    if ( path.extname(node_type_schema) === '.json') {
                        logger.info("Found a schema! " + node_type_schema);

                        var node_type = path.basename(node_type_schema, '.json');

                        var data = fs.readFileSync(path.join(schema_dir, node_type_schema), 'utf-8');

                        if (! validators.hasOwnProperty(namespace)) {
                            validators[namespace] = {};
                        }

                        if (! validators[namespace].hasOwnProperty(node_type)) {
                            validators[namespace][node_type] = {};
                        }

                        try {
                            validators[namespace][node_type]['schema'] = JSON.parse(data);
                        } catch (e) {
                            logger.warn("ERROR: Unable to parse schema " +
                                        node_type_schema + " to JSON !!!");
                        }
                    }
                }
                callback();
            }
        });
    };

    var aux_schema_registrar = function(callback) {
        register_aux_schemas(namespace, function(err) {
            logger.info("Finished registering auxiliary schemas for: " + namespace);
            callback();
        });
    };

    async.series([
        function(callback) {
            schema_registrar(function() {
                callback(null);
            });
        }, function(callback) {
            aux_schema_registrar(function() {
                callback(null);
            });
        }], function(err, callback) {
            define_cb();
        }
    );
}

// This function is used to help out with the deletion of nodes once it has already
// been determined that the node is okay to be deleted because no nodes point to the
// target node with linkages.
// Parameters: user (string), the user requesting deletion
//             node_id (string), the id of the node being deleted
//             response (object), the http response object so response can be sent.
// Returns: none
function delete_helper(user, node_id, response) {
    logger.debug("In delete_helper.");

    db.get(node_id, function(err, node_data) {
        try {
            if (err) {
                if (err.error && err.error === "not_found") {
                    logger.info("User '" + user + "' attempted to delete unknown node: " + node_id);
                    osdf_error(response, 'Unknown node.', 422);
                } else {
                    throw err.reason;
                }
            } else {
                var can_write = perms.has_write_permission(user, node_data);

                if ( can_write ) {
                    delete_couch_doc(node_id, function(err) {
                        if (err) {
                            throw "Unable to delete node " + node_id;
                        } else {
                            delete_history_node(node_id, function(err) {
                                if (err) {
                                    logger.warn("Unable to delete history of node: " +
                                                node_id + ". " + err.message );
                                } else {
                                    logger.info("Successful deletion: " + node_id);
                                }
                                response.status(204).send('');
                            });
                        }
                    });
                } else {
                    logger.debug("User " + user + " cannot delete node " + node_id);
                    osdf_error(response, 'No ACL permissions to delete node.', 403);
                }
            }
        } catch (e) {
            logger.warn("Failed deletion.", e);
            response.status(500).send('');
        }
    });
}

function delete_history_node(node_id, callback) {
    logger.debug("In delete_history_node.");

    var history_node_id = node_id + "_hist";

    delete_couch_doc(node_id + "_hist", function(err) {
        if (err) {
            logger.error("Unable to delete history node for node: " + history_node_id);
            callback(err);
        } else {
            callback(null);
        }
    });
}

function delete_aux_schema_helper(namespace, aux_schema_name) {
    logger.debug("In node-handler:delete_aux_schema_helper.");

    if (! (validators.hasOwnProperty(namespace))) {
        logger.error("No such namespace: " + namespace);
    }
}

function delete_schema_helper(namespace, schema_name) {
    logger.debug("In node-handler:delete_schema_helper.");

    if (validators.hasOwnProperty(namespace) &&
            validators[namespace].hasOwnProperty(schema_name)) {
        logger.debug("Deleting schema " + schema_name + " from " +
                     namespace + " namespace.");
        delete validators[namespace][schema_name];
    } else {
        logger.error("The specified namespace or schema is not known.");
    }
}

// This is the function that is used to save the node data into
// the 'historical record' every time an update is made to it. The
// way we actually implement this is by saving the data as an
// attachment into a special CouchDB document that is paired with
// with the regular node document, but that has the sole purpose
// of holding the node's changes over time as attachments.
// Parameters: id (string) - The CouchDB document ID.
//             callback (function) - Called when complete with an error
//                                   argument. Null if operation was successful.
// Returns: none
function delete_couch_doc(id, callback) {
    logger.debug("In delete_couch_doc.");

    db.get(id, function(err, doc_data) {
        if (err) {
            logger.error("Unable to determine revision of id " + id + ". Can't delete.");
            callback(err);
        } else {
            var doc_revision = doc_data['_rev'];

            db.remove(id, doc_revision, function(err, res) {
                if (err) {
                    callback(err);
                } else {
                    logger.debug("Successful deletion of node: " + id);
                    callback(null);
                }
            });
        }
    });
}

// This function is used to determine if any nodes point to this node.
// We know what nodes we point to because they are listed in the linkage
// property of the object, but to determine what nodes point to us, we
// perform a query against a special view in the database. We also discount
// linkages of nodes against themselves. Those, if they exist, should not
// be counted as dependencies.
//
// Parameters: a node object, or node_id string
// Returns: a boolean
function has_dependent_nodes(node, callback) {
    logger.debug("In has_dependent_nodes.");

    var node_id;
    if (typeof(node) === "object" && node.hasOwnProperty('id') &&
            node.hasOwnProperty('linkage') && node.hasOwnProperty('meta')) {
        node_id = node['id'];
    } else if (typeof(node) === "string") {
        node_id = node;
    } else {
        throw "Invalid argument.";
    }
    logger.debug("Checking " + node_id + " for dependencies.");

    var has_dependencies = false;

    // Query the specially created view using cradle.
    db.view('linkage/reverse', {key: node_id}, function(err, response) {
        if (err) {
            callback(err, null);
        }

        // Remove any reference to ourselves from consideration
        response = _.reject(response, function(row) {
            return row['id'] === node_id;
        });

        var row_count = response.length;
        if (row_count > 0) {
            logger.debug("Found dependencies for " + node_id);
            has_dependencies = true;
        }
        callback(null, has_dependencies);
    });
}

// TODO: Investigate whether tv4 overwrites the previous notion it had
// for that auxiliary schema. This code assumes that it does.
function update_aux_schema_helper(namespace, name, aux_schema_json) {
    logger.debug("In node-handler:update_aux_schema_helper.");

    logger.debug("Type of aux schema provided: " + typeof(aux_schema_json));

    if (validators.hasOwnProperty(namespace)) {
        var tv4 = validators[namespace]['val'];
        load_aux_schema_into_validator_from_json(tv4, name, aux_schema_json, function (err) {
            if (err) {
                logger.error("Unable to load aux schema: " + err);
            }
            return;
        });
    } else {
        logger.error("No such namespace: " + namespace);
    }
}

function insert_aux_schema_helper(namespace, name, aux_schema_json) {
    logger.debug("In node-handler:insert_aux_schema_helper.");

    logger.debug("Type of aux schema provided: " + typeof(aux_schema_json));

    if (validators.hasOwnProperty(namespace)) {
        var tv4 = validators[namespace]['val'];
        load_aux_schema_into_validator_from_json(tv4, name, aux_schema_json, function (err) {
            if (err) {
                logger.error("Unable to load aux schema: " + err);
            }
            return;
        });
    } else {
        logger.error("No such namespace: " + namespace);
    }
}

function insert_schema_helper(namespace, name, schema_json) {
    logger.debug("In node-handler:insert_schema_helper.");

    if (validators.hasOwnProperty(namespace)) {
        var tv4 = validators[namespace]['val'];
        try {
            tv4.addSchema(name, schema_json);
        } catch (err) {
            logger.error("Unable to load schema: " + err);
        }
    } else {
        logger.error("No such namespace: " + namespace);
    }
}

function load_aux_schema_into_validator(tv4, schema, callback) {
    logger.debug("In load_aux_schema_into_validator: " + schema);
    var basename = path.basename(schema, '.json');

    fs.readFile(schema, 'utf-8',
        function(err, data) {
            if (err) {
                logger.error("Missing or invalid schema found for " + schema );
                callback(err);
            } else {
                logger.debug("Registering schema '" + schema + "' with id '" + basename + "'");
                tv4.addSchema(basename, JSON.parse(data));
                callback(null);
            }
        }
    );
}

function load_aux_schema_into_validator_from_json(tv4, name, aux_schema_json, callback) {
    logger.debug("In load_aux_schema_into_validator_from_json. Aux schema name: " + name);

    var json_type = typeof(aux_schema_json);
    try {
        if (json_type === "object") {
            tv4.addSchema(name, aux_schema_json);
        } else if (json_type === "string") {
            tv4.addSchema(name, JSON.parse(aux_schema_json));
            callback(null);
        } else {
            callback("Invalid data type for auxiliary schema.");
        }
    } catch (err) {
        callback(err);
    }
}

function load_aux_schemas_into_validator(ns, tv4, schemas, then) {
    logger.debug("In load_aux_schemas_into_validator.");
    var loaded = {};
    recursive_load_helper(ns, tv4, schemas, loaded, then);
}

function locate_aux_schema_by_name(ns, aux_schema_name) {
    return path.join(working_dir, 'namespaces', ns, 'aux', aux_schema_name + '.json');
}

function locate_aux_schema_source(ns, aux_schema) {
    return path.join(working_dir, 'namespaces', ns, 'aux', aux_schema);
}

// Given a namespace name (string), return the location on the filesystem
// where the namespace's working directory is.
// Parameters: namespace (string)
// Returns: path (string)
function ns2working(namespace) {
    var location = path.join(working_dir, 'namespaces', namespace);
    return location;
}

// A utility function to establish the various JSON-Schema validator objects
// for each of the namespaces that we know about. This all happens
// asynchronously, so the argument to the function is a callback for client
// code to know when the process is complete.
// Parameters: populate_callback (function)
// Returns: none
function populate_validators(populate_callback) {
    logger.debug("In populate_validators.");

    osdf_utils.async_for_each(namespaces, function(ns, cb) {
        logger.info("Creating validators for namespace: " + ns);
        define_namespace_validators(ns, function() {
            cb();
        });
    }, function() {
        populate_callback();
    });
}

function establish_linkage_controls(callback) {
    logger.debug("In establish_linkage_controls.");

    osdf_utils.async_for_each(namespaces, function(ns, cb) {
        logger.info("Checking namespace " + ns + " for linkage.json file.");
        var linkage_path = path.join(ns2working(ns), "linkage.json");
        logger.debug("Path to linkage.json: " + linkage_path);

        fs.stat(linkage_path, function(err, stat) {
            if (err === null) {
                logger.info("Linkage control file exists for namespace " + ns + ".");

                fs.readFile(linkage_path, 'utf8', function(err, file_text) {
                    if (err) {
                        logger.error(err);
                        callback(err);
                    }

                    var linkage_json;

                    try {
                        linkage_json = JSON.parse(file_text);
                    } catch (parse_err) {
                        var msg = "Unable to parse linkage control file for namespace " + ns + "!";
                        logger.error(msg);
                        callback(msg);
                    }

                    logger.debug("Successfully parsed linkage control file for namespace " + ns + ".");
                    linkage_controller.set_namespace_linkages(ns, linkage_json);
                    cb();
                });
            } else {
                logger.info("No linkage control for namespace " + ns + ".");
                cb();
            }
        });
    }, function() {
        callback();
    });
}

// Recursively load all the auxiliary schemas belonging to a namespace
// into the provided JSON-Schema validator in order to be able to validate incoming
// nodes for compliance.
// Parameters
// ns: The string namespace name
// tv4: The tv4 validator. Each namespace has one.
// schemas: An array of schema files to load, each may contain references to other schemas
// then: a callback that is called when the loading is complete
function recursive_load_helper(ns, tv4, schemas, loaded, then) {
    osdf_utils.async_for_each(schemas, function(schema, cb) {
        var schema_src  = locate_aux_schema_source(ns, schema);

        fs.stat(schema_src, function(err, stats) {
            if (err) {
                logger.debug("Error examining " + schema_src + ": ", err);
                cb();
                return;
            }

            if (stats.isDirectory()) {
                logger.warn("Skipping directory: " + schema_src);
                cb();
            } else {
                var schema_id = path.basename(schema, '.json');

                fs.readFile( schema_src, function(err, data) {
                    if (err) {
                        logger.error(err);
                        throw err;
                    }

                    var schemaJson, reference_ids;
                    try {
                        schemaJson = JSON.parse(data);
                        reference_ids = schema_utils.extractRefNames(schemaJson);
                    } catch (e) {
                        logger.warn("Unable to extract references from " + schema_src );
                        cb();
                        return;
                    }

                    var reference_schemas = [];
                    var refIdx;
                    for (refIdx = 0; refIdx < reference_ids.length; refIdx++) {
                        var schema_file = reference_ids[refIdx] + ".json";
                        reference_schemas.push(schema_file);
                    }

                    // Call ourselves and pass along the list of schemas that we have
                    // already loaded.
                    recursive_load_helper(ns, tv4, reference_schemas, loaded, function() {
                        if (loaded.hasOwnProperty(schema_id)) {
                            logger.debug("Already loaded " + schema_id);
                            cb();
                        } else {
                            load_aux_schema_into_validator(tv4, schema_src, cb);
                            // Make a note that we loaded this one already
                            loaded[schema_id] = 1;
                        }
                    });

                });
            }
        });

    }, then);
}

function register_aux_schemas(ns, callback) {
    logger.debug("In register_aux_schemas.");

    var validator = tv4.freshApi();
    register_aux_schemas_to_validator(validator, ns, function(err) {
        if (err) {
            throw new Error(err);
        }
        validators[ns]['val'] = validator;
        callback();
    });
}

function register_aux_schemas_to_validator(tv4, ns, then) {
    logger.debug("In register_aux_schemas_to_validator.");

    async.waterfall([
        function(callback) {
            var aux_dir = path.join(working_dir, 'namespaces', ns, 'aux');
            // Scan the files contained in the directory and process them
            fs.readdir(aux_dir, function(err, files) {
                if (err) {
                    logger.error(err);
                    callback(err);
                } else {
                    callback(null, files);
                }
            });
        },
        function(files, callback) {
            load_aux_schemas_into_validator(ns, tv4, files, function() {
                callback(null);
            });
        }], function(err, results) {
            then(err);
        }
    );
}

function node_retrieval_helper(request, response, err, data) {
    logger.debug("In node_retrieval_helper.");

    if (err) {
        if (err.error === 'not_found') {
            logger.debug("User requested non-existent node.");
            osdf_error(response, 'Non-existent node.', 404);
        } else {
            logger.error(err);
            osdf_error(response, err.error, 500);
        }
    } else {
        var user = auth.get_user(request);
        if (perms.has_read_permission(user, data)) {
            var fix = osdf_utils.fix_keys(data);
            response.jsonp(fix);
        } else {
            logger.info("User does not have read permissions for node.");
            osdf_error(response, 'No read access to this node.', 403);
        }
    }
}

// This is the function that is used to save the node data into
// the 'historical record' every time an update is made to it. The
// way we actually implement this is by saving the data as an
// attachment into a special CouchDB document that is paired with
// with the regular node document, but that has the sole purpose
// of holding the node's changes over time as attachments.
// Parameters: node_id (string)
//             node_data (string) - In JSON format
//             callback (function) - Called when complete
// Returns: none
function save_history(node_id, node_data, callback) {
    logger.debug("In save_history.");
    var version = node_data['ver'];

    var attachment = { contentType: 'application/json',
                       name: version.toString(),
                       body: JSON.stringify(node_data),
                     };

    try {
        if (version === 1) {
            // This is the first time this node is being edited/changed
            db.save(node_id + "_hist", {}, function(err, data) {
                if (err) {
                    logger.error(err);
                    throw err;
                }

                var first_hist_version = data['_rev'];

                var doc = { id: node_id + "_hist",
                            rev: first_hist_version
                          };

                // Save the data as an attachment into CouchDB...
                db.saveAttachment(doc, attachment, function(err, data) {
                    if (err) {
                        logger.error(err);
                        throw err;
                    }
                    logger.debug("Saved first history for node " + node_id + ".");
                    callback(null);
                });
            });
        } else {
            // This is not the first change/edit to this node...
            db.get(node_id + "_hist", function(err, hist_node) {
                if (err) {
                    logger.error(err);
                    throw err;
                }

                var doc = { id: node_id + "_hist",
                            rev: hist_node['_rev']
                          };

                // Save the data as an attachment into CouchDB...
                db.saveAttachment(doc, attachment, function(err, data) {
                    if (err) {
                        logger.error(err);
                        throw err;
                    }

                    logger.debug("Saved history for node " + node_id + ".");
                    callback(null);
                });
            });
        }
    } catch (err) {
        callback(err);
    }
}

function validate_against_schema(data) {
    logger.debug("In validate_against_schema.");

    // TODO: More validation
    var ns = data.ns;
    var node_type = data.node_type;

    var tv4 = validators[ns]['val'];
    var schema = validators[ns][node_type]['schema'];
    var valid = tv4.validate(data, schema);

    var report = { valid: valid,
                   errors:  [ tv4.error ] };

    return report;
}

function successful_validation_report(report) {
    logger.debug("In successful_validation_report.");

    // Assume it's not valid until proven otherwise
    var valid = false;

    if (report !== null && (report.valid &&
            (report.errors === null || report.errors.length === 0))) {
        valid = true;
    }

    return valid;
}
