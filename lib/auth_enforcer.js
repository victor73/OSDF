var async = require('async');
var fs = require('fs');
var linereader = require('line-reader');
var osdf_utils = require('osdf_utils');
var path = require('path');
var pw_hash = require('password-hash');
var _ = require('lodash');

var logger = osdf_utils.get_logger();
var users = {};
var working_dir;

// Initialize the handler by reading the user database file into
// memory. This should make for faster lookups when we are authenticating
// access. Notify the top level code that we are finished with the
// initialization process by sending an event using the emitter which
// is passed in as an argument.
exports.init = function(emitter, working_dir_custom) {
    logger.debug("In " + path.basename(__filename) + " init().");

    if (working_dir_custom !== null && working_dir_custom !== undefined) {
        logger.debug("Configuring for a custom working directory of: " +
                     working_dir_custom);
        working_dir = working_dir_custom;
    } else {
        var root_local_dir = osdf_utils.get_osdf_root();
        working_dir = path.join(root_local_dir, 'working');
    }

    var user_file = path.join(working_dir, 'users.db');


    // If the users.db file is missing, then we clearly can't continue
    async.waterfall([
        function(callback) {
            fs.access(user_file, fs.F_OK | fs.R_OK, function(err) {
                if (err) {
                    logger.error(user_file + " does not exist or is unreadable. " + err);
                    callback(user_file + " does not exist or is unreadable.");
                } else {
                    logger.debug(user_file + " exists and is readable.");
                    callback(null);
                }
            });
        },
        function(callback) {
            var linecount = 0;

            linereader.eachLine(user_file, function(line, last) {
                linecount++;

                // Check if the line contains a ':' character, which it should
                if (_.startsWith(line, "#")) {
                    logger.debug("Skipping comment on line " + linecount + ' of ' + user_file);
                } else if (line.indexOf(':') !== -1) {
                    var user_data_ele = line.split(':');
                    users[user_data_ele[0]] = user_data_ele[1];
                } else {
                    logger.warn("Bad user entry on line " + linecount + ' of ' + user_file);
                }

                if (last) {
                    logger.debug("Finished reading " + user_file);
                    callback(null, Object.keys(users).length);
                }
            });
        }
    ],
    function(err, user_count) {
        if (err) {
            emitter.emit('auth_handler_aborted', err);
        } else {
            // Notify that we are finished.
            emitter.emit("auth_handler_initialized", user_count);
        }
    });
};

exports.authenticate = function authenticate() {
    return function authenticate(request, response, next) {
        if (request.headers.hasOwnProperty('authorization')) {
            var credential_pair =
                new Buffer(request.headers.authorization.split(' ')[1],
                           'base64').toString();
            var credentials = credential_pair.split(':');
            var username = credentials[0];
            var password = credentials[1];

            if (users.hasOwnProperty(username)) {
                var stored_hash = users[username];

                // the hash can be produced on the command line with the following
                // command:
                // echo -n "password" | openssl sha1 -hmac "salt"
                if (pw_hash.verify(password, stored_hash)) {
                    next();
                } else {
                    logger.info("Invalid credentials, " + credential_pair +
                                ", from " + request.client.remoteAddress);
                    response.set('X-OSDF-Error', 'Invalid auth token');
                    response.status(403).send('');
                }
            } else {
                logger.info("Invalid authentication attempt. No such user: " + username);
                response.set('X-OSDF-Error', 'Invalid auth token');
                response.status(403).send('');
            }
        } else {
            logger.info("No authentication provided by user at " + request.client.remoteAddress);
            response.set('X-OSDF-Error', 'No credentials provided');
            response.status(403).send('');
        }
    };
};

// A convenience method to retrieve the number of
// users registered into the OSDF instance.
exports.get_user_count = function() {
    return Object.keys(exports.users).length;
};

exports.get_user = function(request) {
    var credential_pair = new Buffer(request.headers.authorization.split(' ')[1],
                          'base64').toString();
    var credentials = credential_pair.split(':');
    var username = credentials[0];
    return username;
};
