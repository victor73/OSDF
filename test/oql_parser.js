/*eslint indent: 0*/

var assert = require('chai').assert;
var diff = require('deep-diff').diff;
var parser = require('oql_compiler');

var tutils = require('./lib/test_utils');
var logger = tutils.get_null_logger();

describe('oql-parser', function() {
    it('basic_search', function(done) {
        var query = '"text"[type]';

        var expected = [
                'text',
                'type'
                ];

        performTest(done, query, expected);
    });

    it('basic_comparison_integer', function(done) {
        var query = '[type] == 3';

        var expected = ['type', '==', 3];

        performTest(done, query, expected);
    });

    it('basic_comparison_integer_inverted', function(done) {
        var query = '3 == [type]';

        var expected = ['type', '==', 3];

        performTest(done, query, expected);
    });

    it('basic_comparison_lt_integer', function(done) {
        var query = '[type] < 3';

        var expected = ['type', '<', 3];

        performTest(done, query, expected);
    });

    it('basic_comparison_lt_integer_inverted', function(done) {
        var query = '3 < [type]';

        var expected = ['type', '>', 3];

        performTest(done, query, expected);
    });

    it('basic_comparison_gt_negative_integer', function(done) {
        var query = '[type] > -3';

        var expected = ['type', '>', -3];

        performTest(done, query, expected);
    });

    it('basic_comparison_gt_negative_integer_inverted', function(done) {
        var query = '-3 > [type]';

        var expected = ['type', '<', -3];

        performTest(done, query, expected);
    });

    it('basic_comparison_gte_float', function(done) {
        var query = '[type] >= 3.14';

        var expected = ['type', '>=', 3.14];

        performTest(done, query, expected);
    });

    it('basic_comparison_gte_float_inverted', function(done) {
        var query = '3.14 >= [type]';

        var expected = ['type', '<=', 3.14];

        performTest(done, query, expected);
    });

    it('basic_comparison_negative_float', function(done) {
        var query = '[type] == -3.14';

        var expected = ['type', '==', -3.14];

        performTest(done, query, expected);
    });

    it('basic_comparison_negative_float_inverted', function(done) {
        var query = '-3.14 == [type]';

        var expected = ['type', '==', -3.14];

        performTest(done, query, expected);
    });

    it('basic_comparison_gte_negative_float', function(done) {
        var query = '[type] >= -3.14';

        var expected = ['type', '>=', -3.14];

        performTest(done, query, expected);
    });

    it('basic_comparison_gte_negative_float_inverted', function(done) {
        var query = '-3.14 >= [type]';

        var expected = ['type', '<=', -3.14];

        performTest(done, query, expected);
    });

    it('basic_comparison_lte_negative_float', function(done) {
        var query = '[type] <= -3.14';

        var expected = ['type', '<=', -3.14];

        performTest(done, query, expected);
    });

    it('basic_comparison_lte_negative_float_inverted', function(done) {
        var query = '-3.14 <= [type]';

        var expected = ['type', '>=', -3.14];

        performTest(done, query, expected);
    });

    it('basic_comparison_eq_true', function(done) {
        var query = '[type] == true';

        var expected = ['type', '==', true];

        performTest(done, query, expected);
    });

    it('basic_comparison_eq_true_inverted', function(done) {
        var query = 'true == [type]';

        var expected = ['type', '==', true];

        performTest(done, query, expected);
    });

    it('basic_comparison_eq_false', function(done) {
        var query = '[type] == false';

        var expected = ['type', '==', false];

        performTest(done, query, expected);
    });

    it('basic_comparison_eq_false_inverted', function(done) {
        var query = 'false == [type]';

        var expected = ['type', '==', false];

        performTest(done, query, expected);
    });

    it('basic_comparison_ne_true', function(done) {
        var query = '[type] != true';

        var expected = ['type', '!=', true];

        performTest(done, query, expected);
    });

    it('basic_comparison_ne_true_inverted', function(done) {
        var query = 'true != [type]';

        var expected = ['type', '!=', true];

        performTest(done, query, expected);
    });

    it('basic_comparison_ne_false', function(done) {
        var query = '[type] != false';

        var expected = ['type', '!=', false];

        performTest(done, query, expected);
    });

    it('basic_comparison_ne_false_inverted', function(done) {
        var query = 'false != [type]';

        var expected = ['type', '!=', false];

        performTest(done, query, expected);
    });

    it('and_two_searches', function(done) {
        var query = '"text1"[type] && "text2"[type2]';

        var expected = [['text1', 'type'], '&&', ['text2', 'type2']];

        performTest(done, query, expected);
    });

    it('or_two_searches', function(done) {
        var query = '"text1"[field1] || "text2"[field2]';

        var expected = [['text1', 'field1'], '||', ['text2', 'field2']];

        performTest(done, query, expected);
    });

    it('and_two_searches_spelled_out', function(done) {
        var query = '"text1"[type1] and "text2"[type2]';

        var expected = [['text1', 'type1'], '&&', ['text2', 'type2']];

        performTest(done, query, expected);
    });

    it('and_two_searches_spelled_out_uc', function(done) {
        var query = '     "text1"[type1]    AND     "text2"[type2]   ';

        var expected = [['text1', 'type1'], '&&', ['text2', 'type2']];

        performTest(done, query, expected);
    });

    it('or_two_searches_spelled_out', function(done) {
        var query = '"text1"[field1] or "text2"[field2]';

        var expected = [['text1', 'field1'], '||', ['text2', 'field2']];

        performTest(done, query, expected);
    });

    it('or_two_searches_spelled_out_uc', function(done) {
        var query = '     "text1"[field1]    OR     "text2"[field2]   ';

        var expected = [['text1', 'field1'], '||', ['text2', 'field2']];

        performTest(done, query, expected);
    });

    it('nested_and_searches', function(done) {
        var query = '"832586"[rand_subj_id] && ("subject"[node_type] && "male"[sex])';

        var expected = [
                         ['832586', 'rand_subj_id'],
                         '&&',
                         [['subject', 'node_type'], '&&', ['male', 'sex']]
                       ];

        performTest(done, query, expected);
    });

    it('three_adjacent_ands', function(done) {
        var query = '"text1"[field1] && "text2"[field2] && "text3"[field3]';

        var expected = [
                         [['text1', 'field1'], '&&', ['text2', 'field2']],
                         '&&',
                         ['text3', 'field3']
                       ];

        performTest(done, query, expected);
    });

    it('three_adjacent_ors', function(done) {
        var query = '"text1"[field1] || "text2"[field2] || "text3"[field3]';

        var expected = [
                         [['text1', 'field1'], '||', ['text2', 'field2']],
                         '||',
                         ['text3', 'field3']
                       ];

        performTest(done, query, expected);
    });

    it('three_adjacent_and_is_first_mixed', function(done) {
        var query = '"text1"[field1] && "text2"[field2] or "text3"[field3]';

        var expected = [
                         [['text1', 'field1'], '&&', ['text2', 'field2']],
                         '||',
                         ['text3', 'field3']
                       ];

        performTest(done, query, expected);
    });

    it('three_adjacent_or_is_first_mixed', function(done) {
        var query = '"text1"[field1] || "text2"[field2] and "text3"[field3]';

        var expected = [
                         ['text1', 'field1'],
                         '||',
                         [['text2', 'field2'], '&&', ['text3', 'field3']]
                       ];

        performTest(done, query, expected);
    });

    it('four_adjacent_ands', function(done) {
        var query = '"text1"[field1] && "text2"[field2] and "text3"[field3] ' +
                    '&& "text4"[field4]';

        var expected = [
                         [
                           [['text1', 'field1'], '&&', ['text2', 'field2']],
                           '&&',
                           ['text3', 'field3']
                         ],
                         '&&',
                         ['text4', 'field4']
                       ];

        performTest(done, query, expected);
    });

    it('four_adjacent_ors', function(done) {
        var query = '"text1"[field1] or "text2"[field2] || "text3"[field3] ' +
                    'or "text4"[field4]';

        var expected = [
                         [
                           [['text1', 'field1'], '||', ['text2', 'field2']],
                           '||',
                           ['text3', 'field3']
                         ],
                         '||',
                         ['text4', 'field4']
                       ];

        performTest(done, query, expected);
    });

    it('four_adjacent_mixed', function(done) {
        var query = '"text1"[field1] && "text2"[field2] or "text3"[field3] ' +
                    'and "text4"[field4]';

        var expected = [
                         [
                           ['text1', 'field1'], '&&', ['text2', 'field2'],
                         ],
                         '||',
                         [
                           ['text3', 'field3'], '&&', ['text4', 'field4']
                         ]
                       ];

        performTest(done, query, expected);
    });

    it('five_adjacent_mixed', function(done) {
        var query = '"text1"[field1] && "text2"[field2] or "text3"[field3] ' +
                    'and "text4"[field4] || "text5"[field5]';

        var expected = [
                         [
                           [
                             ['text1', 'field1'], '&&', ['text2', 'field2'],
                           ],
                           '||',
                           [
                             ['text3', 'field3'], '&&', ['text4', 'field4']
                           ]
                         ],
                         '||',
                         ['text5', 'field5']
                       ];

        performTest(done, query, expected);
    });

    it('triple_nested_mixed', function(done) {
        var query = '"text1"[field1] || ("text2"[field2] || "text3"[field3] and "text4"[field4])';

        var expected = [
                         ['text1', 'field1'],
                         '||',
                         [
                           ['text2', 'field2'],
                           '||',
                           [['text3', 'field3'], '&&', ['text4', 'field4']]
                         ]
                       ];

        performTest(done, query, expected);
    });

    it('nested_or_searches', function(done) {
        var query = '"832586"[rand_subj_id] || ("subject"[node_type] || "male"[sex])';

        var expected = [
                         ['832586', 'rand_subj_id'],
                         '||',
                         [['subject', 'node_type'], '||', ['male', 'sex']]
                       ];

        performTest(done, query, expected);
    });

    it('nested_with_float_lte_comparison', function(done) {
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

        performTest(done, query, expected);
    });

    it('nested_with_float_lt_comparison', function(done) {
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

        performTest(done, query, expected);
    });

    it('nested_with_float_gte_comparison', function(done) {
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

        performTest(done, query, expected);
    });

    it('nested_with_float_gt_comparison', function(done) {
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

        performTest(done, query, expected);
    });

    it('nested_with_float_eq_comparison', function(done) {
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

        performTest(done, query, expected);
    });

    it('nested_with_float_ne_comparison', function(done) {
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

        performTest(done, query, expected);
    });

    it('dotted_field_search', function(done) {
        var query = '"text"[abc.efg]';

        var expected = [
                'text',
                'abc.efg'
                ];

        performTest(done, query, expected);
    });

    it('spaces_in_search_text', function(done) {
        var query = '"spaced text"[abc]';

        var expected = [
                'spaced text',
                'abc'
                ];

        performTest(done, query, expected);
    });

    it('multi_spaces_in_search_text_preserved', function(done) {
        var query = '"spaced   text"[abc]';

        var expected = [
                'spaced   text',
                'abc'
                ];

        performTest(done, query, expected);
    });

    it('dotted_field_with_multi_space_text', function(done) {
        var query = '"spaced   text"[abc.def.ghi]';

        var expected = [
                'spaced   text',
                'abc.def.ghi'
                ];

        performTest(done, query, expected);
    });
});

function performTest(done, query, expected) {
    var tree = parser.parse(query);

    var differences = diff(tree, expected);

    assert.isUndefined(differences, 'Parser produced expected output.');

    done();
}
