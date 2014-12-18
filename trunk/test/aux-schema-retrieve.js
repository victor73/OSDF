#!/usr/bin/node

var async = require('async');
var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');

var test_ns = 'test';

// Get a set of valid and invalid credentials for our tests
var auth_header = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_schema = {
    description: "A test schema.",
    type: "object",
    properties: {
        prop: {
            title: "A bit of text.",
            type: "string"
        }
    },
    additionalProperties: false,
    required: [
        "prop"
    ]
};

// Test retrieval of the collection of auxiliary schemas. We start by inserting
// a test schema with a random name into the 'test' namespace, then we retrieve
// all the schemas in the namespace and see if it's there or not.
exports['retrieve_all'] = function (test) {
    test.expect(6);

    var aux_schema_name = osdf_utils.random_string(8);

    // First we insert a schema
    var schema_doc = { name: aux_schema_name,
                       schema: test_schema };

    async.waterfall([
        function(callback) {
            tutils.insert_aux_schema(test_ns, schema_doc, auth_header, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for aux schema insertion.");

            test.ok(data === '', "No content returned on an aux schema insertion.");

            // then try to retrieve it
            tutils.retrieve_all_aux_schemas(test_ns, auth_header, function(data, response) {
                callback(null, data, response);
            });

        }, function(data, response, callback) {
            test.equal(response.statusCode, 200, "Correct status for retrieval of all aux schemas.");

            test.ok(data.length > 0, "Data returned.");

            var schema_collection_data;
            try {
                schema_collection_data = JSON.parse(data);
            } catch (err) {
                // ignored
            }

            test.ok(schema_collection_data !== null, "Data returned was valid JSON.");

            // Test if the schema we just inserted is listed in the "all" listing.
            test.ok(schema_collection_data.hasOwnProperty(aux_schema_name),
                    "Aux schema listing shows inserted test aux schema.");

            // Perform cleanup by removing what we just inserted and retrieved.
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth_header, function(data, results) {
                // ignored
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test retrieval of the collection of auxiliary schemas with a missing authentication
// token. We should not provide it if no authentication has been provided. The
// user/caller should get an HTTP 403 status code.
exports['retrieve_all_no_auth'] = function (test) {
    test.expect(2);

    // Note the 'null' for where the auth token would normally be provided.
    tutils.retrieve_all_aux_schemas(test_ns, null, function(data, response) {
        test.equal(response.statusCode, 403,
                   "Correct status for retrieval of schemas with invalid auth token.");

        test.ok(data.length === 0, "No data returned.");

        test.done();
    });
};

// Test retrieval of the collection of auxiliary schemas with an incorrect authentication
// token. We generate an invalid password to test this particular case.  The
// user/caller should get an HTTP 403 status code.
exports['retrieve_all_bad_auth'] = function (test) {
    test.expect(2);

    // then try to retrieve it without providing authentication
    tutils.retrieve_all_aux_schemas( test_ns, bad_auth, function(data, response) {
        test.equal(response.statusCode, 403,
                   "Correct status for retrieval of aux schemas without auth token.");

        test.ok(data.length === 0, "No data returned.");

        test.done();
    });
};

// Test basic retrieval of an auxiliary schema. The approach is to first insert an auxiliary
// schema, then retrieve it. We also make an attempt To cleanup by deleting the auxiliary
// schema at the conclusion of the test.
exports['basic_retrieve'] = function (test) {
    test.expect(5);

    var aux_schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert a schema
            var aux_schema_doc = { name: aux_schema_name,
                                   schema: test_schema };

            tutils.insert_aux_schema(test_ns, aux_schema_doc, auth_header, function(data, response) {
                callback(null, data, response);
            });
        },
        function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for aux schema insertion.");

            test.ok(data === '', "No content returned on aux schema insertion.");

            // then try to retrieve it
            tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth_header,
                                       function(data, response) {
                                           callback(null, data, response);
                                       });
        },
        function(data, response, callback) {
            test.equal(response.statusCode, 200, "Correct status for schema retrieval.");

            test.ok(data.length > 0, "Data returned from aux schema retrieval.");

            var aux_schema_data;
            try {
                aux_schema_data = JSON.parse(data);
            } catch (err) {
                callback(err);
            }

            test.ok(aux_schema_data !== null, "Data returned was valid JSON.");

            // Perform cleanup by removing what we just inserted and retrieved.
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth_header,
                                     function(data, results) {
                                         // ignored
                                     });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Attempt a retreival with no authentication credentials.
// Insert a schema, then retrieve it with no authentication, then cleanup.
exports['basic_retrieve_no_auth'] = function (test) {
    test.expect(5);

    var aux_schema_name = osdf_utils.random_string(8);

    // First we create a schema
    var aux_schema_doc = { name: aux_schema_name,
                           schema: test_schema };

    tutils.insert_aux_schema(test_ns, aux_schema_doc, auth_header, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion of aux schema.");

        test.ok("location" in response.headers, "Response header contains location of new schema." );

        test.ok(data === '', "No content returned on an aux schema insertion.");

        // then try to retrieve it, which should fail...
        // Note the null where the auth_header would normally go.
        tutils.retrieve_aux_schema(test_ns, aux_schema_name, null, function(data, response) {
            test.equal(response.statusCode, 403,
                       "Correct status for retrieval of an aux schema without an auth token.");

            test.ok(data.length === 0, "No data returned.");

            test.done();

            try {
                tutils.delete_aux_schema(test_ns, aux_schema_name, auth_header,
                                         function(data, response) {
                                             // ignored
                                         });
            } catch (e) {
                console.log("Problem deleting test aux schema during cleanup.", e);
            }
        });
    });
};

// Attempt an aux schema retreival with bad/invalid authentication credentials.
// Insert an aux schema, then retrieve it with invalid authentication, then cleanup.
exports['basic_retrieve_bad_auth'] = function (test) {
    test.expect(5);

    var aux_schema_name = osdf_utils.random_string(8);

    // First we create a schema
    var aux_schema_doc = { name: aux_schema_name,
                           schema: test_schema };

    // First we insert an auxiliary schema
    tutils.insert_aux_schema(test_ns, aux_schema_doc, auth_header, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion of an aux schema.");

        test.ok("location" in response.headers, "Response header contains location of new aux schema." );

        test.ok(data === '', "No content returned on an aux schema insertion.");

        // then try to retrieve it, this should fail.
        tutils.retrieve_aux_schema(test_ns, aux_schema_name, bad_auth, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for retrieval with invalid auth credentials.");

            test.ok(data.length === 0, "No data returned.");

            test.done();

            try {
                tutils.delete_aux_schema(test_ns, aux_schema_name, auth_header,
                                     function(data, response) {
                                         // ignored
                                     });
            } catch (e) {
                console.log("Problem deleting test aux schema during cleanup.", e);
            }
        });
    });
};

// Test the behavior of retrieving a non-existent node.
exports['retrieve_nonexistent'] = function (test) {
    test.expect(2);

    var aux_schema_name = osdf_utils.random_string(8);

    tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth_header, function(data, response) {
        test.equal(response.statusCode, 404,
                   "Correct status for retrieval of non-existent aux schema.");

        test.ok(data === '', "No data returned for retrieval of non-existent aux schema.");

        test.done();
    });
};

