var assert = require('chai').assert;
var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');

// Get a set of valid and invalid credentials for our tests
var auth = tutils.get_test_auth();
var bad_auth = tutils.get_invalid_auth();

// Test whether we can retrieve OSDF instance infomration, and whether
// the data that is returend coforms to the API specification for thing
// such as the right keys being present, populated, and in the right format.
describe('osdf-info', function() {
    it('retrieve_info', function(done) {
        tutils.retrieve_info(auth, function(err, resp) {
            if (err) {
                done(err);
            }

            var data = resp['body'];
            var response = resp['response'];

            assert.equal(response.statusCode, 200, 'Correct status for info request.');

            assert.notEqual(
                response.headers['content-type'].indexOf('application/json'),
                -1, 'Correct content type.'
            );

            var info;
            assert.doesNotThrow(function() {
                info = JSON.parse(data);
            }, 'Content returned is valid JSON.');

            assert.hasAllKeys(info, [
                'api_version', 'title', 'description', 'admin_contact_email1',
                'admin_contact_email2', 'technical_contact1', 'technical_contact2',
                'comment1', 'comment2'
            ], 'Return has all required keys.');

            assert.isString(info.api_version, 'api_version is a string');
            assert.isOk(info.api_version.length > 0, 'api_version has length > 0');

            assert.isString(info.title, 'title is a string');
            assert.isOk(info.title.length > 0, 'title has length > 0');

            assert.isString(info.description, 'description is a string');
            assert.isOk(info.description.length > 0, 'description has length > 0');
            assert.isOk(info.description.length <= 512,
                'Description does not exceed 512 characters.');

            assert.isString(info.admin_contact_email1,
                'admin_contact_email1 is a string');
            assert.isOk(info.admin_contact_email1.length > 0,
                'admin_contact_email1 has length > 0');
            assert.isOk(tutils.isRFC822ValidEmail(info.admin_contact_email1),
                'Admin email 1 conforms to RFC822.');

            assert.isString(info.admin_contact_email2,
                'admin_contact_email2 is a string');
            assert.isOk(info.admin_contact_email2.length > 0,
                'admin_contact_email2 has length > 0');
            assert.isOk(tutils.isRFC822ValidEmail(info.admin_contact_email2),
                'Admin email 2 conforms to RFC822.');

            assert.isString(info.technical_contact1,
                'technical_contact1 is a string');
            assert.isOk(info.technical_contact1.length > 0,
                'technical_contact1 has length > 0');

            assert.isString(info.technical_contact2,
                'technical_contact2 is a string');
            assert.isOk(info.technical_contact2.length > 0,
                'technical_contact2 has length > 0');

            // Comments can be empty strings, so there are no checks on the length
            // being greater than 0. However, they must be <= 128 characters in
            // length.
            assert.isString(info.comment1, 'comment1 is a string');
            assert.isAtMost(info.comment1.length, 128,
                'comment1 does not exceed 128 characters.');

            assert.isString(info.comment1, 'comment2 is a string');
            assert.isAtMost(info.comment2.length, 128,
                'comment2 does not exceed 128 characters.');

            done();
        });
    });

    // Test whether we can retreive OSDF instance information without
    // an authorization key.
    it('retrieve_info_no_auth', function(done) {
        tutils.retrieve_info(null, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for info request with no auth token.');

                assert.ok(data === '',
                    'No content returned for info request with no auth.');
            }

            done();
        });
    });

    // Test whether we can retreive OSDF instance information without
    // an authorization key.
    it['retrieve_info_bad_auth'] = function(done) {
        tutils.retrieve_info(bad_auth, function(err, resp) {
            if (err) {
                done(err);
            } else {
                var data = resp['body'];
                var response = resp['response'];

                assert.equal(response.statusCode, 403,
                    'Correct status for info request with a bad ' +
                    'auth token.');

                assert.ok(data === '',
                    'No content returned for info request with bad auth.');
            }

            done();
        });
    };
});
