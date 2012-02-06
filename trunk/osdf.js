#!/usr/bin/node

// Add an additional directory, the 'lib' directory, to the 'require' search path.
var _ = require('underscore');
var auth_enforcer = require('auth_enforcer');
var cluster = require('cluster');
var express = require('express');
var events = require('events');
var osdf_utils = require('osdf_utils');
var fs = require('fs');
var logger = osdf_utils.get_logger();
var os = require('os');
var user_count;

// This event emitter is instrumental in providing us
// a way of knowing when all our handlers are ready.
var eventEmitter = new events.EventEmitter();
eventEmitter.setMaxListeners(0);

engine_start();

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

// Wait for everything to be ready before we get going.
function start_worker(config) {
    listen_for_init_completion(config);
    initialize();
}

// This function sets up the mechanism to wait for all the handlers
// to be ready by acting upon events that are emitted by the handlers
// when they are finished. When all the events are received, we're ready
// to proceed, and launch() is called.
function listen_for_init_completion(config) {
    var signals = [ "node", "info", "auth", "perms", "query" ];
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

function engine_start() {
    require('config');
    var config = Config.get_instance(osdf_utils.get_config());

    if (cluster.isMaster) {
        console.log("OSDF_ROOT: " + osdf_utils.get_osdf_root());

        var cpu_count = os.cpus().length;
        var workers_ready = 0;
        var worker_idx;

        console.log("Running on " + cpu_count + " CPUs.");

        // Fork a work for each CPU
        for (worker_idx = 0; worker_idx < cpu_count; worker_idx++) {
            var worker = cluster.fork();

            worker.on('message', function(msg) {
                if (msg['cmd'] && msg['cmd'] === 'user_count') {
                    user_count = msg['users'];
                }

                if (msg.cmd && msg.cmd === 'init_completed') {
                    workers_ready++;

                    if (workers_ready === cpu_count) {
                        // Show some details about the server after it's up and running.
                        var bind_address = config.value("global", "bind_address");
                        var port = config.value("global", "port");
                        show_ready(bind_address, port);
                    }
                }
            });
        }

        cluster.on('death', function(worker) {
            console.log('Worker ' + worker.pid + ' died. Starting a replacement...');
            cluster.fork();
        });

    } else {
        start_worker(config);
    }
}

// Calls the variously handlers' initialization methods.
function initialize() {
    var info_handler = require('info-handler');
    var node_handler = require('node-handler');
    var perms_handler = require('perms-handler');
    var ns_handler = require('namespace-handler');
    var schema_handler = require('schema-handler');
    var query_handler = require('query-handler');

    // These initializations happen asynchronously, so we use events to
    // to track their completion.
    auth_enforcer.init(eventEmitter);
    info_handler.init(eventEmitter);
    node_handler.init(eventEmitter);
    perms_handler.init(eventEmitter);
    query_handler.init(eventEmitter);

    fs.watchFile(osdf_utils.get_config(), function (curr, prev) {
        if (curr.mtime.getTime() !== prev.mtime.getTime()) {
            logger.info('Detected that the configuration has been updated.');
            info_handler.update();
        }
    }); 
}

// Display server details when we have started up.
function show_ready(address, port) {
    console.log("Total number of registered OSDF users: " + user_count);
    console.log("=================================");
    console.log("Welcome to");
    console.log(new Buffer("ICBfX19fICBfX19fX19fICBfX19fCiAvIF9fIFwvIF9fLyBfIFw" +
                           "vIF9fLwovIC9fLyAvXCBcLyAvLyAvIF8vClxfX19fL19fXy9fX19fL18vCgo=",
                           'base64').toString('utf8'));
    console.log("Open Science Data Framework\n");

    console.log('Listening on server:port : ' + address + ":" + port);
}
