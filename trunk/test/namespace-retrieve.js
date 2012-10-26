#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils');
var _ = require('underscore');
var logger = osdf_utils.get_logger();

var host = 'localhost';
var username = 'test';
var password = 'test';

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

// Test that the system supports the retrieval of all the namespaces the OSDF
// instance knows about. We also examine the data that is retrieved in some
// detail to help ensure the format is correct.
exports['retrieve_all_namespaces'] = function (test) {
    logger.debug('In retrieve_all_namespaces');
    test.expect(9);

    tutils.retrieve_all_namespaces( auth, function(data, response) {
        test.equal(response.statusCode, 200, "Correct status from request for all namespaces.");
        test.ok(response.headers['content-type'].indexOf("application/json") != -1,
                "Correct content type for namespaces request.");

        var namespaces_json;
        try {
            namespaces_json = JSON.parse(data);

            test.ok("Content returned is valid JSON.");

            test.ok( "page" in namespaces_json, "Data contained 'page' key.");
            test.equal( typeof(namespaces_json.page), "number", "Type of 'page' key is correct.");

            test.ok( "result_count" in namespaces_json, "Data contained 'result_count' key.");
            test.equal( typeof(namespaces_json.result_count), "number",
                        "Type of 'result_count' key is correct.");

            test.ok( "results" in namespaces_json, "Data contained 'results' key.");
            test.equal( typeof(namespaces_json.results), "object",
                        "Type of 'results' key is correct.");
        } catch (e) {
            test.fail("Content returned is invalid JSON.");
        }

        test.done();
    });
};

// Test the behavior we get when we attempt to list the namespaces with an
// missing authentication token.
exports['retrieve_all_namespaces_no_auth'] = function (test) {
    logger.debug('In retrieve_all_namespaces_no_auth');
    test.expect(2);

    tutils.retrieve_all_namespaces(null, function(data, response) {
        test.equal(response.statusCode, 403,
                   "Correct status for namespace listing without auth token.");
        test.ok(data == '', "No content returned for namespace listing without auth token.");
        test.done();
    });
};

// Test the behavior we get when we attempt to list the namespaces with an
// invalid/incorrect authentication token.
exports['retrieve_all_namespaces_bad_auth'] = function (test) {
    logger.debug('In retrieve_all_namespaces_bad_auth');
    test.expect(2);

    tutils.retrieve_all_namespaces(bad_auth, function(data, response) {
        test.equal(response.statusCode, 403,
                   "Correct status for namespace listing without auth token.");
        test.ok(data == '', "No content returned for namespace listing without auth token.");
        test.done();
    });
};

// Test the behavior of the system for when a user requests a valid namespace.
// The approach here is to retrieve all the namespaces, pick one of them, and then
// make that request to test the behavior. Of course, for this test to work
// we assume that the retrieval of "all" namespaces works properly. If it doesn't,
// then this test will probably fail too.
exports['retrieve_valid_namespace'] = function (test) {
    test.expect(9);

    tutils.retrieve_all_namespaces(auth, function(data, response) {
        var all_namespaces = JSON.parse(data);
        var results = all_namespaces.results;
        results.length;

        var random_ns_struct = results[ Math.floor(Math.random() * results.length) ];
        var ns_names = _.keys(random_ns_struct);

        // So we have our namespace names now after we have extracted the keys.
        // There should actually be only 1, so use the first element
        if (ns_names.length != 1) {
            throw "Invalid number of namespace names.";
        }

        // Just look at the first one
        var retrieved_ns_name = ns_names[0];

        tutils.retrieve_namespace(retrieved_ns_name, auth, function(data, response) {
            test.equal(response.statusCode, 200, "Correct status for valid namespace retrieval.");

            test.ok(response.headers['content-type'].indexOf("application/json") != -1,
                "Correct content type for namespace retrieval.");

            test.ok(data != null, "Namespace retrieval yielded non-null data.");

            test.ok(data.length > 0, "Namespace data from retrieval not the empty string.");

            try {
                var ns = JSON.parse(data);
                test.equal( _.keys(ns).length, 1, "Number of namespace objects returned is 1.");

                test.ok( "title" in  ns[retrieved_ns_name]);
                test.ok( "description" in  ns[retrieved_ns_name]);
                test.ok( "acl" in  ns[retrieved_ns_name]);
                test.ok( "url" in  ns[retrieved_ns_name]);
            } catch (e) {
                // ignore
            }

            test.done();
        });

    });
}

// Test the behavior of the system for when a user requests a valid namespace,
// but does so without providing an authorization token as specified by the API.
// The approach here is the same as for 'retrieve_valid_namespace' but we should
// get an HTTP 403 (Forbidden) response code.
exports['retrieve_valid_namespace_no_auth'] = function (test) {
    test.expect(2);

    // Get the list of namespaces, and then choose one at random.
    tutils.retrieve_all_namespaces(auth, function(data, response) {
        var all_namespaces = JSON.parse(data);
        var results = all_namespaces.results;
        results.length;

        var random_ns_struct = results[ Math.floor(Math.random() * results.length) ];
        var ns_names = _.keys(random_ns_struct);
        // So we have our namespace names now after we have extracted the keys.
        // There should actually be only 1, so use the first element
        if (ns_names.length != 1) {
            throw "Invalid number of namespace names.";
        }
        var retrieved_ns_name = ns_names[0];

        tutils.retrieve_namespace(retrieved_ns_name, null, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for namespace retrieval with no auth.");

            test.ok(data == '', "No data returned.");

            test.done();
        });

    });
}

// Test the behavior of the system for when a user requests a valid namespace,
// but does so by providing an authorization token that is incorrect or invalid.
// The approach here is the same as for 'retrieve_valid_namespace' but we should
// get an HTTP 403 (Forbidden) response code.
exports['retrieve_valid_namespace_bad_auth'] = function (test) {
    test.expect(2);

    // Get the list of namespaces, and then choose one at random.
    tutils.retrieve_all_namespaces(auth, function(data, response) {
        var all_namespaces = JSON.parse(data);
        var results = all_namespaces.results;
        results.length;

        var random_ns_struct = results[ Math.floor(Math.random() * results.length) ];
        var ns_names = _.keys(random_ns_struct);

        // So we have our namespace names now after we have extracted the keys.
        // There should actually be only 1, so use the first element
        if (ns_names.length != 1) {
            throw "Invalid number of namespace names.";
        }
        var retrieved_ns_name = ns_names[0];

        tutils.retrieve_namespace(retrieved_ns_name, bad_auth, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for namespace retrieval with no auth.");

            test.ok(data == '', "No data returned.");

            test.done();
        });

    });
}

// Test the behavior of the system for when a user requests an non-existent namespace.
// The approach here is to generate a random namespace to use for the request.
exports['retrieve_invalid_namespace'] = function (test) {
    test.expect(2);

    // Generate a random string for our 'invalid' namespace that we're going to request.
    var invalid_namespace = osdf_utils.random_string(8);

    tutils.retrieve_namespace(invalid_namespace, auth, function(data, response) {
        test.equal(response.statusCode, 404, "Correct status for invalid namespace retrieval.");

        test.ok(data == '', "No data returned for an invalid namespace retrieval.");

        test.done();
    });
}
