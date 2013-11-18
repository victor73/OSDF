#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var async = require('async');
var tutils = require('./lib/test_utils.js');
var schema_utils = require('schema_utils');

var test_ns = 'test';

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_schema = {
    description: "A test schema.",
    type: "object",
    properties: {
        prop: {
            title: "A bit of text.",
            type: "string",
            required: true
        }
    },
   additionalProperties: false
};

// Test basic insertion of a schema. The approach is to attempt the insertion,
// then retrieve it to check that it's there, then clean up by deleting it.
exports['insert_schema'] = function (test) {
    test.expect(4);

    var schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert a schema
            var schema_doc = { name: schema_name,
                               schema: test_schema };

            tutils.insert_schema(test_ns, schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok(data === '', "No content returned on a schema insertion.");

            // then try to retrieve it
            tutils.retrieve_schema(test_ns, schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Schema retrieval yielded correct status code.")

            test.ok(data.length > 0, "Data returned on deletion.");

            test.done();

            // Cleanup. Remove the schema that we inserted.
            try {
                tutils.delete_schema(test_ns, schema_name, auth, function(e){} );
            } catch (e) {
                console.log("Problem deleting the test schema during cleanup.", e);
            }
        }]
    );
};

// Test that the service does not allow invalid data or invalid JSON from
// being registered as a schema.
exports['insert_schema_with_malformed_json'] = function (test) {
    test.expect(4);

    var schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert a schema
            var schema_doc = { name: schema_name,
                               schema: "\\\\\/////" };

            tutils.insert_schema(test_ns, schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 422, "Correct status for insertion.");

            test.ok(data === '', "No content returned on a schema insertion.");

            // then try to retrieve it
            tutils.retrieve_schema(test_ns, schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 404,
                       "Schema retrieval yielded correct status code.")

            test.ok(data.length === 0, "No data returned on retrieval.");

            // If for whatever reason, the schema actually made it into the server
            // we try to remove it so that the test doesn't leave a residue behind.
            if (response.statusCode !== 404) {
                // Cleanup. Remove the schema that we inserted.
                tutils.delete_schema(test_ns, schema_name, auth, function(data, response) {
                    // ignored
                });
            }

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test insertion of a schema into the server where one with the same name
// already exists. The server should not allow an overwrite of this nature. The
// user must either delete the schema, or update/edit it.
exports['insert_conflicting_schema'] = function (test) {
    test.expect(3);

    var schema_name = osdf_utils.random_string(8);

    var schema_doc = { name: schema_name,
                       schema: test_schema };

    async.waterfall([
        function(callback) {
            // First we insert a schema
            tutils.insert_schema(test_ns, schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            // Now, try inserting the same thing again...
            tutils.insert_schema(test_ns, schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.notEqual(response.statusCode, 201,
                       "Insertion of a schema with an existing name did not succeed.")

            test.ok(data.length === 0, "No data returned on subsequent insertion.");

            // Cleanup by removing the schema that we inserted.
            tutils.delete_schema(test_ns, schema_name, auth, function(data, response) {
                callback(null);
            });
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test insertion of a schema when no authentication credentials are provided.
// We should not be able to insert a schema this way.
exports['insert_schema_no_auth'] = function (test) {
    // Use a helper function since the insert_schema_no_auth()
    // and insert_schema_bad_auth() tests are so similar.
    invalid_credentials_helper(test, null);
};

// Test insertion of a schema when invalid authentication credentials are
// provided. We should not be able to insert a schema this way.
exports['insert_schema_bad_auth'] = function (test) {
    // Use a helper function since the insert_schema_no_auth()
    // and insert_schema_bad_auth() tests are so similar.
    invalid_credentials_helper(test, bad_auth);
};

// Test that the service does not allow a schema to be inserted
// that makes reference to an auxiliary schema that it does not
// know about.
exports['insert_schema_with_unknown_auxiliary'] = function (test) {
    test.expect(7);

    var schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // Let's take the test schema, add a $ref to it using a
            // randomly generated name, and attempt to insert it. This
            // should fail.
            var random_aux_name = osdf_utils.random_string(8);
            var test_schema_modified = test_schema;

            test_schema_modified['properties']['$ref'] = random_aux_name;

            var schema_doc = { name: schema_name,
                               schema: test_schema_modified };

            var schema_utils = require('schema_utils.js');
            var refs = schema_utils.extractRefNames(test_schema_modified);

            test.ok(Array.isArray(refs), "Got an array of references to test.");

            test.equal(refs.length, 1, "Got the expected number of reference names.");

            test.equal(refs[0], random_aux_name,
                       "The extracted ref name matches the random name we generated.");

            // Attempt to insert the schema.
            tutils.insert_schema(test_ns, schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 422,
                       "Correct status code for insertion with an unknown auxiliary.");

            test.equal(data.length, 0,
                       "No content returned for schema insertion with an unknown auxiliary.");

            // Now retrieve it and make sure it wasn't registered on the server.
            tutils.retrieve_schema(test_ns, schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 404,
                       "Correct status code for failed insertion.");

            test.equal(data.length, 0,
                       "No content returned for schema retrieval.");

            test.done();
        }]
    );
};

function invalid_credentials_helper(test, test_auth) {
    test.expect(4);

    var schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert a schema
            var schema_doc = { name: schema_name,
                               schema: test_schema };

            // Attempt the insertion with invalid credentials...
            tutils.insert_schema(test_ns, schema_doc, test_auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 403,
                       "Correct status for insertion without credentials.");

            test.equal(data.length, 0,
                       "No content returned on a schema insertion with no credentials.");

            // then try to retrieve it.
            tutils.retrieve_schema(test_ns, schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 404,
                       "Schema retrieval of failed insertion yielded correct code.")

            test.equal(data.length, 0, "No data returned on retrieval.");

            // Cleanup. Remove the schema that we inserted.
            tutils.delete_schema(test_ns, schema_name, auth, function(data, response) {
                // ignored
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
}
