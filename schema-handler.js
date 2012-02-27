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
var global_schemas = {};

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
        response.send('', {'X-OSDF-Error': "Namespace or schema not found."}, 404);
        return;
    }
};

function get_ns_schemas(ns, callback) {
    var schemas = {};
    var aux_schemas = {};
    var ns_schema_dir;
    var ns_aux_schema_dir;

    flow.exec(
        function () {
            // Determine the directory to the schemas for this namespace.
            ns_schema_dir = path.join(root_local_dir, '/working/namespaces/', ns, '/schemas');
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
            ns_aux_schema_dir = path.join(root_local_dir, '/working/namespaces/', ns, '/aux');
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

exports.init = function (emitter) {
    logger.debug("In init.");

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
            response.send('', {'X-OSDF-Error': "Auxiliary schema not found."}, 404);
        }
    } else {
        logger.warn("Unknown ns: " + ns);
        response.send('', {'X-OSDF-Error': "Namespace not found."}, 404);
    }
};

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
            response.send('', {'X-OSDF-Error': "Schema not found."}, 404);
        }
    } else {
        logger.warn("Unknown ns: " + ns);
        response.send('', {'X-OSDF-Error': "Namespace not found."}, 404);
    }
};

exports.create_schema = function (request, response) {
    logger.debug("In create_schema.");
    response.send('', {'X-OSDF-Error': "Not yet implemented."}, 501);
};

/* Delete a JSON schema from a namespace. We delete it
   from memory as well as from disk. A user must have 'write' access to the
   namespace in order to delete one of the namespace's auxiliary
   schemas.
 */
exports.delete_schema = function (request, response) {
    logger.debug("In delete_schema.");

    var ns = request.params.ns;
    var schema = request.params.schema;

    if (! global_schemas.hasOwnProperty(ns)) {
        logger.warn("User attempted to delete a schema from unknown namespace " + ns);
        response.send('', {'X-OSDF-Error': "Namespace not found."}, 404);
        return;
    }

    if (global_schemas[ns].hasOwnProperty('schemas') &&
            global_schemas[ns]['schemas'].hasOwnProperty(schema)) {

        // Delete from the filesystem, and if successful, from memory.
        var schema_path = path.join(root_local_dir, '/working/namespaces/',
                                    ns, 'schemas', schema + '.json');
        fs.unlink(schema_path, function (err) {
            if (err) {
                logger.error(err);
                response.send('', {'X-OSDF-Error': "Unable to delete schema."}, 500);
            } else {
                logger.debug("Successful deletion of schema file. Deleting from memory...");
                delete global_schemas[ns]['schemas'][schema];

                // Can't use this, so we have to reach down to the module.exports 
                // to get the inherited emit() function.
                module.exports.emit("delete_schema", { 'ns': ns, 'schema': schema });

                // Send a message to the master process so that it can notify other
                // sibling workers about this.
                process.send({ cmd: "schema_change",
                               type: "deletion",
                               ns: ns,
                               schema: schema
                             });

                response.send('', 204);
            }
        });

    } else {
        logger.warn("User attempted to delete a non-existent schema: " + schema);
        response.send('', {'X-OSDF-Error': "Schema not found."}, 404);
        return;
    }
};

/* Delete an auxiliary schema.  We delete it from memory
   as well as from disk. A user must have 'write' access to the
   namespace in order to delete one of the namespace's auxiliary
   schemas.
 */
exports.delete_aux_schema = function (request, response) {
    logger.debug("In delete_aux_schema.");

    var ns = request.params.ns;
    var aux = request.params.aux;

    if (! global_schemas.hasOwnProperty(ns)) {
        logger.warn("User attempted to delete an aux schema from unknown namespace " + ns);
        response.send('', {'X-OSDF-Error': "Namespace not found."}, 404);
        return;
    }

    if (global_schemas[ns].hasOwnProperty('aux') &&
            global_schemas[ns]['aux'].hasOwnProperty(aux)) {

        // Delete from the filesystem, and if successful, from memory.
        var aux_path = path.join(root_local_dir, '/working/namespaces/',
                                 ns, '/aux/', aux + '.json');

        fs.unlink(aux_path, function (err, data) {
            if (err) {
                logger.err(err);
                response.send('', {'X-OSDF-Error': "Unable to delete auxiliary schema."}, 500);
            } else {
                logger.debug("Successful deletion of auxiliary schema. Deleting from memory...");
                delete global_schemas[ns]['aux'][aux];
                response.send('', 204);
            }
        });

    } else {
        logger.warn("User attempted to delete a non-existent aux schema: " + aux);
        response.send('', {'X-OSDF-Error': "Auxiliary schema not found."}, 404);
        return;
    }
};
