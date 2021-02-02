#!/usr/bin/env node

var _ = require('lodash');
var async = require('async');
var stringify = require('json-stable-stringify');
var prov = require('./prov.js');
var tutil = require('test_utils');

function get_version_list(id, cb) {
    async.waterfall([
        function(callback) {
            tutil.retrieve_node(id, auth, function(err, resp) {
                var node = get_node_from_body(resp);
                if (_.isNull(node)) {
                    callback('Unable to retrieve node {}.'.format(id));
                } else {
                    var latest_version = node['ver'];
                    callback(null, latest_version);
                }
            });
        },
        function(last_version, callback) {
            async.times(last_version, function(n, next) {
                var ver = n + 1;

                tutil.retrieve_node_by_version(id, ver, auth, function(err, resp) {
                    var attach = get_node_from_body(resp);
                    next(null, attach);
                });
            }, function(err, attach_list) {
                callback(err, attach_list);
            });
        }
    ],
    function(err, attach_list) {
        cb(err, attach_list);
    });
}

function get_base_node(id, cb) {
    if (id.endsWith('_hist')) {
        cb('Wrong node type!!!');
    } else {
        tutil.get_node(id, auth, function(resp) {
            var status_code = resp['response']['statusCode'];

            if (status_code < 200 || status_code > 299) {
                cb(resp['headers']['x-osdf-error'], null);
            } else {
                var body = resp['body'];
                cb(null, body);
            }
        });
    }
}

function get_node_from_body(resp) {
    var status_code = resp['response']['statusCode'];
    var body = null;

    if (status_code < 200 || status_code > 299) {
        // error...
    } else {
        body = resp['body'];
    }

    var parsed = JSON.parse(body);

    return parsed;
}

function verify_provenance(id, validation_handler, callback) {
    if (! _.isString(id)) {
        throw 'Must provide a node ID as a string.';
    }

    async.waterfall([
        function(callback) {
            get_version_list(id, function(err, versions) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, versions);
                }
            });
        },
        function(versions, callback) {
            prov.validate_provenance(versions, validation_handler, function(err, valid) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, valid);
                }
            });
        }
    ],
    function(err, result) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, result);
        }
    });
}

if (process.argv.length <= 2) {
    console.log('Usage: ' + __filename + ' NODE_ID');
    process.exit(-1);
}

var id = process.argv[2];

var auth = tutil.get_test_auth();

var validation_handler = function(info, valid) {
    var version = info['ver'];
    var id = info['id'];
    var hash = info['hash'];

    if (valid === true) {
        console.log('{} v{}  {} Valid.'.format(id, version, hash));
    } else {
        console.log('{} v{}  {} INVALID!!!'.format(id, version, hash));
    }
};

verify_provenance(id, validation_handler, function(err, valid) {
    if (err) {
        console.error(err);
        process.exit(1);
    } else {
        console.log('Valid? ' + valid);

        if (valid) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    }
});
