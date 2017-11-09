#!/usr/bin/env nodeunit

/*eslint indent: 0*/

var diff = require('deep-diff').diff;
var parser = require('oql_compiler');

// Shutdown logging as it interferes with the nodeunit output
// Can activate this again if necessary for debugging.
//var log4js = require('log4js');
//log4js.shutdown(function() {});
var tutils = require('./lib/test_utils');
var logger = tutils.get_null_logger();

exports.BasicSearch = function(test) {
    var query = '"text"[type]';

    var expected = [
            'text',
            'type'
            ];

    performTest(test, query, expected);
};

exports.BasicComparisonInteger = function(test) {
    var query = '[type] == 3';

    var expected = [ 'type', '==', 3 ];

    performTest(test, query, expected);
};

exports.BasicComparisonIntegerInverted = function(test) {
    var query = '3 == [type]';

    var expected = [ 'type', '==', 3 ];

    performTest(test, query, expected);
};

exports.BasicComparisonLTInteger = function(test) {
    var query = '[type] < 3';

    var expected = [ 'type', '<', 3 ];

    performTest(test, query, expected);
};

exports.BasicComparisonLTIntegerInverted = function(test) {
    var query = '3 < [type]';

    var expected = [ 'type', '>', 3];

    performTest(test, query, expected);
};

exports.BasicComparisonGTNegativeInteger = function(test) {
    var query = '[type] > -3';

    var expected = [ 'type', '>', -3 ];

    performTest(test, query, expected);
};

exports.BasicComparisonGTNegativeIntegerInverted = function(test) {
    var query = '-3 > [type]';

    var expected = [ 'type', '<', -3 ];

    performTest(test, query, expected);
};

exports.BasicComparisonGTEFloat = function(test) {
    var query = '[type] >= 3.14';

    var expected = [ 'type', '>=', 3.14 ];

    performTest(test, query, expected);
};

exports.BasicComparisonGTEFloatInverted = function(test) {
    var query = '3.14 >= [type]';

    var expected = [ 'type', '<=', 3.14 ];

    performTest(test, query, expected);
};

exports.BasicComparisonNegativeFloat = function(test) {
    var query = '[type] == -3.14';

    var expected = [ 'type', '==', -3.14 ];

    performTest(test, query, expected);
};

exports.BasicComparisonNegativeFloatInverted = function(test) {
    var query = '-3.14 == [type]';

    var expected = [ 'type', '==', -3.14 ];

    performTest(test, query, expected);
};

exports.BasicComparisonGTENegativeFloat = function(test) {
    var query = '[type] >= -3.14';

    var expected = [ 'type', '>=', -3.14 ];

    performTest(test, query, expected);
};

exports.BasicComparisonGTENegativeFloatInverted = function(test) {
    var query = '-3.14 >= [type]';

    var expected = [ 'type', '<=', -3.14 ];

    performTest(test, query, expected);
};

exports.BasicComparisonLTENegativeFloat = function(test) {
    var query = '[type] <= -3.14';

    var expected = [ 'type', '<=', -3.14 ];

    performTest(test, query, expected);
};

exports.BasicComparisonLTENegativeFloatInverted = function(test) {
    var query = '-3.14 <= [type]';

    var expected = [ 'type', '>=', -3.14 ];

    performTest(test, query, expected);
};

exports.BasicComparisonEQTrue = function(test) {
    var query = '[type] == true';

    var expected = [ 'type', '==', true ];

    performTest(test, query, expected);
};

exports.BasicComparisonEQTrueInverted = function(test) {
    var query = 'true == [type]';

    var expected = [ 'type', '==', true ];

    performTest(test, query, expected);
};

exports.BasicComparisonEQFalse = function(test) {
    var query = '[type] == false';

    var expected = [ 'type', '==', false ];

    performTest(test, query, expected);
};

exports.BasicComparisonEQFalseInverted = function(test) {
    var query = 'false == [type]';

    var expected = [ 'type', '==', false ];

    performTest(test, query, expected);
};

exports.BasicComparisonNETrue = function(test) {
    var query = '[type] != true';

    var expected = [ 'type', '!=', true ];

    performTest(test, query, expected);
};

exports.BasicComparisonNETrueInverted = function(test) {
    var query = 'true != [type]';

    var expected = [ 'type', '!=', true ];

    performTest(test, query, expected);
};

exports.BasicComparisonNEFalse = function(test) {
    var query = '[type] != false';

    var expected = [ 'type', '!=', false ];

    performTest(test, query, expected);
};

exports.BasicComparisonNEFalseInverted = function(test) {
    var query = 'false != [type]';

    var expected = [ 'type', '!=', false ];

    performTest(test, query, expected);
};

exports.AndTwoSearches = function(test) {
    var query = '"text"[type] && "text2"[type2]';

    var expected = [ [ 'text', 'type' ], '&&', [ 'text2', 'type2' ] ];

    performTest(test, query, expected);
};

exports.OrTwoSearches = function(test) {
    var query = '"text1"[field1] || "text2"[field2]';

    var expected = [ [ 'text1', 'field1' ], '||', [ 'text2', 'field2' ] ];

    performTest(test, query, expected);
};

exports.AndTwoSearchesSpelledOut = function(test) {
    var query = '"text1"[type1] and "text2"[type2]';

    var expected = [ [ 'text1', 'type1' ], '&&', [ 'text2', 'type2' ] ];

    performTest(test, query, expected);
};

exports.AndTwoSearchesSpelledOutUC = function(test) {
    var query = '     "text1"[type1]    AND     "text2"[type2]   ';

    var expected = [ [ 'text1', 'type1' ], '&&', [ 'text2', 'type2' ] ];

    performTest(test, query, expected);
};

