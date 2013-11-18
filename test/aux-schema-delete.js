#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');
var schema_utils = require('schema_utils');
var async = require('async');

var test_ns = 'test';

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_primary_schema = {
    description: "A test primary schema.",
    type: "object",
    properties: {},
    additionalProperties: false
};

var test_aux_schema = {
    type: "string",
    enum: [
        "alpha",
        "bravo",
        "charlie",
        "delta"
    ],
    required: true
};

// Test basic deletion of an auxiliary schema. The approach is to insert a test
// auxiliary schema, verify that the insertion was successful by retrieving it,
// then delete it, and checking to see if another retrieval attempt does not
// get any data.
exports['delete_aux_schema'] = function (test) {
    test.expect(13);

    var aux_schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert an auxiliary schema
            var aux_schema_doc = { name: aux_schema_name,
                                   schema: test_aux_schema };

            tutils.insert_aux_schema(test_ns, aux_schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201,
                       "Correct status for auxiliary schema insertion.");

            test.equal(data.length, 0,
                       "No content returned on a auxiliary schema insertion.");

            // then try to retrieve it
            tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Auxiliary schema retrieval yielded correct status code after deletion.");

            test.ok(data.length > 0, "Data returned on deletion.");

            // Check that it appears in the master listing of auxiliary schemas
            // for the test namespace
            tutils.retrieve_all_aux_schemas(test_ns, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Correct status for auxiliary schema listing.");

            test.ok(data.length > 0, "Got data for auxiliary schema listing.");

            var aux_schemas = JSON.parse(data);
            test.ok(aux_schemas.hasOwnProperty(aux_schema_name),
                    "Auxiliary schema listing contains the test schema.");

            // Now, delete the auxiliary schema
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 204,
                       "Auxiliary schema deletion yielded correct status code.");

            // Now try to retrieve the schema again. It should not be
            // available any longer...
            tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 404,
                       "Auxiliary schema retrieval yielded correct status after deletion.");

            test.equal(data.length, 0,
                      "No data returned on retrieval of deleted auxiliary schema.");

            // Also check that the schema is also removed from the namespace's
            // auxiliary schema master listing
            tutils.retrieve_all_aux_schemas(test_ns, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Correct status for auxiliary schema listing.");

            test.ok(data.length > 0, "Got data for auxiliary schema listing.");

            var aux_schemas = JSON.parse(data);
            test.ok(! aux_schemas.hasOwnProperty(aux_schema_name),
                    "Auxiliary schema listing no longer contains the test schema.");

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test deletion of an auxiliary schema that is in use by existing primary
// schemas. The server should not allow the deletion in this case.
exports['delete_aux_schema_in_use'] = function (test) {
    // The approach will be to create a schema with a random name, that uses an
    // auxiliary with a random name. We add the auxiliary schema, followed by
    // the primary. We then attempt to delete the auxiliary and see if the
    // server disallows the operation. At the conclusion we perform cleanup by
    // deleting the primary first, and follow it up by deleting the auxiliary
    // schema.
    test.expect(4);

    var primary_schema_name = osdf_utils.random_string(8);
    var aux_schema_name = osdf_utils.random_string(8);

    var aux_schema_doc = { name: aux_schema_name,
                           schema: test_aux_schema };

    // Make the primary schema refer to the auxiliary schema
    test_primary_schema['properties']['testprop'] = {};
    test_primary_schema['properties']['testprop']['$ref'] = aux_schema_name;

    var primary_schema_doc = { name: primary_schema_name,
                               schema: test_primary_schema };

    async.waterfall([
        function(callback) {
            // First we insert the auxiliary schema
            tutils.insert_aux_schema(test_ns, aux_schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201,
                       "Correct status for auxiliary schema insertion.");

            // Now, insert the primary schema that uses (refers to) it.
            tutils.insert_schema(test_ns, primary_schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201,
                       "Correct status for primary schema insertion.");

            // Now, try to delete the auxiliary schema (which is now in use)
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 409,
                       "Correct status for auxiliary schema deletion when in use.");

            test.ok(data.length === 0, "No data returned on deletion attempt.");

            test.done();
        }]
    );

    async.waterfall([
        function(callback) {
            // Cleanup by removing the primary and auxiliary schemas that we inserted.
            tutils.delete_schema(test_ns, primary_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            // This delete_aux_schema call might fail if the test code above
            // flagged a failure and the server ALLOWED the schema to be deleted.
            // If that were the case, this hnext deletion would be trying to
            // re-delete it.
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
           if (err) {
               console.log("Problem encountered with test cleanup.", e);
           }
        }
    );
};

// Test deletion of an auxiliary schema when no authentication credentials are
// provided. We should not be able to delete an auxiliary schema this way.
exports['delete_aux_schema_no_auth'] = function (test) {
    // Use a helper function since the delete_aux_schema_no_auth()
    // and delete_aux_schema_bad_auth() tests are so similar.
    invalid_credentials_helper(test, null);
};

// Test deletion of an auxiliary schema when invalid authentication credentials
// are provided. We should not be able to delete an auxiliary schema this way.
exports['delete_aux_schema_bad_auth'] = function (test) {
    // Use a helper function since the delete_aux_schema_no_auth()
    // and delete_aux_schema_bad_auth() tests are so similar.
    invalid_credentials_helper(test, bad_auth);
};

function invalid_credentials_helper(test, test_auth) {
    test.expect(4);

    var aux_schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert a schema
            var aux_schema_doc = { name: aux_schema_name,
                                   schema: test_aux_schema };

            // Make sure we use the invalid credentials here
            tutils.insert_aux_schema(test_ns, aux_schema_doc, test_auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 403,
                       "Correct status for auxiliary schema insertion.");

            test.ok(data === '',
                    "No content returned on an auxiliary schema insertion.");

            // then try to retrieve it (with valid credentials)
            tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 404,
                       "Auxiliary schema retrieval of failed insertion yielded correct code.");

            test.ok(data.length === 0, "No data returned on auxiliary schema retrieval.");

            // Cleanup. Remove the schema that we inserted. Use valid credentials here.
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth, function(data, response){
                // ignored
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
}
