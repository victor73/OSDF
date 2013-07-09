var _ = require('underscore');
var auth_enforcer = require('auth_enforcer');
var fs = require('fs');
var osdf_utils = require('osdf_utils');
var logger = osdf_utils.get_logger();
var events = require('events');
var express = require('express');

var node_handler = require('node-handler');
var info_handler = require('info-handler');
var perms_handler = require('perms-handler');
var ns_handler = require('namespace-handler');
var schema_handler = require('schema-handler');
var query_handler = require('query-handler');

// This event emitter is instrumental in providing us
// a way of knowing when all our handlers are ready.
var eventEmitter = new events.EventEmitter();
eventEmitter.setMaxListeners(0);

exports.start_worker = function(config, working_path) {
    // Wait for everything to be ready before we get going.
    listen_for_init_completion(config);
    initialize(working_path);
};

// Calls the various handlers' initialization methods.
function initialize(working_path) {
    // These initializations happen asynchronously, so we use events to
    // to track their completion.
    auth_enforcer.init(eventEmitter, working_path);
    info_handler.init(eventEmitter);
    node_handler.init(eventEmitter, working_path);
    perms_handler.init(eventEmitter);
    query_handler.init(eventEmitter);
    schema_handler.init(eventEmitter, working_path);

    fs.watchFile(osdf_utils.get_config(), function (curr, prev) {
        if (curr.mtime.getTime() !== prev.mtime.getTime()) {
            logger.info('Detected that the configuration has been updated.');
            info_handler.update();
        }
    }); 
}

// This function sets up the mechanism to wait for all the handlers
// to be ready by acting upon events that are emitted by the handlers
// when they are finished. When all the events are received, we're ready
// to proceed, and launch() is called.
function listen_for_init_completion(config) {
    var handlers = [ "node", "info", "auth", "perms", "query", "schema" ];
    var handler_count = 0;

    var examine_handlers = function() {
        if (++handler_count === handlers.length) {
            console.log("Handlers initialized for worker " +
                        process.env.NODE_WORKER_ID + " (PID " +
                        process.pid + ").");

            // Send message to master process
            process.send({ cmd: 'init_completed' });

            // You may fire when ready, Gridley...
            launch(config);
        }
    };

    eventEmitter.on("auth_handler_initialized", function (message) {
        var user_count = message;
        process.send({ cmd: "user_count", users: user_count });
    });

    // Allow each handler to abort the launch if there is a configuration
    // problem somewhere. For example, maybe CouchDB or ElasticSearch are down.
    _.each(handlers, function (handler) {
        eventEmitter.on(handler + "_handler_initialized", function (message) {
            examine_handlers();
        });

        eventEmitter.on(handler + "_handler_aborted", function(message) {
            console.error("Got an abort from " + handler + " handler. Reason: " + message);
            process.send({ cmd: "abort", reason: message });
        });
    });
}

// This is the function that launches the app when all
// initialization is complete.
function launch(config) {
    var app = express();

    // Register various middleware functions
    // Logging of the request
    app.use(express.logger());

    // Removed the "X-Powered-By" header (reduce bandwidth a bit).
    app.disable('x-powered-by');

    // Enforce authentication
    app.use(auth_enforcer.authenticate());

    // This custom middleware is what sets the 'rawBody' property
    app.use (function(req, res, next) {
        var data = '';
        req.setEncoding('utf8');
        req.on('data', function(chunk) {
            data += chunk;
        });
        req.on('end', function() {
            req.rawBody = data;
            next();
        });
    });

    // Node handler functions
    var routes = require('routes');
    routes.set_routes(app);
    
    var bind_address = config.value("global", "bind_address");
    var port = config.value("global", "port");

    // Check that we have some valid settings.
    if (bind_address === null || bind_address.length === 0) {
        console.log("The 'bind_address' setting is not configured.");
        process.exit(1);
    }

    if (port === null || port.length === 0) {
        console.log("The 'port' setting is not configured.");
        process.exit(1);
    }

    process.on('uncaughtException', function(err) {
        logger.error("Caught exception: " + err);
        logger.error(err.stack);
        console.log("Check log file for stack trace. Caught exception: " + err);
    });

    process.on('message', function(msg) {
        if (msg && msg.hasOwnProperty("cmd")) {
            logger.info("Got a message from the master: " +  msg['cmd']);

            if (msg['cmd'] === "schema_change") {
                node_handler.process_schema_change(msg);
                schema_handler.process_schema_change(msg);
            } else if (msg['cmd'] === "aux_schema_change") {
                node_handler.process_aux_schema_change(msg);
                schema_handler.process_aux_schema_change(msg);
            } else {
                logger.error("Received unknown process message type.");
            }
        } else {
            logger.error("Received invalid process message.");
        }
    });

    app.listen(port, bind_address);
    
    // If we are being started via sys-v style init scripts we are probably being
    // invoked as root. If we need to listen on a well known port, we need to be
    // launched as root to bind to the port, but then drop down to another UID.
    if (process.getuid() === 0) {
        // Who do we drop privileges to?
        var user = config.value("global", "user");
        if (user === null) {
            console.log("The 'user' setting is not configured.");
            process.exit(1);
        }

        console.log("Launched as root. Switching to " + user); 
        process.setuid(user);
    }
}
