#!/usr/bin/node

var osdf_utils = require('osdf_utils');
var tutils = require('./lib/test_utils.js');
var flow = require('flow');

var auth_header = tutils.get_test_auth();

// Test basic retrieval of a schema. The approach is to first insert a schema, then
// retrieve it. We also make an attempt To cleanup by deleting the schema at the
// conclusion of the test.
exports['basic_retrieve'] = function (test) {
    test.expect(5);

    var schema_id;

    // First we create a node
    tutils.insert_schema( test_schema, auth_header, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion.");

        test.ok("location" in response.headers, "Response header contains location of new node." );

        test.ok(data == '', "No content returned on a schema insertion.");

        var location = response.headers.location;
        node_id = location.split('/').pop();
        
        // then try to retrieve it 
        tutils.retrieve_schema( schema_id, auth_header, function(data, response) {
            test.equal(response.statusCode, 200, "Correct status for schema retrieval.");

            test.ok(data.length > 0, "Data returned.");

            var schema_data;
            try {
                schema_data = JSON.parse(data);
            } catch (err) {
                // ignored
            }
            test.ok(schema_data != null, "Data returned was valid JSON.");

            test.done();

            // Perform cleanup by removing what we just inserted and retrieved.
            try {
                tutils.delete_schema(schema_id, auth_header, function(){} );
            } catch (e) {
                console.log("Problem deleting test schema during cleanup.");
            }

        });

    });
}

// Attempt a retreival with no authentication header provided.
// Insert a schema, then retrieve it with no authentication, then cleanup.
exports['basic_retrieve_no_auth'] = function (test) {
    test.expect(5);

    var node_id;

    // First we create a node
    tutils.insert_schema( test_schema, auth_header, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion.");

        test.ok("location" in response.headers, "Response header contains location of new schema." );

        test.ok(data == '', "No content returned on a schema insertion.");

        var location = response.headers.location;
        schema_id = location.split('/').pop();
        
        // then try to retrieve it, this should fail.
        // Note the null where the auth_header would normally go.
        tutils.retrieve_schema( schema_id, null, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for retrieval without auth token.");

            test.ok(data.length == 0, "No data returned.");

            test.done();

            try {
                tutils.delete_schema( schema_id, auth_header, function(){} );
            } catch (e) {
                console.log("Problem deleting test schema during cleanup.");
            }

        });
    });
}

// Attempt a retreival with no authentication header provided.
// Insert a node, then retrieve it with no authentication, then cleanup.
exports['basic_retrieve_bad_auth'] = function (test) {
    test.expect(5);

    var node_id;

    // First we create a node
    tutils.insert_node( test_node, auth_header, function(data, response) {
        test.equal(response.statusCode, 201, "Correct status for insertion.");

        test.ok("location" in response.headers, "Response header contains location of new node." );

        test.ok(data == '', "No content returned on a node insertion.");

        var location = response.headers.location;
        node_id = location.split('/').pop();
        
        // Get a set of invalid credentials
        var bad_auth = tutils.get_invalid_auth();

        // then try to retrieve it, this should fail.
        tutils.retrieve_node( node_id, bad_auth, function(data, response) {
            test.equal(response.statusCode, 403, "Correct status for retrieval without auth token.");

            test.ok(data.length == 0, "No data returned.");

            test.done();

            try {
                tutils.delete_node(node_id, auth_header, function(){});
            } catch (e) {
                console.log("Problem deleting test node during cleanup.");
            }

        });
    });
}

// Test the behavior of retrieving a non-existent node.
exports['retrieve_nonexistent'] = function (test) {
    test.expect(2);

    var schema_id = osdf_utils.random_string(8);

    tutils.retrieve_schema(schema_id, auth_header, function(data, response) {
        test.equal(response.statusCode, 404, "Correct status for retrieval of non-existent schema.");

        test.ok(data == '', "No data returned for retrieval of non-existent schema.");

        test.done();
    });
};

// Try to retrieve a schema that doesn't exist and try to do it without
// authenticating with an authorization token. This test is a bit silly, but
// it's here just in case and for completeness.
exports['retrieve_nonexistent_no_auth'] = function (test) {
    test.expect(2);

    var schema_id = osdf_utils.random_string(8);

    // Use null for the credential, which won't send anything.
    tutils.retrieve_schema(schema_id, null, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for retrieval of non-existent schema with no auth.");

        test.ok(data == '', "No data returned for retrieval of non-existent schema with no auth.");

        test.done();
    });
};

// Try to retrieve a schema that doesn't exist and try to do it with an invalid
// set of credentials. This test is a bit silly, but it's here just in case and
// for completeness.
exports['retrieve_nonexistent_bad_auth'] = function (test) {
    test.expect(2);

    var schema_id = osdf_utils.random_string(8);

    // Get an invalid credential.
    var bad = tutils.get_invalid_auth();

    tutils.retrieve_schema(schema_id, bad, function(data, response) {
        test.equal(response.statusCode, 403, "Correct status for retrieval of non-existent schema with no auth.");

        test.ok(data == '', "No data returned for retrieval of non-existent schema with no auth.");

        test.done();
    });
};