exports.OrTwoSearchesSpelledOut = function(test) {
    var query = '"text1"[field1] or "text2"[field2]';

    var expected = [ [ 'text1', 'field1' ], '||', [ 'text2', 'field2' ] ];

    performTest(test, query, expected);
};

exports.OrTwoSearchesSpelledOutUC = function(test) {
    var query = '     "text1"[field1]    OR     "text2"[field2]   ';

    var expected = [ [ 'text1', 'field1' ], '||', [ 'text2', 'field2' ] ];

    performTest(test, query, expected);
};

exports.NestedAndSearches = function(test) {
    var query = '"832586"[rand_subj_id] && ("subject"[node_type] && "male"[sex])';

    var expected = [
                     [ '832586', 'rand_subj_id' ],
                     '&&',
                     [ [ 'subject', 'node_type' ], '&&', [ 'male', 'sex' ] ]
                   ];

    performTest(test, query, expected);
};

exports.NestedOrSearches = function(test) {
    var query = '"832586"[rand_subj_id] || ("subject"[node_type] || "male"[sex])';

    var expected = [
                     [ '832586', 'rand_subj_id' ],
                     '||',
                     [ [ 'subject', 'node_type' ], '||', [ 'male', 'sex' ] ]
                   ];

    performTest(test, query, expected);
};

exports.NestedWithFloatLTEComparison = function(test) {
    var query = '("832586"[rand_subj_id] && ' +
                '("subject"[node_type] && "male"[sex])) ' +
                '|| [ver] <= 0.2';

    var expected = [
      [
        [
          '832586',
          'rand_subj_id'
        ],
        '&&',
        [
          [
            'subject',
            'node_type'
          ],
          '&&',
          [
            'male',
            'sex'
          ]
        ]
      ],
      '||',
      [
        'ver',
        '<=',
        0.2
      ]
    ];

    performTest(test, query, expected);
};

exports.NestedWithFloatLTComparison = function(test) {
    var query = '("832586"[rand_subj_id] && ' +
                '("subject"[node_type] && "male"[sex])) ' +
                '|| [ver] < 0.2';

    var expected = [
      [
        [
          '832586',
          'rand_subj_id'
        ],
        '&&',
        [
          [
            'subject',
            'node_type'
          ],
          '&&',
          [
            'male',
            'sex'
          ]
        ]
      ],
      '||',
      [
        'ver',
        '<',
        0.2
      ]
    ];

    performTest(test, query, expected);
};

exports.NestedWithFloatGTEComparison = function(test) {
    var query = '("832586"[rand_subj_id] && ' +
                '("subject"[node_type] && "male"[sex])) ' +
                '|| [ver] >= 0.2';

    var expected = [
      [
        [
          '832586',
          'rand_subj_id'
        ],
        '&&',
        [
          [
            'subject',
            'node_type'
          ],
          '&&',
          [
            'male',
            'sex'
          ]
        ]
      ],
      '||',
      [
        'ver',
        '>=',
        0.2
      ]
    ];

    performTest(test, query, expected);
};

exports.NestedWithFloatGTComparison = function(test) {
    var query = '("832586"[rand_subj_id] && ' +
                '("subject"[node_type] && "male"[sex])) ' +
                '|| [ver] > 0.2';

    var expected = [
      [
        [
          '832586',
          'rand_subj_id'
        ],
        '&&',
        [
          [
            'subject',
            'node_type'
          ],
          '&&',
          [
            'male',
            'sex'
          ]
        ]
      ],
      '||',
      [
        'ver',
        '>',
        0.2
      ]
    ];

    performTest(test, query, expected);
};

exports.NestedWithFloatEQComparison = function(test) {
    var query = '("832586"[rand_subj_id] && ' +
                '("subject"[node_type] && "male"[sex])) ' +
                '|| [ver] == 0.2';

    var expected = [
      [
        [
          '832586',
          'rand_subj_id'
        ],
        '&&',
        [
          [
            'subject',
            'node_type'
          ],
          '&&',
          [
            'male',
            'sex'
          ]
        ]
      ],
      '||',
      [
        'ver',
        '==',
        0.2
      ]
    ];

    performTest(test, query, expected);
};

exports.NestedWithFloatNEComparison = function(test) {
    var query = '("832586"[rand_subj_id] && ' +
                '("subject"[node_type] && "male"[sex])) ' +
                '|| [ver] != 0.2';


    var expected = [
      [
        [
          '832586',
          'rand_subj_id'
        ],
        '&&',
        [
          [
            'subject',
            'node_type'
          ],
          '&&',
          [
            'male',
            'sex'
          ]
        ]
      ],
      '||',
      [
        'ver',
        '!=',
        0.2
      ]
    ];

    performTest(test, query, expected);
};

exports.DottedFieldSearch = function(test) {
    var query = '"text"[abc.efg]';

    var expected = [
            'text',
            'abc.efg'
            ];

    performTest(test, query, expected);
};

exports.SpacesInSearchText = function(test) {
    var query = '"spaced text"[abc]';

    var expected = [
            'spaced text',
            'abc'
            ];

    performTest(test, query, expected);
};

exports.MultiSpacesInSearchTextPreserved = function(test) {
    var query = '"spaced   text"[abc]';

    var expected = [
            'spaced   text',
            'abc'
            ];

    performTest(test, query, expected);
};

exports.DottedFieldWithMultiSpaceText = function(test) {
    var query = '"spaced   text"[abc.def.ghi]';

    var expected = [
            'spaced   text',
            'abc.def.ghi'
            ];

    performTest(test, query, expected);
};

function performTest(test, query, expected) {
    test.expect(1);

    var tree = parser.parse(query);

    var differences = diff(tree, expected);

    test.ok(differences === undefined, 'Parser produced expected output.');

    test.done();
}
