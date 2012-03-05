// cradle - for interactions with CouchDB
// JSV - Used for JSON validation with JSON-Schema
// clone - For creating deep copies of data structures

var _ = require('underscore');
var cradle = require('cradle');
var http = require('http');
var fs = require('fs');
var osdf_utils = require('osdf_utils');
var path = require('path');
var clone = require('clone');
var JSV = require('./node_modules/JSV/jsv').JSV;
var config = require('config');
var flow = require('flow');
var perms = require('perms-handler');
var auth = require('auth_enforcer');

var c = Config.get_instance(osdf_utils.get_config());

// Load some important configuration parameters.
var base_url = c.value('global', 'base_url');
var port = c.value('global', 'port');
var couch_address = c.value('global', 'couch_address');
var couch_port = c.value('global', 'couch_port');
var couch_user = c.value('global', 'couch_user');
var couch_pass = c.value('global', 'couch_pass');

var dbname = c.value('global', 'dbname');

var root_local_dir = osdf_utils.get_osdf_root();
var logger = osdf_utils.get_logger();

// An array to hold the namespaces.
var namespaces = [];
var validators = {};
var db;

// This initializes the handler. The things we need to do before the
// handler is ready to begin its work are: establish a connection to the
// CouchDB server, determine what the installed namespaces are, and create
// the various validators for each of the node types inside each namespace. 
exports.init = function(emitter) {
    logger.debug("In " + path.basename(__filename) + " init().");

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

    // We want to be notified whenever a schema is deleted so that we can
    // adjust our validators data structure by removing the corresponding
    // validator from their as well.
    var schema_handler = require('schema-handler');

    schema_handler.on("delete_schema", function (data) {
        logger.debug("Got a schema deletion event: ", data);
        delete_schema_helper(data['ns'], data['schema']);
    });

    osdf_utils.get_namespace_names( function(names) {
        namespaces = names;
        logger.info("Namespaces: ", namespaces);

        // Setup all the JSON validators for the namespaces and their node types.
        // Then, send a notificatino that we have completed initialization and
        // are ready to begin working.
        populate_validators( function() {
            emitter.emit('node_handler_initialized');
        });
    });
};

// This is the method that handles node retrieval. It is
// called when users HTTP GET the node.
exports.get_node = function (request, response) {
    logger.debug("In get_node.");
    
    db.get(request.params.id, function(err, node_data) {
        retrieval_helper(request, response, err, node_data);
    });
};

// This is the method that handles node retrieval. It is
// called when users HTTP GET the node.
exports.get_node_by_version = function (request, response) {
    logger.debug("In get_node_by_version.");
    
    var node_id = request.params.id;
    var requested_version = parseInt(request.params.ver, 10);

    if (requested_version <= 0) {
        logger.warn("User ask for invalid version number of node: " + node_id);
        response.send('', {'X-OSDF-Error': "Invalid version number." }, 422);
    } else {
        var version = request.params.ver.toString();
        var stream = db.getAttachment(request.params.id + "_hist", version);

        stream.on('data', function(chunk) {
            return response.write(chunk, "binary");
        });
        stream.on('end', function() {
            return response.end();
        });
    }
};

// This is the method that handles node creation.
exports.insert_node = function (request, response) {
    logger.debug("In insert_node.");
    var content = request.rawBody;
    var report;  // To hold the results of validation

    try {
        report = validate_incoming_node(content);
    } catch (report_err) {
        logger.error(report_err);
        response.send('', {'X-OSDF-Error': report_err }, 422);
        return;
    }

    if (report === null || (report !== false && report.errors.length === 0)) {
        // Either we have a good report, or there is no schema for the node type. Either way,
        // we're free to go ahead and insert the data.
        try {
            var node_data = JSON.parse(content);

            var node_id;

            flow.exec( function() {
                    db.save(node_data, this);
                }, function(err, couch_response) {
                    if (err) {
                        throw err;
                    }

                    node_id = couch_response.id;

                    if (couch_response.ok === true) {
                        // Save the history
                        node_data['id'] = node_id;
                        node_data['ver'] = 1;
                        save_history(node_id, node_data, this);
                    } else {
                        // This shouldn't happen, but...
                        throw "No error, but couchdb response was not 'ok'.";
                    }
                }, function(err) {
                    if (err) {
                        throw err;
                    }
                    
                    var node_url = base_url + ':' + port + '/nodes/' + node_id;
                    logger.info("Successful insertion: " + node_url);
                    response.send('', {'Location': base_url + ':' + 
                                  port + '/nodes/' + node_id}, 201); 
                }
            );
        } catch (err) {
            logger.error(err);
            response.send('', {'X-OSDF-Error': "Unable to save node"}, 500);
        }
    } else {
        if (report !== null) {
            var err_msg = report.errors.shift().message;
            logger.info("Bad node. Error: ", err_msg);
            response.send('', {'X-OSDF-Error': err_msg }, 422);
        } else {
            response.send('', {'X-OSDF-Error': 'Invalid node data'}, 422);
        }
    }
};


