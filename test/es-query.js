#!/usr/bin/env nodeunit

var async = require('async');
var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');

// Get a set of valid and invalid credentials for our tests
var test_ns = 'test';
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

exports['test_empty_query'] = function(test) {
    test.expect(2);

    var es_query = {};

    tutils.query(es_query, test_ns, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                'Correct status code for invalid elasticsearch query.');

            test.ok(data.length === 0, 'No data provided in the response.');
        }

        test.done();
    });
};

exports['test_basic_query'] = function(test) {
    test.expect(8);

    var es_query = {
        'query':{
            'filtered':{'filter':[{'term':{'node_type':'example'}}]}
        }
    };

    tutils.query(es_query, test_ns, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 200,
                'Correct status for elasticsearch query response.');

            test.ok(data !== '',
                'Content returned on basic elasticsearch query.');

            var result;

            test.doesNotThrow( function() {
                result = JSON.parse(data);
            }, Error, 'Data returned is valid JSON.');

            test.ok(result !== null && result.hasOwnProperty('results'),
                'Result has "results" key.');
            test.ok(result !== null && result.hasOwnProperty('result_count'),
                'Result has "result_count" key.');
            test.ok(result !== null && result.hasOwnProperty('page'),
                'Result has "page" key.');

            test.ok(result !== null && result.hasOwnProperty('result_count') &&
                   (result['result_count'] > 0), 'Positive number of results.');
            test.ok(result !== null && result.hasOwnProperty('page') &&
                   (result['page'] > 0), 'Positive number of pages.');
        }

        test.done();
    });
};


// Test the behavior of whether the system can decide if a user can write
// (update/delete) a node given that node's ACL settings.
exports['test_invalid_query'] = function (test) {
    test.expect(2);

    var es_query = 'adioasdkjf';

    tutils.query(es_query, test_ns, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                'Correct status code for invalid elasticsearch query.');

            test.ok(data.length === 0, 'No data provided in the response.');
        }

        test.done();
    });
};

exports['test_empty_string_query'] = function (test) {
    test.expect(2);

    var es_query = '';

    tutils.query(es_query, test_ns, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                'Correct status code for invalid elasticsearch query.');

            test.ok(data.length === 0, 'No data provided in the response.');
        }

        test.done();
    });
};

exports['test_null_query'] = function(test) {
    test.expect(2);

    var es_query = null;

    tutils.query(es_query, test_ns, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                'Correct status code for invalid elasticsearch query.');

            test.ok(data.length === 0, 'No data provided in the response.');
        }

        test.done();
    });
};

exports['test_bogus_json_array'] = function(test) {
    test.expect(2);

    var es_query = [ 'moe', 'curly', 'larry' ];

    tutils.query(es_query, test_ns, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                'Correct status code for invalid elasticsearch query.');

            test.ok(data.length === 0, 'No data provided in the response.');
        }

        test.done();
    });
};

exports['test_bogus_json_object'] = function(test) {
    test.expect(2);

    var es_query = {
        'moe': "What's the big idea?!",
        'curly': 'Nyuk nyuk nyuk!',
        'larry': 'Ooo, wise guy eh?'
    };

    tutils.query(es_query, test_ns, auth, function(err, resp) {
        if (err) {
            console.log(err);
        } else {
            var data = resp['body'];
            var response = resp['response'];

            test.equal(response.statusCode, 422,
                'Correct status code for invalid elasticsearch query.');

            test.ok(data.length === 0, 'No data provided in the response.');
        }

        test.done();
    });
};

exports['test_paginated_query_results'] = function(test) {
    test.expect(5);

    async.waterfall([function(callback) {
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

        test.ok(data.length > 0, 'Query returned data.');

        var result;
        test.doesNotThrow( function() {
            result = JSON.parse(data);
        }, Error, 'Data returned is valid JSON.');

        test.ok(response.statusCode === 206,
            'Correct status code of 206 for partial results returned.');

        test.ok(result.hasOwnProperty('results') &&
                result.hasOwnProperty('search_result_total') &&
                result.hasOwnProperty('result_count') &&
                result['search_result_total'] > result['result_count'],
            'Returned results are less than total available results.'),

        test.ok(response.headers.hasOwnProperty('x-osdf-query-resultset'),
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
            console.log(err);
        }

        test.done();
    });
};

exports['test_query_all_pages'] = function (test) {
    test.expect(4);

    var es_query = {
        'query':{
            'filtered':{'filter':[
                {'term':{'node_type':'random_string'}}
            ]}
        }
    };

    async.waterfall([function(callback) {
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
        validate_nodes(test_docs, function (err) {
            callback(err, test_docs);
        });
    },
    function(test_docs, callback) {
        // Nodes are valid, insert them...
        insert_nodes(test_docs, function (err, node_ids) {
            callback(err, node_ids);
        });
    },
    function(node_ids, callback) {
        async.retry({ times: 10, interval: 3000 }, function (cb, results) {
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
                        cb(null, { total: total });
                    } else {
                        console.log("Counts don't match yet... Pausing a bit.");
                        cb("Counts don't yet match...", null);
                    }
                }
            });
        },
        function (err, results) {
            if (err) {
                callback(err);
            } else {
                var total = results['total'];
                test.equal(node_ids.length, total,
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
                test.ok(body !== undefined && body.length > 0,
                    'Query all returned data.');

                var result;

                test.doesNotThrow( function() {
                    result = JSON.parse(body);
                }, Error, 'Data returned is valid JSON.');

                test.equal(result['results'].length, total,
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
                console.log('Failure');
            }

            test.done();
        });
    });
};

function delete_nodes(node_ids, callback) {
    async.each(node_ids,
        function(id, cb) {
            tutils.delete_node(id, auth, function(err, resp) {
                var data = resp['body'];
                var response = resp['response'];

                if (response.statusCode === 204) {
                    cb();
                } else {
                    cb('Unable to delete test node!');
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

    async.each(test_docs,
        function(test_doc, cb) {
            tutils.insert_node(test_doc, auth, function(err, resp) {
                var data = resp['body'];
                var response = resp['response'];

                if (response.statusCode === 201) {
                    var id = tutils.get_node_id(response);
                    node_ids.push(id);
                    cb();
                } else {
                    cb('Unable to insert test node!');
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
    async.each(test_docs,
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

            for (var i = 0; i < result['results'].length; i++) {
                ids.push(result['results'][i]['id']);
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
