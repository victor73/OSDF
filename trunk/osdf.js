#!/usr/bin/node

var _ = require('underscore');
var cluster = require('cluster');
var osdf_utils = require('osdf_utils');
var logger = osdf_utils.get_logger();
var os = require('os');
var user_count;
// Flag to indicate whether a custom config file was specified
var custom_config = false;
// Flag to indicate whether a custom "working" directory was specified
var custom_working = false;
var config_path = null;
var working_path = null;

engine_start();

function engine_start() {
    require('config');
    var commander = require('commander');
    commander.option('-c, --config <path>', 'Specify a configuration file. Default is <OSDF_HOME>/conf/config.ini.')
             .option('-w, --working <path>', 'Specify a path to the working directory where namespaces data is stored.')
             .parse(process.argv);

    config_path = commander.config;
    working_path = commander.working;
    if (config_path === null || typeof config_path === 'undefined') {
        config_path = osdf_utils.get_config();
    } else {
        custom_config = true;
    }

    if (working_path === null || typeof working_path === 'undefined') {
        // nothing
    } else {
        custom_working = true;
    }

    var config = Config.get_instance(config_path);

    if (cluster.isMaster) {
        console.log("OSDF_ROOT: " + osdf_utils.get_osdf_root());

        var cpu_count = os.cpus().length;
        var workers_ready = 0;
        var worker_idx;

        console.log("Running on " + cpu_count + " CPUs.");

        var workers_array = [];

        // Fork a worker for each CPU
        for (worker_idx = 0; worker_idx < cpu_count; worker_idx++) {
            var worker = cluster.fork();

            workers_array.push(worker);

            worker.on('message', function(msg) {
                if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'user_count') {
                    user_count = msg['users'];
                }

                if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'schema_change') {
                    // TODO: Send messages to all the workers so that they can adjust their
                    // lists of active schemas.
                    var ns = msg['ns'];
                    var type = msg['type'];
                    var schema = msg['schema'];
                    logger.info("Master got a schema change event of type: " + type + ". Relay this to the workers.");

                    _.each(workers_array, function (clustered_worker) {
                        clustered_worker.send(msg);
                    });
                }

                if (msg.hasOwnProperty('cmd') && msg['cmd'] === 'init_completed') {
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
        var forked_worker = require("./worker");
        forked_worker.start_worker(config, working_path);
    }
}

// Display server details when we have started up.
function show_ready(address, port) {
    if (custom_config) {
        console.log("User specified configuration file: " + config_path);
    }

    if (custom_working) {
        console.log("User specified working area: " + working_path);
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
