// this is an import function for config
// it converts a DSL string to a $config
// see /docs/dsl.txt for syntax
// see exporter.js to convert a config to this DSL
import {
  SUB,
  SUP,
  ASSERT,
  ASSERT_LOG2,
} from './helpers';
import {
  ML_VV_EQ,
  ML_V8_EQ,
  ML_88_EQ,
  ML_VV_NEQ,
  ML_V8_NEQ,
  ML_88_NEQ,
  ML_VV_LT,
  ML_V8_LT,
  ML_8V_LT,
  ML_88_LT,
  ML_VV_LTE,
  ML_V8_LTE,
  ML_8V_LTE,
  ML_88_LTE,
  ML_VVV_ISEQ,
  ML_V8V_ISEQ,
  ML_VV8_ISEQ,
  ML_88V_ISEQ,
  ML_V88_ISEQ,
  ML_888_ISEQ,
  ML_VVV_ISNEQ,
  ML_V8V_ISNEQ,
  ML_VV8_ISNEQ,
  ML_88V_ISNEQ,
  ML_V88_ISNEQ,
  ML_888_ISNEQ,
  ML_VVV_ISLT,
  ML_8VV_ISLT,
  ML_V8V_ISLT,
  ML_VV8_ISLT,
  ML_88V_ISLT,
  ML_V88_ISLT,
  ML_8V8_ISLT,
  ML_888_ISLT,
  ML_VVV_ISLTE,
  ML_8VV_ISLTE,
  ML_V8V_ISLTE,
  ML_VV8_ISLTE,
  ML_88V_ISLTE,
  ML_V88_ISLTE,
  ML_8V8_ISLTE,
  ML_888_ISLTE,
  ML_NALL,
  ML_ISALL,
  ML_ISNALL,
  ML_ISNONE,
  ML_8V_SUM,
  ML_PRODUCT,
  ML_DISTINCT,
  ML_PLUS,
  ML_MINUS,
  ML_MUL,
  ML_DIV,
  ML_VV_AND,
  ML_VV_OR,
  ML_VV_XOR,
  ML_VV_NAND,
  ML_VV_XNOR,
  ML_START,
  ML_STOP,
  ML_NOOP,
  ML_NOOP2,
  ML_NOOP3,
  ML_NOOP4,
  ML_JMP,
  ML_DEBUG,

  SIZEOF_V,
  //SIZEOF_VV,
  //SIZEOF_8V,
  //SIZEOF_V8,
  //SIZEOF_88,
  //SIZEOF_VVV,
  //SIZEOF_8VV,
  //SIZEOF_V8V,
  //SIZEOF_VV8,
  //SIZEOF_88V,
  //SIZEOF_V88,
  //SIZEOF_8V8,
  //SIZEOF_888,
  //SIZEOF_COUNT,
} from './ml';
import {
  domain_createRange,
  domain_createValue,
  domain_toArr,
} from './domain';

// BODY_START

/**
 * Compile the constraint dsl to a bytecode
 *
 * @param {string} str
 * @param {Function} addVar
 * @param {Function} nameToIndex
 * @param {boolean} [_debug] Improved error reporting when true
 * @returns {string}
 */
