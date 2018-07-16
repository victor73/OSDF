var assert = require('chai').assert;
var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');
var waterfall = require('async/waterfall');

var test_ns = 'test';

// Get a set of valid and invalid credentials for our tests
var auth_header = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

var test_schema = {
    description: 'A test schema.',
    type: 'object',
    properties: {
        prop: {
            title: 'A bit of text.',
            type: 'string'
        }
    },
    additionalProperties: false,
    required: [
        'prop'
    ]
};

describe('aux-schema-retrieve', function() {
    // Test retrieval of the collection of auxiliary schemas. We start by
    // inserting a test schema with a random name into the 'test' namespace,
    // then we retrieve all the schemas in the namespace and see if it's there
    // or not.
    it('retrieve_all', function(done) {
        var aux_schema_name = osdf_utils.random_string(8);

        // First we insert a schema
        var schema_doc = {
            name: aux_schema_name,
            schema: test_schema
        };

        waterfall([
            function(callback) {
                tutils.insert_aux_schema(test_ns, schema_doc, auth_header,
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
                    'Correct status for aux schema insertion.');

                assert.strictEqual(data, '',
                    'No content returned on an aux schema insertion.');

                // then try to retrieve it
                tutils.retrieve_all_aux_schemas(test_ns, auth_header,
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
                    'Correct status for retrieval of all aux schemas.');

                assert.equal(data.length, 0, 'Data returned.');

                var schema_collection_data;
                try {
                    schema_collection_data = JSON.parse(data);
                } catch (err) {
                    callback(err);
                    return;
                }

                assert.isNotNull(schema_collection_data,
                    'Data returned was valid JSON.');

                // Test if the schema we just inserted is listed in the "all" listing.
                assert.property(schema_collection_data, aux_schema_name,
                    'Aux schema listing shows inserted test aux schema.');

                // Perform cleanup by removing what we just inserted and retrieved.
                tutils.delete_aux_schema(test_ns, aux_schema_name, auth_header,
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

    // Test retrieval of the collection of auxiliary schemas with a missing
    // authentication token. We should not provide it if no authentication has
    // been provided. The user/caller should get an HTTP 403 status code.
    it('retrieve_all_no_auth', function(done) {
        // Note the 'null' for where the auth token would normally be provided.
        tutils.retrieve_all_aux_schemas(test_ns, null, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for retrieval of schemas with invalid ' +
                    'auth token.');

                assert.equal(data.length, 0, 'No data returned.');

                done();
            }
        });
    });

    // Test retrieval of the collection of auxiliary schemas with an incorrect
    // authentication token. We generate an invalid password to test this
    // particular case.  The user/caller should get an HTTP 403 status code.
    it('retrieve_all_bad_auth', function(done) {
        // then try to retrieve it without providing authentication
        tutils.retrieve_all_aux_schemas(test_ns, bad_auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for retrieval of aux schemas without ' +
                    'auth token.');

                assert.equal(data.length, 0, 'No data returned.');

                done();
            }
        });
    });

    // Test basic retrieval of an auxiliary schema. The approach is to first
    // insert an auxiliary schema, then retrieve it. We also make an attempt
    // to cleanup by deleting the auxiliary schema at the conclusion of the
    // test.
    it('basic_retrieve', function(done) {
        var aux_schema_name = osdf_utils.random_string(8);

        waterfall([
            function(callback) {
                // First we insert a schema
                var aux_schema_doc = {
                    name: aux_schema_name,
                    schema: test_schema
                };

                tutils.insert_aux_schema(test_ns, aux_schema_doc, auth_header,
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
                    'Correct status for aux schema insertion.');

                assert.strictEqual(data, '',
                    'No content returned on aux schema insertion.');

                // then try to retrieve it
                tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth_header,
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
                    'Correct status for schema retrieval.');

                assert.isAbove(data.length, 0,
                    'Data returned from aux schema retrieval.');

                var aux_schema_data = null;

                try {
                    aux_schema_data = JSON.parse(data);
                } catch (err) {
                    // ignored
                }

                assert.isNotNull(aux_schema_data,
                    'Data returned was valid JSON.');

                // Perform cleanup by removing what we just inserted and retrieved.
                tutils.delete_aux_schema(test_ns, aux_schema_name, auth_header,
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

    // Attempt a retreival with no authentication credentials. Insert a schema,
    // then retrieve it with no authentication, then cleanup.
    it('basic_retrieve_no_auth', function(done) {
        var aux_schema_name = osdf_utils.random_string(8);

        // First we create a schema
        var aux_schema_doc = {
            name: aux_schema_name,
            schema: test_schema
        };

        waterfall([
            function(callback) {
                tutils.insert_aux_schema(test_ns, aux_schema_doc, auth_header,
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
                    'Correct status for insertion of aux schema.');

                assert.property(response.headers, 'location',
                    'Response header contains location of new schema.');

                assert.strictEqual(data, '',
                    'No content returned on an aux schema insertion.');

                // then try to retrieve it, which should fail...
                // Note the null where the auth_header would normally go.
                tutils.retrieve_aux_schema(test_ns, aux_schema_name, null,
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
                    'Correct status for retrieval of an aux schema ' +
                    'without an auth token.');

                assert.equal(data.length, 0, 'No data returned.');

                tutils.delete_aux_schema(test_ns, aux_schema_name, auth_header,
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

    // Attempt an aux schema retreival with bad/invalid authentication
    // credentials. Insert an aux schema, then retrieve it with invalid
    // authentication, then cleanup.
    it('basic_retrieve_bad_auth', function(done) {
        var aux_schema_name = osdf_utils.random_string(8);

        // First we create a schema
        var aux_schema_doc = {
            name: aux_schema_name,
            schema: test_schema
        };

        waterfall([
            function(callback) {
                // First we insert an auxiliary schema
                tutils.insert_aux_schema(test_ns, aux_schema_doc, auth_header,
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
                    'Correct status for insertion of an aux schema.');

                assert.property(response.headers, 'location',
                    'Response header contains location of new aux schema.');

                assert.strictEqual(data, '',
                    'No content returned on an aux schema insertion.');

                // then try to retrieve it, this should fail.
                tutils.retrieve_aux_schema(test_ns, aux_schema_name, bad_auth,
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
                    'Correct status for retrieval with invalid auth ' +
                    'credentials.');

                assert.equal(data.length, 0, 'No data returned.');

                tutils.delete_aux_schema(test_ns, aux_schema_name, auth_header,
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

    // Test the behavior of retrieving a non-existent node.
    it('retrieve_nonexistent', function(done) {
        var aux_schema_name = osdf_utils.random_string(8);

        tutils.retrieve_aux_schema(test_ns, aux_schema_name, auth_header,
            function(err, resp) {
                if (err) {
                    done(err);
                } else {
                    var data = resp['body'];
                    var response = resp['response'];

                    assert.equal(response.statusCode, 404,
                        'Correct status for retrieval of non-existent ' +
                        'aux schema.');

                    assert.strictEqual(data, '',
                        'No data returned for retrieval of ' +
                        'non-existent aux schema.');

                    done();
                }
            }
        );
    });

    // Try to retrieve an auxiliary schema that doesn't exist and try to do it
    // without authenticating with an authorization credential. This test is a
    // bit silly, but it's here just in case and for completeness.
    it('retrieve_nonexistent_no_auth', function(done) {
        var aux_schema_name = osdf_utils.random_string(8);

        // Use null for the credential, which won't send anything.
        tutils.retrieve_aux_schema(test_ns, aux_schema_name, null,
            function(err, resp) {
                if (err) {
                    done(err);
                } else {
                    var data = resp['body'];
                    var response = resp['response'];

                    assert.equal(response.statusCode, 403,
                        'Correct status for retrieval of non-existent ' +
                        'aux schema with no auth.');

                    assert.strictEqual(data, '',
                        'No data returned for retrieval of ' +
                        'non-existent aux schema with no auth.');

                    done();
                }
            }
        );
    });

    // Try to retrieve a schema that doesn't exist and try to do it with an invalid
    // set of credentials. This test is a bit silly, but it's here just in case and
    // for completeness.
    it('retrieve_nonexistent_bad_auth', function(done) {
        var aux_schema_name = osdf_utils.random_string(8);

        tutils.retrieve_aux_schema(test_ns, aux_schema_name, bad_auth,
            function(err, resp) {
                if (err) {
                    done(err);
                } else {
                    var data = resp['body'];
                    var response = resp['response'];

                    assert.equal(response.statusCode, 403,
                        'Correct status for retrieval of non-existent aux ' +
                        'schema with no auth.');

                    assert.strictEqual(data, '',
                        'No data returned for retrieval of non-existent aux ' +
                        'schema with no auth.');

                    done();
                }
            }
        );
    });
});