// This is the function that handles edits/modifications to nodes.
exports.update_node = function(request, response) {
    logger.debug("In update_node.");

    var node_id = request.params.id;
    var content = request.rawBody;

    var report; // To hold the results of validation

    var node_data;

    try {
        node_data = JSON.parse(content);

        // Check that the version has been supplied.
        if (! (node_data !== null && node_data.hasOwnProperty("ver") )) {
            throw "Incoming node data does not supply the node version.";
        }

        report = validate_incoming_node(content);
    } catch (err) {
        logger.info("Returning HTTP 422.", err);
        response.send('', {'X-OSDF-Error': err}, 422);
        return;
    }

    // Check if the json-schema validation reported any errors
    if (report === null || (report !== false && report.errors.length === 0)) {
        update_helper(node_id, node_data, function(err, update_result) {
            if (err) {
                logger.error("Unable to update data in couch.", err);

                response.send('', {'X-OSDF-Error': update_result['msg']}, update_result['code']);
            } else {
                response.send('', update_result['201']);
            }
        });
    } else {
        // If we're here it's because the node data didn't validate
        // or some other problem occurred.
        if (report !== null) {
            var err_msg = report.errors.shift().message;
            logger.info("Bad node. Error: ", err_msg);
            response.send('', {'X-OSDF-Error': err_msg }, 422);
        } else {
            response.send('', {'X-OSDF-Error': 'Node does not validate'}, 422);
        }
    }
};

// This function handles the deletion of nodes. We must check that the
// node exists and that the user has write permissions to it.
exports.delete_node = function(request, response) {
    logger.debug("In delete_node.");

    // TODO: Check that we actually have the id in the request...
    var node_id = request.params.id;

    try {
        // Check if this node has other nodes pointing to it.
        has_dependent_nodes(node_id, function(err, has_dependencies) {
            if (err) {
                logger.error(err);
                throw err;
            }

            if (has_dependencies) {
                response.send('', {'X-OSDF-Error': 'Node has dependencies on it.'}, 403);
            } else {
                logger.debug("No dependencies, so clear to delete.");
                // Get the user that is making the deletion request.
                var user = auth.get_user(request);
                delete_helper(user, node_id, response);
            }
        });
    } catch (e) {
        response.send('', {'X-OSDF-Error': 'Unable to delete node.'}, 500);
    }
};

// Retrieve the nodes that a particular node links to
exports.get_out_linkage = function(request, response) {
    logger.debug("In get_linkage.");

    // TODO: Check that we actually have the id in the request...
    var node_id = request.params.id;

    try {
        // This needs to query a view, not issue N queries...
        db.view('linkage/out',
            {include_docs: true, startkey: [node_id], endkey:[node_id, {}]},
            function(err, results) {
            if (err) {
                logger.error(err);
                throw err;
            }

            // The first entry is the node itself. Subsequent elements in the array are the nodes
            // that we are linking to
            results.shift();

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

            // Fix the couch docs to look like an OSDF doc
            filtered = _.map(filtered, function(filtered_result) {
                return fix_keys(filtered_result);
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
            
            response.json(report);
        });
    } catch (e) {
        logger.error(e);
        response.send('', {'X-OSDF-Error': 'Unable to retrieve node linkages.'}, 500);
    }
};

// Retrieve the nodes that point to this node.
exports.get_in_linkage = function(request, response) {
    logger.debug("In get_in_linkage.");

    // TODO: Check that we actually have the id in the request...
    var node_id = request.params.id;

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
                return fix_keys(filtered_result);
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

            response.json(report);
        });
    } catch (e) {
        logger.error(e);
        response.send('', {'X-OSDF-Error': 'Unable to retrieve node linkages.'}, 500);
    }
};

