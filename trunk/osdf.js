#!/usr/bin/node

// Add an additional directory, the 'lib' directory, to the 'require' search path.
require.paths.unshift(__dirname + "/lib");
require.paths.unshift('.');

var _ = require('underscore');
var express = require('express');
var events = require('events');
var utils = require('utils');
var auth_enforcer = require('auth_enforcer');
var header_fixer = require('fix_headers');
var info_handler = require('info-handler');
var node_handler = require('node-handler');
var perms_handler = require('perms-handler');
var query_handler = require('query-handler');
var ns_handler = require('namespace-handler');
var schema_handler = require('schema-handler');
var fs = require('fs');
var logger = utils.get_logger();

console.log("OSDF_ROOT: " + utils.get_osdf_root());

// This event emitter is instrumental in providing us
// a way of knowing when all our handlers are ready.
var eventEmitter = new events.EventEmitter();

wait_for_initialization();

// This is the function that launches the app when all
// initialization is complete.
function launch() {
    var app = express.createServer(
        express.logger(),
        header_fixer.remove_powered_by(),
        auth_enforcer.authenticate(),
        express.bodyParser()
    );

    app.get('/nodes/:id', node_handler.get_node);
    app.get('/nodes/:id/ver/:ver', node_handler.get_node);
    app.post('/nodes', node_handler.insert_node);
    app.put('/nodes/:id', node_handler.update_node);
    app.delete('/nodes/:id', node_handler.delete_node);
    app.get('/nodes/:id/out', node_handler.get_out_linkage);
    app.get('/nodes/:id/in', node_handler.get_in_linkage);

    app.post('/nodes/query', query_handler.post_query);
    app.get('/nodes/query/:token', query_handler.getQueryResults);
    app.get('/nodes/query/:token/page/:page', query_handler.getQueryResults);

    app.get('/info', info_handler.info);

    app.get('/namespaces', ns_handler.get_all_namespaces);
    app.get('/namespaces/:ns', ns_handler.get_namespace);

    app.get('/namespaces/:ns/schemas', schema_handler.get_all_schemas);
    app.get('/namespaces/:ns/schemas/:schema', schema_handler.get_schema);
    app.post('/namespaces/:ns/schemas', schema_handler.post_schema);
    app.delete('/namespaces/:ns/schemas/:schema', schema_handler.delete_schema);

    require('config');
    var c = Config.get_instance(utils.get_config());
    var bind_address = c.value("global", "bind_address");
    var port = c.value("global", "port");

    // Check that we have some valid settings.
    if (bind_address == null || bind_address.length == 0) {
        console.log("The 'bind_address' setting is not configured.");
        process.exit(1);
    }

    if (port == null || port.length == 0) {
        console.log("The 'port' setting is not configured.");
        process.exit(1);
    }

    app.listen(port, bind_address);
    
    // If we are being started via sys-v style init scripts we are probably being
    // invoked as root. If we need to listen on a well known port, we need to be
    // launched as root to bind to the port, but then drop down to another UID.
    if (process.getuid() == 0) {
        // Who do we drop privileges to?
        var user = c.value("global", "user");
        if (user === null) {
            console.log("The 'user' setting is not configured.");
            process.exit(1);
        }

        console.log("Launched as root. Switching to " + user); 
        process.setuid(user);
    }

    // Show some details about the server after it's up and running.
    show_ready(app.address().address, app.address().port);
}

// Display server details when we have started up.
function show_ready(address, port) {
    console.log("Total number of registered OSDF users: " + auth_enforcer.get_user_count());
    console.log("=================================");
    console.log("Welcome to");
    console.log(new Buffer("ICBfX19fICBfX19fX19fICBfX19fCiAvIF9fIFwvIF9fLyBfIFw" +
                           "vIF9fLwovIC9fLyAvXCBcLyAvLyAvIF8vClxfX19fL19fXy9fX19fL18vCgo=",
                           'base64').toString('utf8'));

    console.log('Listening on server:port : ' + address + ":" + port);
}

// Wait for everything to be ready before we get going.
function wait_for_initialization() {
    listen_for_system_initialization();
    initialize();
}

// This function sets up the mechanism to wait for all the handlers
// to be ready by acting upon events that are emitted by the handlers
// when they are finished. When all the events are received, we're ready
// to proceed, and launch() is called.
function listen_for_system_initialization() {
    var signals = [ "node_handler", "info_handler", "auth_handler", "perms_handler" ];
    var handler_count = 0;

    var examine_handlers = function() {
        if (++handler_count == signals.length) {
            console.log("All handlers initialized.");
            // You may fire when ready, Gridley...
            launch();
        }
    }

    _.each(signals, function(signal) {
        eventEmitter.on(signal + "_initialized", function(message) {
            examine_handlers();
        });
    });
}


// Calls the variously handlers' initialization methods.
function initialize() {
    auth_enforcer.init(eventEmitter);
    info_handler.init(eventEmitter);
    node_handler.init(eventEmitter);
    perms_handler.init(eventEmitter);

    fs.watchFile(utils.get_config(), function (curr, prev) {
        logger.info('Detected that the configuration has been updated.');
        info_handler.update();
    }); 
}
