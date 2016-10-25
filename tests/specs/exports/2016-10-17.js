// from multiversejson
// specs/harmonics/constraints.coffee
//    describe "$(v-miss)", ->
//      describe "// v miss 1 child", ->

let config = {
  _class: '$config',
  _var_names_trie: null,
  _changedVarsTrie: null,
  _propagationBatch: 0,
  _propagationCycles: 0,
  _front: null,
  varStratConfig: {
    _class: '$var_strat_config',
    type: 'naive',
    priorityByName: undefined,
    _priorityByIndex: undefined,
    inverted: false,
    fallback: undefined,
  },
  valueStratName: 'min',
  targetedVars: [
    'ITEM_INDEX', 'ITEM_INDEX&n=1', 'ITEM_INDEX&n=2', 'ITEM_INDEX&n=3', 'ITEM_INDEX&n=4', 'ITEM_INDEX&n=5', 'width', 'width&n=1', 'width&n=2', 'width&n=3', 'width&n=4', 'width&n=5', '_ROOT_BRANCH_', 'SECTION', 'color', 'post_type', 'state', 'SECTION&n=1', 'color&n=1', 'post_type&n=1', 'state&n=1', 'SECTION&n=2', 'color&n=2', 'post_type&n=2', 'state&n=2', 'SECTION&n=3', 'color&n=3', 'post_type&n=3', 'state&n=3', 'SECTION&n=4', 'color&n=4', 'post_type&n=4', 'state&n=4', 'SECTION&n=5', 'color&n=5', 'post_type&n=5', 'state&n=5', 'VERSE_INDEX', 'VERSE_INDEX&n=1', 'VERSE_INDEX&n=2', 'VERSE_INDEX&n=3', 'VERSE_INDEX&n=4', 'VERSE_INDEX&n=5', '119', '120', '121', '122', '123', '124', '125',
  ],
  var_dist_options: {
    width: {list: [3, 1, 2, 4, 5, 6, 7, 8], valtype: 'list'},
    'width&n=1': {list: [3, 1, 2, 4, 5, 6, 7, 8], valtype: 'list'},
    'width&n=2': {list: [3, 1, 2, 4, 5, 6, 7, 8], valtype: 'list'},
    'width&n=3': {list: [3, 1, 2, 4, 5, 6, 7, 8], valtype: 'list'},
    'width&n=4': {list: [3, 1, 2, 4, 5, 6, 7, 8], valtype: 'list'},
    'width&n=5': {list: [3, 1, 2, 4, 5, 6, 7, 8], valtype: 'list'},
  },
  timeout_callback: undefined,
  all_var_names: [
    '0', '_ROOT_BRANCH_', 'SECTION', '3', '4', '5', '6', 'VERSE_INDEX', '8', 'ITEM_INDEX', '10', '11', 'width', 'color', 'post_type', 'state', 'SECTION&n=1', 'VERSE_INDEX&n=1', 'ITEM_INDEX&n=1', 'width&n=1', 'color&n=1', 'post_type&n=1', 'state&n=1', 'SECTION&n=2', 'VERSE_INDEX&n=2', 'ITEM_INDEX&n=2', 'width&n=2', 'color&n=2', 'post_type&n=2', 'state&n=2', 'SECTION&n=3', 'VERSE_INDEX&n=3', 'ITEM_INDEX&n=3', 'width&n=3', 'color&n=3', 'post_type&n=3', 'state&n=3', 'SECTION&n=4', 'VERSE_INDEX&n=4', 'ITEM_INDEX&n=4', 'width&n=4', 'color&n=4', 'post_type&n=4', 'state&n=4', 'SECTION&n=5', 'VERSE_INDEX&n=5', 'ITEM_INDEX&n=5', 'width&n=5', 'color&n=5', 'post_type&n=5', 'state&n=5', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125',
  ],
  all_constraints: [
    { _class: '$constraint', name: 'distinct', varIndexes: [9, 18, 25, 32, 39, 46], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [7, 4, 51], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [9, 2, 52], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [52, 51], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [17, 4, 53], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [18, 2, 54], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [54, 53], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [24, 4, 55], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [25, 2, 56], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [56, 55], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [31, 4, 57], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [32, 2, 58], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [58, 57], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [38, 4, 59], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [39, 2, 60], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [60, 59], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [7, 3, 61], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [9, 3, 62], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [62, 61], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [17, 3, 63], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [18, 3, 64], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [64, 63], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [24, 3, 65], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [25, 3, 66], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [66, 65], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [31, 3, 67], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [32, 3, 68], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [68, 67], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [38, 3, 69], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [39, 3, 70], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [70, 69], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [45, 3, 71], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [46, 3, 72], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [72, 71], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [7, 6, 73], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [9, 4, 74], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [74, 73], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [17, 6, 75], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [18, 4, 76], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [76, 75], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [24, 6, 77], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [25, 4, 78], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [78, 77], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [31, 6, 79], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [32, 4, 80], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [80, 79], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [38, 6, 81], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [39, 4, 82], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [82, 81], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [45, 6, 83], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [46, 4, 84], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [84, 83], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [7, 2, 85], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [9, 8, 86], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [86, 85], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [17, 2, 87], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [18, 8, 88], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [88, 87], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [24, 2, 89], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [25, 8, 90], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [90, 89], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [31, 2, 91], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [32, 8, 92], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [92, 91], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [38, 2, 93], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [39, 8, 94], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [94, 93], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [45, 2, 95], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [46, 8, 96], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [96, 95], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [7, 5, 97], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [9, 5, 98], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [98, 97], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [17, 5, 99], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [18, 5, 100], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [100, 99], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [24, 5, 101], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [25, 5, 102], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [102, 101], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [31, 5, 103], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [32, 5, 104], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [104, 103], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [38, 5, 105], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [39, 5, 106], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [106, 105], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [45, 5, 107], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [46, 5, 108], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [108, 107], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [17, 8, 109], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [18, 6, 110], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [110, 109], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [24, 8, 111], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [25, 6, 112], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [112, 111], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [31, 8, 113], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [32, 6, 114], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [114, 113], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [38, 8, 115], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [39, 6, 116], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [116, 115], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [45, 8, 117], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [46, 6, 118], param: 'eq' },
    { _class: '$constraint', name: 'eq', varIndexes: [118, 117], param: undefined },
    { _class: '$constraint', name: 'reifier', varIndexes: [12, 4, 120], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [19, 4, 121], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [26, 4, 122], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [33, 4, 123], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [40, 4, 124], param: 'eq' },
    { _class: '$constraint', name: 'reifier', varIndexes: [47, 4, 125], param: 'eq' }],
  constant_cache: {
    '0': 119,
    '1': 2,
    '2': 3,
    '3': 4,
    '4': 8,
    '5': 5,
    '6': 6,
    '7': 10,
    '8': 11,
  },
  initial_domains: [
    [1, 1], [1, 1], [1, 1], [2, 2], [3, 3], [5, 5], [6, 6], [1, 3, 5, 6], [4, 4], [1, 5], [7, 7], [8, 8], [1, 1, 3, 8], [1, 2], [1, 2], [1, 2], [1, 1], [1, 6], [1, 6], [1, 1, 3, 8], [1, 2], [1, 2], [1, 2], [1, 1], [1, 6], [1, 6], [1, 1, 3, 8], [1, 2], [1, 2], [1, 2], [1, 1], [1, 6], [1, 6], [1, 1, 3, 8], [1, 2], [1, 2], [1, 2], [1, 1], [1, 6], [1, 6], [1, 1, 3, 8], [1, 2], [1, 2], [1, 2], [1, 1], [1, 2, 4, 6], [2, 6], [1, 1, 3, 8], [1, 2], [1, 2], [1, 2], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 0], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1], [0, 1],
  ],
  _propagators: null,
  _varToPropagators: null,
  _constrainedAway: [
    1, 0, 2, 2, 7, 2, 9, 2, 12, 2, 13, 2, 14, 2, 15, 2, 16, 2, 17, 2, 18, 2, 19, 2, 20, 2, 21, 2, 22, 2, 23, 2, 24, 2, 25, 2, 26, 2, 27, 2, 28, 2, 29, 2, 30, 2, 31, 2, 32, 2, 33, 2, 34, 2, 35, 2, 36, 2, 37, 2, 38, 2, 39, 2, 40, 2, 41, 2, 42, 2, 43, 2, 44, 2, 45, 2, 46, 2, 47, 2, 48, 2, 49, 2, 50, 2,
  ],
};

export default config;