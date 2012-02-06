#!/usr/bin/node

var osdf_utils = require('../lib/osdf_utils');
var tutils = require('./lib/test_utils');
var flow = require('flow');

var host = 'localhost';
var username = 'test';
var password = 'test';
var executive_user = 'test_executive';
var executive_password = 'test';

// For normal operations
var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
var auth_header = { 'Host': host, 'Authorization': auth };

// For testing node ACL permissions
var executive_auth = 'Basic ' + new Buffer(executive_user + ':' + executive_password).toString('base64');
var executive_auth_header = { 'Host': host, 'Authorization': executive_auth };

// For testing security
var bad_auth = 'Basic ' + new Buffer(username + ':' + osdf_utils.random_string(8)).toString('base64');
var bad_auth_header = { 'Host': host, 'Authorization': bad_auth };

var test_node = { ns: 'test',
                  acl: { read: ['all'], write: ['all'] },
                  linkage: {},
                  node_type: 'test',
                  meta: {}
                };

var restricted_node = { ns: 'test',
                        acl: { read: ['all'], write: ['executives'] },
                        linkage: {},
                        node_type: 'test',
                        meta: {}
                      };

// Just try the simple case. Good node, that doesn't have restrictive
// permissions and that doesn't have any dependencies.
exports['basic_deletion'] = function (test) {
    test.expect(6);

    var node_id;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node(test_node, auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");
            test.ok("location" in response.headers, "Response header contains location of new node.");

            var location = response.headers.location;
            node_id = location.split('/').pop();
            
            test.ok(data == '', "No content returned on a node insertion.");

            // Then we delete it
            tutils.delete_node(node_id, auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 204, "Correct status for deletion.");
            
            test.ok(data == '', "No content returned on a node deletion.");

            // Finally, we try to retrieve it again (it shouldn't be there anymore).
            tutils.retrieve_node(node_id, auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 404, "Correct status for retrieval of deleted node.");
            test.done();
        }
    );
};

// Examine the behavior of the system when we attempt to delete a node
// without providing a valid authentiation token.
exports['deletion_no_auth'] = function (test) {
    test.expect(3);

    var location, node_id;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node(test_node, auth_header, this);
        }, function(data, response) {
            location = response.headers.location;
            node_id = location.split('/').pop();

            // Then we attempt to delete it
            tutils.delete_node(node_id, null, this);
        }, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for deletion without auth token.");
            
            test.ok(data == '', "No content returned on a node deletion.");

            // Finally, we try to retrieve it again (it should still be there).
            tutils.retrieve_node(node_id, auth_header, this);
        }, function (data, response) {
            test.equal(response.statusCode, 200, "Node was not deleted.");

            // "Really" delete the node now (clean up)
            tutils.delete_node(node_id, auth_header, function(){});

            test.done();
        }
    );
};

// Examine the behavior of the system when we attempt to delete a node
// when providing an invalid authentiation token.
exports['deletion_bad_auth'] = function (test) {
    test.expect(3);

    var location, node_id;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node(test_node, auth_header, this);
        }, function(data, response) {
            location = response.headers.location;
            node_id = location.split('/').pop();

            // Then we attempt to delete it
            tutils.delete_node(node_id, bad_auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 403,
                "Correct status for deletion with an invalid auth token.");
            
            test.ok(data == '', "No content returned on a node deletion.");

            // Finally, we try to retrieve it again (it should still be there).
            tutils.retrieve_node(node_id, auth_header, this);
        }, function (data, response) {
            test.equal(response.statusCode, 200, "Node was not deleted.");

            // "Really" delete the node now (clean up)
            tutils.delete_node(node_id, auth_header, function(){});

            test.done();
        }
    );
};

// Examine the behavior of the system when we atempt to delete a non-existent
// node. We should get an HTTP 422 when that happens.
exports['deletion_of_nonexistent_node'] = function (test) {
    test.expect(2);

    // An infinitessmially small chance that we'll actually randomly come up
    // with an existing node_id this way, so we can live with it.
    var node_id = osdf_utils.random_string(20);

    tutils.delete_node(node_id, auth_header, function(data, response) {
        test.equal(response.statusCode, 422, "Correct status for deletion of non-existent node.");
        
        test.ok(data == "", "No content returned on node deletion of non-existent node.");

        test.done();
    }, function(){} );

};

// Examine the behavior of the system when we attempt to delete a node that
// exists, but one that has ACL (access control list) settings that prohibit us
// from doing so. We should get an HTTP 403 error code.
exports['deletion_of_node_without_write_perms'] = function (test) {
    test.expect(8);

    var node_id;

    flow.exec(
        function() {
            // First we create a node
            tutils.insert_node( restricted_node, auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");
            test.ok("location" in response.headers, "Response header contains location of new node." );

            var location = response.headers.location;
            node_id = location.split('/').pop();
            
            test.ok(data == "", "No content returned on a node insertion.");

            // Then we attempt to delete it
            tutils.delete_node(node_id, auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for deletion without ACL write permission.");
            
            test.ok(data == "", "No content returned on failed node deletion.");

            // Finally, we try to retrieve it again, but we should not be allowed since we are
            // not in the correct ACL.
            tutils.retrieve_node(node_id, auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 200, "Node still present after failed deletion.");
                
            // Now delete it with an authorization that is permitted to do so.
            tutils.delete_node(node_id, executive_auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 204, "Correct status for node deletion.");

            test.ok(data == "", "No content returned on node deletion.");

            test.done();
        }
    );
}

// The API specifies that, in order to prevent dangling nodes, nodes are not
// allowed to be deleted if any nodes (dependent nodes) have linkages to the
// node to be deleted. This test case verifies that the implementation works
// by inserting a node, then another "child" node with a linkage to it, and
// then attempts to delete the parent. When the test is concluded, both test
// nodes are removed (child first).
exports['deletion_of_node_with_linkage_dependencies'] = function (test) {
    test.expect(7);

    var parent_node_id, child_node_id;

    flow.exec(
        function() {
            // First we create a node
            var parent_node = test_node;;
            tutils.insert_node( parent_node, auth_header, this);

        }, function(data, response) {
              test.equal(response.statusCode, 201, "Correct status for insertion.");
              test.ok("location" in response.headers, "Response header contains location of new node.");

              var location = response.headers.location;
              parent_node_id = location.split('/').pop();
              
              test.ok(data == "", "No content returned on a node insertion.");
              
              // Make a new node that's connected to the previous one.
              var child_node = test_node;
              child_node['linkage'] = { "connected_to": [ parent_node_id ] };

              tutils.insert_node(child_node, auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");
            test.ok(data == '', "No content returned on a node insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node.");

            var location = response.headers.location;
            child_node_id = location.split('/').pop();
              
            // Now try to delete the parent node
            tutils.delete_node(parent_node_id, auth_header, this);
        }, function(data, response) {
            test.equal(response.statusCode, 403,
                "Correct status when trying to delete a node with dependencies.");
            
            // Now cleanup by deleting both nodes, child first
            tutils.delete_node(child_node_id, auth_header, this);
        }, function(data, response) {
            // then the parent
            tutils.delete_node(parent_node_id, auth_header, this);
        }, function(data, response) {
            // tests complete
            test.done();
        }
    );
            
};
