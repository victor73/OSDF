#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');
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

exports['insert_schema_no_auth'] = function (test) {
    invalid_credentials_helper(test, null);
};

exports['insert_schema_bad_auth'] = function (test) {
    invalid_credentials_helper(test, bad_auth);
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
