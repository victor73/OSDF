#!/usr/bin/env nodeunit

var diff = require('deep-diff').diff;
var oql2es = require('oql_compiler');

exports.BasicSearch = function(test) {
    var tree = [
            "text",
            "type"
            ];

    var expected = {"query":{"filtered":{"filter":[{"term":{"type":"text"}}]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonInteger = function(test) {
    var tree = [ 'type', '<', 3 ];

    var expected = {"query":{"filtered":{"filter":[{"range":{"type":{"lt":3}}}]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonNegativeInteger = function(test) {
    var tree = [ 'type', '>', -3 ];

    var expected = {"query":{"filtered":{"filter":[{"range":{"type":{"gt": -3}}}]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonFloat = function(test) {
    var tree = [ 'type', '>=', 3.14 ];

    var expected = {"query":{"filtered":{"filter":[{"range":{"type":{"gte":3.14}}}]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonNegativeFloat = function(test) {
    var tree = [ 'type', '==', -3.14 ];

    var expected = {"query":{"filtered":{"filter":[{"term":{"type":-3.14}}]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonEQTrue = function(test) {
    var tree = [ 'type', '==', true ];

    var expected = {"query":{"filtered":{"filter":[{"term":{"type":true}}]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonEQTrueInverted = function(test) {
    var tree = [ true, '==', 'type' ];

    var expected = {"query":{"filtered":{"filter":[{"term":{"type":true}}]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonEQFalse = function(test) {
    var tree = [ 'type', '==', false ];

    var expected = {"query":{"filtered":{"filter":[{"term":{"type":false}}]}}};

    performTest(test, tree, expected);
};


exports.BasicComparisonEQFalseInverted = function(test) {
    var tree = [ false, '==', 'type' ];

    var expected = {"query":{"filtered":{"filter":[
                     {"term":{"type":false}}
                   ]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonNETrue = function(test) {
    var tree = [ 'type', '!=', true ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"must_not":{"term":{"type":true}}}}
                   ]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonNETrueInverted = function(test) {
    var tree = [ true, '!=', 'type' ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"must_not":{"term":{"type":true}}}}
                   ]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonNEFalse = function(test) {
    var tree = [ 'type', '!=', false ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"must_not":{"term":{"type":false}}}}
                   ]}}};

    performTest(test, tree, expected);
};

exports.BasicComparisonNEFalseInverted = function(test) {
    var tree = [ false, '!=', 'type' ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"must_not":{"term":{"type":false}}}}
                   ]}}};

    performTest(test, tree, expected);
};

exports.AndTwoSearches = function(test) {
    var tree = [ [ 'text1', 'field1' ], '&&', [ 'text2', 'field2' ] ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"must":[
                       {"term":{"field1":"text1"}},
                       {"term":{"field2":"text2"}}
                      ]}}
                    ]}}
                   };
    performTest(test, tree, expected);
};

exports.OrTwoSearches = function(test) {
    var tree = [ [ 'text1', 'field1' ], '||', [ 'text2', 'field2' ] ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"should":[
                       {"term":{"field1":"text1"}},
                       {"term":{"field2":"text2"}}
                     ]}}
                   ]}}};

    performTest(test, tree, expected);
};

exports.NestedAndSearches = function(test) {
    var tree = [ [ '832586', 'rand_subj_id' ],
                   '&&',
                 [ [ 'subject', 'node_type' ], '&&', [ 'male', 'sex' ] ]
               ];

    var expected = {"query":{"filtered":{"filter":[{"bool":{
                      "must":[{"term":{"rand_subj_id":"832586"}},
                              {"bool":{
                                 "must":[
                                   {"term":{"node_type":"subject"}},
                                   {"term":{"sex":"male"}}
                                 ]}}
                      ]}}]}}};

    performTest(test, tree, expected);
};

exports.NestedOrSearches = function(test) {
    var tree = [
                 [ '832586', 'rand_subj_id' ],
                 '||',
                 [ [ 'subject', 'node_type' ], '||', [ 'male', 'sex' ] ]
               ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{
                        "should":[
                          { "term":{"rand_subj_id":"832586"} },
                          { "bool":{
                              "should":[
                                {"term":{"node_type":"subject"}},
                                {"term":{"sex":"male"}}
                              ]
                            }
                          }
                        ]
                      }
                     }
                     ]}}
                   };

    performTest(test, tree, expected);
};

exports.NestedWithFloatLTEComparison = function(test) {
    var tree = [
      [
        [
          "832586",
          "rand_subj_id"
        ],
        "&&",
        [
          [
            "subject",
            "node_type"
          ],
          "&&",
          [
            "male",
            "sex"
          ]
        ]
      ],
      "||",
      [
        "ver",
        "<=",
        0.2
      ]
    ];

    var expected = { "query": { "filtered": { "filter": [
                           {
                             "bool": {
                               "should": [
                                 {
                                   "bool": {
                                     "must": [
                                       { "term": { "rand_subj_id": "832586" } },
                                       {
                                         "bool": {
                                           "must": [
                                             { "term": { "node_type": "subject" } },
                                             { "term": { "sex": "male" } }
                                           ]
                                         }
                                       }
                                     ]
                                   }
                                 },
                                 { "range": { "ver": { "lte": 0.2 } } }
                               ]
                             }
                           }
                         ]
                       }}};

    performTest(test, tree, expected);
};

exports.NestedWithFloatLTComparison = function(test) {
    var tree = [
      [
        [
          "832586",
          "rand_subj_id"
        ],
        "&&",
        [
          [
            "subject",
            "node_type"
          ],
          "&&",
          [
            "male",
            "sex"
          ]
        ]
      ],
      "||",
      [
        "ver",
        "<",
        0.2
      ]
    ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"should":[{"bool":{"must":[
                       {"term":{"rand_subj_id":"832586"}},
                       {"bool":{"must":[
                         {"term":{"node_type":"subject"}},
                         {"term":{"sex":"male"}}
                       ]}}
                     ]}},
                     {"range":{"ver":{"lt":0.2}}}
                   ]}}
                 ]}}};

    performTest(test, tree, expected);
};

exports.NestedWithFloatGTEComparison = function(test) {
    var tree = [
      [
        [
          "832586",
          "rand_subj_id"
        ],
        "&&",
        [
          [
            "subject",
            "node_type"
          ],
          "&&",
          [
            "male",
            "sex"
          ]
        ]
      ],
      "||",
      [
        "ver",
        ">=",
        0.2
      ]
    ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"should":[
                       {"bool":{"must":[
                         {"term":{"rand_subj_id":"832586"}},
                         {"bool":{"must":[
                           {"term":{"node_type":"subject"}},
                           {"term":{"sex":"male"}}
                         ]}}
                       ]}},
                       {"range":{"ver":{"gte":0.2}}}
                     ]}}
                   ]}}};

    performTest(test, tree, expected);
};

