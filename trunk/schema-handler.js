var fs = require('fs');
var events = require('events');
var flow = require('flow');
var osdf_utils = require('osdf_utils');
var path = require('path');
var _ = require('underscore');
var util = require('util');
require('config');

var logger = osdf_utils.get_logger();
var c = Config.get_instance(osdf_utils.get_config());
var bind_address = c.value("global", "bind_address");
var port = c.value("global", "port");
var base_url = c.value("global", "base_url");
var root_local_dir = osdf_utils.get_osdf_root();
var working_dir;
var global_schemas = {};

var osdf_error = osdf_utils.send_error;

function SchemaHandler() {
    // The constructor
}

// Let's make SchemaHandler inherit from EventEmitter so that we
// can emit events.
util.inherits(SchemaHandler, events.EventEmitter);

module.exports = new SchemaHandler();
exports = module.exports;

exports.get_all_schemas = function (request, response) {
    var ns = request.params.ns;

    logger.debug("In get_all_schemas: " + ns);

    // First of all, is the requested namespace even known to us?
    if (global_schemas.hasOwnProperty(ns)) {
        response.json(global_schemas[ns]);
    } else {
        logger.warn("User requested schemas for unknown namespace: " + ns);
        osdf_error(response, 'Namespace or schema not found.', 404);
        return;
    }
};

exports.init = function (emitter, working_dir_custom) {
    logger.debug("In init.");

    if (working_dir_custom !== null && typeof working_dir_custom !== 'undefined') {
        logger.debug("Configuring for a custom working directory of: " + working_dir_custom);
        working_dir = working_dir_custom;
    } else {
        working_dir = path.join(root_local_dir, 'working');
    }

    var ns_schema_dir;

    flow.exec(
        function() {
            // Get all the namespace names into a list of strings
            osdf_utils.get_namespace_names(this);
        },
        function(namespaces) {
            logger.debug("Namespaces to scan: " + namespaces.length);

            osdf_utils.async_for_each(
                namespaces,
                function(ns, cb) {
                    get_ns_schemas(ns, function(ns_schemas) {
                        global_schemas[ns] = ns_schemas;
                        cb();
                    });
                },
                this
            );
        },
        function() {
            logger.debug("Finished scanning all schemas.");

            emitter.emit('schema_handler_initialized');
        }
    );
};

// Retrieves all the auxiliary schemas belonging to a namespace. The
// namespace is specified by the client in the URL.
exports.get_all_aux_schemas = function (request, response) {
    var ns = request.params.ns;
    logger.debug("In get_all_aux_schemas. Namespace: " + ns + ".");

    if (global_schemas.hasOwnProperty(ns)) {
        // Need to return all the auxuilary schemas, which are found
        // under global_schemas[ns]['aux'].
        if (global_schemas[ns].hasOwnProperty('aux')) {
            response.json(global_schemas[ns]['aux']);
        } else {
            // Send an emtpy object
            response.json({});
        }
    } else {
        logger.warn("Unknown ns: " + ns);
        osdf_error(response, 'Namespace not found.', 404);
    }
};

// Retrieves a specific auxiliary schema belonging to a namespace. Both the
// namespace and the auxiliary schema name are specified by the client
// in the URL.
exports.get_aux_schema = function (request, response) {
    var ns = request.params.ns;
    var aux = request.params.aux;

    logger.debug("In get_aux_schema (ns:aux): (" + ns + ":" + aux + ").");

    if (global_schemas.hasOwnProperty(ns)) {
        if (global_schemas[ns].hasOwnProperty('aux') &&
                global_schemas[ns]['aux'].hasOwnProperty(aux)) {
            response.json(global_schemas[ns]['aux'][aux]);
        } else {
            logger.warn("Unknown ns:aux: " + ns + ":" + aux);
            osdf_error(response, 'Auxiliary schema not found.', 404);
        }
    } else {
        logger.warn("Unknown ns: " + ns);
        osdf_error(response, 'Namespace not found.', 404);
    }
};

