var assert = require('chai').assert;
var osdf_utils = require('../lib/osdf_utils');
var tutils = require('./lib/test_utils');
var waterfall = require('async/waterfall');

var host = 'localhost';
var executive_user = 'test_executive';
var executive_password = 'test';

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

// For testing node ACL permissions
var executive_auth = executive_user + ':' + executive_password;

var test_node = {
    ns: 'test',
    acl: { read: ['all'], write: ['all'] },
    linkage: {},
    node_type: 'test',
    meta: {}
};

var restricted_node = {
    ns: 'test',
    acl: { read: ['all'], write: ['executives'] },
    linkage: {},
    node_type: 'test',
    meta: {}
};

describe('node-delete', function() {
    // Just try the simple case. Good node, that doesn't have restrictive
    // permissions and that doesn't have any dependencies.
    it('basic_deletion', function(done) {
        waterfall([
            function(callback) {
                // First we create a node
                tutils.insert_node(test_node, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                });
            },
            function(resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 201,
                    'Correct status for insertion.');
                assert.isOk('location' in response.headers,
                    'Response header contains location of new node.');

                var node_id = tutils.get_node_id(response);

                assert.strictEqual(data, '',
                    'No content returned on a node insertion.');

                // Then we delete it
                tutils.delete_node(node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id, resp);
                    }
                });
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 204,
                    'Correct status for deletion.');

                assert.strictEqual(data, '',
                    'No content returned on a node deletion.');

                // Finally, we try to retrieve it again (it shouldn't be
                // there anymore).
                tutils.retrieve_node(node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                });
            },
            function(resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 404,
                    'Correct status for retrieval of deleted node.');

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // Examine the behavior of the system when we attempt to delete a node
    // without providing a valid authentiation token.
    it('deletion_no_auth', function(done) {
        waterfall([
            function(callback) {
                // First we create a node
                tutils.insert_node(test_node, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                });
            },
            function(resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id = tutils.get_node_id(response);

                // Then we attempt to delete it
                tutils.delete_node(node_id, null, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id, resp);
                    }
                });
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for deletion without auth token.');

                assert.strictEqual(data, '',
                    'No content returned on a node deletion.');

                // Finally, we try to retrieve it again (it should still be
                // there).
                tutils.retrieve_node(node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id, resp);
                    }
                });
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200, 'Node was not deleted.');

                // "Really" delete the node now (clean up)
                tutils.delete_node(node_id, auth, function(err, resp) {
                    // ignored
                });

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // Examine the behavior of the system when we attempt to delete a node
    // when providing an invalid authentiation token.
    it('deletion_bad_auth', function(done) {
        waterfall([
            function(callback) {
                // First we create a node
                tutils.insert_node(test_node, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                });
            },
            function(resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id = tutils.get_node_id(response);

                // Then we attempt to delete it
                tutils.delete_node(node_id, bad_auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id, resp);
                    }
                });
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for deletion with an invalid auth token.');

                assert.strictEqual(data, '',
                    'No content returned on a node deletion.');

                // Finally, we try to retrieve it again (it should still be
                // there).
                tutils.retrieve_node(node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id, resp);
                    }
                });
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200, 'Node was not deleted.');

                // "Really" delete the node now (clean up)
                tutils.delete_node(node_id, auth, function(err, resp) {
                    // ignored
                });

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // Examine the behavior of the system when we atempt to delete a
    // non-existent node. We should get an HTTP 422 when that happens.
    it('deletion_of_nonexistent_node', function(done) {
        // An infinitessmially small chance that we'll actually randomly come up
        // with an existing node_id this way, so we can live with it.
        var node_id = osdf_utils.random_string(20);

        tutils.delete_node(node_id, auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status for deletion of non-existent node.');

                assert.strictEqual(data, '',
                    'No content returned on node deletion of ' +
                    'non-existent node.');

                done();
            }
        });
    });

    // Examine the behavior of the system when we attempt to delete a node that
    // exists, but one that has ACL (access control list) settings that prohibit
    // us from doing so. We should get an HTTP 403 error code.
    it('deletion_of_node_without_write_perms', function(done) {
        waterfall([
            function(callback) {
                // First we create a node
                tutils.insert_node( restricted_node, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                });
            },
            function(resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 201,
                    'Correct status for insertion.');
                assert.isOk('location' in response.headers,
                    'Response header contains location of new node.');

                var node_id = tutils.get_node_id(response);

                assert.strictEqual(data, '',
                    'No content returned on a node insertion.');

                // Then we attempt to delete it
                tutils.delete_node(node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id, resp);
                    }
                });
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for deletion without ACL write permission.');

                assert.strictEqual(data, '',
                    'No content returned on failed node deletion.');

                // Finally, we try to retrieve it again, but we should not be
                // allowed since we are not in the correct ACL.
                tutils.retrieve_node(node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id, resp);
                    }
                });
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200,
                    'Node still present after failed deletion.');

                // Now delete it with an authorization that is permitted to do so.
                tutils.delete_node(node_id, executive_auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                });
            },
            function(resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 204,
                    'Correct status for node deletion.');

                assert.strictEqual(data, '',
                    'No content returned on node deletion.');

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // The API specifies that, in order to prevent dangling nodes, nodes are not
    // allowed to be deleted if any nodes (dependent nodes) have linkages to the
    // node to be deleted. This test case verifies that the implementation works
    // by inserting a node, then another "child" node with a linkage to it, and
    // then attempts to delete the parent. When the test is concluded, both test
    // nodes are removed (child first).
    it('deletion_of_node_with_linkage_dependencies', function(done) {
        waterfall([
            function(callback) {
                // First we create a node
                var parent_node = test_node;
                tutils.insert_node(parent_node, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                });
            },
            function(resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                asssert.equal(response.statusCode, 201,
                    'Correct status for insertion.');
                asssert.isOk('location' in response.headers,
                    'Response header contains location of new node.');

                var parent_node_id = tutils.get_node_id(response);

                assert.isStrictEqual(data, '',
                    'No content returned on a node insertion.');

                // Make a new node that's connected to the previous one.
                var child_node = test_node;
                child_node['linkage'] = { 'connected_to': [ parent_node_id ] };

                tutils.insert_node(child_node, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, parent_node_id, resp);
                    }
                });
            },
            function(parent_node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 201,
                    'Correct status for insertion.');
                assert.strictEqual(data, '',
                    'No content returned on a node insertion.');
                assert.isOk('location' in response.headers,
                    'Response header contains location of new node.');

                var child_node_id = tutils.get_node_id(response);

                // Now try to delete the parent node
                tutils.delete_node(parent_node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, child_node_id, parent_node_id, resp);
                    }
                });
            },
            function(child_node_id, parent_node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 409,
                    'Correct status when trying to delete a node with ' +
                    'dependencies.');

                // Now cleanup by deleting both nodes, child first
                tutils.delete_node(child_node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, parent_node_id);
                    }
                });
            },
            function(parent_node_id, callback) {
                // then the parent
                tutils.delete_node(parent_node_id, auth, function(err, resp) {
                    // ignored
                });

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });
});

