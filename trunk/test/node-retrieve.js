#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');
var flow = require('flow');

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_node = { ns: 'test',
                  acl: { 'read': [ 'all' ], 'write': [ 'all' ] },
                  linkage: {},
                  node_type: 'test',
                  meta: {}
                };

var restricted_node = { ns: 'test',
                        acl: { 'read': [ 'all' ], 'write': [ 'all' ] },
                        linkage: {},
                        node_type: 'test',
                        meta: {}
                      };

// Test basic retrieval of a node. The approach is to first insert a node, then
// retrieve it. We also make an attempt To cleanup by deleting the node at the
// conclusion of the test.
exports['basic_retrieve'] = function (test) {
    test.expect(12);

    var node_id;

    // First we create a node
    tutils.insert_node( test_node, auth, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion.");

        test.ok("location" in response.headers, "Response header contains location of new node." );

        test.ok(data === '', "No content returned on a node insertion.");

        var location = response.headers.location;
        node_id = location.split('/').pop();
        
        // then try to retrieve it 
        tutils.retrieve_node( node_id, auth, function(data, response) {
            test.equal(response.statusCode, 200, "Correct status for node retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var node_data;
            try {
                node_data = JSON.parse(data);
            } catch (err) {
                // ignored
            }
            test.ok(node_data != null, "Data returned was valid JSON.");
            test.ok("id" in node_data, "Node data has id.");
            test.ok("ver" in node_data, "Node data has version.");
            test.ok("meta" in node_data, "Node data has metadata.");
            test.ok("linkage" in node_data, "Node data has linkage.");
            test.ok("acl" in node_data, "Node data has acl.");
            test.ok("node_type" in node_data, "Node data has node_type.");

            test.done();

            // Perform cleanup by removing what we just inserted and retrieved.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {
                console.log("Problem deleting test node during cleanup.", e);
            }
        });
    });
};

// Attempt a retrieval with no authentication header provided.
// Insert a node, then retrieve it with no authentication, then cleanup.
exports['basic_retrieve_no_auth'] = function (test) {
    test.expect(5);

    var node_id;

    // First we create a node...
    tutils.insert_node( test_node, auth, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion.");

        test.ok("location" in response.headers, "Response header contains location of new node." );

        test.ok(data === '', "No content returned on a node insertion.");

        var location = response.headers.location;
        node_id = location.split('/').pop();
        
        // ...then try to retrieve it, this should fail.
        // Note the null where the auth credentials would normally go.
        tutils.retrieve_node( node_id, null, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for retrieval without auth token.");

            test.ok(data.length === 0, "No data returned.");

            test.done();

            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {
                console.log("Problem deleting test node during cleanup.");
            }
        });
    });
};

// Attempt a retreival with no authentication header provided.
// Insert a node, then retrieve it with no authentication, then cleanup.
exports['basic_retrieve_bad_auth'] = function (test) {
    test.expect(5);

    var node_id;

    // First we create a node
    tutils.insert_node( test_node, auth, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion.");

        test.ok("location" in response.headers, "Response header contains location of new node." );

        test.ok(data === '', "No content returned on a node insertion.");

        var location = response.headers.location;
        node_id = location.split('/').pop();
        
        // then try to retrieve it, this should fail.
        tutils.retrieve_node( node_id, bad_auth, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for retrieval without auth token.");

            test.ok(data.length === 0, "No data returned.");

            test.done();

            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {
                console.log("Problem deleting test node during cleanup.");
            }
        });
    });
};