// Retrieves a specific main schema belonging to a namespace. Both the
// namespace and the schema name are specified by the client in the URL.
exports.get_schema = function (request, response) {
    var ns = request.params.ns;
    var schema = request.params.schema;

    logger.debug("In get_schema (ns:schema): (" + ns + ":" + schema + ").");

    if (global_schemas.hasOwnProperty(ns)) {
        if (global_schemas[ns].hasOwnProperty('schemas') &&
                global_schemas[ns]['schemas'].hasOwnProperty(schema)) {
            response.json(global_schemas[ns]['schemas'][schema]);
        } else {
            logger.warn("Unknown ns:schema: " + ns + ":" + schema);
            osdf_error(response, 'Schema not found.', 404);
        }
    } else {
        logger.warn("Unknown ns: " + ns);
        osdf_error(response, 'Namespace not found.', 404);
    }
};

// This is the code that implements schema insertion for when users wish
// to create NEW schemas.
//
// TODO: Need to check the data to see if the new schema makes reference to an
// auxiliary schema that doesn't exist yet. In that case, the auxiliar schema
// must be added first.
exports.insert_schema = function (request, response) {
    logger.debug("In insert_schema.");

    // Get the namespace and the schema data (JSON) that has been provided.
    var ns = request.params.ns;
    var content = request.rawBody;

    // Before we do anything, let's see if the namespace is known to us. If it isn't
    // then we send an appropriate HTTP response code.
    if (! global_schemas.hasOwnProperty(ns)) {
        logger.warn("User attempted to insert a schema into an unknown namespace: " + ns);
        osdf_error(response, 'Namespace not found.', 404);
        return;
    }

    // Parse the data provided. If it's invalid/malformed, we're about to find out.
    var insertion_doc = null;
    try {
        insertion_doc = JSON.parse(content);
    } catch (err) {
        osdf_error(response, 'Invalid JSON provided for insertion.', 422);
        return;
    }

    // Okay, so the user provided valid JSON. However, is it in the right format?
    // Check that the JSON has 'name' and 'schema' properties...
    if (! insertion_doc.hasOwnProperty('name')) {
        var msg = "Document did not have the required the 'name' property.";
        logger.error(msg);
        osdf_error(response, msg, 422);
        return;
    }

    if (! insertion_doc.hasOwnProperty('schema')) {
        var msg = "Document did not have the required 'schema' property.";
        logger.error(msg);
        osdf_error(response, msg, 422);
        return;
    }

    var schema_name = insertion_doc['name'];
    var schema_json = insertion_doc['schema'];

    // Check if the schema name looks okay.
    if (! valid_schema_name(schema_name)) {
        var msg = "Invalid schema name.";
        logger.error(msg);
        osdf_error(response, msg, 422);
        return;
    }
   
    try {
        // The last parameter indicates that this worker is the first to receive
        // this request (we're not responding to a hint from the master process) and
        // therefore we are the worker responsible for writing the data to disk/storage.
        insert_schema_helper(ns, schema_name, schema_json, true);

        // Can't use 'this', so we have to reach down to the module.exports 
        // to get the inherited emit() function.
        module.exports.emit("insert_schema", { 'ns': ns, 'name': schema_name, 'json': schema_json });

        // Send a message to the master process so that it can notify other
        // sibling workers about this.
        process.send({ cmd: 'schema_change',
                       type: 'insertion',
                       ns: ns,
                       name: schema_name,
                       json: schema_json
                     });

        response.send('', {'Location': base_url + ':' + port + '/namespaces/' + ns + '/schemas/' + schema_name }, 201);
    } catch (e) {
        logger.error(e);
        osdf_error(response, 'Unable to insert schema.', 500);
        return;
    }
};

/* Delete a JSON schema from a namespace. We delete it
   from memory as well as from disk.  A user must have 'write' access to the
   namespace in order to delete one of the namespace's schemas.

   TODO: Check the namespace ACL for permission to delete
 */
exports.delete_schema = function (request, response) {
    logger.debug("In delete_schema.");

    var ns = request.params.ns;
    var schema_name = request.params.schema;

    if (! global_schemas.hasOwnProperty(ns)) {
        logger.warn("User attempted to delete a schema from unknown namespace: " + ns);
        osdf_error(response, 'Namespace not found.', 404);
        return;
    }

    if (global_schemas[ns].hasOwnProperty('schemas') &&
        global_schemas[ns]['schemas'].hasOwnProperty(schema_name)) {
            try {
                delete_schema_helper(ns, schema_name);

                // Can't use 'this', so we have to reach down to the module.exports 
                // to get the inherited emit() function.
                module.exports.emit("delete_schema", { 'ns': ns, 'name': schema_name });

                // Send a message to the master process so that it can notify other
                // sibling workers about this.
                process.send({ cmd: "schema_change",
                               type: "deletion",
                               ns: ns,
                               name: schema_name
                             });

                response.send('', 204);
            } catch (err) {
                logger.err("Unable to delete schema.", err);
                osdf_error(response, 'Unable to delete schema.', 500);
            }
    } else {
        logger.warn("User attempted to delete a non-existent schema: " + schema);
        osdf_error(response, 'Schema not found.', 404);
        return;
    }
};

