// cradle - for interactions with CouchDB
// JSV - Used for JSON validation with JSON-Schema
// clone - For creating deep copies of data structures

var _ = require('underscore');
var cradle = require('cradle');
var http = require('http');
var fs = require('fs');
var utils = require('utils');
var path = require('path');
var clone = require('clone');
var JSV = require("./node_modules/JSV/jsv.js").JSV;
//var JSV = require('JSV').JSV;
var config = require('config');
var flow = require('flow');
var perms = require('perms-handler');
var auth = require('auth_enforcer');

var c = Config.get_instance(utils.get_config());

// Load some important configuration parameters.
var base_url = c.value('global', 'base_url');
var port = c.value('global', 'port');
var couch_ip = c.value('global', 'couch_ip');
var couch_port = c.value('global', 'couch_port');;
var couch_user = c.value('global', 'couch_user');
var couch_pass = c.value('global', 'couch_pass');

var dbname = c.value('global', 'dbname');

var root_local_dir = utils.get_osdf_root();
var logger = utils.get_logger();

//cross function dynamic globals
var stay_alive = false;
var search_results_summary_global = {};
var search_results_global = {};

// An array to hold the namespaces.
var namespaces = [];
var validators = {};
var db;

exports.get_node = function(request, response) {
    logger.debug("In get_node.");
    if (request.params.ver) {
        db.get(request.params.id, request.params.ver, function(err, node_data) {
            node_retrieval_helper(request, response, err, node_data);
        });
    } else {
        db.get(request.params.id, function(err, node_data) {
            node_retrieval_helper(request, response, err, node_data);
        });
    }
}

exports.insert_node = function(request, response) {
    logger.debug("In insert_node.");
    var content = request.rawBody;
    var report;  // To hold the results of validation

    try {
        report = validate_incoming_node(content);
    } catch (err) {
        logger.error(err);
        response.send('', {'X-OSDF-Error': err }, 422);
        return;
    }

    if (report == null || (report != false && report.errors.length === 0)) {
        // Either we have a good report, or there is no schema for the node type. Either way,
        // we're free to go ahead and insert the data.
        try {
            var node_data = JSON.parse(content);

            db.save(node_data, function(err, couch_response) {
                if (err) {
                    logger.error(err);
                    response.send(500);
                } else {
                    if (couch_response.ok == true) {
                        var node_url = base_url + ':' + port + '/nodes/' + couch_response.id;
                        logger.info("Successful insertion: " + node_url);
                        response.send('', {'Location': base_url + ':' + port + '/nodes/' + couch_response.id}, 201); 
                    } else {
                        logger.error("No error, but couchdb response was not 'ok'.");
                        response.send(500);
                    }
                }
            });
        } catch (err) {
            logger.error(err);
            response.send(500);
        }
    } else {
        if (report != null) {
            var err_msg = report.errors.shift().message;
            logger.info("Bad node. Error: ", err_msg);
            response.send('', {'X-OSDF-Error': err_msg }, 422);
        } else {
            response.send('', {'X-OSDF-Error': 'Invalid node data'}, 422);
        }
    }
}

function save_history(node_id, node_data) {
    var version = node_data['_rev'].split('-')[0];

    if (version == "1") {
        db.save(node_id + "_hist", {}, function(err, data) {
            if (err) {
                console.log(err);
                throw err;
            }

            var first_hist_version = data['_rev'];
            db.saveAttachment(node_id + "_hist", first_hist_version, version,
                              'application/json', JSON.stringify(node_data), function(err, data) {
                logger.debug("Saved first history for node " + node_id + ".");
            });
        });
    } else {
        db.get(node_id + "_hist", function(err, hist_node) {
            if (err) throw err;

            var hist_node_version = hist_node['_rev'];

            db.saveAttachment(node_id + "_hist",  hist_node_version, version,
                              'application/json', JSON.stringify(node_data), function(err, data) {
                if (err) throw err;

                logger.debug("Saved history for node " + node_id + ".");
            });;
        });
    }
}


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
        if (! ("ver" in node_data)) {
            throw "Incoming node data does not supply the node version.";
        }

        report = validate_incoming_node(content);
    } catch (err) {
        logger.info("Returning HTTP 422.", err);
        response.send('', {'X-OSDF-Error': err}, 422);
        return;
    }

    if (report == null || (report != false && report.errors.length == 0)) {

        var node_version = node_data.ver;

        db.get(node_id, function(err, previous_node) {
            if (err) throw err;

            db.save(node_id, node_version, node_data, function(err, couch_response) {
                if (err) {
                    logger.error(err);
                    response.send('', {'X-OSDF-Error': err.error}, 500);
                } else {
                    if (couch_response.ok == true) {
                        logger.info("Successful update for node id: " + node_id);

                        // Save the history
                        save_history(node_id, previous_node);

                        response.send('', 200); 
                    } else {
                        logger.warn("No error, but couchdb response was not 'ok'.");
                        response.send('', {'X-OSDF-Error': err.error}, 500);
                    }
                }
            });
        });

    } else {
        if (report != null) {
            var err_msg = report.errors.shift().message;
            logger.info("Bad node. Error: ", err_msg);
            response.send('', {'X-OSDF-Error': err_msg }, 422);
        } else {
            response.send('', {'X-OSDF-Error': 'Node does not validate'}, 422);
        }
    }
}

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
}

