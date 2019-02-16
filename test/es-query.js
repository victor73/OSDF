var assert = require('chai').assert;
var each = require('async/each');
var osdf_utils = require('osdf_utils');
var retry = require('async/retry');
var series = require('async/series');
var tutils = require('./lib/test_utils.js');
var waterfall = require('async/waterfall');

// Get a set of valid and invalid credentials for our tests
var test_ns = 'test';
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

describe('es-query', function() {
    it('test_empty_query', function(done) {
        var es_query = {};

        tutils.query(es_query, test_ns, auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status code for invalid elasticsearch query.');

                assert.equal(data.length, 0,
                    'No data provided in the response.');

                done();
            }
        });
    });

    // Here we test the functionality of a basic query by inserting a node with
    // a type of "example", and then querying it back out.
    it('test_basic_query', function(done) {
        var test_doc = {
            'ns': 'test',
            'node_type': 'example',
            'acl': { 'read': ['all'], 'write': ['all'] },
            'linkage': {},
            'meta': {
                'color': 'red'
            }
        };

        var es_query = {
            'query':{
                'filtered':{'filter':[{'term':{'node_type':'example'}}]}
            }
        };

        waterfall([
            function(callback) {
                insert_nodes([test_doc], function(err, node_ids) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null);
                    }
                });
            },
            function(callback) {
                retry({ times: 10, interval: 3000 }, function(retry_cb) {
                    tutils.query(es_query, test_ns, auth, function(err, resp) {
                        if (err) {
                            retry_cb(err, null);
                        } else {
                            var data = resp['body'];
                            var result = JSON.parse(data);

                            if (result.hasOwnProperty('result_count') &&
                                result['result_count'] > 0) {
                                retry_cb(null, resp);
                            } else {
                                retry_cb("Search still has no 'example' node available.", null);
                            }
                        }
                    });
                }, function(err, resp) {
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
                    'Correct status for elasticsearch query response.');

                assert.notStrictEqual(data, '',
                    'Content returned on basic elasticsearch query.');

                var result = null;

                try {
                    result = JSON.parse(data);
                } catch(err) {
                    // ignored
                }

                assert.isNotNull(result, 'Data returned is valid JSON.');
                assert.property(result, 'results',
                    'Result has "results" key.');
                assert.property(result, 'result_count',
                    'Result has "result_count" key.');
                assert.property(result, 'page',
                    'Result has "page" key.');

                assert.isAbove(result['result_count'], 0,
                    'Positive number of results.');
                assert.isAbove(result['page'], 0,
                    'Positive number of pages.');

                callback(null);
            }
        ],
        function(err, results) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    });

    // Test the behavior of whether the system can decide if a user can write
    // (update/delete) a node given that node's ACL settings.
    it('test_invalid_query', function(done) {
        var es_query = 'adioasdkjf';

        tutils.query(es_query, test_ns, auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status code for invalid elasticsearch query.');

                assert.equal(data.length, 0,
                    'No data provided in the response.');

                done();
            }
        });
    });

    it('test_empty_string_query', function(done) {
        var es_query = '';

        tutils.query(es_query, test_ns, auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status code for invalid elasticsearch query.');

                assert.equal(data.length, 0,
                    'No data provided in the response.');

                done();
            }
        });
    });

    it('test_null_query', function(done) {
        var es_query = null;

        tutils.query(es_query, test_ns, auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status code for invalid elasticsearch query.');

                assert.equal(data.length, 0,
                    'No data provided in the response.');

                done();
            }
        });
    });

    it('test_bogus_json_array', function(done) {
        var es_query = [ 'moe', 'curly', 'larry' ];

        tutils.query(es_query, test_ns, auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status code for invalid elasticsearch query.');

                assert.equal(data.length, 0,
                    'No data provided in the response.');

                done();
            }
        });
    });

    it('test_bogus_json_object', function(done) {
        var es_query = {
            'moe': "What's the big idea?!",
            'curly': 'Nyuk nyuk nyuk!',
            'larry': 'Ooo, wise guy eh?'
        };

        tutils.query(es_query, test_ns, auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 422,
                    'Correct status code for invalid elasticsearch query.');

                assert.equal(data.length, 0,
                    'No data provided in the response.');

                done();
            }
        });
    });

    it('test_paginated_query_results', function(done) {
        waterfall([function(callback) {
            // First, ensure we're starting with a blank slate. Delete any test
            // documents...
            wipe_test_docs(function(err) {
                if (err) {
                    console.log('Error wiping test documents.');
                }
                done(err);
            });
        },
        function(callback) {
            // Now, create 3100 new documents...
            var test_docs = [];

            for (var idx = 1; idx <= 3100; idx++) {
                var test_doc = {
                    'ns': 'test',
                    'node_type': 'random_string',
                    'acl': { 'read': ['all'], 'write': ['all'] },
                    'linkage': {},
                    'meta': {},
                };

                test_doc['meta']['random_string'] = osdf_utils.random_string(8);

                test_docs.push(test_doc);
            }

            callback(null, test_docs);
        },
        function(test_docs, callback) {
            // validate all the test docs
            validate_nodes(test_docs, function(err) {
                callback(err, test_docs);
            });
        },
        function(test_docs, callback) {
            // Nodes are valid, insert them...
            insert_nodes(test_docs, function(err, node_ids) {
                callback(err, node_ids);
            });
        },
        function(node_ids, callback) {
            // Okay, now we should be able to test
            var es_query = {'query':{'filtered':{'filter':[
                {'term':{'node_type':'random_string'}}
            ]}}};

            tutils.query(es_query, test_ns, auth, function(err, resp) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, node_ids, resp);
                }
            });
        },
        function(node_ids, resp, callback) {
            var data = resp['body'];
            var response = resp['response'];

            assert.isAbove(data.length, 0, 'Query returned data.');

            var result = null;
            try {
                result = JSON.parse(data);
            } catch (err) {
                // ignored
            }

            assert.isNotNull(result, 'Data returned is valid JSON.');

            assert.equal(response.statusCode, 206,
                'Correct status code of 206 for partial results returned.');

            assert.hasAllKeys(result, ['results', 'search_result_total', 'result_count'],
                'Result has the necessary keys.');

            assert.isAbove(result['search_result_total'], result['result_count'],
                'Returned results are less than total available results.');

            assert.property(response.headers, 'x-osdf-query-resultset',
                'Contains the header to point to the next result set.');

            // Delete them all again...
            delete_nodes(node_ids, function(err) {
                if (err) {
                    console.log('Problem deleting nodes.');
                }
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

    it('test_query_all_pages', function(done) {
        var es_query = {
            'query':{
                'filtered':{'filter':[
                    {'term':{'node_type':'random_string'}}
                ]}
            }
        };

        waterfall([function(callback) {
            // First, ensure we're starting with a blank slate. Delete any test
            // documents...
            wipe_test_docs(function(err) {
                if (err) {
                    console.log('Error wiping test documents.');
                }
                callback(err);
            });
        },
        function(callback) {
            // Now, create 3100 documents...
            var test_docs = [];

            for (var idx = 1; idx <= 3100; idx++) {
                var test_doc = {
                    'ns': 'test',
                    'node_type': 'random_string',
                    'acl': { 'read': ['all'], 'write': ['all'] },
                    'linkage': {},
                    'meta': {},
                };

                test_doc['meta']['random_string'] = osdf_utils.random_string(8);

                test_docs.push(test_doc);
            }

            callback(null, test_docs);
        },
        function(test_docs, callback) {
            // validate all the test docs
            validate_nodes(test_docs, function(err) {
                callback(err, test_docs);
            });
        },
        function(test_docs, callback) {
            // Nodes are valid, insert them...
            insert_nodes(test_docs, function(err, node_ids) {
                callback(err, node_ids);
            });
        },
        function(node_ids, callback) {
            retry({times: 10, interval: 3000}, function(cb, results) {
                tutils.query(es_query, test_ns, auth, function(err, resp) {
                    if (err) {
                        cb(err);
                    } else {
                        var body = resp['body'];
                        var initial_result = JSON.parse(body);
                        var total = initial_result['search_result_total'];

                        if (node_ids.length === total) {
                            // Okay, everything has been inserted and the ES data
                            // has gotten all the data an indexed it...
                            cb(null, {total: total});
                        } else {
                            console.log("Counts don't match yet... Pausing a bit.");
                            cb("Counts don't yet match...", null);
                        }
                    }
                });
            },
            function(err, results) {
                if (err) {
                    callback(err);
                } else {
                    var total = results['total'];
                    assert.equal(node_ids.length, total,
                        'Query result total equals number of nodes inserted.');

                    callback(null, node_ids, total);
                }
            });
        },
        function(node_ids, total, callback) {
            tutils.query_all(es_query, test_ns, auth, function(err, resp) {
                if (err) {
                    callback(err);
                } else {
                    var body = resp['body'];

                    assert.isDefined(body, 'Result body is defined.');
                    assert.isAbove(body.length, 0, 'Query all returned data.');

                    var result = null;

                    try {
                        result = JSON.parse(body);
                    } catch (err) {
                        // ignored
                    }

                    assert.isNotNull(result, 'Data returned is valid JSON.');

                    assert.equal(result['results'].length, total,
                        'Same count when traversing result pagination.');

                    callback(null);
                }
            });
        }],
        function(error) {
            // Delete all test nodes again to leave a pristine server...
            wipe_test_docs(function(err) {
                if (err) {
                    console.log('Problem deleting test nodes.');
                }

                if (error) {
                    done(error);
                } else {
                    done();
                }
            });
        });
    });
});

function delete_nodes(node_ids, callback) {
    each(node_ids,
        function(id, cb) {
            tutils.delete_node(id, auth, function(err, resp) {
                if (err) {
                    cb(err);
                } else {
                    var data = resp['body'];
                    var response = resp['response'];

                    if (response.statusCode === 204) {
                        cb();
                    } else {
                        cb('Unable to delete test node!');
                    }
                }
            });
        },
        function(err) {
            if (err) {
                callback('One or more nodes were not deleted.');
            } else {
                callback();
            }
        }
    );
}

function insert_nodes(test_docs, callback) {
    var node_ids = [];

    each(test_docs,
        function(test_doc, cb) {
            tutils.insert_node(test_doc, auth, function(err, resp) {
                if (err) {
                    cb(err);
                } else {
                    var data = resp['body'];
                    var response = resp['response'];

                    if (response.statusCode === 201) {
                        var id = tutils.get_node_id(response);
                        node_ids.push(id);
                        cb();
                    } else {
                        cb('Unable to insert test node!');
                    }
                }
            });
        },
        function(err) {
            if (err) {
                callback('One or more nodes were not able to be inserted.', node_ids);
            } else {
                callback(null, node_ids);
            }
        }
    );
}

function validate_nodes(test_docs, callback) {
    each(test_docs,
        function(test_doc, cb) {
            tutils.validate_node(test_doc, auth, function(err, resp) {
                var data = resp['body'];
                var response = resp['response'];

                if (response.statusCode === 200) {
                    cb();
                } else {
                    cb('Node did not validate!');
                }
            });
        },
        function(err) {
            if (err) {
                callback('One or more nodes did not validate.');
            } else {
                callback();
            }
        }
    );
}

function wipe_test_docs(callback) {
    var es_query = {
        'query': {
            'filtered':{'filter':[
                {'term':{'node_type':'random_string'}}
            ]}
        }
    };

    tutils.query_all(es_query, test_ns, auth, function(err, resp) {
        if (err) {
            callback(err);
        } else {
            var data = resp['body'];

            var result = JSON.parse(data);

            var ids = [];

            for (var idx = 0; idx < result['results'].length; idx++) {
                ids.push(result['results'][idx]['id']);
            }

            delete_nodes(ids, function(err) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }
    });
}
