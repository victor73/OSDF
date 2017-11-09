// Auxiliary functions for easier testing. These typically accept a callback so
// that we know when they are complete. The callback is called with the data
// that is returned from the OSDF instance as the first argument, and the
// response object from the OSDF instance as the second argument. The response
// is needed and useful so that tests can be written to examine things such as
// status codes and content type.

var async = require('async');
var http = require('http');
var utils = require('osdf_utils');

var server_info = get_server_info();

var host = server_info['host'];
var port = server_info['port'];
var username = server_info['username'];
var password = server_info['password'];

exports.get_null_logger = function() {
    var log4js = require('log4js');

    log4js.configure({
        appenders: {
            noop: { type: 'file', filename: '/dev/null' },
        },
        categories: {
            default: { appenders: [ 'noop' ], level: 'error' }
        }
    });

    var logger = log4js.getLogger('noop');
    return logger;
};

function get_server_info() {
    var config_path;

    try {
        config_path = require.resolve('test_config.ini');
    } catch (e) {
        console.log('Unable to find a test_config.ini in the search path.');
        console.log('Please place an INI file with server settings where ' +
                    'require() will find it.');
        console.log("Section heading should be 'osdf', and have settings " +
                    'for: host, port, username and password.');
        process.exit(1);
    }

    var iniReader = require('inireader');
    var parser = new iniReader.IniReader();
    parser.load(config_path);

    var section = 'osdf';
    var host = parser.param(section + '.' + 'host');
    var port = parser.param(section + '.' + 'port');
    var username = parser.param(section + '.' + 'username');
    var password = parser.param(section + '.' + 'password');

    if ((host === undefined || host === null) ||
        (port === undefined || port === null) ||
        (username === undefined || username === null) ||
        (password === undefined || password === null)) {

        console.log('One or more configuration parameters missing from ' +
                    'test_config.ini');
        console.log('Must have host, port, username and password ' +
                    "configured under an 'osdf' section.");

        process.exit(1);
    }

    var server_info = {
        'host': host,
        'port': port,
        'username': username,
        'password': password
    };

    return server_info;
}