// Retrieve the nodes that a particular node links to
exports.get_out_linkage = function(request, response) {
    logger.debug("In get_linkage.");

    // TODO: Check that we actually have the id in the request...
    var node_id = request.params.id;

    try {
        // This needs to query a view, not issue N queries...
        db.view('linkage/out', {include_docs: true, startkey: [node_id], endkey:[node_id, {}]}, function(err, results) {
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
            filtered = _.map(filtered, function(filtered_result) { return filtered_result['doc']; });

            // Fix the couch docs to look like an OSDF doc
            filtered = _.map(filtered, function(filtered_result) { return fix_keys(filtered_result); });

            // Exclude nodes that we do not have read permission for
            var user = auth.get_user(request);
            filtered = _.select(filtered, function(node) { return perms.has_read_permission(user, node); });

            // Assemble the final document for transmission
            var report = { "result_count": filtered.length,
                           "page": 1,
                           "results": []
                         };

            _.each(filtered, function(filtered_result) { report['results'].push( filtered_result ) } );
            
            response.json(report);
        });
    } catch (e) {
        logger.error(e);
        response.send('', {'X-OSDF-Error': 'Unable to retrieve node linkages.'}, 500);
    }
}

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
            filtered = _.map(filtered, function(filtered_result) { return filtered_result['doc']; });

            // Fix the CouchDB doc to look like an OSDF doc
            filtered = _.map(filtered, function(filtered_result) { return fix_keys(filtered_result); });

            // Exclude nodes that we do not have read permission for
            var user = auth.get_user(request);
            filtered = _.select(filtered, function(node) { return perms.has_read_permission(user, node); });

            // Assemble the final document for transmission
            var report = { "result_count": filtered.length,
                           "page": 1,
                           "results": []
                         };

            _.each(filtered, function(filtered_result) { report['results'].push( filtered_result ) } );

            response.json(report);
        });
    } catch (e) {
        logger.error(e);
        response.send('', {'X-OSDF-Error': 'Unable to retrieve node linkages.'}, 500);
    }
}

// This initializes the handler. The things we need to do before the
// handler is ready to begin its work are: establish a connection to the
// CouchDB server, determine what the installed namespaces are, and create
// the various validators for each of the node types inside each namespace. 
exports.init = function(emitter) {
    logger.debug("In " + path.basename(__filename) + " init().");

    logger.info("Creating couchdb connection. Using db: " + dbname);

    // Establish the connection parameters, including the application's
    // CouchDB credentials.
    var couch_conn = new(cradle.Connection)('http://' + couch_ip, couch_port, {
        auth: { username: couch_user, password: couch_pass },
        cache: false,
        raw: false
    });

    // Create the CouchDB connection using the configured database name.
    db = couch_conn.database(dbname);

    utils.get_namespace_names( function(names) {
        namespaces = names;
        logger.info("Namespaces: ", namespaces);

        // Setup all the JSON validators for the namespaces and their node types.
        populate_validators( function() {
            emitter.emit('node_handler_initialized');
        });
    });
}

