#!/usr/bin/node

var async = require('async');
var utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_node = { ns: 'test',
                  acl: { 'read': ['all'], 'write': ['all'] },
                  linkage: {},
                  node_type: 'test',
                  meta: {}
                };

var restricted_node = { ns: 'test',
                        acl: { 'read': ['executives'], 'write': ['executives'] },
                        linkage: {},
                        node_type: 'test',
                        meta: {}
                      };

// Test basic retrieval of a node's outbound linkages. The approach is to first
// insert two linked nodes, then retrieve the linking node's links to see if we
// obtain the other. We also make an attempt To cleanup by deleting the nodes
// at the conclusion of the test.
exports['out_linkage'] = function (test) {
    test.expect(16);

    var node_id1, node_id2;

    async.waterfall([
        function(callback) {
            // First we create a node
            tutils.insert_node(test_node, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers,
                    "Response header contains location of new node." );

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id1 = location.split('/').pop();

            // Make a new node, and connect it to the previously inserted one.
            var test_node2 = test_node;
            test_node2['linkage']['connected_to'] = [ node_id1 ];

            tutils.insert_node(test_node2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            var location = response.headers.location;
            node_id2 = location.split('/').pop();

            // then try to retrieve the linkage for the first node
            tutils.retrieve_node_out_links(node_id2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Correct status for node linkage retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var report_data;
            try {
                report_data = JSON.parse(data);
                test.ok("Report data returned was valid JSON.");
            } catch (err) {
                test.fail("Invalid JSON returned.");
                callback(err);
            }

            test.ok("result_count" in report_data, "Report data has the result count.");
            test.ok(typeof report_data['result_count'] === "number", "Result count is of the right type.");
            test.equals(report_data['result_count'], 1, "Result count is correct.");

            test.ok("page" in report_data, "Report data has the page number.");
            test.ok(typeof report_data['page'] === "number", "Page number is of the right type.");
            test.equals(report_data['page'], 1, "Page number is correct.");

            test.ok("results" in report_data, "Report data has the 'results' key.");
            test.ok(typeof report_data['results'] === "object", "Results in report is an object.");
            test.equals(report_data['results'].length, 1, "Correct number of entries in the results array.");

            test.ok(report_data['results'][0]['id'] === node_id1, "Retrieved linkage points to correct node.");

            // Perform cleanup by removing what we just inserted. We have to delete in the correct
            // order because the API doesn't allow dangling connections/linkages.
            tutils.delete_node(node_id2, auth, function(data, response) {
                tutils.delete_node(node_id1, auth, function(data, response) {
                    // ignored
                });
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
}

// Check whether we are able to obtain outbound linkages without using an
// authentication token.
exports['out_linkage_no_auth'] = function (test) {
    test.expect(5);

    var node_id1, node_id2;

    async.waterfall([
        function(callback) {
            // First we create a node
            tutils.insert_node(test_node, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers,
                    "Response header contains location of new node.");

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id1 = location.split('/').pop();

            // Make a new node, and connect it to the previously inserted one.
            var test_node2 = test_node;
            test_node2['linkage']['connected_to'] = [ node_id1 ];

            tutils.insert_node(test_node2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            var location = response.headers.location;
            node_id2 = location.split('/').pop();

            // then try to retrieve the linkage for the first node without an authentication token
            tutils.retrieve_node_out_links(node_id2, null, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 403,
                       "Correct status for node outbound linkage with no auth.");

            test.ok(data === '', "No data returned.");

            // Perform cleanup by removing what we just inserted. We have to delete in the correct
            // order because the API doesn't allow dangling connections/linkages.
            tutils.delete_node(node_id2, auth, function(data, response) {
                tutils.delete_node(node_id1, auth, function(data, response) {
                    // ignored
                });
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Check whether we are able to obtain outbound linkages using an
// invalid authentication token.
exports['out_linkage_bad_auth'] = function (test) {
    test.expect(5);

    var node_id1, node_id2;

    async.waterfall([
        function(callback) {
            // First we create a node
            tutils.insert_node(test_node, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers,
                    "Response header contains location of new node.");

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id1 = location.split('/').pop();

            // Make a new node, and connect it to the previously inserted one.
            var test_node2 = test_node;
            test_node2['linkage']['connected_to'] = [ node_id1 ];

            tutils.insert_node(test_node2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            var location = response.headers.location;
            node_id2 = location.split('/').pop();

            // then try to retrieve the linkage for the first node an invalid authentication token
            tutils.retrieve_node_out_links(node_id2, bad_auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 403,
                       "Correct status for node outbound linkage with no auth.");

            test.ok(data === '', "No data returned.");

            // Perform cleanup by removing what we just inserted. We have to delete in the correct
            // order because the API doesn't allow dangling connections/linkages.
            tutils.delete_node(node_id2, auth, function(data, response) {
                tutils.delete_node(node_id1, auth, function(data, response) {
                    // ignored
                });
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test basic retrieval of a node's inbound linkages. The approach is to first
// insert two linked nodes, then retrieve the linked nodes's inbound links to
// see if we obtain the linking node. We also make an attempt To cleanup by
// deleting the nodes at the conclusion of the test.
exports['in_linkage'] = function (test) {
    test.expect(16);

    var node_id1, node_id2;

    async.waterfall([
        function(callback) {
            // First we create a node
            tutils.insert_node(test_node, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers,
                    "Response header contains location of new node.");

            test.ok(data === '', "No content returned on node insertion.");

            var location = response.headers.location;
            node_id1 = location.split('/').pop();

            // Make a new node, and connect it to the previously inserted one.
            var test_node2 = test_node;
            test_node2['linkage']['connected_to'] = [ node_id1 ];

            tutils.insert_node(test_node2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            var location = response.headers.location;
            node_id2 = location.split('/').pop();

            // then try to retrieve the linkage for the first node
            tutils.retrieve_node_in_links(node_id1, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200, "Correct status for node linkage retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var report_data;
            try {
                report_data = JSON.parse(data);
                test.ok("Report data returned was valid JSON.");
            } catch (err) {
                test.fail("Invalid JSON returned.");
                callback(err);
            }

            test.ok("result_count" in report_data, "Report data has the result count.");
            test.ok(typeof report_data['result_count'] === "number",
                    "Result count is of the right type.");
            test.equals(report_data['result_count'], 1, "Result count is correct.");

            test.ok("page" in report_data, "Report data has the page number.");
            test.ok(typeof report_data['page'] === "number", "Page number is of the right type.");
            test.equals(report_data['page'], 1, "Page number is correct.");

            test.ok("results" in report_data, "Report data has the 'results' key.");
            test.ok(typeof report_data['results'] === "object", "Results in report is an object.");
            test.equals(report_data['results'].length, 1,
                        "Correct number of entries in the results array.");

            test.ok(report_data['results'][0]['id'] === node_id2,
                    "Retrieved linkage points to correct node.");

            // Perform cleanup by removing what we just inserted. We have to delete in the correct
            // order because the API doesn't allow dangling connections/linkages.
            tutils.delete_node(node_id2, auth, function(data, response) {
                tutils.delete_node(node_id1, auth, function(data, response) {
                    // ignored
                });
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Check whether we are able to obtain inbound linkages without using an
// authentication token.
exports['in_linkage_no_auth'] = function (test) {
    test.expect(5);

    var node_id1, node_id2;

    async.waterfall([
        function(callback) {
            // First we create a node
            tutils.insert_node(test_node, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers,
                    "Response header contains location of new node.");

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id1 = location.split('/').pop();

            // Make a new node, and connect it to the previously inserted one.
            var test_node2 = test_node;
            test_node2['linkage']['connected_to'] = [ node_id1 ];

            tutils.insert_node(test_node2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            var location = response.headers.location;
            node_id2 = location.split('/').pop();

            // then try to retrieve the linkage for the first node with no authentication token.
            tutils.retrieve_node_in_links(node_id1, null, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 403,
                       "Correct status for node inbound linkage with no auth.");

            test.ok(data === '', "No data returned.");

            // Perform cleanup by removing what we just inserted. We have to delete in the correct
            // order because the API doesn't allow dangling connections/linkages.
            tutils.delete_node(node_id2, auth, function(data, response) {
                tutils.delete_node(node_id1, auth, function(data, response) {
                    // ignore
                });
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Check whether we are able to obtain inbound linkages without using an
// authentication token.
exports['in_linkage_bad_auth'] = function (test) {
    test.expect(5);

    var node_id1, node_id2;

    async.waterfall([
        function(callback) {
            // First we create a node
            tutils.insert_node(test_node, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node.");

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id1 = location.split('/').pop();

            // Make a new node, and connect it to the previously inserted one.
            var test_node2 = test_node;
            test_node2['linkage']['connected_to'] = [ node_id1 ];

            tutils.insert_node(test_node2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            var location = response.headers.location;
            node_id2 = location.split('/').pop();

            // then try to retrieve the linkage for the first node with no authentication token.
            tutils.retrieve_node_in_links(node_id1, bad_auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 403,
                       "Correct status for node inbound linkage with no auth.");

            test.ok(data === '', "No data returned.");

            // Perform cleanup by removing what we just inserted. We have to delete in the correct
            // order because the API doesn't allow dangling connections/linkages.
            tutils.delete_node(node_id2, auth, function(data, response) {
                tutils.delete_node(node_id1, auth, function(data, response) {
                    // ignore
                });
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// The idea here is that there could be a node that the user is able to read,
// that has links to nodes that the user is restricted from reading. In such a
// case, the restricted nodes should be rendered "invisible", otherwise we'd be
// leaking information. We test the behavior by creating a restricted node, and then
// linking it from a public node. We then request the public node's outlinks.
// We shouldn't get any.
exports['out_linkage_with_restricted'] = function (test) {
    test.expect(15);

    var node_id1, node_id2;

    async.waterfall([
        function(callback) {
            // First we create a node
            tutils.insert_node(restricted_node, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers,
                    "Response header contains location of new node.");

            test.ok(data === '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id1 = location.split('/').pop();

            // Make a new node, and connect it to the previously inserted one.
            var test_node2 = test_node;
            test_node2['linkage']['connected_to'] = [ node_id1 ];

            tutils.insert_node(test_node2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            var location = response.headers.location;
            node_id2 = location.split('/').pop();

            // then try to retrieve the linkage for the first node
            tutils.retrieve_node_out_links(node_id2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200, "Correct status for node linkage retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var report_data;
            try {
                report_data = JSON.parse(data);
                test.ok("Report data returned was valid JSON.");
            } catch (e) {
                test.fail("Invalid JSON returned.");
            }

            test.ok("result_count" in report_data, "Report data has the result count.");
            test.ok(typeof report_data['result_count'] === "number",
                    "Result count is of the right type.");
            test.equals(report_data['result_count'], 0, "Result count is correct.");

            test.ok("page" in report_data, "Report data has the page number.");
            test.ok(typeof report_data['page'] === "number", "Page number is of the right type.");
            test.equals(report_data['page'], 1, "Page number is correct.");

            test.ok("results" in report_data, "Report data has the 'results' key.");
            test.ok(typeof report_data['results'] === "object", "Results in report is an object.");
            test.equals(report_data['results'].length, 0,
                        "Correct number of entries in the results array.");

            // Perform cleanup by removing what we just inserted. We have to delete in the correct
            // order because the API doesn't allow dangling connections/linkages.
            tutils.delete_node(node_id2, auth, function(data, response) {
                tutils.delete_node(node_id1, auth, function(data, response) {
                    // ignored
                });
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// There could be a node that the user is able to read, that has incoming links
// from nodes that the user is restricted from reading. In such a case, the
// restricted nodes should be rendered "invisible", otherwise we'd be leaking
// information.  We test the behavior by creating a public node, and then
// linking to it from a restricted node. We then request the public node's
// inlinks.  We shouldn't get any.
exports['in_linkage_with_restricted'] = function (test) {
    test.expect(15);

    var node_id1, node_id2;

    async.waterfall([
        function(callback) {
            // First we create a public node
            tutils.insert_node(test_node, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok("location" in response.headers, "Response header contains location of new node." );

            test.ok(data == '', "No content returned on a node insertion.");

            var location = response.headers.location;
            node_id1 = location.split('/').pop();

            // Make a new node, and connect it to the previously inserted one.
            var test_node2 = restricted_node;
            test_node2['linkage']['connected_to'] = [ node_id1 ];

            tutils.insert_node(test_node2, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            var location = response.headers.location;
            node_id2 = location.split('/').pop();

            // then try to retrieve the linkage for the first node
            tutils.retrieve_node_in_links(node_id1, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200, "Correct status for node linkage retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var report_data;
            try {
                report_data = JSON.parse(data);
                test.ok("Report data returned was valid JSON.");
            } catch (err) {
                test.fail("Invalid JSON returned.");
                callback(err);
            }

            test.ok("result_count" in report_data, "Report data has the result count.");
            test.ok(typeof report_data['result_count'] === "number",
                    "Result count is of the right type.");
            test.equals(report_data['result_count'], 0, "Result count is correct.");

            test.ok("page" in report_data, "Report data has the page number.");
            test.ok(typeof report_data['page'] === "number", "Page number is of the right type.");
            test.equals(report_data['page'], 1, "Page number is correct.");

            test.ok("results" in report_data, "Report data has the 'results' key.");
            test.ok(typeof report_data['results'] === "object", "Results in report is an object.");
            test.equals(report_data['results'].length, 0,
                        "Correct number of entries in the results array.");

            // Perform cleanup by removing what we just inserted. We have to delete in the correct
            // order because the API doesn't allow dangling connections/linkages.
            tutils.delete_node(node_id2, auth, function(data, response) {
                tutils.delete_node(node_id1, auth, function(data, response) {
                    // ignored
                });
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};
