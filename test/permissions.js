var assert = require('chai').assert;
var events = require('events');
var format = require('string-format');
var sec = require('perms-handler');
var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils');

var logger = tutils.get_null_logger();
format.extend(String.prototype);

var sec_initialized = false;
var test_user = 'test';
var privileged_user = 'test_executive';

var test_node = {
    ns: 'test',
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

function read_tests(done) {
    logger.debug('In read_tests.');

    var has_read = sec.has_read_permission(test_user, test_node);
    assert.isTrue(has_read,
        'User "{}" can read test node.'.format(test_user));

    has_read = sec.has_read_permission(test_user, restricted_node);
    assert.isFalse(has_read,
        'User "{}" cannot read restricted test node.'.format(test_user));

    has_read = sec.has_read_permission(privileged_user, restricted_node);
    assert.isTrue(has_read,
        'User "{}" can read test node.'.format(privileged_user));

    done();
}

function write_tests(done) {
    logger.debug('In write_tests.');

    var has_write = sec.has_write_permission('test', test_node);
    assert.isTrue(has_write,
        'User "{}" can write test node'.format(test_user));

    has_write = sec.has_write_permission(test_user, restricted_node);
    assert.isFalse(has_write,
        'User "{}" cannot write restricted node.'.format(test_user));

    has_write = sec.has_write_permission(privileged_user, restricted_node);
    assert.isTrue(has_write,
        'User "{}" can write restricted node.'.format(privileged_user));

    done();
}

describe('permissions', function() {
    // Test the behavior of whether the system can decide if a user can read
    // a node given that node's ACL settings.
    it('read_perms', function(done) {
        logger.debug('In read_perms.');

        if (sec_initialized) {
            // Already initialized, so we can skip initialization.
            read_tests(done);
        } else {
            // If we had a test.setup() function, we would do this there,
            // but we don't.
            var eventEmitter = new events.EventEmitter();

            eventEmitter.on('perms_handler_initialized', function(message) {
                sec_initialized = true;
                read_tests(done);
            });

            sec.init(eventEmitter);
        }
    });

    // Test the behavior of whether the system can decide if a user can write
    // (update/delete) a node given that node's ACL settings.
    it('write_perms', function(done) {
        logger.debug('In write_perms.');

        if (sec_initialized) {
            // Already initialized, so we can skip initialization.
            write_tests(done);
        } else {
            // If we had a test.setup() function, we would do this there,
            // but we don't.
            var eventEmitter = new events.EventEmitter();

            eventEmitter.on('perms_handler_initialized', function(message) {
                sec_initialized = true;
                write_tests(done);
            });

            sec.init(eventEmitter);
        }
    });
});