// Try to retrieve an auxiliary schema that doesn't exist and try to do it without
// authenticating with an authorization credential. This test is a bit silly, but
// it's here just in case and for completeness.
exports['retrieve_nonexistent_no_auth'] = function (test) {
    test.expect(2);

    var aux_schema_name = osdf_utils.random_string(8);

    // Use null for the credential, which won't send anything.
    tutils.retrieve_aux_schema(test_ns, aux_schema_name, null, function(data, response) {
        test.equal(response.statusCode, 403,
                   "Correct status for retrieval of non-existent aux schema with no auth.");

        test.ok(data === '', "No data returned for retrieval of non-existent aux schema with no auth.");

        test.done();
    });
};

// Try to retrieve a schema that doesn't exist and try to do it with an invalid
// set of credentials. This test is a bit silly, but it's here just in case and
// for completeness.
exports['retrieve_nonexistent_bad_auth'] = function (test) {
    test.expect(2);

    var aux_schema_name = osdf_utils.random_string(8);

    tutils.retrieve_aux_schema(test_ns, aux_schema_name, bad_auth, function(data, response) {
        test.equal(response.statusCode, 403,
                   "Correct status for retrieval of non-existent aux schema with no auth.");

        test.ok(data === '',
                "No data returned for retrieval of non-existent aux schema with no auth.");

        test.done();
    });
};
