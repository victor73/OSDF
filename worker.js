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

exports.start_worker = function(config) {
    // Wait for everything to be ready before we get going.
    listen_for_init_completion(config);
    initialize();
};

// Calls the variously handlers' initialization methods.
function initialize() {
    // These initializations happen asynchronously, so we use events to
    // to track their completion.
    auth_enforcer.init(eventEmitter);
    info_handler.init(eventEmitter);
    node_handler.init(eventEmitter);
    perms_handler.init(eventEmitter);
    query_handler.init(eventEmitter);
    schema_handler.init(eventEmitter);

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
    var signals = [ "node", "info", "auth", "perms", "query", "schema" ];
    var handler_count = 0;

    var examine_handlers = function() {
        if (++handler_count === signals.length) {
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

    _.each(signals, function (signal) {
        eventEmitter.on(signal + "_handler_initialized", function (message) {
            examine_handlers();
        });
    });
}

// This is the function that launches the app when all
// initialization is complete.
function launch(config) {
    var header_fixer = require('fix_headers');

    //app.use(header_fixer.remove_powered_by());
    var app = express.createServer(
        express.logger(),
        header_fixer.remove_powered_by(),
        auth_enforcer.authenticate()
    );
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
        logger.info("Got message from the master: ", msg);
        node_handler.process_schema_change(msg);
        schema_handler.process_schema_change(msg);
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