// Validates the data presented based on the json-schema of the node type.
// Returns a report with validation results, or throws an exception if we
// are unable to get that far, for instance, if the content can't be parsed
// into a JSON data structure.
function validate_incoming_node(node_string) {
    logger.debug("In validate_incoming_node.");

    var node;
    if (typeof node_string == 'string') {
        try {
            node = JSON.parse(node_string);
        } catch(e) {
            logger.debug('Unable to parse content into JSON.');
            throw "Unable to parse content into JSON.";
        }
    }

    // TODO: Use a JSON schema check right here instead of this
    // rudimentary check.
    if (! node.ns || ! node.acl || ! node.node_type || ! node.meta || ! node.linkage ) {
        throw "Node JSON does not possess the correct structure.";
    }
    
    if (! utils.contains(node.ns, namespaces)) {
        var msg = "Node belongs to an unrecognized namespace.";
        logger.error(msg);
        throw msg;
    }

    var report = null;
    if ( node.ns in validators && node.node_type in validators[node.ns] ) {
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
    var new_data = clone(data);

    new_data['id'] = data._id;
    new_data['ver'] = data._rev;

    delete new_data._id;
    delete new_data._rev;

    return new_data;
}

function node_retrieval_helper(request, response, err, data) {
    if (err) {
        if (err.error == 'not_found') {
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
    if (file != null) {
        location = path.join(root_local_dir, '/working/namespaces/', namespace, file);
    } else {
        location = path.join(root_local_dir, '/working/namespaces/', namespace);
    }
    return location;
}

function populate_validators(populate_callback) {
    logger.debug("In populate_validators.");

    utils.async_for_each(namespaces, function(ns, cb) {
        logger.info("Creating validators for namespace: " + ns);
        define_namespace_validators(ns, function() {
            cb();
        }); 
    }, function() { populate_callback(); });
}

function define_namespace_validators(namespace, define_cb) {
    logger.debug("In define_namespace_validators: " + namespace);

    var a = function(callback) {
        var schema_dir = path.join(ns2working(namespace), 'schemas');

        // Scan the working area for the namespace for JSON schema files for the node_types.
        // Each .json file in there is basenamed with the name of the node_type.
        fs.readdir(schema_dir, function(err, files) {
            if (err) throw err;

            for (var i = 0; i < files.length; i++) {
                var node_type_schema = files[i];

                if ( path.extname(node_type_schema) == '.json') {
                    logger.info("Found a schema! " + node_type_schema);

                    var node_type = path.basename(node_type_schema, '.json');

                    var data = fs.readFileSync(path.join(schema_dir, node_type_schema), 'utf-8');

                    if (! (namespace in validators)) {
                        validators[namespace] = {};
                    }
                    if (! (node_type in validators[namespace])) {
                        validators[namespace][node_type] = {};
                    }
                    try {
                        validators[namespace][node_type]['schema'] = JSON.parse(data);
                    } catch (e) {
                        logger.warn("ERROR: Unable to parse schema " + node_type_schema + " to JSON !!!");
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
    });
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
                if (err.error && err.error == "not_found") {
                    logger.info("User '" + user + "' attempted to delete unknown node " + node_id);
                    response.send('', {'X-OSDF-Error': "Unknown node"}, 422);
                } else {
                    throw err.reason;
                }
            } else {
                
                var can_write = perms.has_write_permission(user, node_data);
                if ( can_write ) {
                    var node_revision = node_data['_rev'];
                    db.remove(node_id, node_revision, function(err, res) {
                        if (err) {
                            throw "Unable to delete node " + node_id;
                        } else {
                            logger.info("Successful deletion: " + node_id);
                            response.send('', 204);
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
    if (typeof(node) == "object" && 'id' in node && 'linkage' in node && 'meta' in node) {
        node_id = node['id'];
    } else if (typeof(node) == "string") {
        node_id = node;
    } else {
        throw "Invalid argument.";
    }
    logger.debug("Checking " + node_id + " for dependencies.");

    var has_dependencies = false;

    // Query the specially created view using cradle.
    db.view('linkage/reverse', {key: node_id}, function(err, response) {
        if (err) callback(err, null);

        // Remove any reference to ourselves from consideration
        response = _.reject(response, function(row) { return row['id'] == node_id });

        var row_count = response.length;
        if (row_count > 0) {
            logger.debug("Found dependencies for " + node_id);
            has_dependencies = true;
        }
        callback(null, has_dependencies);
    });
}

function loadReferenceSchema(env, schema, callback) {
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

// This function parses a JSON structure and looks for keys named '$ref'
// The function returns an array of the '$ref' values.
function extractRefNames(struct) {
    var refs = [];
    // Check that we have a dictionary
    if (typeof struct === "object") {
        for (var keyName in struct) {
            if (typeof struct[keyName] === "object") {
                var deeper_refs = extractRefNames(struct[keyName]);
                if (deeper_refs != null && deeper_refs.length > 0) {
                    for (var deeperIdx = 0; deeperIdx < deeper_refs.length ; deeperIdx++) {
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


function register_aux_schemas_to_env(env, ns, then) {
    logger.debug("In register_aux_schemas_to_env.");
    flow.exec(
        function() {
            var aux_dir = path.join(root_local_dir, 'working/namespaces', ns, 'aux');
            fs.readdir(aux_dir, this); 
        },
        function(err, files) {
            if (err) throw err;
            loadAuxSchemas(ns, env, files, this);
        }, function() {
            then(); 
        }
    );
}

function loadAuxSchemas(ns, env, schemas, then) {
    var loaded = {};
    recursiveLoadHelper(ns, env, schemas, loaded, then);
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
function recursiveLoadHelper(ns, env, schemas, loaded, then) {
        utils.async_for_each(schemas, function(schema, cb) {
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
                        if (err) throw err;

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
                        for (var refIdx = 0; refIdx < reference_ids.length; refIdx++) {
                            var schema_file = reference_ids[refIdx] + ".json";
                            reference_schemas.push(schema_file);
                        }
                        // Call ourselves and pass along the list of schemas that we have
                        // already loaded.
                        recursiveLoadHelper(ns, env, reference_schemas, loaded, function() {
                            if ( schema_id in loaded) {
                                logger.debug("Already loaded " + schema_id);
                                cb();
                            } else {
                                loadReferenceSchema(env, schema_src, cb);
                                // Make a note that we loaded this one already
                                loaded[schema_id] = 1;
                            }
                        });

                    });
                }
            });

        }, then);
}
