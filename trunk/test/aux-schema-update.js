#!/usr/bin/node

var _ = require('lodash');
var async = require('async');
var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');
var schema_utils = require('schema_utils');
var clone = require('clone');

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

// Test basic update of an auxiliary schema. The approach is to insert an
// auxiliary schema, then perform an update/edit operation, then check that the
// update worked by retrieving it and examining the results. We also need to
// check that the update "stuck" by attempting to insert a node to see whether
// the update auxiliary schema is used by the validation engine or not. After
// those tests are performed, we do cleanup.
exports['update_aux_schema'] = function (test) {
    test.expect(14);

    var primary_schema_name = osdf_utils.random_string(8);
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
                       "Correct status for primary schema insertion.");

            test.ok(data === '', "No content returned on auxiliary schema insertion.");

            // Make a primary schema that refers to the auxiliary schema that we just inserted
            var schema = test_primary_schema;
            schema['properties']['testprop'] = {};
            schema['properties']['testprop']['$ref'] = aux_schema_name;

            var primary_schema_doc = { name: primary_schema_name,
                                       schema: schema };

            // Then we insert the schema that refers to the newly inserted auxiliary schema
            tutils.insert_schema(test_ns, primary_schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201,
                       "Correct status for primary schema insertion.");

            test.ok(data === '', "No content returned on a schema insertion.");

            // Make an altered version of the test aux schema.
            var new_aux_schema = clone(test_aux_schema);
            new_aux_schema['enum'] = [ "x-ray", "yankee", "zulu" ];

            // then we update the auxiliary schema with the altered version
            tutils.update_aux_schema(test_ns, aux_schema_name, new_aux_schema, auth,
                function(data, response) {
                    callback(null, data, response);
                }
            );
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Auxiliary schema update yielded correct status code.")

            test.ok(data === '', "No data returned on auxiliary schema update.");

            // Retrieve the auxiliary schema by name and see if the update/edit
            // was honored.
            tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Retrieval of auxiliary schema yielded correct status code.");

            test.ok(data.length > 0,
                    "Data returned on auxiliary schema retrieval.");

            var aux_schema;
            try {
                aux_schema = JSON.parse(data);
            } catch (err) {
                callback(err);
            }

            test.ok(aux_schema.hasOwnProperty('enum') && (aux_schema['enum'].length === 3),
                    "Retrieved auxiliary schema has the correct structure.");

            test.equal(aux_schema['enum'][2], 'zulu',
                       "Auxiliary schema update took effect.");

            // Get all the auxiliary schemas for the namespace and see if the
            // one we just updated is there and that it has the updated form
            tutils.retrieve_all_aux_schemas(test_ns, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Retrieval of all auxiliary schemas yielded correct status code.");

            test.ok(data.length > 0, "Data returned on auxiliary schema listing.");

            var aux_schemas;
            try {
                aux_schemas = JSON.parse(data);
            } catch (err) {
                callback(err);
            }

            test.ok(aux_schemas.hasOwnProperty(aux_schema_name),
                    "Namespace's auxiliary schema listing includes test aux schema.");

            test.equal(aux_schemas[aux_schema_name]['enum'][2], 'zulu',
                      "Auxiliary schema update took effect in namespace's schema listing.");

            // Cleanup. Remove the aux and primary schemas that we inserted.
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                // ignored
            });
            tutils.delete_schema(test_ns, primary_schema_name, auth, function(data, response) {
                // ignored
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test that the service does not allow invalid data or invalid JSON from
// being registered as an auxiliary schema when performing an update/edit.
exports['update_aux_schema_with_malformed_json'] = function (test) {
    test.expect(7);

    var aux_schema_name = osdf_utils.random_string(8);
    var bad_data = "\\\\\/////";

    async.waterfall([
        function(callback) {
            // First, we create the auxiliary schema document
            var aux_schema_doc = { name: aux_schema_name,
                                   schema: test_aux_schema };

            // Now we insert the auxiliary schema
            tutils.insert_aux_schema(test_ns, aux_schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201,
                       "Correct status for auxiliary schema insertion.");

            test.ok(data === '',
                    "No data returned from auxiliary schema insertion.");

            tutils.update_aux_schema(test_ns, aux_schema_name, bad_data, auth,
                function(data, response) {
                    callback(null, data, response);
                }
            );
        }, function(data, response, callback) {
            test.equal(response.statusCode, 422,
                       "Correct status for invalid auxiliary schema update.");

            test.ok(data === '',
                    "No data returned on an auxiliary schema update.");

            // Next, try to retrieve it
            tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Auxiliary schema retrieval yielded correct status code.")

            test.ok(data.length > 0,
                    "Data returned on auxiliary schema retrieval.");

            test.ok(data !== bad_data,
                   "Bad data did not make it into the server.")

            // If for whatever reason, the auxiliary schema actually made it
            // into the server we try to remove it so that the test doesn't
            // leave a residue behind.
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                // ignored
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

// Test update of an auxiliary schema when no authentication credentials are
// provided. We should not be able to update an auxiliary schema this way.
exports['update_aux_schema_no_auth'] = function (test) {
    // Use a helper function since the update_aux_schema_no_auth()
    // and update_aux_schema_bad_auth() tests are so similar.
    invalid_credentials_helper(test, null);
};

// Test update of an auxiliary schema when invalid authentication credentials
// are provided. We should not be able to update an auxiliary schema this way.
exports['update_aux_schema_bad_auth'] = function (test) {
    // Use a helper function since the update_aux_schema_no_auth()
    // and update_aux_schema_bad_auth() tests are so similar.
    invalid_credentials_helper(test, bad_auth);
};

// Test that the service does not allow a schema to be updated with a reference
// to another auxiliary schema that it does not know about.
exports['update_aux_schema_with_unknown_auxiliary'] = function (test) {
    test.expect(10);

    var aux_schema_name = osdf_utils.random_string(8);

    var aux_schema_doc = { name: aux_schema_name,
                           schema: test_aux_schema };

    var random_aux_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First, we insert the auxiliary schema that we will use to try
            // the update.
            tutils.insert_aux_schema(test_ns, aux_schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201,
                       "Correct status code for auxiliary schema insertion.");

            test.ok(data === '',
                    "No content returned for auxiliary schema insertion.");

            // Now make a modified version of the test auxiliary schema.
            var test_aux_schema_modified = clone(test_aux_schema);

            // Let's take the test aux schema, add a $ref to it using the
            // randomly generated name, and attempt to update with it. This
            // should fail.
            delete test_aux_schema_modified['enum'];
            test_aux_schema_modified['type'] = "object";
            test_aux_schema_modified['properties'] = {};
            test_aux_schema_modified['properties']['testprop'] = {};
            test_aux_schema_modified['properties']['testprop']['$ref'] = random_aux_name;

            // Get the reference list. and examine it.
            var schema_utils = require('schema_utils.js');
            var refs = schema_utils.extractRefNames(test_aux_schema_modified);

            test.ok(Array.isArray(refs), "Got an array of references to test.");

            test.equal(refs.length, 1, "Got the expected number of reference names.");

            test.equal(refs[0], random_aux_name,
                       "The extracted ref name matches the random name we generated.");

            // Now attempt an auxiliary schema update with the bad reference.
            tutils.update_aux_schema(test_ns, aux_schema_name,
                                     test_aux_schema_modified, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 422,
                       "Correct status code for auxiliary schema update " +
                       "with bad reference.");

            test.ok(data === '',
                    "No content returned for auxiliary schema update.");

            // Check to see that the auxiliary schema was NOT updated.
            tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Correct status code for auxiliary schema retrieval.");

            test.ok(data.length > 0,
                    "Content returned for auxiliary schema retrieval.");

            var retrieved = JSON.parse(data);
            var refs_retrieved = schema_utils.extractRefNames(retrieved);

            test.equal(_.indexOf(refs_retrieved, random_aux_name), -1,
                       "Schema update was not honored.");

            // Perform cleanup by removing the auxiliary schema we inserted
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                // ignored
            });

            callback(null);
        }],
        function(err, results) {
            test.done();
        }
    );
};

function invalid_credentials_helper(test, test_auth) {
    test.expect(11);

    var aux_schema_name = osdf_utils.random_string(8);

    var aux_schema_doc = { name: aux_schema_name,
                           schema: test_aux_schema };

    async.waterfall([
        function(callback) {
            // First we insert an auxiliary schema
            // Make sure we use the valid credentials here
            tutils.insert_aux_schema(test_ns, aux_schema_doc, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 201,
                       "Correct status for auxiliary schema insertion.");

            test.ok(data === '',
                    "No content returned on an auxiliary schema insertion.");

            var modified = clone(test_aux_schema);
            modified['enum'] = [ 'xray', 'yankee', 'zulu' ];

            // Now, try to update it (with the test/invalid credentials)
            tutils.update_aux_schema(test_ns, aux_schema_name, modified, test_auth,
                function(data, response) {
                    callback(null, data, response);
                }
            );
        }, function(data, response, callback) {
            test.equal(response.statusCode, 403,
                       "Auxiliary schema update had correct code.")

            test.equal(data.length, 0,
                    "No data returned on auxiliary schema update.");

            // Next, check that the modified schema did not get registered
            tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth,
                function(data, response) {
                    callback(null, data, response);
                }
            );
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Correct status for auxiliary schema retrieval.");

            test.ok(data.length > 0,
                    "Auxiliary schema retrieval returned data.");

            var registered;
            try {
                registered = JSON.parse(data);
            } catch (err) {
                callback(err);
            }

            test.equal(registered['enum'][0], "alpha",
                       "Attempted update with invalid creds was not honored.");

            // Finally, also check to see that the modified auxiliary schema
            // did NOT find its way into the namespace's master list of
            // auxiliary schemas.
            tutils.retrieve_all_aux_schemas(test_ns, auth, function(data, response) {
                callback(null, data, response);
            });
        }, function(data, response, callback) {
            test.equal(response.statusCode, 200,
                       "Correct status for the auxiliary schema listing.");

            test.ok(data.length > 0,
                    "Got data back for the auxiliary schema listing.");

            var aux_schemas;
            try {
                aux_schemas = JSON.parse(data);
            } catch (err) {
                callback(err);
            }

            test.ok(aux_schemas.hasOwnProperty(aux_schema_name),
                    "Auxiliary schema is present in the namespace's list.");

            test.equal(aux_schemas[aux_schema_name]['enum'][0], "alpha",
                       "Attempted update with invalid creds was not honored.");

            // Cleanup. Remove the schema that we inserted. Use valid credentials here.
            tutils.delete_aux_schema(test_ns, aux_schema_name, auth, function(data, response) {
                // ignored
            });

            callback(null);
        }],
        function() {
            test.done();
        }
    );
}
