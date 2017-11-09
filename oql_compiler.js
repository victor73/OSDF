var osdf_utils = require('osdf_utils');
var logger = osdf_utils.get_logger();
var parser = require('oql_jison_parser');

// Speed up calls to hasOwnProperty
var hasOwnProperty = Object.prototype.hasOwnProperty;

exports.compile = function(tree) {
    logger.debug('In compile.');
    var query = {
        query: {
            filtered: {}
        }
    };

    query.query.filtered.filter = [];
    var processed = _processNode(tree);

    if (! isEmpty(processed)) {
        query.query.filtered.filter = [ processed ];
    } else {
        delete query.query.filtered.filter;
    }

    return query;
};

exports.parse = function(query) {
    logger.debug('In parse.');
    var tree = parser.parse(query);
    return tree;
};

var generators = {
    'COMPARISON': function(node) {
        var left = node[0];
        var comparator = node[1];
        var right = node[2];
        if (typeof left === 'object') {
            left = _processNode(left);
        }

        if (typeof right === 'object') {
            right = _processNode(right);
        }

        var generated = generators[comparator](left, right);

        return generated;
    },
    'ALL': function(node) {
        var text = node[0];
        var generated = {
            'query': {
                'query_string': {
                    'query': null
                }
            }
        };

        generated.query.query_string.query = text;

        return generated;
    },
    'SEARCH': function(node) {
        var text = node[0];
        var field = node[1];

        var generated = {'term': {}};
        generated.term[field] = text;

        return generated;
    },
    '&&': function(left, right) {
        if (isEmpty(left) && isEmpty(right)) {
            return null;
        } else {
            var _and = { bool: { must: [] } };
            _and.bool.must.push(left);
            _and.bool.must.push(right);

            return _and;
        }
    },
    '||': function(left, right) {
        if (isEmpty(left) && isEmpty(right)) {
            return null;
        } else {
            var _or = { bool: { should: [] } };

            _or.bool.should.push(left);
            _or.bool.should.push(right);

            return _or;
        }
    },
    '<': function(left, right) {
        var _lt = {
            range: {}
        };

        _lt.range[ left] = {
            lt: right
        };

        return _lt;
    },
    '<=': function(left, right) {
        var _lte = {
            range: {}
        };

        _lte.range[ left ] = {
            lte: right
        };

        return _lte;
    },
    '>': function(left, right) {
        var _gt = {
            range: {}
        };

        _gt.range[ left ] = {
            gt: right
        };

        return _gt;
    },
    '>=': function(left, right) {
        var _gte = {
            range: {}
        };

        _gte.range[ left ] = {
            gte: right
        };

        return _gte;
    },
    '==': function(left, right) {
        var _eq = {
            term: {}
        };

        if (typeof left === 'boolean') {
            // As in [ true, '==', field ]
            _eq.term[ right ] = left;
        } else {
            // As in [ field, '==', true ]
            _eq.term[ left ] = right;
        }

        return _eq;
    },
    '!=': function(left, right) {
        var _ne = {
            bool: {
                must_not: {
                    term: {}
                }
            }
        };

        if (typeof left === 'boolean') {
            // As in [ true, '!=', field ]
            _ne.bool.must_not.term[ right ] = left;
        } else {
            // As in [ field, '!=', true ]
            _ne.bool.must_not.term[ left ] = right;
        }

        return _ne;
    }
};

function _processNode(node) {
    logger.debug('In _processNode.');

    if (node.length === 1) {
        return generators['ALL'](node);
    } else if (node.length === 2) {
        return generators['SEARCH'](node);
    } else if (node.length === 3) {
        return generators['COMPARISON'](node);
    } else {
        throw new Error('Invalid AST node.');
    }
}

function isEmpty(obj) {
    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and valueOf enumeration bugs in IE < 9
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
}
