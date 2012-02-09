var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var utils = require('osdf_utils');
var logger = utils.get_logger();

// The main data structure to hold our ACL information.
var acl = {};

// Initialize the handler by scanning the 'acls' directory in each namespace
// directory, reading the files therein, and adding the contents to a datastructure
// in memory for faster lookups during runtime.
exports.init = function(emitter) {
    logger.info("In " + path.basename(__filename) + " init().");

    var acl_reader = function(namespaces) {
        // Initialize the master ACL hash with a key for each namespace
        _.each(namespaces, function(namespace) {
            acl[namespace] = {};
        });

        // Now, iterate over the namespaces and scan the ACL files for each one.
        utils.async_for_each(namespaces, function(namespace, cb) {

            var acl_dir = path.join(utils.get_osdf_root(), '/working/namespaces/',
                                    namespace, 'acls'); 

            fs.readdir(acl_dir, function(err, files) {
                if (err) {
                    throw err;
                }

                // Reject any hidden files/directories, such as .svn directories
                files = _.reject(files, function(file) {
                    return file.substr(0, 1) === '.';
                });

                // So, if we're here, the scan has been completed and the 'files'
                // array is populated without incident.
                logger.debug("Found " + files.length + " ACL files for namespace " + namespace);

                utils.async_for_each(files, function(file, file_cb) {
                    var acl_file = path.join(acl_dir, file);

                    fs.readFile(acl_file, 'utf-8', function(err, data) {
                        if (err) {
                            throw err;
                        }

                        var members = data.split('\n'); 

                        // Reject any strange members
                        members = _.reject(members, function(member) {
                            return member === null || member.length === 0 || member === "all";
                        });

                        // Remove any that have spaces in them.
                        members = _.reject(members, function(member) {
                            return utils.has_white_space(member);
                        }); 

                        // Sort them
                        members = _.sortBy(members, function(member) { return member; });

                        // Remove any duplicates...
                        members = _.uniq(members, true);

                        acl[namespace][file] = members;
                        file_cb();
                    });
                }, function() { cb(); });
               
            });
        }, function() {
            emitter.emit('perms_handler_initialized');
        });
    };

    utils.get_namespace_names(function(namespaces) {
        acl_reader(namespaces);
    });
};

// Given a user and a node, determine if the user can read (retrieve)
// the node. Returns true or false.
exports.has_read_permission = function(user, node) {
    if (! (node.hasOwnProperty('ns') && node.hasOwnProperty('node_type') &&
           node.hasOwnProperty('acl') && node.hasOwnProperty('linkage'))) {
        throw "Invalid node.";
    }

    var can_read = false;
    var read_acls = node['acl']['read'];

    // Do the easiest/fastest thing first. Is 'all' in the read acl?
    // If so, our job is done.
    if (utils.contains("all", read_acls)) {
        return true;
    }

    // Okay, look at them in more detail. For that we'll need the node's
    // namespace.
    var namespace = node['ns'];

    if (acl.hasOwnProperty(namespace)) {
        var acl_idx;
        for (acl_idx = 0; acl_idx < read_acls.length; acl_idx++) {
            var read_acl = read_acls[acl_idx];

            if (  utils.contains(user, acl[namespace][read_acl])) {
                can_read = true;
                break;
            }
        }
    } else {
        logger.warn("Unknown namespace: " + namespace);
    }
    return can_read;
};

// Given a user and a node, determine if the user can write to
// (that is, update or delete) the node. Returns true or false.
exports.has_write_permission = function(user, node) {
    if (! (node.hasOwnProperty('ns') && node.hasOwnProperty('node_type') &&
           node.hasOwnProperty('acl') && node.hasOwnProperty('linkage') )) {
        throw "Invalid node.";
    }

    var write_acls = node['acl']['write'];

    // Do the easiest/fastest thing first. Is 'all' in the write acl?
    // If so, our job is done.
    if (utils.contains("all", write_acls)) {
        return true;
    }

    // Okay, look at them in more detail. For that we'll need the node's
    // namespace.
    var namespace = node['ns'];

    var can_write = false;

    if (acl.hasOwnProperty(namespace)) {
        var acl_idx;
        for (acl_idx = 0; acl_idx < write_acls.length; acl_idx++) {
            var write_acl = write_acls[acl_idx]; 

            if (  utils.contains(user, acl[namespace][write_acl])) {
                can_write = true;
                break;
            }
        }
    } else {
        logger.warn("Unknown namespace: " + namespace);
    }
    return can_write;
};