// Auxiliary function to retrieve a single individual namespace.
exports.retrieve_namespace = function(namespace, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace,
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

// Auxiliary function to retrieve all namespaces.
exports.retrieve_all_namespaces = function(auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces',
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.insert_node = function(node_data, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes',
        method: 'POST'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.write(JSON.stringify(node_data));
    request.end();
};

// Auxiliary function to delete a node
exports.delete_node = function(node_id, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/' + node_id,
        method: 'DELETE'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_node = function(node_id, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/' + node_id,
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_node_out_links = function(node_id, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/' + node_id + '/out',
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_node_in_links = function(node_id, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/' + node_id + '/in',
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_node_by_version = function(node_id, version, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/' + node_id + '/ver/' + version,
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_info = function(auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/info',
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.insert_aux_schema = function(namespace, aux_schema_doc, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/aux',
        method: 'POST'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.write(JSON.stringify(aux_schema_doc));
    request.end();
};

exports.insert_schema = function(namespace, schema_doc, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas',
        method: 'POST'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.write(JSON.stringify(schema_doc));
    request.end();
};

exports.delete_aux_schema = function(namespace, aux_schema_name, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/aux/' + aux_schema_name,
        method: 'DELETE'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.delete_schema = function(namespace, schema_name, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/' + schema_name,
        method: 'DELETE'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_all_schemas = function(namespace, auth, callback ) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/',
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_all_aux_schemas = function(namespace, auth, callback ) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/aux/',
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_aux_schema = function(namespace, aux_schema_name, auth, callback ) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/aux/' + aux_schema_name,
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.retrieve_schema = function(namespace, schema_name, auth, callback ) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/' + schema_name,
        method: 'GET'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.end();
};

exports.update_aux_schema = function(namespace, aux_schema_name, aux_schema_doc, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/aux/' + aux_schema_name,
        method: 'PUT'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.write(JSON.stringify(aux_schema_doc));
    request.end();
};

exports.update_schema = function(namespace, schema_name, schema_doc, auth, callback ) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/namespaces/' + namespace + '/schemas/' + schema_name,
        method: 'PUT'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.write(JSON.stringify(schema_doc));
    request.end();
};

exports.update_node = function(node_id, node_data, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/' + node_id,
        method: 'PUT'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.write(JSON.stringify(node_data));
    request.end();
};

exports.validate_node = function(node_data, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/validate',
        method: 'POST'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.on('error', function(err) {
        callback(err, null);
    });
    request.write(JSON.stringify(node_data));
    request.end();
};

exports.query = function(es_query, namespace, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/query/' + namespace,
        method: 'POST'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);

    request.on('error', function(err) {
        callback(err, null);
    });

    if (typeof es_query === 'object') {
        request.write(JSON.stringify(es_query));
    } else {
        request.write(es_query);
    }
    request.end();
};

exports.query_page = function(es_query, namespace, page, auth, callback) {
    var body = '';

    var cb = function(response) {
        response.on('data', function(chunk) {
            body = body + chunk;
        });
        response.on('end', function() {
            callback(null, {'body': body, 'response': response});
        });
    };

    var options = {
        host: host,
        port: port,
        path: '/nodes/query/' + namespace + '/page/' + page,
        method: 'POST'
    };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);

    request.on('error', function(err) {
        callback(err, null);
    });

    if (typeof es_query === 'object') {
        request.write(JSON.stringify(es_query));
    } else {
        request.write(es_query);
    }
    request.end();
};

exports.query_all = function(es_query, namespace, auth, callback) {
    var has_next_page = true;
    var page = 1;
    var all_results = [];

    // TODO: Stream the results back, don't gather it all into a structure
    // and write it back after complete...
    async.doWhilst(
        function(callback) {
            exports.query_page(es_query, namespace, page, auth,
                function(err, resp) {
                    if (err) {
                        callback(err, null);
                    }

                    var data = resp['body'];
                    var response = resp['response'];

                    has_next_page = response
                        .headers
                        .hasOwnProperty('x-osdf-query-resultset');
                    page++;

                    var json_data = JSON.parse(data);
                    all_results = all_results.concat(json_data['results']);

                    callback();
                }
            );
        },
        function() {
            return has_next_page;
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                var final = {
                    'search_result_total': all_results.length,
                    'result_count': all_results.length,
                    'results': all_results
                };
                callback(null, { 'body': JSON.stringify(final), 'response': 200 } );
            }
        }
    );
};

exports.oql_query = function(oql_query, namespace, auth, callback) {

};

// Taken from http://rosskendall.com/blog/web/javascript-function-to-check\
// -an-email-address-conforms-to-rfc822
// and licensed under the Creative Commons Attribution-ShareAlike 2.5 License,
// or the GPL.
exports.isRFC822ValidEmail = function(sEmail) {
    var sQtext = '[^\\x0d\\x22\\x5c\\x80-\\xff]';
    var sDtext = '[^\\x0d\\x5b-\\x5d\\x80-\\xff]';
    var sAtom = '[^\\x00-\\x20\\x22\\x28\\x29\\x2c\\x2e\\x3a-\\x3c\\x3e\\x40\\x5b-\\x5d\\x7f-\\xff]+';
    var sQuotedPair = '\\x5c[\\x00-\\x7f]';
    var sDomainLiteral = '\\x5b(' + sDtext + '|' + sQuotedPair + ')*\\x5d';
    var sQuotedString = '\\x22(' + sQtext + '|' + sQuotedPair + ')*\\x22';
    var sDomain_ref = sAtom;
    var sSubDomain = '(' + sDomain_ref + '|' + sDomainLiteral + ')';
    var sWord = '(' + sAtom + '|' + sQuotedString + ')';
    var sDomain = sSubDomain + '(\\x2e' + sSubDomain + ')*';
    var sLocalPart = sWord + '(\\x2e' + sWord + ')*';
    var sAddrSpec = sLocalPart + '\\x40' + sDomain; // complete RFC822 email address spec
    var sValidEmail = '^' + sAddrSpec + '$'; // as whole string

    var reValidEmail = new RegExp(sValidEmail);

    if (reValidEmail.test(sEmail)) {
        return true;
    }

    return false;
};

exports.get_test_auth = function() {
    var auth = username + ':' + password;
    return auth;
};

exports.get_invalid_auth = function() {
    var username = utils.random_string(8);
    var password = utils.random_string(8);
    var auth = username + ':' + password;
    return auth;
};

exports.get_node_id = function(response) {
    var location = response.headers.location;
    var node_id = location.split('/').pop();
    return node_id;
};
