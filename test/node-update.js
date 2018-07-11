var assert = require('chai').assert;
var clone = require('clone');
var events = require('events');
var tutils = require('./lib/test_utils.js');
var utils = require('osdf_utils');
var waterfall = require('async/waterfall');

var ee = new events.EventEmitter();
ee.setMaxListeners(0);

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_node = {
    ns: 'test',
    acl: { read: ['all'], write: ['all'] },
    linkage: {},
    node_type: 'test',
    meta: {}
};

var test_node_controlled = {
    ns: 'test',
    acl: { read: ['all'], write: ['all'] },
    linkage: {},
    node_type: 'example',
    meta: {
        description: 'my description',
        color: 'indigo'
    }
};

describe('node-update', function() {
    it('basic_update', function(done) {
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

                assert.strictEqual(data, '',
                    'No content returned on a node insertion.');

                var node_id = tutils.get_node_id(response);

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
                var inserted = JSON.parse(data);
                var initial_version = inserted['ver'];

                // Okay, now to modify the node, we have to put the version in
                var modified_node = clone(test_node);
                modified_node.meta['modified'] = true;
                modified_node['ver'] = initial_version;

                // then try to update it
                tutils.update_node(node_id, modified_node, auth, function(err, resp) {
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
                    'Correct status for update.');

                assert.strictEqual(data, '',
                    'No content returned.');

                // Retrieve and check that the update took effect
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

                var retrieved;
                try {
                    retrieved = JSON.parse(data);
                } catch (err) {
                    callback(err);
                }

                assert.isOk('ver' in retrieved,
                    'Retrieved node has version in it.');
                assert.isOk('meta' in retrieved,
                    'Retrieved node has metadata in it.');
                assert.isOk('modified' in retrieved.meta,
                    'Retrieved node modified as expected.');

                // Try to clean up by deleting the node.
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

    // Test the behavior of the system when a user attempts to update a node without
    // providing the authentication token.
    it('update_no_auth', function(done) {
        waterfall([
            function(callback) {
                // Create the initial node
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

                var modified_node = clone(test_node);
                modified_node.meta['modified'] = true;

                // then try to update it with no authentication
                tutils.update_node(node_id, modified_node, null,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, node_id, resp);
                        }
                    }
                );
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for insertion w/o auth (forbidden).');

                assert.isFalse('location' in response.headers,
                    'Response header does not contain location of new node.');

                assert.strictEqual(data, '', 'No content returned.');

                // Try to clean up by deleting the node.
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

    // Test the behavior of the system when a user attempts to update a node
    // with an invalid or incorrect authentication token.
    it('update_bad_auth', function(done) {
        waterfall([
            function(callback) {
                // Create the initial node
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

                var modified_node = clone(test_node);
                modified_node.meta['modified'] = true;

                // then try to update it with no authentication
                tutils.update_node(node_id, modified_node, bad_auth,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, node_id, resp);
                        }
                    }
                );
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for insertion w/o auth (forbidden).');

                assert.isFalse('location' in response.headers,
                    'Response header does not contain location of new node.');

                assert.strictEqual(data, '', 'No content returned.');

                // Try to clean up by deleting the node.
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

    // Test the system's behavior when updating a node that is tied to a schema.
    // First we create/insert a fresh node, then we make an update to it.  The
    // update is valid, so we should check that the update took effect by
    // reading back the new node.
    it('valid_update_with_schema_validation', function(done) {
        waterfall([
            function(callback) {
                // create a node
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

                var node_id = tutils.get_node_id(response);

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

                var initial_node;
                try {
                    initial_node = JSON.parse(data);
                } catch (err) {
                    callback(err);
                    return;
                }
                var initial_version = initial_node.ver;
                var modified_node = test_node_controlled;
                modified_node['ver'] = initial_version;

                // then try to update it with data that is valid and controlled by
                // a schema
                tutils.update_node(node_id, modified_node, auth,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, initial_version, node_id, resp);
                        }
                    }
                );
            },
            function(initial_version, node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200,
                    'Correct status for insertion.');

                assert.strictEqual(data, '', 'No content returned.');

                // Retrieve the node and double check that it was modified.
                tutils.retrieve_node(node_id, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, initial_version, node_id, resp);
                    }
                });
            },
            function(initial_version, node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var retrieved = JSON.parse(data);

                assert.equal(retrieved.node_type, 'example',
                    'Updated node was modified.');

                assert.strictNotEqual(retrieved['ver'], initial_version,
                    'Module version changed.');

                // Try to clean up by deleting the node.
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

    it('invalid_update_with_schema_validation', function(done) {
        waterfall([
            function(callback) {
                // create a node
                tutils.insert_node( test_node, auth, function(err, resp) {
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

                var initial_node = JSON.parse(data);
                var initial_version = initial_node.ver;
                var modified_node = test_node_controlled;

                modified_node['ver'] = initial_version;

                // Use a value in the new node that is invalid per the schema. In
                // this case, we're going to use an invalid color
                modified_node['meta']['color'] = 'pink';

                // then try to update it with data that is valid and controlled
                // by a schema
                tutils.update_node(node_id, modified_node, auth,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, node_id, resp);
                        }
                    }
                );
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status for insertion with invalid data.');

                assert.strictEqual(data, '', 'No content returned.');

                // Try to clean up by deleting the node.
                tutils.delete_node(node_id, auth, function(err, resp) {
                    // ignored
                });

                callback(null);
            }],
        function(err, response) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // Check the behavior of the system when an attempt is made to modify a
    // perfectly valid node by altering the namespace to an invalid/unknown
    // namespace. That operation should result in an error. As usual, we insert
    // a brand new node, then attempt to make the modification and examine the
    // results.
    it('update_into_unknown_namespace', function(done) {
        waterfall([
            function(callback) {
                // create a node
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

                var initial_node = JSON.parse(data);
                var initial_version = initial_node.ver;
                var modified_node = clone(test_node);
                modified_node['ver'] = initial_version;

                // Use a bogus namespace value to attempt to place the node into
                // a namespace that doesn't exist.
                modified_node['ns'] = utils.random_string(5);

                // then try to update it with data that is valid and controlled by
                // a schema
                tutils.update_node(node_id, modified_node, auth,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, node_id, resp);
                        }
                    }
                );
            },
            function(node_id, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status for insertion with invalid data.');

                assert.strictEqual(data, '', 'No content returned.');

                // Try to clean up by deleting the node.
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

    // The API requires that updates to a node include the version of the node
    // that is being updated. This way, if the node was updated through another
    // means before the update is received, the server will know that the user's
    // update is invalid because it is attempting to alter an older version.
    // Here we check this behavior.
    it('update_with_invalid_version', function(done) {
        waterfall([
            function(callback) {
                // create a node
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
                var initial_node;

                try {
                    initial_node = JSON.parse(data);
                } catch (err) {
                    callback(err);
                }

                var initial_version = initial_node.ver;
                assert.equal(initial_version, 1,
                    'First version is equal to 1.');

                var modified_node = test_node;
                modified_node['ver'] = initial_version + 10;

                // then try to update it with data that is valid and controlled
                // by a schema
                tutils.update_node(node_id, modified_node, auth,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, resp);
                        }
                    }
                );
            },
            function(resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status for update with invalid version.');

                assert.strictEqual(data, '', 'No content returned.');

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

