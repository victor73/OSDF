var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var utils = require('utils');
var root_local_dir = utils.get_osdf_root();

// This is the code that is responsible for assembling the complete list
// of namespaces that this OSDF instance is aware of.
exports.get_all_namespaces = function (request, response) {
    console.log("In get_all_namespaces.");

    var ns_path = path.join(root_local_dir, '/working/namespaces/');

    // This is a simply array that will hold the data read from each
    // namespace file.
    var files_array = [];

    // This is the function that takes final assembly of the data that has
    // been read from the filesystem, packages it all, and sends the final
    // datastructure to the client via the response object.
    var final_packager = function () {
        var json = {};
        json.result_count = files_array.length;
        json.page = 1;
        json.results = files_array;
        response.json(json);
    };

    // Scan the directory containing the namespace descriptors for JSON
    // files. Do it ASYNCHRONOUSLY, so we DO NOT use the "sync" version 
    // of readdir(), readDirSync().
    fs.readdir(ns_path, function(err, files) {
        if (err) throw err;

        // Reject any hidden files/directories, such as .svn directories
        files = _.reject(files, function(file) { return file.substr(0, 1) == '.' });

        // So, if we're here, the scan has been completed and the 'files'
        // array is populated without incident.
        console.log("Found " + files.length + " files.");

        utils.async_for_each(
            files,
            function (file, callback) {
                fs.stat(path.join(ns_path, file), function(err, stats) {
                    if (err) throw err;

                    if (stats.isDirectory()) {
                        var ns_dir = file;
                        var info_file = path.join(ns_path, ns_dir, 'info.json');
                        fs.readFile(info_file, function (err, file_text) {
                            if (err) {
                                console.log(err);
                            } else {
                                var file_obj = JSON.parse(file_text);
                                files_array.push(file_obj);
                            }
                            callback();
                        });
                    } else {
                        console.log("Invalid entry " + file);
                        callback();
                    }
                });
            },
            // Call the final packager and data sender...
            final_packager
        );
    });
}

// This is the code that is responsible for responding to requests for individual
// namespaces.
exports.get_namespace = function (request, response) {
    console.log("In get_namespace.");

    var ns_file = path.join(root_local_dir, 'working/namespaces/', request.params.ns, "info.json");

    // Check to see if we have a file descriptor (JSON) for the namespace the user
    // has specified. This is also an asynchronous call.
    path.exists(ns_file, function(exists) { 
        if (! exists) {
            // The namespace is unknown to us.
            response.send('', {'X-OSDF-Error': "Namespace doesn't exist." }, 404);
        } else {
            // File exists. So, let us read the data and send it back.
            fs.readFile(ns_file, function (err, file_text) {
                if (err) {
                    console.log(err);
                    response.send('', {'X-OSDF-Error': err.error }, 500);
                } else {
                    var ns_data = JSON.parse(file_text);
                    response.json(ns_data);
                }
            });
        }
    });
}