// Retreive a node by version.
exports['retrieve_by_version'] = function (test) {
    test.expect(20);

    var node_id;
    var version;
    var modified_data;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node( test_node, auth, this);
        }, function(data, response) {
            // Check that the insertion happened properly
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers,
                    "Response header contains location of new node." );

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id = location.split('/').pop();

            // Then retrieve it and modify it.
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            // Perform a modification
            var inserted_node = JSON.parse(data);
            test.ok("ver" in inserted_node, "Inserted node has version.");
            version = inserted_node['ver'];

            modified_data = test_node;
            modified_data['meta']['modified'] = true;
            modified_data['ver'] = version;

            // and save the modification
            tutils.update_node(node_id, modified_data, auth, this);
        }, function(data, response) {
            // Retrieve the modified node
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            // and double check that it was modified
            var updated = JSON.parse(data);

            test.ok("id" in updated, "Updated node has an id.");
            test.equal(updated.id, node_id, "Updated node has the same id as original.");
            test.ok("ver" in updated, "Updated node has a version.");
            var updated_version = updated['ver'];

            test.ok(updated_version !== version, "Updated node and original have different versions.");

            test.ok("modified" in updated['meta'] && updated['meta']['modified'] === true,
                    "Updated node is modified as expected.");

            // Now, retrieve the older node by version
            tutils.retrieve_node_by_version( node_id, version, auth, this);
        }, function(data, response) {
            // And examine it in detail
            test.equal(response.statusCode, 200, "Correct status for node retrieval by version.");

            test.ok(data.length > 0, "Data returned.");

            var node_data = null;
            try {
                node_data = JSON.parse(data);
            } catch (e) {
                // ignored
            }

            test.ok(node_data !== null, "Data returned was valid JSON.");
            test.ok("id" in node_data, "Node data has id.");
            test.ok("ver" in node_data, "Node data has version.");
            test.ok("meta" in node_data, "Node data has metadata.");
            test.ok("linkage" in node_data, "Node data has linkage.");
            test.ok("acl" in node_data, "Node data has acl.");
            test.ok("node_type" in node_data, "Node data has node_type.");

            // Also test that the version we requested is the version we got
            test.equal(version, node_data['ver'], "Version requested and retrieved match.");

            test.ok(node_data !== null && (! ("modified" in node_data['meta'])),
                    "Older version of node does not have modification.");

            test.done();

            // Perform cleanup by removing what we just inserted and retrieved.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {
                console.log("Problem deleting test node during cleanup.", e);
            }
        }
    );
};

// Retreive a node by version.
exports['retrieve_by_version_with_invalid_version'] = function (test) {
    test.expect(7);

    var node_id;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node( test_node, auth, this);
        }, function(data, response) {
            // Check that the insertion happened properly
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node." );

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id = location.split('/').pop();

            // Now, retrieve the node (by version) using an invalid (zero) version number.
            tutils.retrieve_node_by_version( node_id, 0, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 422, "Correct status for version number of zero.");

            test.equal(data.length, 0, "No data returned.");

            // Now, retrieve the node (by version) using an invalid (negative) version number.
            tutils.retrieve_node_by_version( node_id, -1, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 422, "Correct status for negative version number.");

            // Now, retrieve the node (by version) using an invalid (string) version number.
            // We generate it randomly.
            var random_string = osdf_utils.random_string(8);
            random_string = random_string.replace(/[0-9]/g, '');
            if (random_string.length === 0) {
                random_string = "ABCDEFG";
            }

            tutils.retrieve_node_by_version( node_id, random_string, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 422,
                       "Correct status for invalid (alphanumeric string) version.");

            test.done();

            // Perform cleanup by removing what we just inserted and retrieved.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {
                console.log("Problem deleting test node during cleanup.", e);
            }
        }
    );
};