exports.NestedWithFloatGTComparison = function(test) {
    var tree = [
      [
        [
          "832586",
          "rand_subj_id"
        ],
        "&&",
        [
          [
            "subject",
            "node_type"
          ],
          "&&",
          [
            "male",
            "sex"
          ]
        ]
      ],
      "||",
      [
        "ver",
        ">",
        0.2
      ]
    ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"should":[
                       {"bool":{"must":[
                         {"term":{"rand_subj_id":"832586"}},
                         {"bool":{"must":[
                           {"term":{"node_type":"subject"}},
                           {"term":{"sex":"male"}}
                         ]}}
                       ]}},
                       {"range":{"ver":{"gt":0.2}}}
                     ]}}
                   ]}}};

    performTest(test, tree, expected);
};

exports.NestedWithFloatEQComparison = function(test) {
    var tree = [
      [
        [
          "832586",
          "rand_subj_id"
        ],
        "&&",
        [
          [
            "subject",
            "node_type"
          ],
          "&&",
          [
            "male",
            "sex"
          ]
        ]
      ],
      "||",
      [
        "ver",
        "==",
        0.2
      ]
    ];

    var expected = {"query":{"filtered":{"filter":[{"bool":{
                      "should":[{"bool":{"must":[{"term":{"rand_subj_id":"832586"}},
                                {"bool":{"must":[
                                          {"term":{"node_type":"subject"}},
                                          {"term":{"sex":"male"}}
                                        ]}}]}},
                                {"term":{"ver":0.2}}
                      ]
                   }}]}}};

    performTest(test, tree, expected);
};

exports.NestedWithFloatNEComparison = function(test) {
    var tree = [
      [
        [
          "832586",
          "rand_subj_id"
        ],
        "&&",
        [
          [
            "subject",
            "node_type"
          ],
          "&&",
          [
            "male",
            "sex"
          ]
        ]
      ],
      "||",
      [
        "ver",
        "!=",
        0.2
      ]
    ];

    var expected = {"query":{"filtered":{"filter":[
                     {"bool":{"should":[
                                {"bool":{"must":[
                                   {"term":{"rand_subj_id":"832586"}},
                                   {"bool":{"must":[{"term":{"node_type":"subject"}},
                                   {"term":{"sex":"male"}}]}}]}
                                },
                                {"bool":{"must_not":{"term":{"ver":0.2}}}}
                              ]
                     }}
                   ]}}};

    performTest(test, tree, expected);
};

exports.DottedFieldSearch = function(test) {
    var tree = [
            "text",
            "abc.efg"
            ];

    var expected = { "query":{ "filtered": {
                       "filter":[{"term":{"abc.efg":"text"}}]}
                     }
                   };

    performTest(test, tree, expected);
};

exports.SpaceInSearchText = function(test) {
    var tree = [
            "spaced text",
            "abc"
            ];

    var expected = { "query":{"filtered":{
                       "filter":[{"term":{"abc":"spaced text"}}]}
                     }
                   };

    performTest(test, tree, expected);
};

exports.MultiSpacesInSearchTextPreserved = function(test) {
    var tree = [
            "spaced   text",
            "abc"
            ];

    var expected = { "query":{"filtered":{
                       "filter":[{"term":{"abc":"spaced   text"}}]}
                     }
                   };

    performTest(test, tree, expected);
};


exports.DottedFieldWithMultiSpaceText = function(test) {
    var tree = [
            "spaced   text",
            "abc.def.ghi"
            ];

    var expected = { "query":{"filtered":{
                       "filter":[{"term":{"abc.def.ghi":"spaced   text"}}]}
                     }
                   };

    performTest(test, tree, expected);
};

function performTest(test, tree, expected) {
    test.expect(1);

    var result = oql2es.compile(tree);

    var differences = diff(result, expected);

    test.ok(differences === undefined, "Compiler produced expected output.");

    test.done();
}
