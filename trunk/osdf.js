#!/usr/bin/node

var _ = require('underscore');
var cluster = require('cluster');
var path = require('path');
var os = require('os');
var config_path = null;
var working_path = null;
var log_file_path = null;
var logger = null;

// Flag that is consulted for whether we will attempt to spawn
// replacement workers if any should die. This will be set to
// true when we shutdown via the 'exit' handler.
var letWorkersDie = false;

// Flags to indicate whether a non-standard config file location or
// non-standard working directories were specified.
var custom_config = false;
var custom_working = false;
var custom_log_file = false;
var osdf_utils = require('osdf_utils');

configure();

function engine_start() {
    // Get the configuration.
    require('config');
    var config = Config.get_instance(config_path);

    if (cluster.isMaster) {
        start_master(config);
    } else {
        var forked_worker = require("./worker");
        forked_worker.start_worker(config, working_path);
    }
}

function configure() {
    var commander = require('commander');

    commander.option('-c, --config <path>', 'Specify a configuration file. Default is <OSDF_HOME>/conf/config.ini.')
             .option('-w, --working <path>', 'Specify a path to the working directory where namespaces data is stored.')
             .option('-l, --log <path>', 'Specify the path to the log file.')
             .parse(process.argv);

    config_path = commander.config;
    working_path = commander.working;
    log_file_path = commander.log;

    if (config_path === null || typeof config_path === 'undefined') {
        config_path = osdf_utils.get_config();
    } else {
        osdf_utils.set_config(config_path);
        custom_config = true;
    }

    if (log_file_path === null || typeof log_file_path === 'undefined') {
        //log_file_path = path.join(osdf_utils.get_osdf_root(), '/logs/osdf.log'); 
    } else {
        // Set the path to hte log file and...
        osdf_utils.set_log_file(log_file_path);
        custom_log_file = true;
    }

    // ...get the logger object
    logger = osdf_utils.get_logger();

    if (working_path === null || typeof working_path === 'undefined') {
        // Nothing specified, get the default
        working_path = osdf_utils.get_working_dir();
        engine_start();
    } else {
        custom_working = true;
        osdf_utils.set_working_dir(working_path, function() {
            engine_start();
        });
    }
}

function start_master(config) {
    console.log("OSDF_ROOT: " + osdf_utils.get_osdf_root());

    var cpu_count = os.cpus().length;
    var workers_ready = 0;
    var worker_idx;

    console.log("Running on " + cpu_count + " CPUs.");

    var workers_array = [];

    var ready_data = {};

    // Fork a worker for each CPU
    for (worker_idx = 0; worker_idx < cpu_count; worker_idx++) {
        var worker = cluster.fork();

        workers_array.push(worker);

        worker.on('message', function(msg) {
            if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'user_count') {
                ready_data['user_count'] = msg['users'];
            }

            if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'schema_change') {
                // Send messages to all the workers so that they can adjust their
                // lists of active schemas.
                var type = msg['type'];
                logger.info("Master got a schema change event of type: " + type + ". Relay this to the workers.");

                _.each(workers_array, function (clustered_worker) {
                    clustered_worker.send(msg);
                });
            }

            if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'abort') {
                var reason = msg['reason'];
                console.error("Aborting execution. Reason: " + reason);
                letWorkersDie = true;
                process.exit(1);
            }

            if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'init_completed') {
                workers_ready++;

                if (workers_ready === cpu_count) {
                    // Show some details about the server after it's up and running.
                    var bind_address = config.value("global", "bind_address");
                    var port = config.value("global", "port");
                    ready_data['address'] = bind_address;
                    ready_data['port'] = port;
                    show_ready(ready_data);
                }
            }
        });
    }

    cluster.on('death', function(worker) {
        if (! letWorkersDie) {
            console.error('Worker ' + worker.pid + ' died. Starting a replacement...');
            cluster.fork();
        }
    });

    process.on('SIGTERM', function() {
        console.error("Caught SIGTERM. Killing workers.");

        // Modify the flag so that the 'death' handler does not attempt
        // to replace the workers we are about to kill off.
        letWorkersDie = true;

        kill_workers(workers_array);
    });

    process.on('exit', function() {
        console.error("Exiting. Killing workers.");

        // Modify the flag so that the 'death' handler does not attempt
        // to replace the workers we are about to kill off.
        letWorkersDie = true;

        kill_workers(workers_array);
    });
}

function kill_workers(workers) {
    // Iterate through the workers, and kill each of them.
    _.each(workers, function(worker) {
        console.error('Killing worker ' + worker.pid);
        worker.kill();
    });
}

// Display server details when we have started up.
function show_ready(ready_data) {
    var user_count = ready_data['user_count'];
    var address = ready_data['address'];
    var port = ready_data['port'];

    if (custom_config) {
        console.log("Configured settings file: " + config_path);
    }

    if (custom_working) {
        console.log("Configured working area: " + working_path);
    }

    if (custom_log_file) {
        console.log("Configured log file: " + log_file_path);
    }

    console.log("Total number of registered OSDF users: " + user_count);
    console.log("=================================");
    console.log("Welcome to");
    console.log(new Buffer("ICBfX19fICBfX19fX19fICBfX19fCiAvIF9fIFwvIF9fLyBfIFw" +
                           "vIF9fLwovIC9fLyAvXCBcLyAvLyAvIF8vClxfX19fL19fXy9fX19fL18vCgo=",
                           'base64').toString('utf8'));
    console.log("Open Science Data Framework\n");

    console.log('Listening on server:port : ' + address + ":" + port);
}
