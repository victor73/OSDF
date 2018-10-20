var _ = require('lodash');
var assert = require('chai').assert;
var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils');
var waterfall = require('async/waterfall');

var logger = tutils.get_null_logger();

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

describe('namespace-retrieve', function() {
    // Test that the system supports the retrieval of all the namespaces the
    // OSDF instance knows about. We also examine the data that is retrieved in
    // some detail to help ensure the format is correct.
    it('retrieve_all_namespaces', function(done) {
        logger.debug('In retrieve_all_namespaces');

        waterfall([
            function(callback) {
                tutils.retrieve_all_namespaces(auth, function(err, resp) {
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

                assert.equal(response.statusCode, 200,
                    'Correct status from request for all namespaces.');

                assert.notEqual(
                    response.headers['content-type'].indexOf('application/json'),
                    -1,
                    'Correct content type for namespaces request.'
                );

                var namespaces_json = null;
                try {
                    namespaces_json = JSON.parse(data);
                } catch (err) {
                    callback(err, null);
                }

                assert.isNotNull(namespaces_json,
                    'Content returned is valid JSON.');

                callback(null, namespaces_json);
            },
            function(namespaces_json, callback) {
                assert.isOk(namespaces_json.hasOwnProperty('page'),
                    "Data contained 'page' key.");
                assert.isNumber(namespaces_json.page,
                    "Type of 'page' key is correct.");
                assert.isOk(namespaces_json.hasOwnProperty('result_count'),
                    "Data contained 'result_count' key.");
                assert.isNumber(namespaces_json.result_count,
                    "Type of 'result_count' key is correct.");
                assert.isOk(namespaces_json.hasOwnProperty('results'),
                    "Data contained 'results' key.");
                assert.isArray(namespaces_json.results,
                    "Type of 'results' key is correct.");

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

    // Test the behavior we get when we attempt to list the namespaces with an
    // missing authentication token.
    it('retrieve_all_namespaces_no_auth', function(done) {
        logger.debug('In retrieve_all_namespaces_no_auth');

        tutils.retrieve_all_namespaces(null, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for namespace listing without auth token.');
                assert.strictEqual(data, '',
                    'No content returned for namespace listing without ' +
                    'auth token.');

                done();
            }
        });
    });

    // Test the behavior we get when we attempt to list the namespaces with an
    // invalid/incorrect authentication token.
    it('retrieve_all_namespaces_bad_auth', function(done) {
        logger.debug('In retrieve_all_namespaces_bad_auth');

        tutils.retrieve_all_namespaces(bad_auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for namespace listing without auth token.');
                assert.strictEqual(data, '',
                    'No content returned for namespace listing without ' +
                    'auth token.');

                done();
            }
        });
    });

    // Test the behavior of the system for when a user requests a valid
    // namespace. The approach here is to retrieve all the namespaces, pick one
    // of them, and then make that request to test the behavior. Of course, for
    // this test to work we assume that the retrieval of "all" namespaces works
    // properly. If it doesn't, then this test will probably fail too.
    it('retrieve_valid_namespace', function(done) {
        waterfall([
            function(callback) {
                tutils.retrieve_all_namespaces(auth, function(err, resp) {
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

                var all_namespaces = JSON.parse(data);
                var results = all_namespaces.results;

                var random_ns_struct = results[
                    Math.floor(Math.random() * results.length)
                ];
                var ns_names = _.keys(random_ns_struct);

                // So we have our namespace names now after we have extracted the
                // keys.  There should actually be only 1, so use the first element
                if (ns_names.length != 1) {
                    callback('Invalid number of namespace names.', null);
                }

                // Just look at the first one
                var retrieved_ns_name = ns_names[0];

                tutils.retrieve_namespace(retrieved_ns_name, auth,
                    function(err, resp) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, retrieved_ns_name, resp);
                        }
                    }
                );
            },
            function(retrieved_ns_name, resp, callback) {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 200,
                    'Correct status for valid namespace retrieval.');

                assert.isOk(
                    response.headers['content-type'].indexOf('application/json') != -1,
                    'Correct content type for namespace retrieval.'
                );

                assert.isNotNull(data,
                    'Namespace retrieval yielded non-null data.');

                assert.isAbove(data.length, 0,
                    'Namespace data from retrieval not the empty string.');

                var ns = JSON.parse(data);
                assert.equal(_.keys(ns).length, 1,
                    'Number of namespace objects returned is 1.');

                assert.hasAllKeys(ns[retrieved_ns_name],
                    ['title', 'description', 'acl', 'url'],
                    'Namespace has required keys.'
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

    // Test the behavior of the system for when a user requests a valid
    // namespace, but does so without providing an authorization token as
    // specified by the API. The approach here is the same as for
    // 'retrieve_valid_namespace' but we should get an HTTP 403 (Forbidden)
    // response code.
    it('retrieve_valid_namespace_no_auth', function(done) {
        waterfall([
            function(callback) {
                // Get the list of namespaces, and then choose one at random.
                tutils.retrieve_all_namespaces(auth, function(err, resp) {
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

                var all_namespaces = JSON.parse(data);
                var results = all_namespaces.results;

                var random_ns_struct = results[
                    Math.floor(Math.random() * results.length)
                ];
                var ns_names = _.keys(random_ns_struct);

                // So we have our namespace names now after we have extracted
                // the keys. There should actually be only 1, so use the first
                // element
                if (ns_names.length !== 1) {
                    throw 'Invalid number of namespace names.';
                }
                var retrieved_ns_name = ns_names[0];

                tutils.retrieve_namespace(retrieved_ns_name, null,
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
                    'Correct status for namespace retrieval with no auth.');

                assert.strictEqual(data, '', 'No data returned.');

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

    // Test the behavior of the system for when a user requests a valid
    // namespace, but does so by providing an authorization token that is
    // incorrect or invalid. The approach here is the same as for
    // 'retrieve_valid_namespace' but we should get an HTTP 403 (Forbidden)
    // response code.
    it('retrieve_valid_namespace_bad_auth', function(done) {
        waterfall([
            function(callback) {
                // Get the list of namespaces, and then choose one at random.
                tutils.retrieve_all_namespaces(auth, function(err, resp) {
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

                var all_namespaces = JSON.parse(data);
                var results = all_namespaces.results;

                var random_ns_struct = results[
                    Math.floor(Math.random() * results.length)
                ];
                var ns_names = _.keys(random_ns_struct);

                // So we have our namespace names now after we have extracted the
                // keys. There should actually be only 1, so use the first element
                if (ns_names.length !== 1) {
                    callback('Invalid number of namespace names.', null);
                }
                var retrieved_ns_name = ns_names[0];

                tutils.retrieve_namespace(retrieved_ns_name, bad_auth,
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
                    'Correct status for namespace retrieval with no auth.');

                assert.strictEqual(data, '', 'No data returned.');

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

    // Test the behavior of the system for when a user requests an non-existent
    // namespace.  The approach here is to generate a random namespace to use
    // for the request.
    it('retrieve_invalid_namespace', function(done) {
        // Generate a random string for our 'invalid' namespace that we're going
        // to request.
        var invalid_namespace = osdf_utils.random_string(8);

        tutils.retrieve_namespace(invalid_namespace, auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 404,
                    'Correct status for invalid namespace retrieval.');

                assert.strictEqual(data, '',
                    'No data returned for an invalid namespace retrieval.');

                done();
            }
        });
    });
});
