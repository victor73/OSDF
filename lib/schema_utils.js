var _ = require('lodash');
var fs = require('fs');
var invalid_pattern = /[^A-z0-9_-]/;
var osdf_utils = require('osdf_utils');
var jsonschema = require('jsonschema');
var logger = osdf_utils.get_logger();
var path = require('path');
var format = require('string-format');

format.extend(String.prototype);
var Validator = require('jsonschema').Validator;
var checker = new Validator();

var corePath = path.resolve(osdf_utils.get_osdf_root(), 'lib/core_meta_schema.json');
var core = fs.readFileSync(corePath).toString();
var core_json = JSON.parse(core);


// This function is used to check if an auxiliary schema is in use
// by a namespace's primiary schemas or not. Returns true if the
// aux schema is in use, and false if it is not.
exports.aux_schema_in_use = function(global_schemas, namespace, aux_schema_name) {
    logger.debug('In aux_schema_in_use.');

    // Start off by assuming that it's not in use. If we detect that it is ten
    // we'll set this to true.
    var in_use = false;

    if (! global_schemas.hasOwnProperty(namespace)) {
        logger.warn('Unknown namespace ' + namespace);
        return in_use;
    }

    var refs;

    for (var primary_schema_name in global_schemas[namespace]['schemas']) {
        logger.debug('Checking schema {} for usage of {}.'
            .format(primary_schema_name, aux_schema_name));

        var primary_schema = global_schemas[namespace]['schemas'][primary_schema_name];

        // Check if the incoming schema makes use of any references that we
        // don't already know about.
        refs = exports.extractRefNames(primary_schema);
        if (_.indexOf(refs, aux_schema_name) !== -1) {
            logger.info('Aux schema in use by schema: ' + primary_schema_name);
            in_use = true;
            break;
        }
    }

    return in_use;
};

// This function parses a JSON structure and looks for keys named '$ref'
// The function returns an array of the '$ref' values.
exports.extractRefNames = function(struct) {
    var refs = [];

    // Check that we have a dictionary
    if (_.isObject(struct)) {
        _.each(struct, function(value, keyName) {
            if (_.isObject(struct[keyName])) {
                var deeper_refs = exports.extractRefNames(struct[keyName]);

                if (deeper_refs !== null && deeper_refs.length > 0) {
                    _.each(deeper_refs, function(ref) {
                        refs.push(ref);
                    });
                }
            } else if (keyName === '$ref') {
                if (! _.isEmpty(struct[keyName])) {
                    refs.push(struct[keyName]);
                }
            }
        });
    }
    return refs;
};

// Function that is used to check the validity of JSON-schema documents.
// Returns true if the JSON is valid JSON-Schema, and false if it is not.
exports.valid_json_schema = function(json_schema) {
    logger.debug('In valid_json_schema.');

    // Start by assuming the data is invalid.
    var valid = false;

    // Check that the JSON-Schema provided is actually valid JSON-Schema and
    // not just a string, or regular JSON that is not JSON-Schema.
    try {
        logger.info('Checking if document is valid JSON-Schema.');

        var results = checker.validate(json_schema, core_json);

        valid = results.valid;
    } catch (err) {
        logger.warn('Unable to determine if JSON-Schema provided was valid.', err);
    }
    logger.debug('Provided JSON-Schema valid? ' + valid);

    return valid;
};

// Function that is used to check the validity of schema names.  This is
// critical for checking new schemas that are inserted by users.
exports.valid_schema_name = function(schema_name) {
    logger.debug('In valid_schema_name.');
    var valid = false;

    var result = invalid_pattern.test(schema_name);
    if (! result && schema_name.length <= 32) {
        // Didn't have any invalid characters
        valid = true;
    }

    return valid;
};

