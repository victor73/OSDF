#!/usr/bin/node

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

exports['basic_insertion'] = function (test) {
    test.expect(3);

    var node_id;

    // First we create a node
    tutils.insert_node( test_node, auth, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion.");
        test.ok("location" in response.headers, "Response header contains location of new node." );

        var location = response.headers.location;
        node_id = location.split('/').pop();

        test.ok(data === '', "No content returned on a node insertion.");

        // Clean-up (delete the inserted node)
        try {
            tutils.delete_node(node_id, auth, function(){});
        } catch (e) {}
        test.done();
    });
};

// Attempt a node insertion without providing an authentication token.
exports['basic_insertion_no_auth'] = function (test) {
    test.expect(2);

    // First we create a node
    tutils.insert_node( test_node, null, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for unauthorized insertion.");

        test.ok(data === '', "No content returned on a unauthorized node insertion.");

        test.done();
    });
};

// Attempt a node insertion with an invalid authentication token.
exports['basic_insertion_bad_auth'] = function (test) {
    test.expect(2);

    // First we create a node
    tutils.insert_node( test_node, bad_auth, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for unauthorized insertion.");

        test.ok(data === '', "No content returned on a unauthorized node insertion.");

        test.done();
    });
};

// Check the behavior of the system when inserting a valid node that is
// mapped to a node type that has a schema associated with it.
exports['valid_insertion_with_schema_validation'] = function (test) {
    test.expect(4);

    var node_id;
    var inserted = false;

    // Attempt to insert a node
    tutils.insert_node( test_node_with_schema, auth, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion.");
        test.ok("location" in response.headers, "Response header contains location of new node." );

        try {
            var location = response.headers.location;
            node_id = location.split('/').pop();

            test.ok(node_id.length > 0, "Got a node id from the insertion.");
            inserted = true;
        } catch (e) {
            test.fail("Unable to determine new node's id.");
        }

        test.ok(data === '', "No content returned on a node insertion.");

        if (inserted) {
            try {
                tutils.delete_node(node_id, auth, function(body, response) {
                    // ignored
                });
            } catch (f) {
                console.log("Problem deleting inserted node: ", f);
            }
        }

        test.done();
    });
};


// Check the behavior of the system when inserting a node that does
// NOT validate against the schema associated with the node's 'node_type'.
exports['invalid_insertion_with_schema_validation'] = function (test) {
    test.expect(3);

    var node_id;

    // We make a 'bad' node by copying our good node, and then deleting a required
    // property in that the validator mandates should be present.
    var bad_node = test_node_with_schema;
    delete bad_node.meta['color'];

    // First we create a node
    tutils.insert_node( bad_node, auth, function(data, response) {
        test.equal(response.statusCode, 422, "Correct status for insertion of bad node.");
        test.ok(! ("location" in response.headers), "Response header does not contain 'location'." );

        test.ok(data === '', "No content returned on a bad node insertion.");

        // We shouldn't get in here, but you never know.
        if ("location" in response.headers) {
            try {
                var location = response.headers.location;
                node_id = location.split('/').pop();

                // We should NOT have inserted, because the node inserted is invalid, but if we DID
                // insert anyway (perhaps due to a bug), then we clean up after ourselves by deleting.
                tutils.delete_node(node_id, auth, function(body, response) {
                    //
                });
            } catch (e) {
                console.log("Problem deleting inserted node: ", e);
            }
        }

        test.done();
    });
};

// Test what happens when we attempt to insert a node into
// an unknown namespace. We should get an error.
exports['insertion_into_unknown_namespace'] = function (test) {
    test.expect(2);

    var bad_node = test_node;

    // Overwrite the namespace with a randomly generated one.
    bad_node.ns = osdf_utils.random_string(8);

    tutils.insert_node( bad_node, auth, function(data, response) {
        test.equal(response.statusCode, 422, "Correct status for node with bad namespace.");

        test.ok(data === '', "No content returned on bad node insertion.");

        // We shouldn't get in here, but you never know.
        if ("location" in response.headers) {
            try {
                var location = response.headers.location;
                node_id = location.split('/').pop();

                // We should NOT have inserted, because the node inserted is invalid, but if we DID
                // insert anyway (perhaps due to a bug), then we clean up after ourselves by deleting.
                tutils.delete_node(node_id, auth, function(body, response) {
                    //
                });
            } catch (e) {
                console.log("Problem deleting inserted node: ", e);
            }
        }

        test.done();
    });
};

// Test what happens when we attempt to insert a node into
// an unknown namespace AND without an authorization token.
// We should get an HTTP 403 (Forbidden) error.
exports['insertion_into_unknown_namespace_no_auth'] = function (test) {
    test.expect(2);

    var bad_node = test_node;

    // Overwrite the namespace with a randomly generated one.
    bad_node.ns = osdf_utils.random_string(8);

    tutils.insert_node( bad_node, null, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for node with bad ns, no auth.");

        test.ok(data === '', "No content returned on bad node insertion.");

        // We shouldn't get in here, but you never know.
        if ("location" in response.headers) {
            try {
                var location = response.headers.location;
                node_id = location.split('/').pop();

                // We should NOT have inserted, because the node inserted is invalid, but if we DID
                // insert anyway (perhaps due to a bug), then we clean up after ourselves by deleting.
                tutils.delete_node(node_id, auth, function(body, response) {
                    //
                });
            } catch (e) {
                console.log("Problem deleting inserted node: ", e);
            }
        }

        test.done();
    });
};
