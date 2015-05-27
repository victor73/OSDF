#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var async = require('async');
var tutils = require('./lib/test_utils.js');
var clone = require('clone');


// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();

var test_node = { ns: 'test2',
                  acl: { 'read': ['all'], 'write': ['all'] },
                  linkage: {},
                  node_type: '',
                  meta: {}
                };

// at the conclusion of the test.
exports['insert_all_links_disallowed'] = function (test) {
    test.expect(3);

    async.waterfall([
        function(callback) {
            // First we create a starting node
            var start_node = clone(test_node);
            start_node['node_type'] = "start_test_node";

            tutils.insert_node(start_node, auth, function(data, response) {
                var start_node_id = get_node_id(response.headers);

                callback(null, start_node_id);
            });
        }, function(start_node_id, callback) {
            // Now make a "target" node, and attempt to connect it to the 'start' node.
            var target = clone(test_node);
            target['node_type'] = 'target';
            target['linkage'] = { "relates_to": [ start_node_id ] };
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                callback(null, start_node_id, data, response);
            });
        }, function(start_node_id, data, response, callback) {
            // Confirm that we failed, because "target" nodes cannot link to anything
            test.equal(response.statusCode, 422,
                       "Correct status for insertion with illegal linkage.");

            test.ok(response.headers.hasOwnProperty('x-osdf-error'),
                    'OSDF reports an error message in the right header.');

            test.notEqual(response.headers['x-osdf-error'].search(/linkage/), -1,
                    "Error message makes mention of 'linkage'");

            // If the node still got inserted somehow, we make sure we remove it
            if (response.headers.hasOwnProperty('location')) {
                var bad_node_id = get_node_id(response.headers);

                tutils.delete_node(bad_node_id, auth, function(data, response) {
                    callback(null, start_node_id);
                });
            } else {
                callback(null, start_node_id);
            }
        }, function(start_node_id, callback) {
            // Perform cleanup by removing what we just inserted. We have
            // to delete in the correct order because the API doesn't
            // allow dangling connections/linkages.
            tutils.delete_node(start_node_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test to ensure that if we try to insert a node that does allow
// some linkages, but only to nodes of a single type, that OSDF
// disallows the insertion if the incoming linkage is not of that
// type.
exports['insert_one_allowance_invalid_link'] = function (test) {
    test.expect(3);

    async.waterfall([
       function(callback) {
            // First we create a starting node
            var start_node = clone(test_node);
            start_node['node_type'] = "start_test_node";

            tutils.insert_node(start_node, auth, function(data, response) {
                var start_node_id = get_node_id(response.headers);

                callback(null, start_node_id);
            });
       },
       function(start_node_id, callback) {
            // Now create an "example" node, and attempt to connect it to the
            // start node. "example" nodes are only allowed to connect to
            // "target" nodes.
            var example = clone(test_node);
            example['node_type'] = 'example';
            example['linkage'] = { "relates_to": [ start_node_id ] };
            example['meta']['color'] = "red";

            tutils.insert_node(example, auth, function(data, response) {
                callback(null, start_node_id, data, response);
            });
        },
        function(start_node_id, data, response, callback) {
            // Confirm that we failed, because "target" nodes cannot link to anything
            test.equal(response.statusCode, 422,
                       "Correct status for insertion with illegal linkage.");

            test.ok(response.headers.hasOwnProperty('x-osdf-error'),
                    'OSDF reports an error message in the right header.');

            test.notEqual(response.headers['x-osdf-error'].search(/linkage/), -1,
                    "Error message makes mention of 'linkage'");

            // If the node got inserted somehow, we make sure we remove it
            if (response.headers.hasOwnProperty('location')) {
                var bad_node_id = get_node_id(response.headers);

                tutils.delete_node(bad_node_id, auth, function(data, response) {
                    callback(null, start_node_id);
                });
            } else {
                callback(null, start_node_id);
            }
        },
        function(start_node_id, callback) {
            // Perform cleanup by removing what we just inserted. We have to
            // delete in the correct order because the API doesn't allow dangling
            // connections/linkages.
            tutils.delete_node(start_node_id, auth, function(data, response) {
                // ignored
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test to ensure that if we try to insert a node with a wildcard for
// linkage names, but a specified target, that the system does allow
// an insertion with a pseudo-random linkage, and the target that
// the linkage.json file allows.
exports['insert_wildcard_linkage_valid_target'] = function (test) {
    test.expect(1);

    async.waterfall([
        function(callback) {
            // First we create a "target" node
            var target2 = clone(test_node);
            target2['node_type'] = 'target';
            target2['meta']['color'] = "red";

            tutils.insert_node(target2, auth, function(data, response) {
                var target_id = get_node_id(response.headers);

                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            // Now create an "any_link_to_target" node, and attempt to connect it to the
            // target node. "any_link_to_target" nodes are only allowed to connect to
            // "target" nodes, but can use any linkage/edge name.
            var any_link_to_target = clone(test_node);
            any_link_to_target['node_type'] = 'any_link_to_target';
            // "abc123" is intended to be somewhat random
            any_link_to_target['linkage'] = { "abc123": [ target_id ] };
            any_link_to_target['meta']['color'] = "red";

            tutils.insert_node(any_link_to_target, auth, function(data, response) {
                // Confirm that we inserted
                test.equal(response.statusCode, 201,
                           "Correct status for insertion.");

                var any_link_id = get_node_id(response.headers);

                callback(null, any_link_id, target_id);
            });
        },
        function(any_link_id, target_id, callback) {
            // Clean up after the newly created 'any_link_to_target'
            tutils.delete_node(any_link_id, auth, function(data, response) {
                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            // Try to do some cleanup. Ignore any issues if the cleanup fails,
            tutils.delete_node(target_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test to ensure that if we try to insert a node with a wildcard for
// linkage names, but a specified target, that the system does NOT allow
// an insertion with a pseudo-random linkage, and a target that
// the linkage.json file does not mention/allow.
exports['insert_wildcard_linkage_invalid_target'] = function (test) {
    test.expect(2);

    async.waterfall([
        function(callback) {
            // Create an "other" node to test the insertion
            // (to a non "target" node).
            var other = clone(test_node);
            other['node_type'] = 'other';
            other['linkage'] = {};

            tutils.insert_node(other, auth, function(data, response) {
                var other_id = get_node_id(response.headers);

                callback(null, other_id);
            });
        },
        function(other_id, callback) {
            var any_link_to_target = clone(test_node);
            any_link_to_target['node_type'] = 'any_link_to_target';
            // "abc123" is intended to be somewhat random
            any_link_to_target['linkage'] = { "abc123": [ other_id ] };
            any_link_to_target['meta']['color'] = "red";

            tutils.insert_node(any_link_to_target, auth, function(data, response) {
                test.ok(response.headers.hasOwnProperty('x-osdf-error'),
                        'OSDF reports an error message in the right header.');

                test.notEqual(response.headers['x-osdf-error'].search(/linkage/), -1,
                        "Error message makes mention of 'linkage'");

                callback(null, other_id, response);
            });
        },
        // Clean up the inserted node if it managed to get into the db
        function(other_id, response, callback) {
           // If the node got inserted somehow, we make sure we remove it
            if (response.headers.hasOwnProperty('location')) {
                // This would be the "any_link_to_target" node...
                var bad_node_id = get_node_id(response.headers);

                tutils.delete_node(bad_node_id, auth, function(data, response) {
                    callback(null, other_id);
                });
            } else {
                callback(null, other_id);
            }
        },
        // Delete the helper 'other' node
        function(other_id, callback) {
            tutils.delete_node(other_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

//
//    "any_link": {
//        "*": [ "*" ]
//    }
//
exports['insert_wildcard_linkage_wildcard_target'] = function (test) {
    test.expect(2);

    async.waterfall([
        function(callback) {
            // Create a "starting" node to
            var start_node = clone(test_node);
            start_node['node_type'] = 'start_test_node';
            start_node['linkage'] = {};

            tutils.insert_node(start_node, auth, function(data, response) {
                var start_node_id = get_node_id(response.headers);

                callback(null, start_node_id);
            });
        },
        function(start_node_id, callback) {
            // Now make an "any_link" node, and attempt to connect it to the 'start' node.
            var any_link = clone(test_node);
            any_link['node_type'] = 'any_link';
            // "abc123" is intended to be somewhat random
            any_link['linkage'] = { "abc123": [ start_node_id ] };

            tutils.insert_node(any_link, auth, function(data, response) {
                test.equal(response.statusCode, 201,
                           "Correct status for insertion.");

                test.ok((! response.headers.hasOwnProperty('x-osdf-error')),
                        "No error message in headers after insertion.");

                var any_link_id = get_node_id(response.headers);

                callback(null, any_link_id, start_node_id);
            });
        },
        // Clean up the inserted nodes
        function(any_link_id, start_node_id, callback) {
            tutils.delete_node(any_link_id, auth, function(data, response) {
                callback(null, start_node_id);
            });
        },
        // Delete the helper 'other' node
        function(start_node_id, callback) {
            tutils.delete_node(start_node_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};


//    "*": {
//        "*": [ "*" ]
//    }
//
//    To be read as: Anything (anything that isn't otherwise configured, that is)
//    is allowed to link to anything else, with any linkage.
//
//
exports['insert_wildcard_node_wildcard_linkage_wildcard_target'] = function (test) {
    test.expect(2);

    async.waterfall([
        function(callback) {
            // Create a "starting" node to
            var start_node = clone(test_node);
            start_node['node_type'] = 'start_test_node';
            start_node['linkage'] = {};

            tutils.insert_node(start_node, auth, function(data, response) {
                var start_node_id = get_node_id(response.headers);

                callback(null, start_node_id);
            });
        },
        function(start_node_id, callback) {
            // Now make an node with a randomly generated node type,
            // and attempt to connect it to the 'start' node.
            var randomly_named_node = clone(test_node);
            randomly_named_node['node_type'] = osdf_utils.random_string(6);
            var random_linkage_name = osdf_utils.random_string(6);
            randomly_named_node['linkage'] = { random_linkage_name: [ start_node_id ] };

            tutils.insert_node(randomly_named_node, auth, function(data, response) {
                test.equal(response.statusCode, 201,
                           "Correct status for insertion.");

                test.ok((! response.headers.hasOwnProperty('x-osdf-error')),
                        "No error message in headers after insertion.");

                var randomly_named_id = get_node_id(response.headers);

                callback(null, randomly_named_id, start_node_id);
            });
        },
        // Clean up the inserted nodes
        function(randomly_named_id, start_node_id, callback) {
            tutils.delete_node(randomly_named_id, auth, function(data, response) {
                callback(null, start_node_id);
            });
        },
        // Delete the helper 'other' node
        function(start_node_id, callback) {
            tutils.delete_node(start_node_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

//    "example2": {
//       "related_to": [ "target" ],
//       "connected_to": [ "target", "target2" ]
//    }
//
exports['insert_multi_linkage_multi_target_valid'] = function (test) {
    test.expect(2);

    async.waterfall([
        function(callback) {
            // Make a "target" node to start out with
            var target = clone(test_node);
            target['node_type'] = 'target';
            target['linkage'] = {};
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                var target_id = get_node_id(response.headers);

                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            // Now make an example2 node
            var example2 = clone(test_node);
            example2['node_type'] = "example2";
            example2['linkage'] = { "connected_to": [ target_id ] };

            tutils.insert_node(example2, auth, function(data, response) {
                test.equal(response.statusCode, 201,
                           "Correct status for insertion.");

                test.ok((! response.headers.hasOwnProperty('x-osdf-error')),
                        "No error message in headers after insertion.");

                var example2_id = get_node_id(response.headers);

                callback(null, example2_id, target_id);
            });
        },
        // Clean up the inserted nodes
        function(example2_id, target_id, callback) {
            tutils.delete_node(example2_id, auth, function(data, response) {
                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            tutils.delete_node(target_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

//    "example2": {
//       "related_to": [ "target" ],
//       "connected_to": [ "target", "target2" ]
//    }
//
exports['insert_multi_linkage_multi_target_invalid'] = function (test) {
    test.expect(3);

    async.waterfall([
        function(callback) {
            // Make a "target" node to start out with
            var target = clone(test_node);
            target['node_type'] = 'target';
            target['linkage'] = {};
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                var target_id = get_node_id(response.headers);

                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            // Now make an example2 node
            var example2 = clone(test_node);
            example2['node_type'] = "example2";
            example2['linkage'] = { "invalid_linkage_to": [ target_id ] };

            tutils.insert_node(example2, auth, function(data, response) {
                test.equal(response.statusCode, 422,
                           "Correct status for insertion with illegal linkage.");

                test.ok(response.headers.hasOwnProperty('x-osdf-error'),
                        'OSDF reports an error message in the right header.');

                test.notEqual(response.headers['x-osdf-error'].search(/linkage/), -1,
                              "Error message makes mention of 'linkage'");

                // If the node still got inserted somehow, we make sure we remove it
                if (response.headers.hasOwnProperty('location')) {
                    var bad_node_id = get_node_id(response.headers);

                    tutils.delete_node(bad_node_id, auth, function(data, response) {
                        callback(null, target_id);
                    });
                } else {
                    callback(null, target_id);
                }
            });
        },
        // Clean up the inserted nodes
        function(target_id, callback) {
            tutils.delete_node(target_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

function get_node_id(headers) {
    var location = headers.location;
    var node_id = location.split('/').pop();
    return node_id;
}
