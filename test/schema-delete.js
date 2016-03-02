#!/usr/bin/node

/*jshint sub:true*/

var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');
var async = require('async');

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

// Test basic retrieval of a schema. The approach is to first insert a schema, then
// retrieve it to check that it's htere, then delete it, then attempt to retrieve it
// again and verify that it's gone.
exports['delete_schema'] = function(test) {
    test.expect(9);

    var schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert a schema
            var schema_doc = { name: schema_name,
                               schema: test_schema };

            tutils.insert_schema(test_ns, schema_doc, auth_header,
                function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                }
            );
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 201,
                       "Correct status for insertion.");
            test.equal(data.length, 0,
                       "No content returned on a schema insertion.");

            // then try to retrieve it
            tutils.retrieve_schema(test_ns, schema_name, auth_header,
                function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                }
            );
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 200,
                       "Correct status for schema retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var schema_data;
            try {
                schema_data = JSON.parse(data);
            } catch (err) {
                // ignored
            }
            test.ok(typeof schema_data !== "undefined" && schema_data !== null,
                    "Data returned was valid JSON.");

            // Perform cleanup by removing what we just inserted and retrieved.
            tutils.delete_schema(test_ns, schema_name, auth_header, function(err, resp) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, resp);
                }
            });
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 204,
                       "Schema deletion yielded correct status code.");

            test.equal(data.length, 0, "No data returned on deletion.");

            // Now try to retrieve the schema again. It should not be
            // available any longer...
            tutils.retrieve_schema(test_ns, schema_name, auth_header, function(err, resp) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, resp);
                }
            });
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 404,
                       "Schema retrieval yielded 404.");

            test.equal(data.length, 0,
                      "No data returned on retrieval of deleted schema.");

            callback(null);
        }],
        function(err, results) {
            if (err) {
                console.log(err);
            }
            test.done();
        }
    );
};

// Attempt a retreival with no authentication credentials.
// Insert a schema, then retrieve, then delete it with no authentication,
// then cleanup.
exports['delete_schema_no_auth'] = function(test) {
    test.expect(7);

    var schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert a schema
            var schema_doc = { name: schema_name,
                               schema: test_schema };

            tutils.insert_schema(test_ns, schema_doc, auth_header,
                function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                }
            );
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 201,
                       "Correct status for insertion.");
            test.ok(data === '', "No content returned on a schema insertion.");

            // then try to retrieve it
            tutils.retrieve_schema(test_ns, schema_name, auth_header,
                function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                }
            );
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 200,
                       "Correct status for schema retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var schema_data;
            try {
                schema_data = JSON.parse(data);
            } catch (err) {
                // ignored
            }
            test.ok(typeof schema_data !== "undefined" && schema_data !== null,
                    "Data returned was valid JSON.");

            // Attempt to delete without providing credentials
            tutils.delete_schema(test_ns, schema_name, null, function(err, resp) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, resp);
                }
            });
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 403,
                       "Schema deletion without credentials yielded " +
                       "correct status code.");

            test.equal(data.length, 0, "No data returned on deletion.");

            // Perform cleanup
            tutils.delete_schema(test_ns, schema_name, auth_header,
                function(err) {
                    if (err) {
                        console.log("Problem deleting the test schema during " +
                                    "cleanup.", err);
                    }
                }
            );

            callback(null);
        }],
        function(err, results) {
            if (err) {
                console.log(err);
            }
            test.done();
        }
    );
};

// Attempt a retreival with bad/invalid authentication credentials provided.
// Insert a node, then retrieve it with invalid authentication, then cleanup.
exports['delete_schema_bad_auth'] = function(test) {
    test.expect(7);

    var schema_name = osdf_utils.random_string(8);

    async.waterfall([
        function(callback) {
            // First we insert a schema
            var schema_doc = { name: schema_name,
                               schema: test_schema };

            tutils.insert_schema(test_ns, schema_doc, auth_header,
                function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                }
            );
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 201,
                       "Correct status for insertion.");
            test.ok(data === '', "No content returned on a schema insertion.");

            // then try to retrieve it
            tutils.retrieve_schema(test_ns, schema_name, auth_header,
                function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                }
            );
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 200,
                       "Correct status for schema retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var schema_data;
            try {
                schema_data = JSON.parse(data);
            } catch (err) {
                // ignored
            }
            test.ok(typeof schema_data !== "undefined" && schema_data !== null,
                    "Data returned was valid JSON.");

            // Attempt to delete the inserted schema with invalid credentials.
            tutils.delete_schema(test_ns, schema_name, bad_auth,
                function(err, resp) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, resp);
                    }
                }
            );
        },
        function(resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 403,
                       "Schema deletion without credentials yielded correct " +
                       "status code.");

            test.equal(data.length, 0, "No data returned on deletion.");

            // Perform cleanup
            tutils.delete_schema(test_ns, schema_name, auth_header,
                function(err) {
                    if (err) {
                        console.log("Problem deleting the test schema during " +
                                    "cleanup.", err);
                    }
                }
            );

            callback(null);
        }],
        function(err, results) {
            if (err) {
                console.log(err);
            }
            test.done();
        }
    );
};