function dslToMl(str, addVar, nameToIndex, _debug) {
  let ret = {
    mlString: '',
    varstrat: 'default',
    valstrat: 'default',
  };
  let ml = '';
  ml += encode8bit(ML_START);
  let constraintCount = 0;

  let pointer = 0;
  let len = str.length;

  while (!isEof()) parseStatement();

  ret.mlString = ml + encode8bit(ML_STOP);
  console.log('# dslToMl: parsed', constraintCount, 'constraints');
  return ret;

  function read() {
    return str[pointer];
  }

  function skip() {
    ++pointer;
  }

  function is(c, desc) {
    if (read() !== c) THROW('Expected ' + (desc + ' ' || '') + '`' + c + '`, found `' + read() + '`');
    skip();
  }

  function skipWhitespaces() {
    while (pointer < len && isWhitespace(read())) skip();
  }

  function skipWhites() {
    while (!isEof()) {
      let c = read();
      if (isWhite(c)) {
        skip();
      } else if (isComment(c)) {
        skipComment();
      } else {
        break;
      }
    }
  }

  function isWhitespace(s) {
    return s === ' ' || s === '\t';
  }

  function isNewline(s) {
    // no, I don't feel bad for also flaggin a comment as eol :)
    return s === '\n' || s === '\r';
  }

  function isComment(s) {
    return s === '#';
  }

  function isWhite(s) {
    return isWhitespace(s) || isNewline(s);
  }

  function expectEol() {
    skipWhitespaces();
    if (pointer < len) {
      let c = read();
      if (c === '#') {
        skipComment();
      } else if (isNewline(c)) {
        skip();
      } else {
        THROW('Expected EOL but got `' + read() + '`');
      }
    }
  }

  function isEof() {
    return pointer >= len;
  }

  function parseStatement() {
    // either:
    // - start with colon: var decl
    // - start with hash: line comment
    // - empty: empty
    // - otherwise: constraint

    skipWhites();
    switch (read()) {
      case ':':
        return parseVar();
      case '#':
        return skipComment();
      case '@':
        return parseAtRule();
      default:
        if (!isEof()) return parseVoidConstraint();
    }
  }

  function parseVar() {
    skip(); // is(':')
    skipWhitespaces();
    let nameNames = parseIdentifier();
    skipWhitespaces();
    if (read() === ',') {
      nameNames = [nameNames];
      while (!isEof() && read() === ',') {
        skip();
        skipWhitespaces();
        nameNames.push(parseIdentifier());
        skipWhitespaces();
      }
    }
    let domain = parseDomain();
    skipWhitespaces();
    let alts;
    while (str.slice(pointer, pointer + 6) === 'alias(') {
      if (!alts) alts = [];
      alts.push(parseAlias(pointer += 6));
      skipWhitespaces();
    }
    let mod = parseModifier();
    expectEol();

    if (typeof nameNames === 'string') {
      if (nameToIndex(nameNames) >= 0) {
        return THROW('Dont declare a var after using it');
      }
      addVar(nameNames, domain, mod);
    } else {
      nameNames.map(name => {
        if (nameToIndex(name) >= 0) {
          return THROW('Dont declare a var after using it');
        }
        addVar(name, domain, mod);
      });
    }

    if (alts) THROW('implement me (var alias)'); // alts.map(name => addVar(name, domain, mod));
  }

  function parseIdentifier() {
    if (read() === '\'') return parseQuotedIdentifier();
    else return parseUnquotedIdentifier();
  }

  function parseQuotedIdentifier() {
    is('\'');

    let start = pointer;
    while (!isEof() && read() !== '\'') skip();
    if (isEof()) THROW('Quoted identifier must be closed');
    if (start === pointer) THROW('Expected to parse identifier, found none');
    skip(); // quote
    return str.slice(start, pointer - 1); // return unquoted ident
  }

  function parseUnquotedIdentifier() {
    // anything terminated by whitespace
    let start = pointer;
    if (read() >= '0' && read() <= '9') THROW('Unquoted ident cant start with number');
    while (!isEof() && isValidUnquotedIdentChar(read())) skip();
    if (isEof()) THROW('Quoted identifier must be closed');
    if (start === pointer) THROW('Expected to parse identifier, found none');
    return str.slice(start, pointer);
  }

  function isValidUnquotedIdentChar(c) {
    switch (c) {
      case '(':
      case ')':
      case ',':
      case '[':
      case ']':
      case '\'':
      case '#':
        return false;
    }
    if (isWhite(c)) return false;
    return true;
  }

  function parseAlias() {
    skipWhitespaces();

    let start = pointer;
    while (true) {
      let c = read();
      if (c === ')') break;
      if (isNewline(c)) THROW('Alias must be closed with a `)` but wasnt (eol)');
      if (isEof()) THROW('Alias must be closed with a `)` but wasnt (eof)');
      skip();
    }
    let alias = str.slice(start, pointer);
    if (!alias) THROW('The alias() can not be empty but was');

    skipWhitespaces();
    is(')', '`alias` to be closed by `)`');

    return alias;
  }

  function parseDomain() {
    // []
    // [lo hi]
    // [[lo hi] [lo hi] ..]
    // *
    // 25
    // (comma's optional and ignored)

    let c = read();
    if (c === '=') {
      skip();
      skipWhitespaces();
      c = read();
    }

    let domain;
    switch (c) {
      case '[':

        is('[', 'domain start');
        skipWhitespaces();

        domain = [];

        if (read() === '[') {
          do {
            skip();
            skipWhitespaces();
            let lo = parseNumber();
            skipWhitespaces();
            if (read() === ',') {
              skip();
              skipWhitespaces();
            }
            let hi = parseNumber();
            skipWhitespaces();
            is(']', 'range-end');
            skipWhitespaces();

            domain.push(lo, hi);

            if (read() === ',') {
              skip();
              skipWhitespaces();
            }
          } while (read() === '[');
        } else if (read() !== ']') {
          do {
            skipWhitespaces();
            let lo = parseNumber();
            skipWhitespaces();
            if (read() === ',') {
              skip();
              skipWhitespaces();
            }
            let hi = parseNumber();
            skipWhitespaces();

            domain.push(lo, hi);

            if (read() === ',') {
              skip();
              skipWhitespaces();
            }
          } while (read() !== ']');
        }

        is(']', 'domain-end');
        return domain;

      case '*':
        skip();
        return [SUB, SUP];

      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        let v = parseNumber();
        skipWhitespaces();
        return [v, v];
    }

    THROW('Expecting valid domain start, found `' + c + '`');
  }

  function parseModifier() {
    if (read() !== '@') return;
    skip();

    let mod = {};

    let start = pointer;
    while (read() >= 'a' && read() <= 'z') skip();
    let stratName = str.slice(start, pointer);

    switch (stratName) {
      case 'list':
        parseList(mod);
        break;

      case 'markov':
        parseMarkov(mod);
        break;

      case 'max':
      case 'mid':
      case 'min':
      case 'minMaxCycle':
      case 'naive':
      case 'splitMax':
      case 'splitMin':
        break;

      default:
        THROW('Expecting a strategy name after the `@` modifier (`' + stratName + '`)');
    }

    mod.valtype = stratName;

    return mod;
  }

  function parseList(mod) {
    skipWhitespaces();
    if (str.slice(pointer, pointer + 5) !== 'prio(') THROW('Expecting the priorities to follow the `@list`');
    pointer += 5;
    mod.list = parseNumList();
    is(')', 'list end');
  }

  function parseMarkov(mod) {
    while (true) {
      skipWhitespaces();
      if (str.slice(pointer, pointer + 7) === 'matrix(') {
        // TOFIX: there is no validation here. apply stricter and safe matrix parsing
        let matrix = str.slice(pointer + 7, pointer = str.indexOf(')', pointer));
        let code = 'return ' + matrix;
        let func = Function(code);
        /* eslint no-new-func: "off" */
        mod.matrix = func();
        if (pointer === -1) THROW('The matrix must be closed by a `)` but did not find any');
      } else if (str.slice(pointer, pointer + 7) === 'legend(') {
        pointer += 7;
        mod.legend = parseNumList();
        skipWhitespaces();
        is(')', 'legend closer');
      } else if (str.slice(pointer, pointer + 7) === 'expand(') {
        pointer += 7;
        mod.expandVectorsWith = parseNumber();
        skipWhitespaces();
        is(')', 'expand closer');
      } else {
        break;
      }
      skip();
    }
  }

  function skipComment() {
    is('#', 'comment start'); //is('#', 'comment hash');
    while (!isEof() && !isNewline(read())) skip();
    if (!isEof()) skip();
  }

  function encode8bit(num) {
    ASSERT(typeof num === 'number' && num >= 0 && num <= 0xff, 'OOB number');
    ASSERT_LOG2('encode8bit:', num);
    return String.fromCharCode(num);
  }

  function encodeNameOrLiteral(name, addVar) {
    if (typeof name === 'number') {
      ASSERT_LOG2('dsl parser; encodeNameOrLiteral will generate an anon var for a number');
      name = addVar(undefined, name, false, true);
    }
    return encodeName(name);
  }

  function encodeName(name) {
    return encode16bit(nameToIndexSafe(name));
  }

  function encodeNameOrDie(name) {
    return encode16bit(nameToIndexSafe(name, true));
  }

  function nameToIndexSafe(name, mustExist) {
    if (typeof name !== 'string') THROW('Expecting name to be a string:' + name);
    ASSERT_LOG2('encoding name:', name);
    ASSERT_LOG2('to index', nameToIndex(name));
    let index = nameToIndex(name);
    if (index < 0) {
      if (mustExist) THROW('Required var to be declared but it was not: [' + name + ']');
      index = addVar(name, undefined, false, false, true);
    }
    return index;
  }

  function encode16bit(index) {
    ASSERT_LOG2('encode16bit:', index, '->', index >> 8, index & 0xff);
    ASSERT(typeof index === 'number', 'Encoding 16bit must be num', typeof index, index);
    ASSERT(index >= 0, 'OOB index', index);
    ASSERT(index <= 0xffff, 'implement 32bit index support if this breaks', index);
    let s = String.fromCharCode(index >> 8, index & 0xff);
    if (s.length === 1) return '\0' + s;
    return s;
  }

  function parseVoidConstraint() {
    // parse a constraint that does not return a value itself

    // first try to parse single value constraints without value like markov() and distinct()
    if (parseUexpr()) return;

    // so the first value must be a value returning expr
    let A = parseVexpr(); // returns a var name or a constant value

    skipWhitespaces();
    let cop = parseCop();
    skipWhitespaces();

    if (cop === '=') {
      parseAssignment(A);
    } else if (cop) {
      let B = parseVexpr();
      compileVoidConstraint(A, cop, B);
    }

    expectEol();
  }

  function compileVoidConstraint(A, cop, B) {
    ++constraintCount;
    // literals are only supported as 8bit values, otherwise just compile it as a solved var
    let codeA = typeof A === 'number' ? A <= 0xff ? '8' : (A = addVar(undefined, A, false, true), 'V') : 'V';
    let codeB = typeof B === 'number' ? B <= 0xff ? '8' : (B = addVar(undefined, B, false, true), 'V') : 'V';
    switch (codeA + cop + codeB) {
      case 'V==V':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV_EQ) + encode16bit(A) + encode16bit(B);
        else ml += encode8bit(ML_VV_EQ) + encode16bit(B) + encode16bit(A);
        break;
      case 'V==8':
        ml += encode8bit(ML_V8_EQ) + encodeName(A) + encode8bit(B);
        break;
      case '8==V':
        ml += encode8bit(ML_V8_EQ) + encodeName(B) + encode8bit(A);
        break;
      case '8==8':
        ml += encode8bit(ML_88_EQ) + encode8bit(A) + encode8bit(B);
        break;

      case 'V!=V':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV_NEQ) + encode16bit(A) + encode16bit(B);
        else ml += encode8bit(ML_VV_NEQ) + encode16bit(B) + encode16bit(A);
        break;
      case 'V!=8':
        ml += encode8bit(ML_V8_NEQ) + encodeName(A) + encode8bit(B);
        break;
      case '8!=V':
        ml += encode8bit(ML_V8_NEQ) + encodeName(B) + encode8bit(A);
        break;
      case '8!=8':
        ml += encode8bit(ML_88_NEQ) + encode8bit(A) + encode8bit(B);
        break;

      case 'V<V':
        ml += encode8bit(ML_VV_LT) + encodeName(A) + encodeName(B);
        break;
      case 'V<8':
        ml += encode8bit(ML_V8_LT) + encodeName(A) + encode8bit(B);
        break;
      case '8<V':
        ml += encode8bit(ML_8V_LT) + encode8bit(A) + encodeName(B);
        break;
      case '8<8':
        ml += encode8bit(ML_88_LT) + encode8bit(A) + encode8bit(B);
        break;

      case 'V<=V':
        ml += encode8bit(ML_VV_LTE) + encodeName(A) + encodeName(B);
        break;
      case 'V<=8':
        ml += encode8bit(ML_V8_LTE) + encodeName(A) + encode8bit(B);
        break;
      case '8<=V':
        ml += encode8bit(ML_8V_LTE) + encode8bit(A) + encodeName(B);
        break;
      case '8<=8':
        ml += encode8bit(ML_88_LTE) + encode8bit(A) + encode8bit(B);
        break;

      case 'V>V':
        ml += encode8bit(ML_VV_LT) + encodeName(B) + encodeName(A);
        break;
      case 'V>8':
        ml += encode8bit(ML_8V_LT) + encode8bit(B) + encodeName(A);
        break;
      case '8>V':
        ml += encode8bit(ML_V8_LT) + encodeName(B) + encode8bit(A);
        break;
      case '8>8':
        ml += encode8bit(ML_88_LT) + encode8bit(B) + encode8bit(A);
        break;

      case 'V>=V':
        ml += encode8bit(ML_VV_LTE) + encodeName(B) + encodeName(A);
        break;
      case 'V>=8':
        ml += encode8bit(ML_8V_LTE) + encode8bit(B) + encodeName(A);
        break;
      case '8>=V':
        ml += encode8bit(ML_V8_LTE) + encodeName(B) + encode8bit(A);
        break;
      case '8>=8':
        ml += encode8bit(ML_88_LTE) + encode8bit(B) + encode8bit(A);
        break;

      case 'V&V':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV_AND) + encode16bit(A) + encode16bit(B);
        else ml += encode8bit(ML_VV_AND) + encode16bit(B) + encode16bit(A);
        break;
      case '8&V':
        ml += encode8bit(ML_VV_AND) + encodeName(B) + encodeNameOrLiteral(A);
        break;
      case 'V&8':
        ml += encode8bit(ML_VV_AND) + encodeNameOrLiteral(B) + encodeName(A);
        break;
      case '8&8':
        ml += encode8bit(ML_VV_AND) + encodeNameOrLiteral(B) + encodeNameOrLiteral(A);
        break;

      case 'V|V':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV_OR) + encode16bit(A) + encode16bit(B);
        else ml += encode8bit(ML_VV_OR) + encode16bit(B) + encode16bit(A);
        break;
      case '8|V':
        ml += encode8bit(ML_VV_OR) + encodeName(B) + encodeNameOrLiteral(A);
        break;
      case 'V|8':
        ml += encode8bit(ML_VV_OR) + encodeNameOrLiteral(B) + encodeName(A);
        break;
      case '8|8':
        ml += encode8bit(ML_VV_OR) + encodeNameOrLiteral(B) + encodeNameOrLiteral(A);
        break;

      case 'V^V':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV_XOR) + encode16bit(A) + encode16bit(B);
        else ml += encode8bit(ML_VV_XOR) + encode16bit(B) + encode16bit(A);
        break;
      case '8^V':
        ml += encode8bit(ML_VV_XOR) + encodeName(B) + encodeNameOrLiteral(A);
        break;
      case 'V^8':
        ml += encode8bit(ML_VV_XOR) + encodeNameOrLiteral(B) + encodeName(A);
        break;
      case '8^8':
        ml += encode8bit(ML_VV_XOR) + encodeNameOrLiteral(B) + encodeNameOrLiteral(A);
        break;

      case 'V!&V':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV_NAND) + encode16bit(A) + encode16bit(B);
        else ml += encode8bit(ML_VV_NAND) + encode16bit(B) + encode16bit(A);
        break;
      case '8!&V':
        ml += encode8bit(ML_VV_NAND) + encodeNameOrLiteral(B) + encodeName(A);
        break;
      case 'V!&8':
        ml += encode8bit(ML_VV_NAND) + encodeNameOrLiteral(B) + encodeName(A);
        break;
      case '8!&8':
        ml += encode8bit(ML_VV_NAND) + encodeNameOrLiteral(B) + encodeNameOrLiteral(A);
        break;

      case 'V!^V':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV_XNOR) + encode16bit(A) + encode16bit(B);
        else ml += encode8bit(ML_VV_XNOR) + encode16bit(B) + encode16bit(A);
        break;
      case '8!^V':
        ml += encode8bit(ML_VV_XNOR) + encodeName(B) + encodeNameOrLiteral(A);
        break;
      case 'V!^8':
        ml += encode8bit(ML_VV_XNOR) + encodeNameOrLiteral(B) + encodeName(A);
        break;
      case '8!^8':
        ml += encode8bit(ML_VV_XNOR) + encodeNameOrLiteral(B) + encodeNameOrLiteral(A);
        break;

      default:
        THROW('Unknown constraint op: [' + cop + ']');
    }
  }

  function createResultVar(from, forceBool, noLit) {
    ASSERT_LOG2('createResultVar', from, forceBool, noLit);
    ASSERT(typeof from === 'string' || typeof from === 'number' || from === undefined, 'input can only be a string (name) or number (literal) or undefined (new var reflects result for something else)');

    if (from === undefined) {
      return addVar(undefined, forceBool ? [0, 1] : undefined, false, true);
    }

    if (typeof from === 'number') {
      // a literal that is >1 where a bool is expected will always result in a problem (bad input problem)
      if (forceBool && from > 1) return addVar(undefined, [], false, true);
      // only supporting literals of 8bit. in some cases literals still need to become temp anon vars when the op doesnt have a lit version for it.
      if (from > 0xff || noLit) return addVar(undefined, (forceBool && from > 1) ? [] : domain_createValue(from), false, true);
      return from;
    }

    if (nameToIndex(from) < 0) return addVar(from, forceBool ? domain_toArr(domain_createRange(0, 1)) : undefined, false, true);
    return from;
  }

  function parseAssignment(C) {
    let A = parseVexpr(C);
    skipWhitespaces();
    let c = read();
    if (isEof() || isNewline(c) || isComment(c)) {
      // any var, literal, or group without "top-level" op (`A=5`, `A=X`, `A=(B+C)`, `A=sum(...)`, etc)
      if (A !== C) {
        C = createResultVar(C); // wont change for 8bit literals or existing vars
        compileVoidConstraint(A, '==', C);
      }
    } else {
      parseAssignRest(A, C);
    }
  }

  function parseAssignRest(A, C) {
    let rop = parseRop();
    skipWhitespaces();
    let B = parseVexpr();

    return _parseAssignRest(A, rop, B, C);
  }

  function _parseAssignRest(A, rop, B, C) {
    ++constraintCount;

    // force fresh reifier result vars to a bool
    C = createResultVar(C, rop[rop.length - 1] === '?'); // wont change for 8bit literals or existing vars

    // literals are only supported as 8bit values, otherwise just compile it as a solved var
    let codeA = typeof A === 'number' ? A <= 0xff ? '8' : (A = addVar(undefined, A, false, true), 'V') : 'V';
    let codeB = typeof B === 'number' ? B <= 0xff ? '8' : (B = addVar(undefined, B, false, true), 'V') : 'V';
    let codeC = typeof C === 'number' ? '8' : 'V'; // check already done above

    switch (codeA + rop + codeB + codeC) {
      case 'V==?VV':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VVV_ISEQ) + encode16bit(A) + encode16bit(B) + encodeName(C);
        else ml += encode8bit(ML_VVV_ISEQ) + encode16bit(B) + encode16bit(A) + encodeName(C);
        break;
      case '8==?VV':
        ml += encode8bit(ML_V8V_ISEQ) + encodeName(B) + encode8bit(A) + encodeName(C);
        break;
      case 'V==?8V':
        ml += encode8bit(ML_V8V_ISEQ) + encodeName(A) + encode8bit(B) + encodeName(C);
        break;
      case 'V==?V8':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV8_ISEQ) + encode16bit(A) + encode16bit(B) + encode8bit(C);
        else ml += encode8bit(ML_VV8_ISEQ) + encode16bit(B) + encode16bit(A) + encode8bit(C);
        break;
      case '8==?8V':
        ml += encode8bit(ML_88V_ISEQ) + encode8bit(A) + encode8bit(B) + encodeName(C);
        break;
      case 'V==?88':
        ml += encode8bit(ML_V88_ISEQ) + encodeName(A) + encode8bit(B) + encode8bit(C);
        break;
      case '8==?V8':
        ml += encode8bit(ML_V88_ISEQ) + encodeName(B) + encode8bit(A) + encode8bit(C);
        break;
      case '8==?88':
        ml += encode8bit(ML_888_ISEQ) + encode8bit(A) + encode8bit(B) + encode8bit(C);
        break;

      case 'V!=?VV':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VVV_ISNEQ) + encode16bit(A) + encode16bit(B) + encodeName(C);
        else ml += encode8bit(ML_VVV_ISNEQ) + encode16bit(B) + encode16bit(A) + encodeName(C);
        break;
      case '8!=?VV':
        ml += encode8bit(ML_V8V_ISNEQ) + encodeName(B) + encode8bit(A) + encodeName(C);
        break;
      case 'V!=?8V':
        ml += encode8bit(ML_V8V_ISNEQ) + encodeName(A) + encode8bit(B) + encodeName(C);
        break;
      case 'V!=?V8':
        A = nameToIndexSafe(A);
        B = nameToIndexSafe(B);
        if (A < B) ml += encode8bit(ML_VV8_ISNEQ) + encode16bit(A) + encode16bit(B) + encode8bit(C);
        else ml += encode8bit(ML_VV8_ISNEQ) + encode16bit(B) + encode16bit(A) + encode8bit(C);
        break;
      case '8!=?8V':
        ml += encode8bit(ML_88V_ISNEQ) + encode8bit(A) + encode8bit(B) + encodeName(C);
        break;
      case 'V!=?88':
        ml += encode8bit(ML_V88_ISNEQ) + encodeName(A) + encode8bit(B) + encode8bit(C);
        break;
      case '8!=?V8':
        ml += encode8bit(ML_V88_ISNEQ) + encodeName(B) + encode8bit(A) + encode8bit(C);
        break;
      case '8!=?88':
        ml += encode8bit(ML_888_ISNEQ) + encode8bit(A) + encode8bit(B) + encode8bit(C);
        break;

      case 'V<?VV':
        ml += encode8bit(ML_VVV_ISLT) + encodeName(A) + encodeName(B) + encodeName(C);
        break;
      case '8<?VV':
        ml += encode8bit(ML_8VV_ISLT) + encode8bit(A) + encodeName(B) + encodeName(C);
        break;
      case 'V<?8V':
        ml += encode8bit(ML_V8V_ISLT) + encodeName(A) + encode8bit(B) + encodeName(C);
        break;
      case 'V<?V8':
        ml += encode8bit(ML_VV8_ISLT) + encodeName(A) + encodeName(B) + encode8bit(C);
        break;
      case '8<?8V':
        ml += encode8bit(ML_88V_ISLT) + encode8bit(A) + encode8bit(B) + encodeName(C);
        break;
      case 'V<?88':
        ml += encode8bit(ML_V88_ISLT) + encodeName(A) + encode8bit(B) + encode8bit(C);
        break;
      case '8<?V8':
        ml += encode8bit(ML_8V8_ISLT) + encode8bit(A) + encodeName(B) + encode8bit(C);
        break;
      case '8<?88':
        ml += encode8bit(ML_888_ISLT) + encode8bit(A) + encode8bit(B) + encode8bit(C);
        break;

      case 'V<=?VV':
        ml += encode8bit(ML_VVV_ISLTE) + encodeName(A) + encodeName(B) + encodeName(C);
        break;
      case '8<=?VV':
        ml += encode8bit(ML_8VV_ISLTE) + encode8bit(A) + encodeName(B) + encodeName(C);
        break;
      case 'V<=?8V':
        ml += encode8bit(ML_V8V_ISLTE) + encodeName(A) + encode8bit(B) + encodeName(C);
        break;
      case 'V<=?V8':
        ml += encode8bit(ML_VV8_ISLTE) + encodeName(A) + encodeName(B) + encode8bit(C);
        break;
      case '8<=?8V':
        ml += encode8bit(ML_88V_ISLTE) + encode8bit(A) + encode8bit(B) + encodeName(C);
        break;
      case 'V<=?88':
        ml += encode8bit(ML_V88_ISLTE) + encodeName(A) + encode8bit(B) + encode8bit(C);
        break;
      case '8<=?V8':
        ml += encode8bit(ML_8V8_ISLTE) + encode8bit(A) + encodeName(B) + encode8bit(C);
        break;
      case '8<=?88':
        ml += encode8bit(ML_888_ISLTE) + encode8bit(A) + encode8bit(B) + encode8bit(C);
        break;

      default:
        if (rop === '>?') return _parseAssignRest(B, '<?', A, C);
        if (rop === '>=?') return _parseAssignRest(B, '<=?', A, C);
        if (rop === undefined) return A;

        if (typeof A === 'number') {
          ASSERT_LOG2('dsl parser; encodeNameOrLiteral will generate an anon var for a number');
          A = addVar(undefined, A, false, false, true);
        } else {
          A = nameToIndexSafe(A);
        }
        if (typeof B === 'number') {
          ASSERT_LOG2('dsl parser; encodeNameOrLiteral will generate an anon var for a number');
          B = addVar(undefined, B, false, false, true);
        } else {
          B = nameToIndexSafe(B);
        }

        let opCode;
        let fixed = false;
        switch (rop) {
          case '+':
            opCode = ML_PLUS;
            break;
          case '-':
            opCode = ML_MINUS;
            fixed = true;
            break;
          case '*':
            opCode = ML_MUL;
            break;
          case '/':
            opCode = ML_DIV;
            fixed = true;
            break;
          default:
            return THROW('Unknown rop: `' + rop + '`');
        }

        if (fixed || A < B) ml += encode8bit(opCode) + encode16bit(A) + encode16bit(B) + encodeNameOrLiteral(C, addVar);
        else ml += encode8bit(opCode) + encode16bit(B) + encode16bit(A) + encodeNameOrLiteral(C, addVar);
    }
  }

  function parseCop() {
    let c = read();
    switch (c) {
      case '=':
        skip();
        if (read() === '=') {
          skip();
          return '==';
        }
        return '=';
      case '!':
        skip();
        if (read() === '=') {
          skip();
          return '!=';
        }
        if (read() === '&') {
          skip();
          return '!&';
        }
        if (read() === '^') {
          skip();
          return '!^';
        }
        return '!';
      case '<':
        skip();
        if (read() === '=') {
          skip();
          return '<=';
        }
        return '<';
      case '>':
        skip();
        if (read() === '=') {
          skip();
          return '>=';
        }
        return '>';
      case '&':
        skip();
        return '&';
      case '|':
        skip();
        return '|';
      case '^':
        skip();
        return '^';
      case '#':
        THROW('Expected to parse a cop but found a comment instead');
        break;
      default:
        if (isEof()) THROW('Expected to parse a cop but reached eof instead');
        THROW('Unknown cop char: `' + c + '`');
    }
  }

  function parseRop() {
    let a = read();
    switch (a) {
      case '=':
        skip();
        let b = read();
        if (b === '=') {
          skip();
          is('?', 'reifier suffix');
          return '==?';
        } else {
          return '=';
        }

      case '!':
        skip();
        is('=', 'middle part of !=? op');
        is('?', 'reifier suffix');
        return '!=?';

      case '<':
        skip();
        if (read() === '=') {
          skip();
          is('?', 'reifier suffix');
          return '<=?';
        } else {
          is('?', 'reifier suffix');
          return '<?';
        }

      case '>':
        skip();
        if (read() === '=') {
          skip();
          is('?', 'reifier suffix');
          return '>=?';
        } else {
          is('?', 'reifier suffix');
          return '>?';
        }

      case '+':
      case '-':
      case '*':
      case '/':
        skip();
        return a;

      default:
        THROW('Wanted to parse a rop but next char is `' + a + '`');
    }
  }

  function parseUexpr() {
    // it's not very efficient (we could parse an ident before and check that result here) but it'll work for now
    if (str.slice(pointer, pointer + 9) === 'distinct(') parseCalledListConstraint(ML_DISTINCT, 9);
    else if (str.slice(pointer, pointer + 5) === 'nall(') parseCalledListConstraint(ML_NALL, 5);
    else return false;

    return true;
  }

  function parseCalledListConstraint(opcode, delta) {
    ++constraintCount;
    pointer += delta;
    skipWhitespaces();
    let vals = parseVexpList();
    ASSERT(vals.length <= 255, 'dont do lists with more than 255 vars :(');
    ml += encode8bit(opcode) + encode16bit(vals.length) + vals.map(encodeName).join('');
    skipWhitespaces();
    is(')', 'parseCalledListConstraint call closer');
    expectEol();
  }

  function parseVexpList() {
    let list = [];
    skipWhitespaces();
    while (!isEof() && read() !== ')') {
      let v = parseVexpr();
      list.push(v);

      skipWhitespaces();
      if (read() === ',') {
        skip();
        skipWhitespaces();
      }
    }
    return list;
  }

  function parseVexpr(resultVar) {
    // valcall, ident, number, group

    let c = read();
    let v;
    if (c === '(') v = parseGrouping();
    else if (c === '[') {
      let d = parseDomain();
      if (d[0] === d[1] && d.length === 2) v = d[0];
      else v = addVar(undefined, d, false, true);
    } else if (c >= '0' && c <= '9') {
      v = parseNumber();
    } else {
      let ident = parseIdentifier();

      if (read() === '(') {
        if (ident === 'sum') v = parseSum(resultVar);
        else if (ident === 'product') v = parseArgs(ML_PRODUCT, resultVar);
        else if (ident === 'all?') v = parseArgs(ML_ISALL, resultVar, true);
        else if (ident === 'nall?') v = parseArgs(ML_ISNALL, resultVar, true);
        else if (ident === 'none?') v = parseArgs(ML_ISNONE, resultVar, true);
        else THROW('Unknown constraint func: ' + ident);
      } else {
        v = ident;
      }
    }

    return v;
  }

  function parseGrouping() {
    is('(', 'group open');
    skipWhitespaces();
    let A = parseVexpr();
    skipWhitespaces();

    if (read() === '=') {
      if (read() !== '=') {
        parseAssignment(A);
        skipWhitespaces();
        is(')', 'group closer');
        return A;
      }
    }

    if (read() === ')') {
      // just wrapping a vexpr is okay
      skip();
      return A;
    }

    let C = parseAssignRest(A);
    skipWhitespaces();
    is(')', 'group closer');
    return C;
  }

  function parseNumber() {
    let start = pointer;
    while (!isEof() && read() >= '0' && read() <= '9') skip();
    if (start === pointer) {
      THROW('Expecting to parse a number but did not find any digits [' + start + ',' + pointer + '][' + read() + ']');
    }
    return parseInt(str.slice(start, pointer), 10);
  }

  function parseSum(result) {
    ++constraintCount;
    is('(', 'sum call opener');
    skipWhitespaces();
    let refs = parseVexpList();
    result = createResultVar(result, false, true);
    ASSERT_LOG2('parseSum refs:', refs, 'result:', result, nameToIndex(result));
    ml += encode8bit(ML_8V_SUM) + encode16bit(refs.length) + encode8bit(0) + refs.map(r => {
      if (typeof r === 'number') {
        // have to make temp var for this :(
        r = addVar(undefined, r, false, true);
      }
      return encodeName(r);
    }).join('') + encodeName(result);
    skipWhitespaces();
    is(')', 'sum closer');
    return result;
  }

  function parseArgs(op, result, defaultBoolResult) {
    ++constraintCount;
    is('(', 'args call opener');
    skipWhitespaces();
    let refs = parseVexpList();
    result = createResultVar(result, defaultBoolResult, true);
    ASSERT_LOG2('parseArgs refs:', refs, 'result:', result, nameToIndex(result), 'defaultBoolResult:', defaultBoolResult);
    ml += encode8bit(op) + encode16bit(refs.length) + refs.map(r => {
      if (typeof r === 'number') {
        // have to make temp var for this :(
        r = addVar(undefined, r, false, true);
      }
      return encodeName(r);
    }).join('') + encodeName(result);
    skipWhitespaces();
    is(')', 'args closer');
    return result;
  }

  function parseNumstr() {
    let start = pointer;
    while (!isEof() && read() >= '0' && read() <= '9') skip();
    return str.slice(start, pointer);
  }

  function parseNumList() {
    let nums = [];

    skipWhitespaces();
    let numstr = parseNumstr();
    while (numstr) {
      nums.push(parseInt(numstr, 10));
      skipWhitespaces();
      if (read() === ',') {
        ++pointer;
        skipWhitespaces();
      }
      numstr = parseNumstr();
    }

    if (!nums.length) THROW('Expected to parse a list of at least some numbers but found none');
    return nums;
  }

  function parseIdentList() {
    let idents = [];

    while (true) {
      skipWhitespaces();
      if (read() === ')') break;
      if (read() === ',') {
        skip();
        skipWhitespaces();
      }
      let ident = parseIdentifier();
      idents.push(ident);
    }

    if (!idents.length) THROW('Expected to parse a list of at least some identifiers but found none');
    return idents;
  }

  function parseIdentsToEol() {
    let idents = [];

    while (true) {
      skipWhitespaces();

      let c = read();
      if (isNewline(c)) break;

      if (c === ',') {
        skip();
        skipWhitespaces();
      }
      let ident = parseIdentifier();
      idents.push(ident);
    }

    if (!idents.length) THROW('Expected to parse a list of at least some identifiers but found none');
    return idents;
  }

  function readLine() {
    let offset = pointer;
    while (!isEof() && !isNewline(read())) skip();
    return str.slice(offset, pointer);
  }

  function parseAtRule() {
    is('@');
    // mostly temporary hacks while the dsl stabilizes...

    if (str.slice(pointer, pointer + 6) === 'custom') {
      pointer += 6;
      skipWhitespaces();
      let ident = parseIdentifier();
      skipWhitespaces();
      if (read() === '=') {
        skip();
        skipWhitespaces();
      }
      switch (ident) {
        case 'var-strat':
          parseVarStrat();
          break;
        case 'val-strat':
          parseValStrat();
          break;
        case 'set-valdist':
          skipWhitespaces();
          let target = parseIdentifier();
          let config = parseRestCustom();

          if (!ret.valdist) ret.valdist = {};
          ret.valdist[target] = JSON.parse(config);
          break;
        case 'noleaf':
          skipWhitespaces();

          let idents = parseIdentsToEol();
          for (let i = 0, len = idents.length; i < len; ++i) {
            // debug vars are never considered leaf vars until we change that (to something else and update this to something that still does the same thing)
            // this is for testing as a simple tool to prevent many trivial optimizations to kick in. it's not flawless.
            ml += encode8bit(ML_DEBUG) + encodeNameOrDie(idents[i]);
          }
          break;
        case 'free':
          skipWhitespaces();
          let size = parseNumber();
          ASSERT_LOG2('Found a jump of', size);
          switch (size) {
            case 0:
              break; // ignore. only expliclty illustrates no free space
            case 1:
              ml += encode8bit(ML_NOOP);
              break;
            case 2:
              ml += encode8bit(ML_NOOP2);
              break;
            case 3:
              ml += encode8bit(ML_NOOP3);
              break;
            case 4:
              ml += encode8bit(ML_NOOP4);
              break;
            default:
              ml += encode8bit(ML_JMP) + encode16bit(size - SIZEOF_V) + '\0'.repeat(size - SIZEOF_V);
              break;

          }
          break;

        default:
          THROW('Unsupported custom rule: ' + ident);
      }
    } else if (str.slice(pointer, pointer + 7) === 'targets') {
      pointer += 7;
      parseTargets();
    } else if (str.slice(pointer, pointer + 4) === 'mode') {
      pointer += 4;
      parseMode();
    } else {
      THROW('Unknown atrule');
    }
    expectEol();
  }

  function parseVarStrat() {
    let json = readLine();
    if (/\w+/.test(json)) ret.varstrat = json;
    else ret.varstrat = JSON.parse(json);
  }

  function parseValStrat() {
    ret.varstrat = parseIdentifier();
  }

  function parseRestCustom() {
    skipWhitespaces();
    if (read() === '=') {
      skip();
      skipWhitespaces();
    }

    return readLine();
  }

  function parseTargets() {
    skipWhitespaces();
    if (read() === '=') {
      skip();
      skipWhitespaces();
    }

    THROW('implement me (targeted vars)');
    if (str.slice(pointer, pointer + 3) === 'all') {
      pointer += 3;
      this.solver.config.targetedVars = 'all';
    } else {
      is('(');
      let idents = parseIdentList();
      this.solver.config.targetedVars = idents;
      is(')');
    }
    expectEol();
  }

  function parseMode() {
    skipWhitespaces();
    if (read() === '=') {
      skip();
      skipWhitespaces();
    }

    if (str.slice(pointer, pointer + 'constraints'.length) === 'constraints') {
      // input consists of high level constraints. generate low level optimizations.
      pointer += 'constraints'.length;
    } else if (str.slice(pointer, pointer + 'propagators'.length) === 'propagators') {
      // input consists of low level constraints. try not to generate more.
      pointer += 'propagators'.length;
    }
  }

  function THROW(msg) {
    if (_debug) {
      ASSERT_LOG2(str.slice(0, pointer) + '##|PARSER_IS_HERE[' + msg + ']|##' + str.slice(pointer));
    }
    msg += ', source at #|#: `' + str.slice(Math.max(0, pointer - 20), pointer) + '#|#' + str.slice(pointer, Math.min(str.length, pointer + 20)) + '`';
    throw new Error(msg);
  }
}

// BODY_STOP

export {
  dslToMl,
};
