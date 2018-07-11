var assert = require('chai').assert;
var osdf_utils = require('osdf_utils');
var waterfall = require('async/waterfall');
var tutils = require('./lib/test_utils.js');
var schema_utils = require('schema_utils');

var test_ns = 'test';

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

//    description: "A test schema.",
var test_schema = {
    type: 'object',
    properties: {
        prop: {
            title: 'A bit of text.',
            type: 'string'
        }
    },
    additionalProperties: false,
    required: [ 'prop' ]
};

describe('schema-insert', function() {
    // Test basic insertion of a schema. The approach is to attempt the insertion,
    // then retrieve it to check that it's there, then clean up by deleting it.
    it('insert_schema', function(done) {
        var schema_name = osdf_utils.random_string(8);

        waterfall([
            function(callback) {
                // First we insert a schema
                var schema_doc = {
                    name: schema_name,
                    schema: test_schema
                };

                tutils.insert_schema(test_ns, schema_doc, auth,
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

                assert.equal(response.statusCode, 201,
                    'Correct status for insertion.');

                assert.strictEqual(data, '',
                    'No content returned on a schema insertion.');

                // then try to retrieve it
                tutils.retrieve_schema(test_ns, schema_name, auth,
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

                assert.equal(response.statusCode, 200,
                    'Schema retrieval yielded correct status code.');

                assert.isAbove(data.length, 0, 'Data returned on deletion.');

                // Cleanup. Remove the schema that we inserted.
                tutils.delete_schema(test_ns, schema_name, auth, function(err) {
                    // ignored
                });

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // Test that the service does not allow invalid data or invalid JSON from
    // being registered as a schema.
    it('insert_schema_with_malformed_json', function(done) {
        var schema_name = osdf_utils.random_string(8);

        waterfall([
            function(callback) {
                // First we insert a schema
                var schema_doc = {
                    name: schema_name,
                    /*eslint no-useless-escape: 0*/
                    schema: '\\\\\/////'
                };

                tutils.insert_schema(test_ns, schema_doc, auth,
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

                assert.equal(response.statusCode, 422,
                    'Correct status for insertion.');

                assert.ok(data, '',
                    'No content returned on a schema insertion.');

                // then try to retrieve it
                tutils.retrieve_schema(test_ns, schema_name, auth,
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

                assert.equal(response.statusCode, 404,
                    'Schema retrieval yielded correct status code.');

                assert.ok(data.length, 0, 'No data returned on retrieval.');

                // If for whatever reason, the schema actually made it into the
                // server we try to remove it so that the test doesn't leave
                // a residue behind.
                if (response.statusCode !== 404) {
                    // Cleanup. Remove the schema that we inserted.
                    tutils.delete_schema(test_ns, schema_name, auth,
                        function(err, resp) {
                            // ignored
                        }
                    );
                }

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // Test insertion of a schema into the server where one with the same name
    // already exists. The server should not allow an overwrite of this nature.
    // The user must either delete the schema, or update/edit it.
    it('insert_conflicting_schema', function(done) {
        var schema_name = osdf_utils.random_string(8);

        var schema_doc = {
            name: schema_name,
            schema: test_schema
        };

        waterfall([
            function(callback) {
                // First we insert a schema
                tutils.insert_schema(test_ns, schema_doc, auth,
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

                assert.equal(response.statusCode, 201,
                    'Correct status for insertion.');

                // Now, try inserting the same thing again...
                tutils.insert_schema(test_ns, schema_doc, auth,
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

                assert.notEqual(response.statusCode, 201,
                    'Insertion of a schema with an existing name did ' +
                    'not succeed.');

                assert.ok(data.length, 0,
                    'No data returned on subsequent insertion.');

                // Cleanup by removing the schema that we inserted.
                tutils.delete_schema(test_ns, schema_name, auth,
                    function(err, resp) {
                        // ignored
                    }
                );

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // Test insertion of a schema when no authentication credentials are provided.
    // We should not be able to insert a schema this way.
    it('insert_schema_no_auth', function(done) {
        // Use a helper function since the insert_schema_no_auth()
        // and insert_schema_bad_auth() tests are so similar.
        invalid_credentials_helper(done, null);
    });

    // Test insertion of a schema when invalid authentication credentials are
    // provided. We should not be able to insert a schema this way.
    it('insert_schema_bad_auth', function(done) {
        // Use a helper function since the insert_schema_no_auth()
        // and insert_schema_bad_auth() tests are so similar.
        invalid_credentials_helper(done, bad_auth);
    });

    // Test that the service does not allow a schema to be inserted
    // that makes reference to an auxiliary schema that it does not
    // know about.
    it('insert_schema_with_unknown_auxiliary', function(done) {
        var schema_name = osdf_utils.random_string(8);

        waterfall([
            function(callback) {
                // Let's take the test schema, add a $ref to it using a
                // randomly generated name, and attempt to insert it. This
                // should fail.
                var random_aux_name = osdf_utils.random_string(8);
                var test_schema_modified = test_schema;

                test_schema_modified['properties']['$ref'] = random_aux_name;

                var schema_doc = {
                    name: schema_name,
                    schema: test_schema_modified
                };

                var schema_utils = require('schema_utils.js');
                var refs = schema_utils.extractRefNames(test_schema_modified);

                assert.ok(Array.isArray(refs),
                    'Got an array of references to test.');

                assert.equal(refs.length, 1,
                    'Got the expected number of reference names.');

                assert.equal(refs[0], random_aux_name,
                    'The extracted ref name matches the random name ' +
                    'we generated.');

                // Attempt to insert the schema.
                tutils.insert_schema(test_ns, schema_doc, auth, function(err, resp) {
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

                assert.equal(response.statusCode, 422,
                    'Correct status code for insertion with an unknown ' +
                    'auxiliary.');

                assert.equal(data.length, 0,
                    'No content returned for schema insertion with an ' +
                    'unknown auxiliary.');

                // Now retrieve it and make sure it wasn't registered on the server.
                tutils.retrieve_schema(test_ns, schema_name, auth,
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

                assert.equal(response.statusCode, 404,
                    'Correct status code for failed insertion.');

                assert.equal(data.length, 0,
                    'No content returned for schema retrieval.');

                callback(null);
            }],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });
});

function invalid_credentials_helper(done, test_auth) {
    var schema_name = osdf_utils.random_string(8);

    waterfall([
        function(callback) {
            // First we insert a schema
            var schema_doc = {
                name: schema_name,
                schema: test_schema
            };

            // Attempt the insertion with invalid credentials...
            tutils.insert_schema(test_ns, schema_doc, test_auth,
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

            assert.equal(response.statusCode, 403,
                'Correct status for insertion without credentials.');

            assert.equal(data.length, 0,
                'No content returned on a schema insertion with ' +
                'no credentials.');

            // then try to retrieve it.
            tutils.retrieve_schema(test_ns, schema_name, auth,
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

            assert.equal(response.statusCode, 404,
                'Schema retrieval of failed insertion yielded correct ' +
                'code.');

            assert.equal(data.length, 0, 'No data returned on retrieval.');

            // Cleanup. Remove the schema that we inserted.
            tutils.delete_schema(test_ns, schema_name, auth,
                function(err, resp) {
                    // ignored
                }

            );

            callback(null);
        }],
    function(err, results) {
        if (err) {
            done(err);
        } else {
            done();
        }
    });
}