// This message is used to process schema deletion events that are relayed to
// this process from the master process by worker.js.
exports.process_schema_change = function (msg) {
    logger.debug("In process_schema_change.");

    if (msg.hasOwnProperty('cmd') && msg['cmd'] === "schema_change") {
        if (msg.hasOwnProperty('type') && msg['type'] === 'deletion') {
            var namespace = msg['ns']
            var schema = msg['schema']
            delete_schema_helper(namespace, schema);
        }
    }
};

// Validates the data presented based on the json-schema of the node type.
// Returns a report with validation results, or throws an exception if we
// are unable to get that far, for instance, if the content can't be parsed
// into a JSON data structure.
function validate_incoming_node(node_string) {
    logger.debug("In validate_incoming_node.");

    var node;
    if (typeof node_string === 'string') {
        try {
            node = JSON.parse(node_string);
        } catch(e) {
            logger.debug('Unable to parse content into JSON.');
            throw "Unable to parse content into JSON.";
        }
    }

    // TODO: Use a JSON schema check right here instead of the rudimentary check.
    if (! node.ns || ! node.acl || ! node.node_type || ! node.meta || ! node.linkage ) {
        throw "Node JSON does not possess the correct structure.";
    }

    if (! (node.acl.hasOwnProperty('read') && node.acl['read'] instanceof Array)) {
        throw "Node acl object doesn't have a correctly defined 'read' key.";
    }

    if (! (node.acl.hasOwnProperty('write') && node.acl['write'] instanceof Array)) {
        throw "Node acl object doesn't have a correctly defined 'write' key.";
    }
    
    if (! osdf_utils.contains(node.ns, namespaces)) {
        var msg = "Node belongs to an unrecognized namespace.";
        logger.error(msg);
        throw msg;
    }

    var report = null;
    if ( validators.hasOwnProperty(node.ns) && 
             validators[node.ns].hasOwnProperty(node.node_type) ) {
        // Look up the schema for this node type from our validators data structure.
        var schema = validators[node.ns][node.node_type]['schema'];

        // So, we don't validate the whole node against the JSON schema,
        // just the 'meta' portion.
        var meta = node['meta'];

        // And validate...
        report = validators[node.ns]['env'].validate(meta, schema);
    } else {
        logger.debug("No validator found for namespace/node_type of " +
                    node.ns + "/" + node.node_type + ".");
    } 

    return report;
}

function fix_keys(data) {
    // Should need to clone the data, but stumbled upon an apparent bug with V8.
    var new_data = null;

    if (data !== null) {
        new_data = clone(data);

        new_data['id'] = data._id;
        new_data['ver'] = parseInt(data._rev.split("-")[0], 10);

        delete new_data._id;
        delete new_data._rev;
    }
    return new_data;
}

function update_helper(node_id, node_data, callback) {
    logger.debug("In update_helper.");

    var node_version = node_data.ver;
    var result = {};  // What we will send back through the callback

    try {
        var couchdb_version;
        var couchdb_version_int;
        var previous_node;

        flow.exec(
            function() {
                db.get(node_id, this);
            },
            function(err, data) {
                previous_node = data;
                if (err) {
                    result['msg'] = "Unable to perform update operation.";
                    result['code'] = 500;
                    throw err;
                }

                couchdb_version = previous_node['_rev'];
                couchdb_version_int = parseInt(couchdb_version.split('-')[0], 10);

                if ( node_version !== couchdb_version_int ) {
                    var msg = "Version provided (" + node_version + ") doesn't match " +
                              "saved (" + couchdb_version_int + ").";

                    result['msg'] = msg;
                    result['code'] = 422;
                    throw msg;
                }

                // Okay to proceed with the update because the versions match
                db.save(node_id, couchdb_version, node_data, this);
            },
            function(err, couch_response) {
                if (err) {
                    result['msg'] = err.error;
                    result['code'] = 500;
                    throw err;
                }

                if (! couch_response.ok) {
                    result['msg'] = err.error;
                    result['code'] = 500;
                    throw err;
                }

                logger.info("Successful update for node id: " + node_id);

                // Save the history
                save_history(node_id, fix_keys(previous_node), this);
            },
            function(err) {
                if (err) {
                    result['msg'] = err.error;
                    result['code'] = 500;
                    throw err;
                }

                result['msg'] = '';
                result['code'] = 200;

                callback(null, result);
            }
        );

    } catch (err) {
        callback(err, result);
    }
}

