#!/usr/bin/node

// Scan the current directory for Javascript files that contain
// CouchDB design documents. Such files will have the following
// naming convention <design_doc_name>-<view_name>-map[-reduce].js.
// The files are then read, escaped, and formatted into the proper
// CouchDB design documents before being registered with the configured
// CouchDB server.

// TODO: Use the 'commander' module to provide for an alternate method
// to specify a different configuration file, or perhaps specify the
// CouchDB server hostname and port number...
var fs = require('fs');
var path = require('path');
var cradle = require('cradle');
var cli = require('commander');
var async = require('async');
var _ = require('underscore');
var c = require(path.join(__dirname, "../../lib/config.js"));
var config = new Config(path.join(__dirname, "../../conf/conf.ini"));

main();

function main() {
    var files = fs.readdirSync(__dirname);
    var design_doc_names = [];
    var design_docs = {};

    for (var fileIdx = 0; fileIdx < files.length; fileIdx++) {
        var file = files[fileIdx];

        if ((path.extname(file) == ".js") && strEndsWith(file, '-map.js')) {
            var base = path.basename(file, '-map.js');
            var pieces = base.split('-');
            var name = pieces[0];

            design_doc_names.push(name);
        }
    }
    // Okay, we have the design document names.
    design_doc_names = _.uniq(design_doc_names);

    async.forEachSeries(design_doc_names, function(design_name, parent_cb) {
        // The variable to hold the named design document.
        var doc_code = "";

        async.forEachSeries(files, function(file, cb) {

            if (strBeginsWith(file, design_name) && strEndsWith(file, '-map.js')) {

                var base = path.basename(file, '-map.js');

                var pieces = base.split('-');
                var view_name = pieces[1];
                
                var map_code = fs.readFileSync(file, "utf-8");

                var reduce_file = base + '-reduce.js';

                path.exists(reduce_file, function(exists) {
                    if (exists) {
                        var reduce_code = fs.readFileSync(reduce_file, "utf-8");
                        var map_reduce = create_map_reduce(view_name, map_code, reduce_code);
                        if (doc_code == "") {
                            doc_code += map_reduce;
                        } else {
                            doc_code += ",\n" + map_reduce;
                        }
                    } else {
                        var map = create_map(view_name, map_code);
                        if (doc_code == "") {
                            doc_code += map;
                        } else {
                            doc_code += ",\n" + map;
                        }
                    }

                    cb();
                });
            } else {
                cb();
            }

        }, function() {
               design_docs[design_name] = '{' + doc_code + '}';
               parent_cb();
        });
    }, function() {
        post_all_design_docs(design_docs);
    });
}

// Check if a string begins with another string (prefix).
function strBeginsWith(str, prefix) {
    return str.indexOf(prefix) === 0;
}

// Check if a string end with another string (suffix).
function strEndsWith(str, suffix) {
    var lastIndex = str.lastIndexOf(suffix);
    return (lastIndex != -1) && (lastIndex + suffix.length == str.length);
}


// Create a Couchdb "map" key/value for a "view" design document.
// The first argument is the name of the map, and the second
// argument is the javascript code to execute.
function create_map(name, code) { 
    var view = '"' + name + '": {' + "\n";
    view += '"map": "' + escape(code) + '"}';
    return view;
}

// Create a Couchdb "map/reduce" key/value for a "view" design document. The
// first argument is the name of the map, and the second argument is the
// javascript code to execute.
function create_map_reduce(name, map_code, reduce_code) {
    var view = '"' + name + '": {' + "\n";
    view += '"map": "' + escape(map_code) + '",' + "\n";
    view += '"reduce": "' + escape(reduce_code) + '"' + "\n";
    view += "}\n";

    return view;
}

// Certain parts of JavaScript code has to be escaped for proper
// inclusion into a JSON document. This function escapes the code
// and returns the formatted result.
function escape(code) {
    var escaped = code.replace(/\n/g, "\\n")
                      .replace(/\"/g, "\\\"")
                      .replace(/\r/g, "\\r")
                      .replace(/\t/g, "\\t")
                      .replace(/\f/g, "\\f");
    return escaped;
}

// Take the code that has been escaped and formatted into a JSON documents
// (CouchDB design documents) and post tehm into the CouchDB server.
function post_all_design_docs(design_docs) {
    var couch_ip = config.value('global', 'couch_ip');
    var couch_port = config.value('global', 'couch_port');;
    var couch_user = config.value('global', 'couch_user');
    var couch_pass = config.value('global', 'couch_pass');
    var dbname = config.value('global', 'dbname');

    // Establish the connection parameters, including the application's
    // CouchDB credentials.
    var couch_conn = new(cradle.Connection)('http://' + couch_ip, couch_port, {
        auth: { username: couch_user, password: couch_pass },
        cache: false,
        raw: false
    });

    // Create the CouchDB connection using the configured database name.
    var db = couch_conn.database(dbname);

    async.forEachSeries(_.keys(design_docs), function(name, cb) {
        var code = design_docs[name];

        //console.log(code);
        var view_json = JSON.parse(code);

        db.save('_design/' + name, view_json );
        cb;
    });
}
