#!/usr/bin/node

var events = require('events');
var ee = new events.EventEmitter();
ee.setMaxListeners(0);

var flow = require('flow');
var utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_node = { ns: 'test',
                  acl: { read: ['all'], write: ['all'] },
                  linkage: {},
                  node_type: 'test',
                  meta: {}
                };

var test_node_schema = { ns: 'test',
                         acl: { read: ['all'], write: ['all'] },
                         linkage: {},
                         node_type: 'example',
                         meta: {
                              description: "my description",
                              color: "indigo",
                         }
                       };

exports['basic_update'] = function (test) {
    test.expect(8);

    var node_id;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node( test_node, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node." );

            test.ok(data == "", "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id = location.split('/').pop();

            var initial_version;
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var inserted = JSON.parse(data);
            initial_version = inserted['ver'];

            // Okay, now to modify the node, I have to put the version in
            var modified_node = test_node;
            modified_node.meta['modified'] = true;
            modified_node['ver'] = initial_version;

            // then try to update it
            tutils.update_node( node_id, modified_node, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 200, "Correct status for update.");

            test.ok(data == "", "No content returned.");

            // Retreieve and check that the update took effect
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var retrieved = JSON.parse(data);
            test.ok("ver" in retrieved, "Retrieved node has version in in.");
            test.ok("meta" in retrieved, "Retrieved node has metadata in in.");

            test.ok("modified" in retrieved.meta, "Retrieved node modified as expected.");

            // Try to clean up by deleting the node.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {}

            test.done();
        }
    );
}


// Test the behavior of the system when a user attempts to update a node without
// providing the authentication token.
exports['update_no_auth'] = function (test) {
    test.expect(3);

    // Create the initial node
    tutils.insert_node( test_node, auth, function(data, response) {

        var location = response.headers.location;
        var node_id = location.split('/').pop();

        var modified_node = test_node;
        modified_node.meta['modified'] = true;

        // then try to update it with no authentication
        tutils.update_node( node_id, modified_node, null, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for insertion w/o auth (forbidden).");

            test.ok(! ("location" in response.headers), "Response header does not contain location of new node." );
                  
            test.ok(data == "", "No content returned.");

            test.done();

            // Try to clean up by deleting the node.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {}
        });

    });
}


// Test the behavior of the system when a user attempts to update a node with
// an invalid or incorrect authentication token.
exports['update_bad_auth'] = function (test) {

    test.expect(3);

    // Create the initial node
    tutils.insert_node( test_node, auth, function(data, response) {

        var location = response.headers.location;
        var node_id = location.split('/').pop();

        var modified_node = test_node;
        modified_node.meta['modified'] = true;

        // then try to update it with no authentication
        tutils.update_node( node_id, modified_node, bad_auth, function(data, response) {
            test.equal(response.statusCode, 403,
                "Correct status for insertion w/o auth (forbidden).");

            test.ok(! ("location" in response.headers),
                "Response header does not contain location of new node." );
                  
            test.ok(data == "", "No content returned.");

            test.done();

            // Try to clean up by deleting the node.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {}
        });

    });
}

// Test the system's behavior when updating a node that is tied
// to a schema. First we create/insert a fresh node, then we make an update to it.
// The update is valid, so we should check that the update
// took effect by reading back the new node. 
exports['valid_update_with_schema_validation'] = function (test) {
    test.expect(4);

    var node_id;
    var initial_version;

    flow.exec(
        function() {
            // create a node
            tutils.insert_node( test_node, auth, this);
        }, function(data, response) {
            var location = response.headers.location;
            node_id = location.split('/').pop();

            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var initial_node = JSON.parse(data);
            initial_version = initial_node.ver;
            var modified_node = test_node_schema;
            modified_node['ver'] = initial_version;

            // then try to update it with data that is valid and controlled by a schema
            tutils.update_node(node_id, modified_node, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 200, "Correct status for insertion.");

            test.ok(data == "", "No content returned.");

            // Retrieve the node and double check that it was modified.
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var retrieved = JSON.parse(data);

            test.ok(retrieved.node_type == 'example', "Updated node was modified.");
            test.ok(retrieved['ver'] !== initial_version, "Module version changed.");

            // Try to clean up by deleting the node.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {}

            test.done();
        }
    );
};

exports['invalid_update_with_schema_validation'] = function (test) {
    test.expect(2);

    var node_id;

    flow.exec(
        function() {
            // create a node
            tutils.insert_node( test_node, auth, this);
        }, function(data, response) {
            var location = response.headers.location;
            node_id = location.split('/').pop();

            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var initial_node = JSON.parse(data);
            var initial_version = initial_node.ver;
            var modified_node = test_node_schema;

            modified_node['ver'] = initial_version;

            // Use a value in the new node that is invalid per the schema. In this case,
            // we're going to use an invalid color
            modified_node['meta']['color'] = "pink";

            // then try to update it with data that is valid and controlled by a schema
            tutils.update_node(node_id, modified_node, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 422, "Correct status for insertion with invalid data.");

            test.ok(data == '', "No content returned.");

            // Try to clean up by deleting the node.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {}

            test.done();
        }
    );
};

// Check the behavior of the system when an attempt is made to modify a
// perfectly valid node by altering the namespace to an invalid/unknown
// namespace. That operation should result in an error. As usual, we insert a
// brand new node, then attempt to make the modification and examine the
// results.
exports['update_into_unknown_namespace'] = function (test) {
    test.expect(2);

    var node_id;

    flow.exec(
        function() {
            // create a node
            tutils.insert_node( test_node, auth, this);
        }, function(data, response) {
            var location = response.headers.location;
            node_id = location.split('/').pop();

            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var initial_node = JSON.parse(data);
            var initial_version = initial_node.ver;
            var modified_node = test_node_schema;
            modified_node['ver'] = initial_version;

            // Use a bogus namespace value to attempt to place the node into
            // a namespace that doesn't exist.
            modified_node['ns'] = utils.random_string(5);

            // then try to update it with data that is valid and controlled by a schema
            tutils.update_node(node_id, modified_node, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 422,
                "Correct status for insertion with invalid data.");

            test.ok(data == '', "No content returned.");

            // Try to clean up by deleting the node.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {}

            test.done();
        }
    );
};
