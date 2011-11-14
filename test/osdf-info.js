#!/usr/bin/node

require.paths.unshift(__dirname + "/../lib");

var utils = require('utils');
var tutils = require('./lib/test_utils.js');

var host = 'localhost';
var username = 'test';
var password = 'test';
var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
var auth_header = { 'Host': host, 'Authorization': auth };
var bad_auth = 'Basic ' + new Buffer(username + ':' + utils.random_string(8)).toString('base64');
var bad_auth_header = { 'Host': host, 'Authorization': bad_auth };

// Test whether we can retrieve OSDF instance infomration, and whether
// the data that is returend coforms to the API specification for thing
// such as the right keys being present, populated, and in the right format.
exports['retrieve_info'] = function (test) {
    test.expect(33);

    tutils.retrieve_info( auth_header, function(data, response) {
        test.equal(response.statusCode, 200, "Correct status for info request.");

        test.ok(response.headers['content-type'].indexOf("application/json") != -1, "Correct content type.");

        var info;
        try {
            info = JSON.parse(data);
            test.ok("Content returned is valid JSON.");
        } catch (e) {
            test.fail("Content returned is invalid JSON.");
        }

        test.ok( "api_version" in info, "Info data structure had key for 'api_version'." );
        test.ok( typeof info.api_version == "string");
        test.ok( info.api_version.length > 0);

        test.ok( "title" in info, "Info data structure had key for 'title'." );
        test.ok( typeof info.title == "string");
        test.ok( info.title.length > 0);

        test.ok( "description" in info, "Info data structure had key for 'description'." );
        test.ok( typeof info.description == "string");
        test.ok( info.description.length > 0);
        test.ok( info.description.length <= 512, "Description does not exceed 512 characters.");

        test.ok( "admin_contact_email1" in info);
        test.ok( typeof info.admin_contact_email1 == "string");
        test.ok( info.admin_contact_email1.length > 0);
        test.ok( tutils.isRFC822ValidEmail(info.admin_contact_email1), "Admin email 1 conforms to RFC822.");

        test.ok( "admin_contact_email2" in info);
        test.ok( typeof info.admin_contact_email2 == "string");
        test.ok( info.admin_contact_email2.length > 0);
        test.ok( tutils.isRFC822ValidEmail(info.admin_contact_email2), "Admin email 2 conforms to RFC822.");

        test.ok( "technical_contact1" in info);
        test.ok( typeof info.technical_contact1 == "string");
        test.ok( info.technical_contact1.length > 0);

        test.ok( "technical_contact2" in info);
        test.ok( typeof info.technical_contact2 == "string");
        test.ok( info.technical_contact2.length > 0);

        // Comments can be empty strings, so there are no checks on the length
        // being greater than 0. However, they must be <= 128 characters in length.
        test.ok( "comment1" in info);
        test.ok( typeof info.comment1 == "string");
        test.ok( info.comment1.length <= 128, "Comment1 does not exceed 128 characters.");

        test.ok( "comment2" in info);
        test.ok( typeof info.comment2 == "string");
        test.ok( info.comment2.length <= 128, "Comment2 does not exceed 128 characters.");

        test.done();

    });
};

// Test whether we can retreive OSDF instance information without
// an authorization key.
exports['retrieve_info_no_auth'] = function (test) {
    test.expect(2);

    tutils.retrieve_info( null, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for info request with no auth token.");

        test.ok(data == '', "No content returned for info request with no auth.");

        test.done();
    });
}


// Test whether we can retreive OSDF instance information without
// an authorization key.
exports['retrieve_info_bad_auth'] = function (test) {
    test.expect(2);

    tutils.retrieve_info( bad_auth_header, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for info request with a bad auth token.");

        test.ok(data == '', "No content returned for info request with bad auth.");

        test.done();
    });
}