// Retreive a node by version, but ask for the CURRENT version of the node.
// Normally one would retrieve the current version of the node by simply using
// the simple retrieve method using the node's id. However, one should ALSO be
// able to get it out using the history/versioning feature. This is unorthodox,
// but should be supported.
exports['retrieve_by_version_using_latest_version'] = function (test) {
    test.expect(20);

    var node_id;
    var version;
    var modified_data;
    var updated_version;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node( test_node, auth, this);
        }, function(data, response) {
            // Check that the insertion happened properly
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node." );

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id = location.split('/').pop();

            // Then retrieve it and modify it.
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            // Perform a modification
            var inserted_node = JSON.parse(data);
            test.ok("ver" in inserted_node, "Inserted node has version.");
            version = inserted_node['ver'];

            modified_data = test_node;
            modified_data['meta']['modified'] = true;
            modified_data['ver'] = version;

            // and save the modification
            tutils.update_node(node_id, modified_data, auth, this);
        }, function(data, response) {
            // Retrieve the modified node
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            // and double check that it was modified
            var updated = JSON.parse(data);

            test.ok("id" in updated, "Updated node has an id.");
            test.equal(updated.id, node_id, "Updated node has the same id as original.");
            test.ok("ver" in updated, "Updated node has a version.");
            updated_version = updated['ver'];

            test.ok(updated_version !== version,
                    "Updated node and original have different versions.");

            test.ok("modified" in updated['meta'] && updated['meta']['modified'] === true,
                    "Updated node is modified as expected.");

            // Now, retrieve the LATEST version of the node by version
            tutils.retrieve_node_by_version( node_id, updated_version, auth, this);
        }, function(data, response) {
            // And examine it in detail
            test.equal(response.statusCode, 200, "Correct status for node retrieval by version.");

            test.ok(data.length > 0, "Data returned.");

            var node_data = null;
            try {
                node_data = JSON.parse(data);
            } catch (e) {
                // ignored
            }

            test.ok(node_data !== null, "Data returned was valid JSON.");
            test.ok("id" in node_data, "Node data has id.");
            test.ok("ver" in node_data, "Node data has version.");
            test.ok("meta" in node_data, "Node data has metadata.");
            test.ok("linkage" in node_data, "Node data has linkage.");
            test.ok("acl" in node_data, "Node data has acl.");
            test.ok("node_type" in node_data, "Node data has node_type.");

            // Also test that the version we requested is the version we got
            test.equal(updated_version, node_data['ver'], "Version requested and retrieved match.");

            test.ok(node_data !== null && ("modified" in node_data['meta']),
                    "Current version of node has our modification.");

            test.done();

            // Perform cleanup by removing what we just inserted and retrieved.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {
                console.log("Problem deleting test node during cleanup.", e);
            }
        }
    );
};

// Retrieve a node by requesting a specific version, but attempt to do so
// without providing an authentication token.
exports['retrieve_by_version_no_auth'] = function (test) {
    test.expect(11);

    var node_id;
    var version;
    var modified_data;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node(test_node, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node." );

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers['location'];
            node_id = location.split('/').pop();

            // Then retrieve it and modify it.
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var inserted_node = JSON.parse(data);
            test.ok("ver" in inserted_node, "Inserted node has version.");
            version = inserted_node['ver'];

            modified_data = test_node;
            modified_data.meta['modified'] = true;
            modified_data['ver'] = version;

            // Perform the modification and double check it.
            tutils.update_node(node_id, modified_data, auth, this);
        }, function(data, response) {
            // Check it by retrieving the updated node
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            // and seeing if the 'modified' flag is set
            var updated = JSON.parse(data);

            test.ok("id" in updated, "Updated node has an id.");
            test.equal(updated.id, node_id, "Updated node has the same id as original.");
            test.ok("ver" in updated, "Updated node has a version.");
            test.ok(updated.ver != version, "Updated node and original have different versions.");

            test.ok("modified" in updated.meta && updated.meta.modified === true,
                    "Updated node is modified as expected.");

            // Now, retrieve the older node by version, but WITHOUT supplying credentials.
            tutils.retrieve_node_by_version( node_id, version, null, this);
        }, function (data, response) {
            test.equal(response.statusCode, 403, "Correct status for node retrieval by id.");

            test.ok(data.length === 0, "No data returned.");

            test.done();

            // Perform cleanup by removing what we just inserted and retrieved.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {
                console.log("Problem deleting test node.", e);
            }
        }
    );

};

