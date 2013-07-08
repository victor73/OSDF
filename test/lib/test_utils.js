// Auxiliary functions for easier testing. These typically accept a callback so
// that we know when they are complete. The callback is called with the data
// that is returned from the OSDF instance as the first argument, and the
// response object from the OSDF instance as the second argument. The response
// is needed and useful so that tests can be written to examine things such as
// status codes and content type.

var http = require('http');
var utils = require(__dirname + "/../../lib/osdf_utils");
var host = 'localhost';
var port = 8123;
var username = "test";
var password = 'test';

// Auxiliary function to retrieve a single individual namespace.
exports.retrieve_namespace = function (namespace, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

// Auxiliary function to retrieve all namespaces.
exports.retrieve_all_namespaces = function (auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces' };


    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb );
};

exports.insert_node = function (node_data, auth, callback) {
    var request;
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/nodes',
                    method: 'POST' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    request = http.request(options, cb);
    request.write(JSON.stringify(node_data));
    request.end();
};

// Auxiliary function to delete a node
exports.delete_node = function (node_id, auth, callback) {
    var request;
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/nodes/' + node_id,
                    method: 'DELETE' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    request = http.request(options, cb);
    request.end();
};

exports.retrieve_node = function (node_id, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/nodes/' + node_id };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.retrieve_node_out_links = function (node_id, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/nodes/' + node_id + '/out' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.retrieve_node_in_links = function (node_id, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/nodes/' + node_id + '/in' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.retrieve_node_by_version = function (node_id, version, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/nodes/' + node_id + '/ver/' + version };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.retrieve_info = function (auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/info' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.insert_aux_schema = function (namespace, aux_schema_doc, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/aux',
                    method: 'POST' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.write(JSON.stringify(aux_schema_doc));
    request.end();
};

exports.insert_schema = function (namespace, schema_doc, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas',
                    method: 'POST' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.write(JSON.stringify(schema_doc));
    request.end();
};

exports.delete_aux_schema = function (namespace, aux_schema_name, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/aux/' + aux_schema_name,
                    method: 'DELETE' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);

    request.end();
};

exports.delete_schema = function (namespace, schema_name, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/' + schema_name,
                    method: 'DELETE' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);

    request.end();
};

exports.retrieve_all_schemas = function (namespace, auth, callback ) {
    var request;
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.retrieve_all_aux_schemas = function (namespace, auth, callback ) {
    var request;
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/aux/' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.retrieve_aux_schema = function (namespace, aux_schema_name, auth, callback ) {
    var request;
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/aux/' + aux_schema_name };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.retrieve_schema = function (namespace, schema_name, auth, callback ) {
    var request;
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/' + schema_name };

    if (auth !== null) {
        options['auth'] = auth;
    }

    http.get(options, cb);
};

exports.update_aux_schema = function (namespace, aux_schema_name, aux_schema_doc, auth, callback ) {
    var request;
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/aux/' + aux_schema_name,
                    method: 'PUT' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.write(JSON.stringify(aux_schema_doc));
    request.end();
};

exports.update_schema = function (namespace, schema_name, schema_doc, auth, callback ) {
    var request;
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/namespaces/' + namespace + '/schemas/' + schema_name,
                    method: 'PUT' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.write(JSON.stringify(schema_doc));
    request.end();
};

exports.update_node = function (node_id, node_data, auth, callback) {
    var body = "";

    var cb = function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    };

    var options = { host: host,
                    port: port,
                    path: '/nodes/' + node_id,
                    method: 'PUT' };

    if (auth !== null) {
        options['auth'] = auth;
    }

    var request = http.request(options, cb);
    request.write(JSON.stringify(node_data));
    request.end();
};


// Taken from http://rosskendall.com/blog/web/javascript-function-to-check-an-email-address-conforms-to-rfc822
// and licensed under the Creative Commons Attribution-ShareAlike 2.5 License, or the GPL.
exports.isRFC822ValidEmail = function (sEmail) {
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

exports.get_test_auth = function () {
    var auth = username + ":" + password;
    return auth;
};

exports.get_invalid_auth = function () {
    var password = utils.random_string(8);
    var auth = username + ':' + password;
    return auth;
};