function retrieval_helper(request, response, err, data) {
    if (err) {
        if (err.error === 'not_found') {
            logger.debug("User requested non-existent node.");
            response.send('', {'X-OSDF-Error': "Non-existent node" }, 404);
        } else {
            logger.error(err);
            response.send('', {'X-OSDF-Error': err.error }, 500);
        }
    } else {
        var user = auth.get_user(request);
        if (perms.has_read_permission(user, data)) {
            var fix = fix_keys(data); 
            response.json(fix);
        } else {
            response.send('', {'X-OSDF-Error': 'No read access to this node'}, 403);
        }
    }
}

// Given a namespace name (string), return the location on the filesystem
// where the namespace's working directory is. If an optional 'file' path is
// specified as well, the path to the file in the namespace's workign directory
// is returned.
// Parameters: namespace (string)
//             file (string, optional)
// Returns: path (string)
function ns2working(namespace, file) {
    var location;
    if (file !== null) {
        location = path.join(root_local_dir, '/working/namespaces/', namespace, file);
    } else {
        location = path.join(root_local_dir, '/working/namespaces/', namespace);
    }
    return location;
}

function populate_validators(populate_callback) {
    logger.debug("In populate_validators.");

    osdf_utils.async_for_each(namespaces, function(ns, cb) {
        logger.info("Creating validators for namespace: " + ns);
        define_namespace_validators(ns, function() {
            cb();
        }); 
    }, function() { populate_callback(); });
}

function define_namespace_validators(namespace, define_cb) {
    logger.debug("In define_namespace_validators: " + namespace);
    var file_idx;

    var a = function(callback) {
        var schema_dir = path.join(ns2working(namespace), 'schemas');

        // Scan the working area for the namespace for JSON schema files for the node_types.
        // Each .json file in there is basenamed with the name of the node_type.
        fs.readdir(schema_dir, function(err, files) {
            if (err) {
                throw err;
            }

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
        });
    };

    var b = function(callback) {
        register_aux_schemas(namespace, function() {
            logger.info("Finished registering auxiliary schemas for: " + namespace);
            callback();
        }); 
    }; 

    flow.exec( function() {
            a(this);
        }, function() {
            b(this);
        }, function() {
            define_cb();
        }
    );
}

function validate_against_schema(data) {
    logger.debug("In validate_against_schema.");

    // TODO: More validation
    var ns = data.ns;
    var node_type = data.node_type;

    var env = validators[ns]['env'];
    var schema = validators[ns][node_type]['schema'];
    var report = env.validate(data, schema);
    return report;
}

