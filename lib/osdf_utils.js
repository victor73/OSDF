// clone - For creating deep copies of data structures

var _ = require('underscore');
var clone = require('clone');
var fs = require('fs');
var path = require('path');
var log4js = require('log4js');

var root = path.resolve(path.resolve(__dirname, '..'));
var log_file = path.join(root, '/logs/osdf.log');
log4js.clearAppenders();
log4js.loadAppender('file');
log4js.loadAppender('console');
log4js.addAppender(log4js.appenders.file(log_file), 'main');
log4js.addAppender(log4js.appenders.console(log4js.messagePassThroughLayout), 'console');

var logger = log4js.getLogger('main');

exports.get_logger = function() {
    return logger;
}

exports.get_config = function() {
    return path.resolve(exports.get_osdf_root(), 'conf/conf.ini');
}

exports.get_osdf_root = function() {
    return path.resolve(__dirname, '..');
}

exports.random_string = function (length) {
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');
    
    if (! length) {
        length = Math.floor(Math.random() * chars.length);
    }
    
    var str = '';
    for (var i = 0; i < length; i++) {
        str += chars[Math.floor(Math.random() * chars.length)];
    }
    return str;
}

// Used to retrieve the namespace names known to this OSDF instance.
// The function takes a callback that is called when the namespace scan
// is complete. The callback will be passed an array of namespace names
// as its first argument.
exports.get_namespace_names = function (callback) {
    if (! callback) {
        throw "No callback provided.";
    }

    var namespaces = [];
    var namespace_dir = path.join(exports.get_osdf_root(), 'working/namespaces');

    // Scan the directory containing the namespace descriptors for JSON
    // files. Do it ASYNCHRONOUSLY, so we DO NOT use the "sync" version
    // of readdir(), readDirSync().
    fs.readdir(namespace_dir, function(err, files) {
        if (err) throw err;

        // Reject any hidden files/directories, such as .svn directories
        files = _.reject(files, function(file) { return file.substr(0,1) == '.' });

        exports.async_for_each(files, function(entry, cb) {
            var full_path = path.join(namespace_dir, entry);

            fs.stat(full_path, function(err, stats) {
                if (err) throw err;

                if (stats.isDirectory()) {
                    namespaces.push(entry); 
                } else {
                    logger.debug(entry + " is not a directory!");
                }
                cb();
            });
        }, function() { callback(namespaces)});
    });
}

// A quick way to check if an array contains a value
// The first argument is the value to check for, and the
// second argument is the array to check in.
exports.contains = function (value, array_to_check ) {
    var present = false;
    if (array_to_check != null) {
        var len = array_to_check.length;
        while (len--) {
            if (array_to_check[len] === value) {
                present = true;
            }
        }
    }
    return present;
}

exports.async_for_each = function (array, iterator, then) {
    function loop(i) {
        if (i < array.length) {
            iterator(array[i], function() {
                loop(i + 1);
            });
        } else {
            if (then != null) { then(); }
        }
    }
    loop(0);
}

// Check for white space
exports.has_white_space = function(string) {
    return /\s/.test(string);
}

exports.fix_keys = function(data) {
    // Should need to clone the data, but stumbled upon an apparent bug with V8.
    var new_data = null;

    if (data !== null) {
        new_data = clone(data);

        new_data['id'] = data._id;
        new_data['ver'] = parseInt(data._rev.split("-")[0], 10);

        delete new_data._id;
        delete new_data._rev;
    }
    return new_data;
}

