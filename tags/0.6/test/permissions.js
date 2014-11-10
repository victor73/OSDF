#!/usr/bin/node

var events = require('events');
var sec = require('perms-handler');
var osdf_utils = require('osdf_utils');

var logger = osdf_utils.get_logger();
var sec_initialized = false;
var test_user = "test";
var privileged_user = "test_executive";

var test_node = { ns: 'test',
                  acl: { read: [ 'all' ], write: [ 'all' ] },
                  linkage: {},
                  node_type: 'test',
                  meta: {}
                };

var restricted_node = {
                  ns: 'test',
                  acl: { read: [ 'executives' ], write: [ 'executives' ] },
                  linkage: {},
                  node_type: 'test',
                  meta: {}
                };
            
// Test the behavior of whether the system can decide if a user can read
// a node given that node's ACL settings.
exports['test_read_perms'] = function (test) {
    logger.debug("In test_read_perms.");

    if (sec_initialized) {
        // Already initialized, so we can skip initialization.
        read_tests(test);
    } else {
        // If we had a test.setup() function , we would do this there, but we don't.
        var eventEmitter = new events.EventEmitter();

        eventEmitter.on("perms_handler_initialized", function(message) {
            sec_initialized = true;
            read_tests(test);
        });

        sec.init(eventEmitter);
    }
};

// Test the behavior of whether the system can decide if a user can write
// (update/delete) a node given that node's ACL settings.
exports['test_write_perms'] = function (test) {
    logger.debug("In test_write_perms.");

    if (sec_initialized) {
        // Already initialized, so we can skip initialization.
        write_tests(test);
    } else {
        // If we had a test.setup() function , we would do this there, but we don't.
        var eventEmitter = new events.EventEmitter();

        eventEmitter.on("perms_handler_initialized", function(message) {
            sec_initialized = true;
            write_tests(test);
        });

        sec.init(eventEmitter);
    }
};

function read_tests(test) {
    test.expect(3);

    var has_read = sec.has_read_permission(test_user, test_node);
    test.ok(has_read == true, "User '" + test_user + "' can read test node.");
    
    has_read = sec.has_read_permission(test_user, restricted_node);
    test.ok(has_read == false, "User '" + test_user + "' cannot read restricted test node.");

    has_read = sec.has_read_permission(privileged_user, restricted_node);
    test.ok(has_read == true, "User '" + privileged_user + "' can read test node.");

    test.done();
}

function write_tests(test) {
    test.expect(3);

    var has_write = sec.has_write_permission("test", test_node);
    test.ok(has_write, "User '" + test_user + "' can write test node");

    has_write = sec.has_write_permission(test_user, restricted_node);
    test.ok(has_write == false, "User '" + test_user + "' cannot write restricted node.");

    has_write = sec.has_write_permission(privileged_user, restricted_node);
    test.ok(has_write == true, "User '" + privileged_user + "' can write restricted node.");

    test.done();
}
