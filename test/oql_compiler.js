var assert = require('chai').assert;
var diff = require('deep-diff').diff;
var oql2es = require('oql_compiler');

var tutils = require('./lib/test_utils');
var logger = tutils.get_null_logger();

describe('oql_compiler', function() {
    it('BasicSearch', function(done) {
        var tree = [
            'text',
            'type'
        ];

        var expected = {'query':{'filtered':{'filter':[{'term':{'type':'text'}}]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonInteger', function(done) {
        var tree = [ 'type', '<', 3 ];

        var expected = {'query':{'filtered':{'filter':[{'range':{'type':{'lt':3}}}]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonNegativeInteger', function(done) {
        var tree = [ 'type', '>', -3 ];

        var expected = {'query':{'filtered':{'filter':[{'range':{'type':{'gt': -3}}}]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonFloat', function(done) {
        var tree = [ 'type', '>=', 3.14 ];

        var expected = {'query':{'filtered':{'filter':[{'range':{'type':{'gte':3.14}}}]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonNegativeFloat', function(done) {
        var tree = [ 'type', '==', -3.14 ];

        var expected = {'query':{'filtered':{'filter':[{'term':{'type':-3.14}}]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonEQTrue', function(done) {
        var tree = [ 'type', '==', true ];

        var expected = {'query':{'filtered':{'filter':[{'term':{'type':true}}]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonEQTrueInverted', function(done) {
        var tree = [ true, '==', 'type' ];

        var expected = {'query':{'filtered':{'filter':[{'term':{'type':true}}]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonEQFalse', function(done) {
        var tree = [ 'type', '==', false ];

        var expected = {'query':{'filtered':{'filter':[{'term':{'type':false}}]}}};

        performTest(done, tree, expected);
    });


    it('BasicComparisonEQFalseInverted', function(done) {
        var tree = [ false, '==', 'type' ];

        var expected = {'query':{'filtered':{'filter':[
            {'term':{'type':false}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonNETrue', function(done) {
        var tree = [ 'type', '!=', true ];

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{'must_not':{'term':{'type':true}}}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonNETrueInverted', function(done) {
        var tree = [ true, '!=', 'type' ];

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{'must_not':{'term':{'type':true}}}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonNEFalse', function(done) {
        var tree = [ 'type', '!=', false ];

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{'must_not':{'term':{'type':false}}}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('BasicComparisonNEFalseInverted', function(done) {
        var tree = [ false, '!=', 'type' ];

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{'must_not':{'term':{'type':false}}}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('AndTwoSearches', function(done) {
        var tree = [ [ 'text1', 'field1' ], '&&', [ 'text2', 'field2' ] ];

        var expected = {'query':{'filtered':{'filter':[
            {
                'bool':{'must':[
                    {'term':{'field1':'text1'}},
                    {'term':{'field2':'text2'}}
                ]}
            }
        ]}}};

        performTest(done, tree, expected);
    });

    it('OrTwoSearches', function(done) {
        var tree = [ [ 'text1', 'field1' ], '||', [ 'text2', 'field2' ] ];

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{'should':[
                {'term':{'field1':'text1'}},
                {'term':{'field2':'text2'}}
            ]}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('NestedAndSearches', function(done) {
        var tree = [
            [ '832586', 'rand_subj_id' ],
            '&&',
            [ [ 'subject', 'node_type' ], '&&', [ 'male', 'sex' ] ]
        ];

        var expected = {'query':{'filtered':{'filter':[{'bool':{
            'must':[
                {'term':{'rand_subj_id':'832586'}},
                {'bool':{
                    'must':[
                        {'term':{'node_type':'subject'}},
                        {'term':{'sex':'male'}}
                    ]
                }}
            ]
        }}]}}};

        performTest(done, tree, expected);
    });

    it('NestedOrSearches', function(done) {
        var tree = [
            [ '832586', 'rand_subj_id' ],
            '||',
            [ [ 'subject', 'node_type' ], '||', [ 'male', 'sex' ] ]
        ];

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{
                'should':[
                    { 'term':{'rand_subj_id':'832586'} },
                    { 'bool':{
                        'should':[
                            {'term':{'node_type':'subject'}},
                            {'term':{'sex':'male'}}
                        ]}
                    }
                ]
            }}
        ]}}};

        performTest(done, tree, expected);
    });

    it('NestedWithFloatLTEComparison', function(done) {
        /* eslint-disable indent */
        var tree = [
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
        /* eslint-enable indent */

        var expected = { 'query': { 'filtered': { 'filter': [{
            'bool': { 'should': [
                {
                    'bool': {
                        'must': [
                            { 'term': { 'rand_subj_id': '832586' } },
                            {
                                'bool': {
                                    'must': [
                                        { 'term': { 'node_type': 'subject' } },
                                        { 'term': { 'sex': 'male' } }
                                    ]
                                }
                            }
                        ]
                    }
                },
                { 'range': { 'ver': { 'lte': 0.2 } } }
            ]}
        }]}}};

        performTest(done, tree, expected);
    });

    it('NestedWithFloatLTComparison', function(done) {
        /* eslint-disable indent */
        var tree = [
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
        /* eslint-enable indent */

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{'should':[{'bool':{'must':[
                {'term':{'rand_subj_id':'832586'}},
                {'bool':{'must':[
                    {'term':{'node_type':'subject'}},
                    {'term':{'sex':'male'}}
                ]}}
            ]}},
            {'range':{'ver':{'lt':0.2}}}
            ]}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('NestedWithFloatGTEComparison', function(done) {
        /* eslint-disable indent */
        var tree = [
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
        /* eslint-enable indent */

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{'should':[
                {'bool':{'must':[
                    {'term':{'rand_subj_id':'832586'}},
                    {'bool':{'must':[
                        {'term':{'node_type':'subject'}},
                        {'term':{'sex':'male'}}
                    ]}}
                ]}},
                {'range':{'ver':{'gte':0.2}}}
            ]}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('NestedWithFloatGTComparison', function(done) {
        /* eslint-disable indent */
        var tree = [
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
        /* eslint-enable indent */

        var expected = { 'query':{'filtered':{'filter':[
            {'bool':{'should':[
                {'bool':{'must':[
                    {'term':{'rand_subj_id':'832586'}},
                    {'bool':{'must':[
                        {'term':{'node_type':'subject'}},
                        {'term':{'sex':'male'}}
                    ]}}
                ]}},
                {'range':{'ver':{'gt':0.2}}}
            ]}}
        ]}}};

        performTest(done, tree, expected);
    });

    it('NestedWithFloatEQComparison', function(done) {
        /* eslint-disable indent */
        var tree = [
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
        /* eslint-enable indent */

        var expected = {'query':{'filtered':{'filter':[{'bool':{
            'should':[
                {'bool':{
                    'must':[
                        {'term':{'rand_subj_id':'832586'}},
                        {'bool':{
                            'must':[
                                {'term':{'node_type':'subject'}},
                                {'term':{'sex':'male'}}
                            ]
                        }}
                    ]
                }},
                {'term':{'ver':0.2}}
            ]
        }}]}}};

        performTest(done, tree, expected);
    });

    it('NestedWithFloatNEComparison', function(done) {
        /* eslint-disable indent */
        var tree = [
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
        /* eslint-enable indent */

        var expected = {'query':{'filtered':{'filter':[
            {'bool':{
                'should':[
                    {'bool':{'must':[
                        {'term':{'rand_subj_id':'832586'}},
                        {'bool':{'must':[
                            {'term':{'node_type':'subject'}},
                            {'term':{'sex':'male'}}
                        ]}}
                    ]}},
                    {'bool':{'must_not':{'term':{'ver':0.2}}}}
                ]
            }}
        ]}}};

        performTest(done, tree, expected);
    });

    it('DottedFieldSearch', function(done) {
        var tree = [
            'text',
            'abc.efg'
        ];

        var expected = {
            'query':{ 'filtered': {
                'filter':[{'term':{'abc.efg':'text'}}]}
            }
        };

        performTest(done, tree, expected);
    });

    it('SpaceInSearchText', function(done) {
        var tree = [
            'spaced text',
            'abc'
        ];

        var expected = {
            'query':{'filtered':{
                'filter':[{'term':{'abc':'spaced text'}}]}
            }
        };

        performTest(done, tree, expected);
    });

    it('MultiSpacesInSearchTextPreserved', function(done) {
        var tree = [
            'spaced   text',
            'abc'
        ];

        var expected = {
            'query':{
                'filtered':{
                    'filter':[{'term':{'abc':'spaced   text'}}]
                }
            }
        };

        performTest(done, tree, expected);
    });


    it('DottedFieldWithMultiSpaceText', function(done) {
        var tree = [
            'spaced   text',
            'abc.def.ghi'
        ];

        var expected = {
            'query':{
                'filtered':{
                    'filter':[{'term':{'abc.def.ghi':'spaced   text'}}]
                }
            }
        };

        performTest(done, tree, expected);
    });
});

function performTest(done, tree, expected) {
    var result = oql2es.compile(tree);

    var differences = diff(result, expected);

    assert.isUndefined(differences, undefined, 'Compiler produced expected output.');

    done();
}
