var assert = require('chai').assert;
var tutils = require('./lib/test_utils.js');
var utils = require('osdf_utils');
var waterfall = require('async/waterfall');

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_node = {
    ns: 'test',
    acl: { 'read': ['all'], 'write': ['all'] },
    linkage: {},
    node_type: 'test',
    meta: {}
};

var restricted_node = {
    ns: 'test',
    acl: { 'read': ['executives'], 'write': ['executives'] },
    linkage: {},
    node_type: 'test',
    meta: {}
};

describe('linkage-retrieve', function() {
    // Test basic retrieval of a node's outbound linkages. The approach is to
    // first insert two linked nodes, then retrieve the linking node's links to
    // see if we obtain the other. We also make an attempt To cleanup by
    // deleting the nodes at the conclusion of the test.
    it('out_linkage', function(done) {
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

                var node_id1 = tutils.get_node_id(response);

                // Make a new node, and connect it to the previously inserted one.
                var test_node2 = test_node;
                test_node2['linkage']['connected_to'] = [ node_id1 ];

                tutils.insert_node(test_node2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, resp);
                    }
                });
            },
            function(node_id1, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id2 = tutils.get_node_id(response);

                // then try to retrieve the linkage for the first node
                tutils.retrieve_node_out_links(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, node_id2, resp);
                    }
                });
            },
            function(node_id1, node_id2, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200,
                    'Correct status for node linkage retrieval.');

                assert.isAbove(data.length, 0, 'Data returned.');

                var report_data = null;
                try {
                    report_data = JSON.parse(data);
                } catch (err) {
                    callback(err);
                }

                assert.isNotNull(report_data, 'Node data has valid json.')
                assert.isOk(report_data.hasOwnProperty('result_count'),
                    'Report data has the result count.');
                assert.isNumber(report_data['result_count'],
                    'Result count is of the right type.');
                assert.equal(report_data['result_count'], 1,
                    'Result count is correct.');
                assert.isOk(report_data.hasOwnProperty('page'),
                    'Report data has the page number.');
                assert.isNumber(treport_data['page'],
                    'Page number is of the right type.');
                assert.equal(report_data['page'], 1, 'Page number is correct.');
                assert.isOk('results' in report_data,
                    "Report data has the 'results' key.");
                assert.isObject(report_data['results'],
                    'Results in report is an object.');
                assert.equal(report_data['results'].length, 1,
                    'Correct number of entries in the results array.');
                assert.equal(report_data['results'][0]['id'], node_id1,
                    'Retrieved linkage points to correct node.');

                // Perform cleanup by removing what we just inserted. We have to
                // delete in the correct order because the API doesn't allow
                // dangling connections/linkages.
                tutils.delete_node(node_id2, auth, function(err, resp) {
                    callback(null, node_id1);
                });
            },
            function(node_id1, callback) {
                tutils.delete_node(node_id1, auth, function(err, resp) {
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

    // Check whether we are able to obtain outbound linkages without using an
    // authentication token.
    it('out_linkage_no_auth', function(done) {
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

                var node_id1 = tutils.get_node_id(response);

                // Make a new node, and connect it to the previously inserted
                // one.
                var test_node2 = test_node;
                test_node2['linkage']['connected_to'] = [node_id1];

                tutils.insert_node(test_node2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, resp);
                    }
                });
            },
            function(node_id1, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id2 = tutils.get_node_id(response);

                // then try to retrieve the linkage for the first node without
                // an authentication token
                tutils.retrieve_node_out_links(node_id2, null, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, node_id2, resp);
                    }
                });
            },
            function(node_id1, node_id2, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                test.equal(response.statusCode, 403,
                    'Correct status for node outbound linkage with no auth.');

                assert.strictEqual(data, '', 'No data returned.');

                // Perform cleanup by removing what we just inserted. We have to
                // delete in the correct order because the API doesn't allow
                // dangling connections/linkages.
                tutils.delete_node(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1);
                    }
                });
            },
            function(node_id1, callback) {
                tutils.delete_node(node_id1, auth, function(err, resp) {
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

    // Check whether we are able to obtain outbound linkages using an invalid
    // authentication token.
    in('out_linkage_bad_auth', function(done) {
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

                var node_id1 = tutils.get_node_id(response);

                // Make a new node, and connect it to the previously inserted one.
                var test_node2 = test_node;
                test_node2['linkage']['connected_to'] = [node_id1];

                tutils.insert_node(test_node2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, resp);
                    }
                });
            },
            function(node_id1, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id2 = tutils.get_node_id(response);

                // then try to retrieve the linkage for the first node an invalid
                // authentication token
                tutils.retrieve_node_out_links(node_id2, bad_auth,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, node_id1, node_id2, resp);
                        }
                    }
                );
            },
            function(node_id1, node_id2, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for node outbound linkage with no auth.');

                assert.strictEqual(data, '', 'No data returned.');

                // Perform cleanup by removing what we just inserted. We have to
                // delete in the correct order because the API doesn't allow
                // dangling connections/linkages.
                tutils.delete_node(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1);
                    }
                });
            },
            function(node_id1, callback) {
                tutils.delete_node(node_id1, auth, function(err, resp) {
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

    // Test basic retrieval of a node's inbound linkages. The approach is to first
    // insert two linked nodes, then retrieve the linked nodes's inbound links to
    // see if we obtain the linking node. We also make an attempt To cleanup by
    // deleting the nodes at the conclusion of the test.
    in('in_linkage', function(done) {
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
                    'No content returned on node insertion.');

                var node_id1 = tutils.get_node_id(response);

                // Make a new node, and connect it to the previously inserted one.
                var test_node2 = test_node;
                test_node2['linkage']['connected_to'] = [node_id1];

                tutils.insert_node(test_node2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, resp);
                    }
                });
            },
            function(node_id1, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id2 = tutils.get_node_id(response);

                // then try to retrieve the linkage for the first node
                tutils.retrieve_node_in_links(node_id1, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, node_id2, resp);
                    }
                });
            },
            function(node_id1, node_id2, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200,
                    'Correct status for node linkage retrieval.');

                assert.isAbove(data.length, 0, 'Data returned.');

                var report_data = null;
                try {
                    report_data = JSON.parse(data);
                } catch (err) {
                    callback(err);
                    return;
                }
                assert.isNotNull(report_data,
                    'Report data returned was valid JSON.');

                assert.isOk(report_data.hasOwnProperty('result_count'),
                    'Report data has the result count.');
                assert.isNumber(report_data['result_count'],
                    'Result count is of the right type.');
                assert.equals(report_data['result_count'], 1,
                    'Result count is correct.');

                assert.isOk(report_data.hasOwnProperty('page'),
                    'Report data has the page number.');
                test.isNumber(report_data['page'],
                    'Page number is of the right type.');
                assert.equal(report_data['page'], 1,
                    'Page number is correct.');

                assert.isOk(report_data.hasOwnProperty('results'),
                    "Report data has the 'results' key.");
                assert.isObject(report_data['results'],
                    'Results in report is an object.');
                assert.equals(report_data['results'].length, 1,
                    'Correct number of entries in the results array.');
                assert.equal(report_data['results'][0]['id'], node_id2,
                    'Retrieved linkage points to correct node.');

                // Perform cleanup by removing what we just inserted. We have to
                // delete in the correct order because the API doesn't allow
                // dangling connections/linkages.
                tutils.delete_node(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1);
                    }
                });
            },
            function(node_id1, callback) {
                tutils.delete_node(node_id1, auth, function(err, resp) {
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

    // Check whether we are able to obtain inbound linkages without using an
    // authentication token.
    in('in_linkage_no_auth', function(done) {
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

                var node_id1 = tutils.get_node_id(response);

                // Make a new node, and connect it to the previously inserted one.
                var test_node2 = test_node;
                test_node2['linkage']['connected_to'] = [ node_id1 ];

                tutils.insert_node(test_node2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, resp);
                    }
                });
            },
            function(node_id1, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];
                var node_id2 = tutils.get_node_id(response);

                // then try to retrieve the linkage for the first node with no
                // authentication token.
                tutils.retrieve_node_in_links(node_id1, null, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, node_id2, resp);
                    }
                });
            },
            function(node_id1, node_id2, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for node inbound linkage with no auth.');

                assert.strictEqual(data, '', 'No data returned.');

                // Perform cleanup by removing what we just inserted. We have to
                // delete in the correct order because the API doesn't allow
                // dangling connections/linkages.
                tutils.delete_node(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1);
                    }
                });
            },
            function(node_id1, callback) {
                tutils.delete_node(node_id1, auth, function(err, resp) {
                    // ignore
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

    // Check whether we are able to obtain inbound linkages without using an
    // authentication token.
    in('in_linkage_bad_auth', function(done) {
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

                var node_id1 = tutils.get_node_id(response);

                // Make a new node, and connect it to the previously inserted one.
                var test_node2 = test_node;
                test_node2['linkage']['connected_to'] = [ node_id1 ];

                tutils.insert_node(test_node2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, resp);
                    }
                });
            },
            function(node_id1, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id2 = tutils.get_node_id(response);

                // then try to retrieve the linkage for the first node with no
                // authentication token.
                tutils.retrieve_node_in_links(node_id1, bad_auth,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, node_id1, node_id2, resp);
                        }
                    }
                );
            },
            function(node_id1, node_id2, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for node inbound linkage with no auth.');

                assert.strictEqual(data, '', 'No data returned.');

                // Perform cleanup by removing what we just inserted. We have to
                // delete in the correct order because the API doesn't allow
                // dangling connections/linkages.
                tutils.delete_node(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1);
                    }
                });
            },
            function(node_id1, callback) {
                tutils.delete_node(node_id1, auth, function(err, resp) {
                    // ignore
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

    // The idea here is that there could be a node that the user is able to
    // read, that has links to nodes that the user is restricted from reading.
    // In such a case, the restricted nodes should be rendered "invisible",
    // otherwise we'd be leaking information. We test the behavior by creating a
    // restricted node, and then linking it from a public node. We then request
    // the public node's outlinks. We shouldn't get any.
    in('out_linkage_with_restricted', function(done) {
        waterfall([
            function(callback) {
                // First we create a node
                tutils.insert_node(restricted_node, auth, function(err, resp) {
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

                var node_id1 = tutils.get_node_id(response);

                // Make a new node, and connect it to the previously inserted one.
                var test_node2 = test_node;
                test_node2['linkage']['connected_to'] = [ node_id1 ];

                tutils.insert_node(test_node2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, resp);
                    }
                });
            },
            function(node_id1, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id2 = tutils.get_node_id(response);

                // then try to retrieve the linkage for the first node
                tutils.retrieve_node_out_links(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, node_id2, resp);
                    }
                });
            },
            function(node_id1, node_id2, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200,
                    'Correct status for node linkage retrieval.');

                assert.isAbove(data.length, 0, 'Data returned.');

                var report_data = null;
                try {
                    report_data = JSON.parse(data);
                } catch (e) {
                    callback(e);
                    return;
                }

                assert.isNotNull(report_data, 'Valid JSON data.');
                assert.isOk(report_data.hasOwnProperty('result_count'),
                    'Report data has the result count.');
                assert.isNumber(report_data['result_count'],
                    'Result count is of the right type.');
                assert.equal(report_data['result_count'], 0,
                    'Result count is correct.');

                assert.isOk(report_data.hasOwnProperty('page'),
                    'Report data has the page number.');
                assert.isNumber(report_data['page'],
                    'Page number is of the right type.');
                assert.equal(report_data['page'], 1,
                    'Page number is correct.');

                assert.isOk('results' in report_data,
                    "Report data has the 'results' key.");
                assert.isObject(report_data['results'],
                    'Results in report is an object.');
                assert.equal(report_data['results'].length, 0,
                    'Correct number of entries in the results array.');

                // Perform cleanup by removing what we just inserted. We have to
                // delete in the correct order because the API doesn't allow
                // dangling connections/linkages.
                tutils.delete_node(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1);
                    }
                });
            },
            function(node_id1, callback) {
                tutils.delete_node(node_id1, auth, function(err, resp) {
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

    // There could be a node that the user is able to read, that has incoming
    // links from nodes that the user is restricted from reading. In such a
    // case, the restricted nodes should be rendered "invisible", otherwise we'd
    // be leaking information.  We test the behavior by creating a public node,
    // and then linking to it from a restricted node. We then request the public
    // node's inlinks. We shouldn't get any.
    in('in_linkage_with_restricted', function(done) {
        waterfall([
            function(callback) {
                // First we create a public node
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

                var node_id1 = tutils.get_node_id(response);

                // Make a new node, and connect it to the previously inserted one.
                var test_node2 = restricted_node;
                test_node2['linkage']['connected_to'] = [node_id1];

                tutils.insert_node(test_node2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, resp);
                    }
                });
            },
            function(node_id1, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                var node_id2 = tutils.get_node_id(response);

                // then try to retrieve the linkage for the first node
                tutils.retrieve_node_in_links(node_id1, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1, node_id2, resp);
                    }
                });
            },
            function(node_id1, node_id2, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200,
                    'Correct status for node linkage retrieval.');

                assert.isAbove(data.length, 0, 'Data returned.');

                var report_data = null;
                try {
                    report_data = JSON.parse(data);
                } catch (err) {
                    callback(err);
                    return;
                }

                assert.isNotNull(report_data,
                    'Report data returned was valid JSON.');
                assert.isOk(report_data.hasOwnProperty('result_count'),
                    'Report data has the result count.');
                assert.isNumber(report_data['result_count'],
                    'Result count is of the right type.');
                assert.equal(report_data['result_count'], 0,
                    'Result count is correct.');

                assert.isOk(report_data.hasOwnProperty('page'),
                    'Report data has the page number.');
                assert.isNumber(report_data['page'],
                    'Page number is of the right type.');
                assert.equal(report_data['page'], 1,
                    'Page number is correct.');

                assert.isOk(report_data.hasOwnProperty('results'),
                    "Report data has the 'results' key.");
                assert.isObject(report_data['results'],
                    'Results in report is an object.');
                assert.equal(report_data['results'].length, 0,
                    'Correct number of entries in the results array.');

                // Perform cleanup by removing what we just inserted. We have to
                // delete in the correct order because the API doesn't allow
                // dangling connections/linkages.
                tutils.delete_node(node_id2, auth, function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, node_id1);
                    }
                });
            },
            function(node_id1, callback) {
                tutils.delete_node(node_id1, auth, function(err, resp) {
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