function register_aux_schemas(ns, callback) {
    logger.debug("In register_aux_schemas.");

    // Create a JSON-Schema (Draft 3) environment
    var environment = JSV.createEnvironment('json-schema-draft-03');
    register_aux_schemas_to_env(environment, ns, function() {
        validators[ns]['env'] = environment;
        callback();
    });
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
                    response.send('', {'X-OSDF-Error': "Unknown node"}, 422);
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
                                response.send('', 204);
                            });
                        }
                    });
                } else {
                    logger.debug("User " + user + " cannot delete node " + node_id);
                    response.send('', {'X-OSDF-Error': 'No ACL permissions to delete node'}, 403);
                }
            }
        } catch (e) {
            logger.warn("Failed deletion.", e);
            response.send('', 500);
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

function load_reference_schema(env, schema, callback) {
    var basename = path.basename(schema, '.json');

    fs.readFile(schema, 'utf-8',
        function(err, data) {
            if (err) {
                logger.error("Missing or invalid schema found for " + schema );
                callback();
            } else {
                logger.debug("Registering schema '" + schema + "' with id '" + basename + "'");
                env.createSchema( JSON.parse(data), undefined, basename );
                callback();
            }
        }
    );
}

function delete_schema_helper(namespace, schema_name) {
    if (validators.hasOwnProperty(namespace) && validators[namespace].hasOwnProperty(schema_name)) {
        delete validators[namespace][schema_name];
    }
}

// This function parses a JSON structure and looks for keys named '$ref'
// The function returns an array of the '$ref' values.
function extractRefNames(struct) {
    var refs = [];
    var keyName;
    var deeperIdx;

    // Check that we have a dictionary
    if (typeof struct === "object") {
        for (keyName in struct) {
            if (typeof struct[keyName] === "object") {
                var deeper_refs = extractRefNames(struct[keyName]);
                if (deeper_refs !== null && deeper_refs.length > 0) {
                    for (deeperIdx = 0; deeperIdx < deeper_refs.length ; deeperIdx++) {
                        refs.push(deeper_refs[deeperIdx]);
                    }
                }
            } else if (keyName === "$ref") {
                if (struct[keyName].length > 0) {
                    refs.push(struct[keyName]);
                }
            }
        }
    }
    return refs;
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

function load_aux_schemas(ns, env, schemas, then) {
    var loaded = {};
    recursive_load_helper(ns, env, schemas, loaded, then);
}

function locate_schema_id_source(ns, schema_id) {
    return path.join(root_local_dir, 'working/namespaces', ns, 'aux', schema_id + '.json');
}

function locate_schema_source(ns, schema) {
    return path.join(root_local_dir, 'working/namespaces', ns, 'aux', schema);
}

// Recursively load all the auxiliary schemas belonging to a namespace
// into the provided JSV environment for later validatnion.
// Parameters
// ns: the string namespace name
// env: the JSV environment. Each namespace has one
// schemas: an array of schema files to load, each may contain references to other schemas
// then: a callback that is called when the loading is complete
function recursive_load_helper(ns, env, schemas, loaded, then) {
    osdf_utils.async_for_each(schemas, function(schema, cb) {
        var schema_src  = locate_schema_source(ns, schema);

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
                        reference_ids = extractRefNames(schemaJson);
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
                    recursive_load_helper(ns, env, reference_schemas, loaded, function() {
                        if (loaded.hasOwnProperty(schema_id)) {
                            logger.debug("Already loaded " + schema_id);
                            cb();
                        } else {
                            load_reference_schema(env, schema_src, cb);
                            // Make a note that we loaded this one already
                            loaded[schema_id] = 1;
                        }
                    });

                });
            }
        });

    }, then);
}

function register_aux_schemas_to_env(env, ns, then) {
    logger.debug("In register_aux_schemas_to_env.");
    flow.exec(
        function() {
            var aux_dir = path.join(root_local_dir, 'working/namespaces', ns, 'aux');
            fs.readdir(aux_dir, this); 
        },
        function(err, files) {
            if (err) {
                throw err;
            }
            load_aux_schemas(ns, env, files, this);
        }, function() {
            then(); 
        }
    );
}

function save_history(node_id, node_data, callback) {
    logger.debug("In save_history.");
    var version = node_data['ver'];

    var attachment = { contentType: 'application/json',
                       name: version.toString(),
                       body: JSON.stringify(node_data),
                     };

    try {
        if (version === 1) {
            db.save(node_id + "_hist", {}, function(err, data) {
                if (err) {
                    console.log(err);
                    throw err;
                }

                var first_hist_version = data['_rev'];

                var doc = { id: node_id + "_hist",
                            rev: first_hist_version
                          };
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
            db.get(node_id + "_hist", function(err, hist_node) {
                if (err) {
                    logger.error(err);
                    throw err;
                }

                var doc = { id: node_id + "_hist",
                            rev: hist_node['_rev']
                          };

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
