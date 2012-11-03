#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');
var schema_utils = require('schema_utils');
var flow = require('flow');

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

// Test basic insertion of a schema. The approach is to attempt the isnertion, then
// retrieve it to check that it's there, then clean up by deleting it.
exports['insert_schema'] = function (test) {
    test.expect(4);

    var schema_name = osdf_utils.random_string(8);

    flow.exec(
        function() {
            // First we insert a schema
            var schema_doc = { name: schema_name,
                               schema: test_schema };

            tutils.insert_schema(test_ns, schema_doc, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 201, "Correct status for insertion.");

            test.ok(data === '', "No content returned on a schema insertion.");

            // then try to retrieve it 
            tutils.retrieve_schema(test_ns, schema_name, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 200,
                       "Schema retrieval yielded correct status code.")

            test.ok(data.length > 0, "No data returned on deletion.");

            test.done();

            // Clenaup. Remove the schema that we inserted.
            try {
                tutils.delete_schema(test_ns, schema_name, auth, function(e){} );
            } catch (e) {
                console.log("Problem deleting the test schema during cleanup.", e);
            }
        }
    );
};

// Test insertion of a schema when no authentication credentials
// are provided. We should not be able to insert a schema this way.
exports['insert_schema_no_auth'] = function (test) {
    // Use a helper function since the insert_schema_no_auth()
    // and insert_schema_bad_auth() tests are so similar.
    invalid_credentials_helper(test, null);
};

// Test insertion of a schema when invalid authentication credentials
// are provided. We should not be able to insert a schema this way.
exports['insert_schema_bad_auth'] = function (test) {
    // Use a helper function since the insert_schema_no_auth()
    // and insert_schema_bad_auth() tests are so similar.
    invalid_credentials_helper(test, bad_auth);
};

exports['insert_schema_with_unknown_auxiliary'] = function (test) {
    test.expect(7);

    var schema_name = osdf_utils.random_string(8);

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

    flow.exec(
        function() {
            test.ok(Array.isArray(refs), "Got an array of references to test.");

            test.equal(refs.length, 1, "Got the expected number of reference names.");
            
            test.equal(refs[0], random_aux_name,
                       "The extracted ref name matches the random name we generated.");

            tutils.insert_schema(test_ns, schema_doc, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 422,
                       "Correct status code for insertion with an unknown auxiliary.");

            test.ok(data === '', 
                    "No content returned for schema insertion with an unknown auxiliary.");

            tutils.retrieve_schema(test_ns, schema_name, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 404,
                       "Correct status code for failed insertion.");

            test.ok(data === '', 
                    "No content returned for schema retrieval.");

            test.done();
        }
    );
};

function invalid_credentials_helper(test, test_auth) {
    test.expect(4);

    var schema_name = osdf_utils.random_string(8);

    flow.exec(
        function() {
            // First we insert a schema
            var schema_doc = { name: schema_name,
                               schema: test_schema };

            tutils.insert_schema(test_ns, schema_doc, test_auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 403,
                       "Correct status for insertion without credentials.");

            test.ok(data === '',
                    "No content returned on a schema insertion with no credentials.");

            // then try to retrieve it 
            tutils.retrieve_schema(test_ns, schema_name, auth, this);
        }, function(data, response) {
            test.equal(response.statusCode, 404,
                       "Schema retrieval of failed insertion yielded correct code.")

            test.ok(data.length == 0, "No data returned on retrieval.");

            test.done();

            // Clenaup. Remove the schema that we inserted.
            try {
                tutils.delete_schema(test_ns, schema_name, auth, function(e){} );
            } catch (e) {
                console.log("Problem deleting the test schema during cleanup.", e);
            }
        }
    );
}
