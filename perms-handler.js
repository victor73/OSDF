var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var osdf_utils = require('osdf_utils');
var logger = osdf_utils.get_logger();

// The main data structure to hold our ACL information.
var acl = {};
var namespace_user_acls = {};

function process_namespace(namespace, cb) {
    var acl_dir = path.join(osdf_utils.get_working_dir(), 'namespaces',
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
        logger.debug("Found " + files.length +
                     " ACL files for namespace " + namespace);

        async.each(files, function(file, callback) {
            var acl_file = path.join(acl_dir, file);

            fs.readFile(acl_file, 'utf-8', function(err, data) {
                if (err) {
                    callback(err);
                }

                var members = data.split('\n');

                // Reject any strange members
                members = _.reject(members, function(member) {
                    return member === null ||
                        member.length === 0 ||
                        member === "all";
                });

                // Remove any that have spaces in them.
                members = _.reject(members, function(member) {
                    return osdf_utils.has_white_space(member);
                });

                // Sort them
                members = _.sortBy(members, function(member) {
                    return member;
                });

                // Remove any duplicates...
                members = _.uniq(members, true);

                // Populate the acl object
                acl[namespace][file] = members;

                // Populate the namespace_user_acls object
                _.each(members, function(member) {
                    if (! namespace_user_acls[namespace][member]) {
                        namespace_user_acls[namespace][member] = [];
                    }
                    namespace_user_acls[namespace][member].push(file);
                });

                callback();
            });
        }, function(err) {
            if (err) {
                logger.error("Namespace " + namespace +
                             " had an ACL error: " + err);
                cb(err);
            } else {
                logger.info("Processed namespace " + namespace + " ACLs fine.");
                cb();
            }
        });
    });
}

// Initialize the handler by scanning the 'acls' directory in each namespace
// directory, reading the files therein, and adding the contents to a
// datastructure in memory for faster lookups during runtime.
exports.init = function(emitter) {
    logger.info("In " + path.basename(__filename) + " init().");

    var acl_reader = function(namespaces) {
        // Initialize the master ACL hash with a key for each namespace
        _.each(namespaces, function(namespace) {
            acl[namespace] = {};
            namespace_user_acls[namespace] = {};
        });

        // Now, iterate over the namespaces and scan the ACL files for each one.
        async.each(namespaces, function(namespace, callback) {
            process_namespace(namespace, function(err) {
                if (err) {
                    callback(err);
                } else {
                    callback();
                }
            });
        }, function(err) {
            if (err) {
                emitter.emit('perms_handler_aborted', err);
            } else {
                emitter.emit('perms_handler_initialized');
            }
        });
    };

    osdf_utils.get_namespace_names(function(err, namespaces) {
        if (err) {
            logger.error("Error retrieving namespace names: " + err);
            emitter.emit('perms_handler_aborted', err);
        } else {
            logger.debug("Got namespace names.");
            acl_reader(namespaces);
        }
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
    if (_.includes(read_acls, "all")) {
        return true;
    }

    // Okay, look at them in more detail. For that we'll need the node's
    // namespace.
    var namespace = node['ns'];

    if (acl.hasOwnProperty(namespace)) {
        var acl_idx;
        for (acl_idx = 0; acl_idx < read_acls.length; acl_idx++) {
            var read_acl = read_acls[acl_idx];

            if (_.includes(acl[namespace][read_acl], user)) {
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
    if (_.includes(write_acls, "all")) {
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

            if (_.includes(acl[namespace][write_acl], user)) {
                can_write = true;
                break;
            }
        }
    } else {
        logger.warn("Unknown namespace: " + namespace);
    }
    return can_write;
};

exports.get_user_acls = function(namespace, user) {
    var user_acls = ["all"];
    // If namespace/user has valid acls, return them with prepended "all"
    // otherwise, simply return "all"
    if (namespace_user_acls[namespace] && namespace_user_acls[namespace][user]) {
        user_acls.concat(namespace_user_acls[namespace][user]);
    }
    return user_acls;
};
