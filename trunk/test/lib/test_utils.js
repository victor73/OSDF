// Auxiliary functions for easier testing. These typically accept a callback so
// that we know when they are complete. The callback is called with the data
// that is returned from the OSDF instance as the first argument, and the
// response object from the OSDF instance as the second argument. The response
// is needed and useful so that tests can be written to examine things such as
// status codes and content type.

var http = require('http');
var utils = require(__dirname + "/../../lib/osdf_utils");
var host = 'localhost';
var client = http.createClient(8123, host);
var username = "test";
var password = 'test';

// Auxiliary function to retrieve a single individual namespace.
exports.retrieve_namespace = function(namespace, auth_header, callback) {
    var request;
    if (auth_header == null) {
        request = client.request('GET', '/namespaces/' + namespace);
    } else {
        request = client.request('GET', '/namespaces/' + namespace, auth_header);
    }
    request.end();

    var body = "";

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    });
};

// Auxiliary function to retrieve all namespaces.
exports.retrieve_all_namespaces = function(auth_header, callback) {
    // Create an HTTP client and issue the GET call.
    var request;
    if (auth_header == null) {
        request = client.request('GET', '/namespaces');
    } else {
        request = client.request('GET', '/namespaces', auth_header );
    }
    request.end();

    var body = "";
    var headers;

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    });
};

// Auxiliary function to delete a node
exports.delete_node = function(node_id, auth_header, callback, next) {
    var request;
    if (auth_header == null) {
        request = client.request('DELETE', '/nodes/' + node_id);
    } else {
        request = client.request('DELETE', '/nodes/' + node_id, auth_header);
    }
    request.end();

    var body = "";
    var headers;

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
            if (next) next();
        });
    });
};

exports.insert_node = function(node_data, auth_header, callback) {
    var request;
    if (auth_header == null) {
        request = client.request('POST', '/nodes');
    } else {
        request = client.request('POST', '/nodes', auth_header);
    }
    request.write(JSON.stringify(node_data));
    request.end();

    var body = "";
    var headers;

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    });
};

exports.retrieve_node = function(node_id, auth_header, callback) {
    var request;
    if (auth_header == null) {
        request = client.request('GET', '/nodes/' + node_id);
    } else {
        request = client.request('GET', '/nodes/' + node_id, auth_header);
    }
    request.end();

    var body = "";
    var headers;

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    });
};

exports.retrieve_node_out_links = function(node_id, auth_header, callback) {
    var request;
    if (auth_header == null) {
        request = client.request('GET', '/nodes/' + node_id + '/out');
    } else {
        request = client.request('GET', '/nodes/' + node_id + '/out', auth_header);
    }
    request.end();

    var body = "";
    var headers;

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    });
};

exports.retrieve_node_in_links = function(node_id, auth_header, callback) {
    var request;
    if (auth_header == null) {
        request = client.request('GET', '/nodes/' + node_id + '/in');
    } else {
        request = client.request('GET', '/nodes/' + node_id + '/in', auth_header);
    }
    request.end();

    var body = "";
    var headers;

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    });
};


exports.retrieve_node_by_version = function(node_id, version, auth_header, callback, next) {
    var request;
    if (auth_header == null) {
        request = client.request('GET', '/nodes/' + node_id + '/ver/' + version);
    } else {
        request = client.request('GET', '/nodes/' + node_id + '/ver/' + version, auth_header);
    }
    request.end();

    var body = "";

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
            if (next != null) {
                next();
            }
        });
    });
};

exports.update_node = function(node_id, node_data, auth_header, callback, next) {
    var request;
    if (auth_header == null) {
        request = client.request('PUT', '/nodes/' + node_id  );
    } else {
        request = client.request('PUT', '/nodes/' + node_id, auth_header );
    }
    request.write(JSON.stringify(node_data));
    request.end();

    var body = "";
    var headers;

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
            if (next != null) {
                next();
            }
        });
    });
};

exports.retrieve_info = function (auth_header, callback) {
    var request;
    if (auth_header == null) {
        request = client.request('GET', '/info');
    } else {
        request = client.request('GET', '/info', auth_header);
    }
    request.end();

    var body = "";

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    });
};

exports.insert_schema = function (namespace, schema_doc, auth_header, callback) {
    var request;
    if (auth_header == null) {
        request = client.request('POST', '/namespaces/' + namespace + '/schemas');
    } else {
        request = client.request('POST', '/namespaces/' + namespace + '/schemas', auth_header);
    }
    request.write(JSON.stringify(schema_doc));
    request.end();

    var body = "";
    var headers;

    request.on('response', function (response) {
        response.on('data', function (chunk) {
            body = body + chunk;
        });
        response.on('end', function () {
            callback(body, response);
        });
    });
};

// Taken from http://rosskendall.com/blog/web/javascript-function-to-check-an-email-address-conforms-to-rfc822
// and licensed under the Creative Commons Attribution-ShareAlike 2.5 License, or the GPL.
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
    var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
    var auth_header = { 'Host': host, 'Authorization': auth };
    return auth_header;
};

exports.get_invalid_auth = function() {
    var password = utils.random_string(8);
    var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
    var auth_header = { 'Host': host, 'Authorization': auth };
    return auth_header;
};
