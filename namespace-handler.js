var _ = require('lodash');
var each = require('async/each');
var fs = require('fs');
var osdf_utils = require('osdf_utils');
var path = require('path');
var working_dir = osdf_utils.get_working_dir();

var logger = osdf_utils.get_logger();
var osdf_error = osdf_utils.send_error;

// This is the code that is responsible for assembling the complete list
// of namespaces that this OSDF instance is aware of.
exports.get_all_namespaces = function(request, response) {
    logger.debug('In get_all_namespaces.');

    var ns_path = path.join(working_dir, 'namespaces');

    // This is a simply array that will hold the data read from each
    // namespace file.
    var files_array = [];

    // This is the function that takes final assembly of the data that has
    // been read from the filesystem, packages it all, and sends the final
    // datastructure to the client via the response object.
    var final_packager = function() {
        var json = {};
        json.result_count = files_array.length;
        json.page = 1;
        json.results = files_array;
        response.jsonp(json);
    };

    // Scan the directory containing the namespace descriptors for JSON
    // files. Do it ASYNCHRONOUSLY, so we DO NOT use the "sync" version
    // of readdir(), readDirSync().
    fs.readdir(ns_path, function(err, files) {
        if (err) {
            throw err;
        }

        // Reject any hidden files/directories, such as .svn directories
        files = _.reject(files, function(file) {
            return file.substr(0, 1) === '.';
        });

        // So, if we're here, the scan has been completed and the 'files'
        // array is populated without incident.
        logger.info('Found ' + files.length + ' files.');

        each(files, function(file, callback) {
            fs.stat(path.join(ns_path, file), function(err, stats) {
                if (err) {
                    logger.error(err);
                    callback(err);
                }

                if (stats.isDirectory()) {
                    var ns_dir = file;
                    var info_file = path.join(ns_path, ns_dir, 'info.json');
                    fs.readFile(info_file, function (err, file_text) {
                        if (err) {
                            logger.error(err);
                            callback(err);
                        } else {
                            var file_obj = JSON.parse(file_text);
                            files_array.push(file_obj);
                            callback(null);
                        }
                    });
                } else {
                    logger.warn('Invalid entry (not a directory): ' + file);
                    callback(null);
                }
            });
        },
        function(err) {
            if (err) {
                logger.error('Error retrieving all namespaces: ' + err);
            }
            // Call the final packager and data sender...
            final_packager();
        });
    });
};

// This is the code that is responsible for responding to requests for individual
// namespaces.
exports.get_namespace = function(request, response) {
    logger.debug('In get_namespace.');

    var ns_file = path.join(working_dir, 'namespaces', request.params.ns, 'info.json');

    // Check to see if we have a file descriptor (JSON) for the namespace the user
    // has specified. This is also an asynchronous call.
    fs.exists(ns_file, function(exists) {
        if (! exists) {
            // The namespace is unknown to us.
            osdf_error(response, "Namespace doesn't exit.", 404);
        } else {
            // File exists. So, let us read the data and send it back.
            fs.readFile(ns_file, function(err, file_text) {
                if (err) {
                    logger.error(err);
                    osdf_error(response, err.error, 500);
                } else {
                    var ns_data = JSON.parse(file_text);
                    response.jsonp(ns_data);
                }
            });
        }
    });
};