/* Delete an auxiliary schema.  We delete it from memory
   as well as from disk. A user must have 'write' access to the
   namespace in order to delete one of the namespace's auxiliary
   schemas.

   TODO: Check the namespace ACL for permission to delete
 */
exports.delete_aux_schema = function (request, response) {
    logger.debug("In delete_aux_schema.");

    var ns = request.params.ns;
    var aux = request.params.aux;

    if (! global_schemas.hasOwnProperty(ns)) {
        logger.warn("User attempted to delete an aux schema from unknown namespace " + ns);
        osdf_error(response, 'Namespace not found.', 404);
        return;
    }

    if (global_schemas[ns].hasOwnProperty('aux') &&
            global_schemas[ns]['aux'].hasOwnProperty(aux)) {

        // Delete from the filesystem, and if successful, from memory.
        var aux_path = path.join(working_dir, 'namespaces', ns, '/aux/', aux + '.json');

        fs.unlink(aux_path, function (err, data) {
            if (err) {
                logger.err(err);
                osdf_error(response, 'Unable to delete auxiliary schema.', 500);
            } else {
                logger.debug("Successful deletion of auxiliary schema. Deleting from memory...");
                delete global_schemas[ns]['aux'][aux];
                response.send('', 204);
            }
        });

    } else {
        logger.warn("User attempted to delete a non-existent aux schema: " + aux);
        osdf_error(response, 'Auxiliary schema not found.', 404);
        return;
    }
};

// This message is used to process schema deletion events that are relayed to
// this process from the master process by worker.js.
exports.process_schema_change = function (msg) {
    logger.debug("In process_schema_change. PID: " + process.pid);

    if (msg.hasOwnProperty('cmd') && msg['cmd'] === "schema_change") {
        var namespace = msg['ns']
        var schema_name = msg['name']

        if (msg.hasOwnProperty('type') && msg['type'] === 'deletion') {
            delete_schema_helper(namespace, schema_name);
        } else if (msg.hasOwnProperty('type') && msg['type'] === 'insertion') {
            var schema_json = msg['json'];
            // false is to indicate that we do not need to write to disk.
            // since we are responding to a message from the master, another
            // worker already handled the write
            insert_schema_helper(namespace, schema_name, schema_json, false);
        }
    }
};

// Handle the details of a new schema that has been added. This is
// used by both the worker that initially received the request,
// and the workers that respond to notifications from the master
// process.
function insert_schema_helper(namespace, schema_name, schema_json, write) {
    logger.debug("In schema-handler:insert_schema_helper.");

    if (! global_schemas[namespace].hasOwnProperty('schemas')) {
        // Should never get here.
        logger.error("No 'schemas' structure for namespace: " + namespace);
        throw "No 'schemas' structure for namespace: " + namespace;
    }

    if ( global_schemas[namespace]['schemas'].hasOwnProperty(schema_name) ) {
        // Overwriting a schema, so let's just make a note of that.
        logger.warn("Overwriting existing schema (ns:schema): (" +
                    namespace + ":" + schema_name + ")");
    }

    if (write) {
        // Save the schema to the filesystem in the working directory,
        // and if successful, save it to our in-memory data structure.
        var schema_path = path.join(working_dir, "namespaces", namespace,
                                    "schemas", schema_name + '.json');

        var stream = fs.createWriteStream(schema_path);

        stream.once('open', function(fd) {
            // Write out the prettyfied JSON to the filesystem.
            stream.write(JSON.stringify(schema_json, null, 4));
            stream.end();

        });
    }

    // And save it to our data structure.
    global_schemas[namespace]['schemas'][schema_name] = schema_json;
}

