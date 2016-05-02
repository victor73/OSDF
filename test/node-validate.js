#!/usr/bin/node

/*jshint sub:true*/

var osdf_utils = require('../lib/osdf_utils');
var tutils = require('./lib/test_utils.js');

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_node = { ns: 'test',
                  acl: { 'read': [ 'all' ], 'write': [ 'all' ] },
                  linkage: {},
                  node_type: 'unregistered',
                  meta: {}
                };

var test_node_with_schema = {
                  ns: 'test',
                  acl: { 'read': [ 'all' ], 'write': [ 'all' ] },
                  linkage: {},
                  node_type: 'example',
                  meta: {
                      description: "something",
                      color: "blue"
                  }
              };

exports['basic_validation_no_schema_control'] = function(test) {
    test.expect(2);

    tutils.validate_node(test_node, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 200,
                       "Correct status for validation.");

            test.ok(data === '',
                    "No content returned on a good node validation.");
        }

        test.done();
    });
};

exports['basic_validation_with_schema_control'] = function(test) {
    test.expect(2);

    tutils.validate_node(test_node_with_schema, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 200,
                       "Correct status for validation.");

            test.ok(data === '',
                    "No content returned on a good node validation.");
        }

        test.done();
    });
};

exports['basic_validation_with_invalid_node'] = function(test) {
    test.expect(3);

    var invalid_node = test_node_with_schema;
    delete invalid_node['meta']['color'];

    tutils.validate_node(invalid_node, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                       "Correct status for invalid node.");

            test.ok(data !== '', "Content returned on a bad node validation.");

            // Message should say something about 'color' being missing...
            test.ok(data.indexOf("color") !== -1,
                    "Error message mentioned missing property.");
        }

        test.done();
    });
};

// Attempt a node validation without providing an authentication token.
exports['basic_validation_no_auth'] = function(test) {
    test.expect(2);

    tutils.validate_node(test_node, null, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 403,
                       "Correct status for unauthorized validation.");

            test.ok(data === '',
                    "No content returned on a unauthorized node validation.");
        }

        test.done();
    });
};

// Attempt a node validation with an invalid authentication token.
exports['basic_validation_bad_auth'] = function(test) {
    test.expect(2);

    // First we create a node
    tutils.validate_node(test_node, bad_auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 403,
                       "Correct status for unauthorized validation.");

            test.ok(data === '',
                    "No content returned on a unauthorized node validation.");
        }

        test.done();
    });
};

// Test what happens when we attempt to validate a node with
// an unknown namespace. We should get an error.
exports['validation_with_unknown_namespace'] = function(test) {
    test.expect(2);

    var bad_node = test_node;

    // Overwrite the namespace with a randomly generated one.
    bad_node.ns = osdf_utils.random_string(8);

    tutils.validate_node(bad_node, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                       "Correct status for node with bad namespace.");

            test.ok(data !== "", "Content is returned on bad node validation.");
        }

        test.done();
    });
};

// Test what happens when we attempt to validate a node with an unknown
// namespace AND without an authorization token.  We should get an HTTP 403
// (Forbidden) error.
exports['validation_with_unknown_namespace_no_auth'] = function(test) {
    test.expect(2);

    var bad_node = test_node;

    // Overwrite the namespace with a randomly generated one.
    bad_node.ns = osdf_utils.random_string(8);

    tutils.validate_node(bad_node, null, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 403,
                       "Correct status for node with bad namespace, no auth.");

            test.ok(data === "", "No content returned on bad node " +
                                 "validation with no authentication.");
        }

        test.done();
    });
};

exports['validation_with_valid_linkage'] = function(test) {
    test.expect(2);

    var test_node = { ns: 'test2',
                      acl: { 'read': ['all'], 'write': ['all'] },
                      linkage: {},
                      node_type: 'target',
                      meta: { color: 'red' }
                    };

    tutils.validate_node(test_node, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 200,
                       "Correct status for node with valid linkages.");

            test.ok(data === "", "No Content returned.");
        }

        test.done();
    });
};

exports['validation_with_invalid_linkage'] = function(test) {
    test.expect(3);

    var test_node = { ns: 'test2',
                      acl: { 'read': ['all'], 'write': ['all'] },
                      linkage: { related_to: [ "XXXXXX" ]},
                      node_type: 'example',
                      meta: {}
                    };

    tutils.validate_node(test_node, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                       "Correct status for node with valid linkages.");

            test.ok(data !== "", "Validation results returned.");

            test.ok(data.search("linkage") !== -1,
                    "Validation output mentioned linkage.");
        }

        test.done();
    });
};

