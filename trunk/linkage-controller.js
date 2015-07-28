var _ = require('lodash');
var nh = require('node-handler');
var osdf_utils = require('osdf_utils');
var util = require('util');
var async = require('async');

var linkage_control_map = {};
var logger = osdf_utils.get_logger();

exports.set_db_connection = function(connection) {
    logger.debug("In set_db_connection.");
    db = connection;
};

exports.set_namespace_linkages = function(namespace, linkage_mapping) {
    logger.debug("In set_namespace_linkages.");
    linkage_control_map[namespace] = linkage_mapping;
};

exports.valid_linkage = function(node, callback) {
    logger.debug("In valid_linkage.");
    var valid = true;

    var ns = node['ns'];

    if (! (linkage_control_map.hasOwnProperty(ns))) {
        logger.info("Node's namespace (" + ns + ") not linkage controlled.");
        callback(null, valid);
        return;
    }

    // Let's more easily work with the controls for THIS namespace
    var ns_control = linkage_control_map[ns];

    var node_type = node['node_type'];

    if (ns_control.hasOwnProperty(node_type)) {
        // The incoming node is listed as a node that is controlled
        // so we need to check the nodes that we are connecting to
        var edges = Object.keys( node['linkage'] );

        if (edges.length === 0) {
            logger.debug("Incoming node has no linkages.");
            callback(null, valid);
            return;
        } else {
            logger.debug("Incoming node linkage count: " + edges.length);
        }

        // A flag to discern a "true" error, as opposed to us using the callback(err)
        // mechanism to abor thte eachLimit() loop.
        var trueErrorFlag = false;

        async.eachLimit(edges, 1, function (edge, cb) {
            logger.debug('Working on linkage named "' + edge + '"');

            if (ns_control[node_type].hasOwnProperty(edge)) {
                check(ns_control, node, edge, edge, function(err, result) {
                    if (err) {
                        logger.error(err);
                        valid = false;
                        trueErrorFlag = true;
                        cb(err);
                    } else {
                        valid = result;
                        if (valid === false) {
                            // We try to abort the loop, but not signal a "true" error
                            cb(1);
                        } else {
                            cb();
                        }
                    }
                });
            } else if (ns_control[node_type].hasOwnProperty('*')) {
                // Wildcard for edge names is present
                logger.info('Wildcard for edges for nodes of type "' + node_type + '" detected.');
                check(ns_control, node, edge, '*', function(err, result) {
                    if (err) {
                        logger.error(err);
                        valid = false;
                        trueErrorFlag = true;
                        cb(err);
                    } else {
                        valid = result;
                        if (valid === false) {
                            // We try to abort the loop, but not signal a "true" error
                            cb(1);
                        } else {
                            cb();
                        }
                    }
                });
           } else {
                logger.debug('Linkage named "' + edge +
                             '" not valid for nodes of type "' + node_type + '".');
                valid = false;
                cb(1);
            }
        }, function (err) {
            if (trueErrorFlag === true) {
                callback(err, valid);
            } else {
                callback(null, valid);
            }
        });
    } else {
        // TODO: Handle * wildcard
        logger.debug('Namespace "' + ns + '" imposes no linkage control over "' +
                     node_type + '" nodes.');
        callback(null, valid);
    }
};

function check(ns_control, node, edge, edgeKey, callback) {
    var node_type = node['node_type'];
    var valid = false;

    var allowed_targets = ns_control[node_type][edgeKey];

    // Nothing is allowed, so return early
    if (allowed_targets.length === 0) {
        logger.debug('No allowed targets for node type "' + node_type + '"');
        callback(null, valid);
    } else if (_.contains(allowed_targets, edge)) {
        logger.debug('This node (' + node_type  + ') can link via "' + node_type +
                     '" to any other because of a wildcard.');
        valid = true;
        callback(null, valid);
    } else {
        var node_ids = node['linkage'][edge];
        areTargetNodesAllowed(node_ids, allowed_targets, function(err, valid) {
            callback(err, valid);
        });
    }
}

function areTargetNodesAllowed(node_ids, allowed_target_types, callback) {
    logger.debug("In areTargetNodesAllowed.");
    var valid = true;

    if (_.contains(allowed_target_types, '*')) {
        logger.info('Allowed targets contains a wildcard. Returning "true".');
        callback(null, valid);
        return;
    }

    // Get each of the nodes we're pointing to and check their
    // node types...
    async.eachLimit(node_ids, 1, function(node_id, cb) {
        db.get(node_id, function(err, target_node) {
            if (err) {
                if (err.hasOwnProperty('error') && err['error'].search('not_found') !== -1) {
                    logger.warn("Linkage points to non-existent node.");
                    valid = false;
                    cb();
                } else {
                    logger.error(err);
                    cb(err);
                }
            } else {
                var target_type = target_node['node_type'];
                logger.debug('Target node is of type "' + target_type + '". Checking.');

                if (! _.contains(allowed_target_types, target_type)) {
                    logger.info('Target type of "' + target_type + '" is not permisssible.');
                    valid = false;
                }
                cb();
            }
        });
    }, function(err) {
        if (err) {
            logger.error("An error with areTargetNodesAllowed occurred: " + err);
            valid = false;
        }
        logger.debug("areTargetNodesAllowed returning: " + valid);
        callback(err, valid);
    });
}