// Handle the details of a schema that has been deleted. This is
// used by both the worker that initially received the request,
// and the workers that respond to notifications from the master
// process.
function delete_schema_helper(namespace, schema_name) {
    logger.debug("In schema-handler:delete_schema_helper.");

    if (global_schemas[namespace].hasOwnProperty('schemas') &&
        global_schemas[namespace]['schemas'].hasOwnProperty(schema_name)) {

        // Delete from the filesystem, and if successful, from memory.
        var schema_path = path.join(working_dir, 'namespaces', ns, 'schemas', schema_name + '.json');

        // We have to check if the schema file exists because it might have already been
        // deleted by another worker.
        fs.exists(schema_path, function (exists) {
            if (exists) {
                fs.unlink(schema_path, function (err) {
                    if (err) {
                        throw err;
                    } else {
                        logger.debug("Successful deletion of schema file. Deleting from memory...");
                    }
                });
            }
        });

        logger.debug("Deleting schema from memory.");
        if (global_schemas.hasOwnProperty(namespace) &&
                global_schemas[namespace].hasOwnProperty('schemas') &&
                global_schemas[namespace]['schemas'].hasOwnProperty(schema_name)) {
            delete global_schemas[namespace]['schemas'][schema_name];
        }
    } else {
        logger.warn("Namespace to delete is missing. Nothing to do.");
    }
}

// Function that is used to check the validity of schema names.
// This critical for checking new schemas that are inserted by users.
function valid_schema_name(schema_name) {
    logger.debug("In valid_schema_name.");
    var valid = false;
    var invalid_pattern = /[^A-z0-9_-]/;

    var result = invalid_pattern.test(schema_name);
    if (! result && schema_name.length <= 32) {
        // Didn't have any invalid characters
        valid = true;
    }

    return valid;
}

function get_ns_schemas(ns, callback) {
    var schemas = {};
    var aux_schemas = {};
    var ns_schema_dir;
    var ns_aux_schema_dir;

    flow.exec(
        function () {
            // Determine the directory to the schemas for this namespace.
            ns_schema_dir = path.join(working_dir, 'namespaces', ns, 'schemas');
            logger.debug("Schema dir for namespace " + ns + ": " + ns_schema_dir);

            // Scan the directory for the schema files.
            fs.readdir(ns_schema_dir, this);
        },
        function (err, files) {
            if (err) {
                logger.error("Unable to scan schema directory for namespace " + ns, err);
                throw err;
            }

            // Reject any hidden files/directories, such as .svn directories
            files = _.reject(files, function(file) {
                return file.substr(0, 1) === '.';
            });

            logger.debug("Scanned " + files.length + " schemas.");

            osdf_utils.async_for_each(
                files,
                function(file, cb) {
                    try {
                        var name = path.basename(file, '.json');
                        var file_text = fs.readFileSync(ns_schema_dir + '/' + file, 'utf8');
                        var schema_json = JSON.parse(file_text);
                        schemas[name] = schema_json;
                        cb();
                    } catch (err) {
                        logger.error("Error parsing schema file " + file, err);
                        cb();
                    }
                },
                this
            );
        },
        function() {
            // Determine the directory to the auxiliary schemas for this namespace.
            ns_aux_schema_dir = path.join(working_dir, 'namespaces', ns, 'aux');
            logger.debug("Aux schema dir for namespace " + ns + ": " + ns_aux_schema_dir);

            // Scan the directory for the schema files.
            fs.readdir(ns_aux_schema_dir, this);
        },
        function(err, files) {
            if (err) {
                logger.error("Unable to scan schema directory for namespace " + ns, err);
                throw err;
            }

            // Reject any hidden files/directories, such as .svn directories
            files = _.reject(files, function(file) {
                return file.substr(0, 1) === '.';
            });

            logger.debug("Scanned " + files.length + " auxiliary schemas.");

            osdf_utils.async_for_each(
                files,
                function(file, cb) {
                    try {
                        var name = path.basename(file, '.json');
                        var file_text = fs.readFileSync(ns_aux_schema_dir + '/' + file, 'utf8');
                        var aux_schema_json = JSON.parse(file_text);
                        aux_schemas[name] = aux_schema_json;
                        cb();
                    } catch (err) {
                        logger.error("Error parsing aux schema file " + file, err);
                        cb();
                    }
                },
                this
            );
        },
        function() {
            var final_struct = { 'schemas': schemas,
                                 'aux': aux_schemas };
            callback(final_struct);
        }
    );
}