// Retrieve a node by requesting a specific version, but attempt to do so
// with an invalid authentication token.
exports['retrieve_by_version_bad_auth'] = function (test) {
    test.expect(11);

    var node_id;
    var version;
    var modified_data;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node(test_node, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node." );

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers['location'];
            node_id = location.split('/').pop();

            // Then retrieve it and modify it.
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var inserted_node = JSON.parse(data);
            test.ok("ver" in inserted_node, "Inserted node has version.");
            version = inserted_node['ver'];

            modified_data = test_node;
            modified_data.meta['modified'] = true;
            modified_data['ver'] = version;

            // Perform the modification and double check it.
            tutils.update_node(node_id, modified_data, auth, this);
        }, function(data, response) {
            // Check it by retrieving the updated node
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            // and seeing if the 'modified' flag is set
            var updated = JSON.parse(data);

            test.ok("id" in updated, "Updated node has an id.");
            test.equal(updated.id, node_id, "Updated node has the same id as original.");
            test.ok("ver" in updated, "Updated node has a version.");
            test.ok(updated.ver != version, "Updated node and original have different versions.");

            test.ok("modified" in updated.meta && updated.meta.modified === true,
                    "Updated node is modified as expected.");

            // Now, retrieve the older node by version, but with INVALID credentials.
            tutils.retrieve_node_by_version( node_id, version, bad_auth, this);
        }, function (data, response) {
            test.equal(response.statusCode, 403, "Correct status for node retrieval by id.");

            test.ok(data.length === 0, "No data returned.");

            test.done();

            // Perform cleanup by removing what we just inserted and retrieved.
            try {
                tutils.delete_node(node_id, auth, function(){});
            } catch (e) {
                console.log("Problem deleting test node.", e);
            }
        }
    );
};

// This is a helper function to run tests for requesting nodes by version.
// Callers can control the authentication token by passing an auth header in
// along with the nodeunit test object.
function retrieve_by_version_test(test, auth) {
    test.expect(11);

    var node_id;
    var version;
    var modified_data;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node(test_node, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node." );

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers['location'];
            node_id = location.split('/').pop();

            // Then retrieve it and modify it.
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            var inserted_node = JSON.parse(data);
            test.ok("ver" in inserted_node, "Inserted node has version.");
            version = inserted_node['ver'];

            modified_data = test_node;
            modified_data.meta['modified'] = true;
            modified_data['ver'] = version;

            // Perform the modification and double check it.
            tutils.update_node(node_id, modified_data, auth, this);
        }, function(data, response) {
            // Check it by retrieving the updated node
            tutils.retrieve_node(node_id, auth, this);
        }, function(data, response) {
            // and seeing if the 'modified' flag is set
            var updated = JSON.parse(data);

            test.ok("id" in updated, "Updated node has an id.");
            test.equal(updated.id, node_id, "Updated node has the same id as original.");
            test.ok("ver" in updated, "Updated node has a version.");
            test.ok(updated.ver != version, "Updated node and original have different versions.");

            test.ok("modified" in updated.meta && updated.meta.modified === true,
                    "Updated node is modified as expected.");

            // Now, retrieve the older node by version using the supplied credentials
            tutils.retrieve_node_by_version( node_id, version, auth, this);
        }, function (data, response) {
            test.equal(response.statusCode, 403, "Correct status for node retrieval by id.");

            test.ok(data.length === '', "No data returned.");

            test.done();

            // Perform cleanup by removing what we just inserted and retrieved.
            tutils.delete_node(node_id, auth, function(){});
        }
    );
};

// Test the behavior of retrieving a non-existent node.
exports['retrieve_nonexistent'] = function (test) {
    test.expect(2);

    var node_id = osdf_utils.random_string(8);

    tutils.retrieve_node(node_id, auth, function(data, response) {
        test.equal(response.statusCode, 404, "Correct status for retrieval of non-existent node.");

        test.ok(data === '', "No data returned for retrieval of non-existent node.");

        test.done();
    });
};

// Try to retrieve a node that doesn't exist and try to do it without
// authenticating with an authorization token. This test is a bit silly, but
// it's here just in case and for completeness.
exports['retrieve_nonexistent_no_auth'] = function (test) {
    test.expect(2);

    var node_id = osdf_utils.random_string(8);

    // Use null for the credential, which won't send anything.
    tutils.retrieve_node(node_id, null, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for retrieval of non-existent node with no auth.");

        test.ok(data === '', "No data returned for retrieval of non-existent node with no auth.");

        test.done();
    });
};

// Try to retrieve a node that doesn't exist and try to do it with an invalid
// set of credentials. This test is a bit silly, but it's here just in case and
// for completeness.
exports['retrieve_nonexistent_bad_auth'] = function (test) {
    test.expect(2);

    var node_id = osdf_utils.random_string(8);

    tutils.retrieve_node(node_id, bad_auth, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for retrieval of non-existent node with no auth.");

        test.ok(data === '', "No data returned for retrieval of non-existent node with no auth.");

        test.done();
    });
};
