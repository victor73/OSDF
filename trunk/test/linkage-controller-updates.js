#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var async = require('async');
var tutils = require('./lib/test_utils.js');
var _ = require('lodash');

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();

var test_node = { ns: 'test2',
                  acl: { 'read': ['all'], 'write': ['all'] },
                  linkage: {},
                  node_type: '',
                  meta: {}
                };

exports['update_all_links_disallowed'] = function (test) {
    test.expect(3);

    async.waterfall([
        function(callback) {
            // First we create a starting node
            var start_node = _.cloneDeep(test_node);
            start_node['node_type'] = "start_test_node";

            tutils.insert_node(start_node, auth, function(data, response) {
                var start_node_id = get_node_id(response);

                callback(null, start_node_id);
            });
        }, function(start_node_id, callback) {
            // Now we make a "target" node, that should insert properly because
            // it doesn't have any linkages
            var target = _.cloneDeep(test_node);
            target['node_type'] = 'target';
            target['linkage'] = {};
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                var target_node_id = get_node_id(response);

                callback(null, target, target_node_id, start_node_id);
            });
        }, function(target, target_node_id, start_node_id, callback) {
            // Now we attempt to UPDDATE/EDIT the target node to ADD a linkage.
            // This should FAIL, so we need to check for the failure
            var modified_target = _.cloneDeep(target);
            var random_linkage_name = osdf_utils.random_string(6);

            modified_target['ver'] = 1;
            modified_target['linkage'][random_linkage_name] = [ start_node_id ];

            tutils.update_node(target_node_id, modified_target, auth, function(data, response) {
                callback(null, target_node_id, start_node_id, data, response);
            });
        }, function(target_node_id, start_node_id, data, response, callback) {
            // Confirm that we failed, because "target" nodes cannot link to anything
            test.equal(response.statusCode, 422,
                       "Correct status for update with illegal linkage.");

            test.ok(response.headers.hasOwnProperty('x-osdf-error'),
                    'OSDF reports an error message in the right header.');

            test.notEqual(response.headers['x-osdf-error'].search(/linkage/), -1,
                          "Error message makes mention of 'linkage'");

            // Perform cleanup by removing what we just inserted/updated. We have
            // to delete in the correct order because the API doesn't
            // allow dangling connections/linkages.
            tutils.delete_node(target_node_id, auth, function(data, response) {
                callback(null, start_node_id);
            });
        }, function(start_node_id, callback) {
            tutils.delete_node(start_node_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test to ensure that if we try to update a node that does allow
// some linkages, but only to nodes of a single type, that OSDF
// disallows the update if the incoming linkage is not of that
// type.
exports['update_one_allowance_invalid_link'] = function (test) {
    test.expect(3);

    async.waterfall([
        function(callback) {
            // First we make a "target" node
            var target = _.cloneDeep(test_node);
            target['node_type'] = 'target';
            target['linkage'] = {};
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                var target_node_id = get_node_id(response);

                callback(null, target_node_id);
            });
       },
       function(target_node_id, callback) {
            // Then we create an "example" node
            var example_node = _.cloneDeep(test_node);
            example_node['node_type'] = "example";
            example_node['linkage'] = { related_to: [ target_node_id ] };
            example_node['meta']['color'] = "red";
            example_node['ver'] = 1;

            tutils.insert_node(example_node, auth, function(data, response) {
                var example_node_id = get_node_id(response);

                callback(null, example_node, example_node_id, target_node_id);
            });
       },
       function(example_node, example_node_id, target_node_id, callback) {
            // Now create an "example" node, and attempt to connect it to the
            // start node. "example" nodes are only allowed to connect to
            // "target" nodes.
            var random_linkage_name = osdf_utils.random_string(6);
            var example_modified = _.cloneDeep(example_node);
            example_modified['node_type'] = 'example';
            example_modified['linkage'][ random_linkage_name ] = [ target_node_id ];

            tutils.update_node(example_node_id, example_modified, auth, function(data, response) {
                callback(null, example_node_id, target_node_id, data, response);
            });
        },
        function(example_node_id, target_node_id, data, response, callback) {
            // Confirm that we failed...
            test.equal(response.statusCode, 422,
                    "Correct status for update with illegal linkage.");

            test.ok(response.headers.hasOwnProperty('x-osdf-error'),
                    'OSDF reports an error message in the right header.');

            test.notEqual(response.headers['x-osdf-error'].search(/linkage/), -1,
                    "Error message makes mention of 'linkage'");

            // Perform cleanup by removing what we just inserted/updated. We have to
            // delete in the correct order because the API doesn't allow dangling
            // connections/linkages.
            tutils.delete_node(example_node_id, auth, function(data, response) {
                callback(null, target_node_id);
            });
        },
        function(target_node_id, callback) {
            tutils.delete_node(target_node_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test to ensure that if we try to update a node with a wildcard for
// linkage names, but a specified target, that the system does allow
// an insertion with a random linkage, and the target that
// the linkage.json file allows.
//
// any_link_to_target: {
//   "*": [ "target" ]
// }
//
exports['update_wildcard_linkage_valid_target'] = function (test) {
    test.expect(2);

    async.waterfall([
        function(callback) {
            // First we create a "target" node
            var target = _.cloneDeep(test_node);
            target['node_type'] = 'target';
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                var target_id = get_node_id(response);

                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            // Now create an "any_link_to_target" node, and attempt to connect it to the
            // target node. "any_link_to_target" nodes are only allowed to connect to
            // "target" nodes, but can use any linkage/edge name.
            var any_link_to_target = _.cloneDeep(test_node);
            any_link_to_target['node_type'] = 'any_link_to_target';
            // Make a random link name
            var random_link_name = osdf_utils.random_string(6);
            any_link_to_target['linkage'][ random_link_name ] = [ target_id ];

            tutils.insert_node(any_link_to_target, auth, function(data, response) {
                var any_link_id = get_node_id(response);

                callback(null, any_link_to_target, any_link_id, target_id);
            });
        },
        function(any_link_to_target, any_link_id, target_id, callback) {
            // Now UPDATE the link, to use a different link name, but still
            // pointing to the "target".

            // Make a random link name
            var random_link_name = osdf_utils.random_string(6);

            any_link_cloned = _.cloneDeep(any_link_to_target);
            any_link_cloned['linkage'][ random_link_name ] = [ target_id ];
            any_link_cloned['ver'] = 1;

            tutils.update_node(any_link_id, any_link_cloned, auth, function(data, response) {
                // Confirm that we succeeded...
                test.equal(response.statusCode, 200,
                        "Correct status for update with valid linkage.");

                test.ok(! response.headers.hasOwnProperty('x-osdf-error'),
                        'OSDF did not report any error message in the headers.');

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
            // Do some cleanup by removing the initial target node.
            tutils.delete_node(target_id, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test to ensure that if we try to update a node with a wildcard for
// linkage names, but a specified target, that the system does NOT allow
// an update with a random linkage, and a target that
// the linkage.json file does not mention/allow.
//
// any_link_to_target: {
//   "*": [ "target" ]
// }
exports['update_wildcard_linkage_invalid_target'] = function (test) {
    test.expect(3);

    async.waterfall([
        function(callback) {
            // First we create a "target" node
            var target = _.cloneDeep(test_node);
            target['node_type'] = 'target';
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                var target_id = get_node_id(response);

                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            // Create an "other" node
            // (to a non "target" node).
            var other = _.cloneDeep(test_node);
            other['node_type'] = 'other';
            other['linkage'] = {};

            tutils.insert_node(other, auth, function(data, response) {
                var other_id = get_node_id(response);

                callback(null, other_id, target_id);
            });
        },
        function(other_id, target_id, callback) {
            var any_link_to_target = _.cloneDeep(test_node);
            var random_link_name = osdf_utils.random_string(6);
            any_link_to_target['node_type'] = 'any_link_to_target';
            any_link_to_target['linkage'][ random_link_name ] = [ target_id ];
            any_link_to_target['meta']['color'] = "red";

            tutils.insert_node(any_link_to_target, auth, function(data, response) {
                var any_id = get_node_id(response);

                callback(null, any_id, other_id, target_id);
            });
        },
        // Clean up the inserted node if it managed to get into the db
        function(any_id, other_id, target_id, callback) {
            var any_link_modified = _.cloneDeep(test_node);
            var random_link_name = osdf_utils.random_string(6);
            any_link_modified['node_type'] = 'any_link_to_target';
            any_link_modified['ver'] = 1;
            any_link_modified['linkage'][ random_link_name ] = [ other_id ];

            tutils.update_node(any_id, any_link_modified, auth, function(data, response) {
                // Confirm that we failed...
                test.equal(response.statusCode, 422,
                        "Correct status for update with link to impermissible target.");

                test.ok(response.headers.hasOwnProperty('x-osdf-error'),
                        'OSDF reports an error message in the right header.');

                test.notEqual(response.headers['x-osdf-error'].search(/linkage/), -1,
                        "Error message makes mention of 'linkage'");

                callback(null, any_id, other_id, target_id);
            });
        },
        function(any_id, other_id, target_id, callback) {
            tutils.delete_node(any_id, auth, function(data, response) {
                callback(null, other_id, target_id);
            });
        },
        // Delete the helper 'other' node
        function(other_id, target_id, callback) {
            tutils.delete_node(other_id, auth, function(data, response) {
                callback(null, target_id);
            });
        },
        // Delete the helper 'target' node
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


//
//    "any_link": {
//        "*": [ "*" ]
//    }
//
exports['update_wildcard_linkage_wildcard_target'] = function (test) {
    test.expect(2);

    async.waterfall([
        function(callback) {
            // Create a "starting" node
            var start_node = _.cloneDeep(test_node);
            start_node['node_type'] = 'start_test_node';
            start_node['linkage'] = {};

            tutils.insert_node(start_node, auth, function(data, response) {
                var start_node_id = get_node_id(response);

                callback(null, start_node_id);
            });
        },
        function(start_node_id, callback) {
            // Make a new node with no linkages
            var any_link = _.cloneDeep(test_node);
            any_link['node_type'] = 'any_link';

            tutils.insert_node(any_link, auth, function(data, response) {
                var any_link_id = get_node_id(response);

                callback(null, any_link_id, start_node_id);
            });
        },
        function(any_link_id, start_node_id, callback) {
            // Modify this new node to point to the starting node
            var any_link_modified = _.cloneDeep(test_node);
            var random_link_name = osdf_utils.random_string(6);
            any_link_modified['node_type'] = 'any_link';
            any_link_modified['ver'] = 1;
            any_link_modified['linkage'][ random_link_name ] = [ start_node_id ];

            tutils.update_node(any_link_id, any_link_modified, auth, function(data, response) {
                // Confirm that we succeeded...
                test.equal(response.statusCode, 200,
                        "Correct status for update with valid linkage.");

                test.ok(! response.headers.hasOwnProperty('x-osdf-error'),
                        'OSDF did not report any error message in the headers.');

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
exports['update_wildcard_node_wildcard_linkage_wildcard_target'] = function (test) {
    test.expect(2);

    async.waterfall([
        function(callback) {
            // Create a "starting" node to
            var start_node = _.cloneDeep(test_node);
            start_node['node_type'] = 'start_test_node';
            start_node['linkage'] = {};

            tutils.insert_node(start_node, auth, function(data, response) {
                var start_node_id = get_node_id(response);

                callback(null, start_node_id);
            });
        },
        function(start_node_id, callback) {
            // Now make a node with a randomly generated node type,
            // and connect it to the 'starting' node.
            var randomly_named_node = _.cloneDeep(test_node);
            randomly_named_node['node_type'] = osdf_utils.random_string(6);
            var random_linkage_name = osdf_utils.random_string(6);

            tutils.insert_node(randomly_named_node, auth, function(data, response) {
                var randomly_named_id = get_node_id(response);

                callback(null, randomly_named_id, start_node_id);
            });
        },
        function(randomly_named_id, start_node_id, callback) {
            // Now make a node with a randomly generated node type,
            // and connect it to the 'starting' node.
            var randomly_modified = _.cloneDeep(test_node);
            var random_linkage_name = osdf_utils.random_string(6);
            var random_node_type = osdf_utils.random_string(6);

            randomly_modified['node_type'] = random_node_type;
            randomly_modified['linkage'][ random_linkage_name ] = [ start_node_id ];
            randomly_modified['ver'] = 1;

            tutils.update_node(randomly_named_id, randomly_modified, auth, function(data, response) {
                test.equal(response.statusCode, 200,
                           "Correct status for update.");

                test.ok((! response.headers.hasOwnProperty('x-osdf-error')),
                        "No error message in headers after insertion.");

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
exports['update_multi_linkage_multi_target_valid'] = function (test) {
    test.expect(2);

    async.waterfall([
        function(callback) {
            // Make a "target" node to start out with
            var target = _.cloneDeep(test_node);
            target['node_type'] = 'target';
            target['linkage'] = {};
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                var target_id = get_node_id(response);

                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            // Now make an example2 node
            var example2 = _.cloneDeep(test_node);
            example2['node_type'] = "example2";
            example2['linkage'] = { "related_to": [ target_id ] };

            tutils.insert_node(example2, auth, function(data, response) {
                var example2_id = get_node_id(response);

                callback(null, example2_id, target_id);
            });
        },
        function(example2_id, target_id, callback) {
            // Now modify the example2 node and attempt an update
            var example2_modified = _.cloneDeep(test_node);
            example2_modified['node_type'] = "example2";
            example2_modified['linkage'] = { "connected_to": [ target_id ] };
            example2_modified['ver'] = 1;

            tutils.update_node(example2_id, example2_modified, auth, function(data, response) {
                test.equal(response.statusCode, 200,
                           "Correct status for update.");

                test.ok((! response.headers.hasOwnProperty('x-osdf-error')),
                        "No error message in headers after insertion.");

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
exports['update_multi_linkage_multi_target_invalid'] = function (test) {
    test.expect(3);

    async.waterfall([
        function(callback) {
            // Make a "target" node to start out with
            var target = _.cloneDeep(test_node);
            target['node_type'] = 'target';
            target['linkage'] = {};
            target['meta']['color'] = "red";

            tutils.insert_node(target, auth, function(data, response) {
                var target_id = get_node_id(response);

                callback(null, target_id);
            });
        },
        function(target_id, callback) {
            // Now make an example2 node
            var example2 = _.cloneDeep(test_node);
            example2['node_type'] = "example2";
            example2['linkage'] = { "connected_to": [ target_id ] };

            tutils.insert_node(example2, auth, function(data, response) {
                var example2_id = get_node_id(response);
                callback(null, example2_id, target_id);
            });
        },
        function(example2_id, target_id, callback) {
            var modified_example2 = _.cloneDeep(test_node);
            var random_linkage_name = osdf_utils.random_string(6);

            modified_example2['ver'] = 1;
            modified_example2['node_type'] = "example2";
            modified_example2['linkage'][ random_linkage_name ] = [ target_id ];

            tutils.update_node(example2_id, modified_example2, auth, function(data, response) {
                test.equal(response.statusCode, 422,
                           "Correct status for update with illegal linkage.");

                test.ok(response.headers.hasOwnProperty('x-osdf-error'),
                        'OSDF reports an error message in the right header.');

                test.notEqual(response.headers['x-osdf-error'].search(/linkage/), -1,
                              "Error message makes mention of 'linkage'");

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

function get_node_id(response) {
    var location = response.headers.location;
    var node_id = location.split('/').pop();
    return node_id;
}

