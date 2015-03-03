#!/usr/bin/env node

var commander = require('commander');
var http = require('http');
var async = require('async');

commander.option('-e, --es-server <hostname>',
                 'Specify the hostname or IP address of the ElasticSearch server')
         .option('--es-port [port]',
                 'Specify the port that ElasticSearch is listening on (defaults to 9200)')
         .option('--couchdb-server [hostname/ip]',
                 'Specify the hostname or IP address of the CouchDB server" (defaults to localhost)')
         .option('--couchdb-port [port]',
                 'Specify the port that CouchDB is listening on (defaults to 5984)')
         .option('--couchdb-user [user]',
                 'Specify the username to login to CouchDB with (defaults to "osdf")')
         .option('--couchdb-password [password]',
                 'Specify the username to login to CouchDB with (defaults to "osdf")')
         .parse(process.argv);

var couchdb_server = commander.couchdbServer;
var couchdb_port = commander.couchdbPort;
var couchdb_user = commander.couchdbUser;
var couchdb_password = commander.couchdPassword;
var es_server = commander.esServer;
var es_port = commander.esPort;

if (couchdb_server == null) {
    couchdb_server = "localhost";
}

if (couchdb_port == null) {
    couchdb_port = 5984;
}

if (couchdb_user == null) {
    couchdb_user = "osdf";
}

if (couchdb_password == null) {
    couchdb_password = "osdf";
}

// The elasticsearch hostname or IP address is required in all cases.
if (es_server == null) {
    console.log("-e, or --es-server, is required,");
    process.exit(1);
}

if (es_port == null) {
    es_port = 9200;
}


var json = { "type" : "couchdb",
             "couchdb" : {
                 "user" : couchdb_user,
                 "password" : couchdb_password,
                 "host" : couchdb_server,
                 "port" : couchdb_port,
                 "db" : "osdf",
                 "ignore_attachments": true,
                 "filter": null
              },
              "index" : {
                 "index" : "osdf",
                  "type" : "osdf",
                  "bulk_size" : "100",
                  "bulk_timeout" : "10ms"
              }
          };

var osdf_mapping = {
  "mappings": {
    "osdf": {
      "date_detection": false
    }
  }
};

async.series([
    function(callback) {
        install_es_config('/osdf', 'PUT', osdf_mapping, function(err, status) {
            if (status == 200) {
                callback(null, "The mapping installation succeeded (status " + status + ")");
            } else {
                callback("The mapping installation FAILED (status " + status + ")");
            }
        });
    },
    function(callback) {
        install_es_config('/_river/osdf/_meta', 'PUT', json, function(err, status) {
            if (status == 201) {
                callback(null, "The river installation succeeded (status " + status + ")");
            } else {
                callback("The river installation FAILED (status " + status + ")");
            }
        });
    }
],
function(err, results) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
    console.log(results.join("\n"));
    process.exit(0);
});

function install_es_config(path, method, data, cb) {
    var options = {
        hostname: es_server,
        port: es_port,
        path: path,
        method: method
    };

    var req = http.request(options, function(response) {
        var status = response.statusCode;
        var err = null;
        cb(err, status);
    });

    req.write(JSON.stringify(data));

    req.end();
}
