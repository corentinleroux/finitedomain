// Finite-Domain Helpers

// Note: this file is post processed to remove the ASSERTs
// A grunt cli (`grunt string-replace:perf`, which is also triggered
// in `grunt perf`) will replace all lines that start with `ASSERT`
// with a `1`, which acts as a noop to prevent syntax errors for
// sub-statements (like condiditions). Additionally, there is a macro
// `__REMOVE_BELOW_FOR_DIST__` and `__REMOVE_ABOVE_FOR_DIST__` which
// act like barriers. Anything in between is removed and replaced with
// an `x` so the result is `x=1` (just easier than the clean version).
// We need to wipe these lines because we won't use them and when we
// strip the ASSERT lines, syntax errors would happen in this file.
// The export is preserved so the constants are still exported but
// the method exports are stripped with the ASSERT replacement...

// BODY_START

let SUB = 0; // WARNING: adjusting SUB to something negative means adjusting all tests. probably required for any change actually.
let SUP = 100000000;
let ZERO_CHANGES = 0;
let SOMETHING_CHANGED = 1;
let REJECTED = -1;
let NOT_FOUND = -1;
let LOG_NONE = 0;
let LOG_STATS = 1;
let LOG_SOLVES = 2;
let LOG_MIN = LOG_NONE;
let LOG_MAX = LOG_SOLVES;
// different from NOT_FOUND in that NOT_FOUND must be -1 because of the indexOf api
// while NO_SUCH_VALUE must be a value that cannot be a legal domain value (<SUB or >SUP)
let NO_SUCH_VALUE = SUB - 1; // make sure NO_SUCH_VALUE is not a value that may be valid in a domain
let ENABLED = true; // override for most tests (but not regular ASSERTs) like full domains and space validations
let ENABLE_DOMAIN_CHECK = false; // also causes unrelated errors because mocha sees the expandos
let ENABLE_EMPTY_CHECK = false; //  also causes unrelated errors because mocha sees the expandos
let PAIR_SIZE = 2;

// __REMOVE_BELOW_FOR_ASSERTS__

// For unit tests
// Should be removed in production. Obviously.

function ASSERT(bool, msg = '', ...args) {
  if (bool) {
    return;
  }

  console.error(`Assertion fail: ${msg}`);
  if (args) {
    console.log('Error args:', args);
  }
  //      console.trace()
  //      process.exit() # uncomment for quick error access :)

  let suffix = '';
  if (args && args.length) {
    suffix = `Args (${args.length}x): [${_stringify(args).join(', ')}]`;
  }

  THROW(`Assertion fail: ${msg} ${suffix}`);
}

function _stringify(o) {
  if (o instanceof Array) {
    return o.map(e => `[${_stringify(e)}]`);
  }
  return o + '';
}

// Simple function to completely validate a domain
// Should be removed in production. Obviously.

function ASSERT_DOMAIN(domain) {
  /* istanbul ignore if */
  if (ENABLED) {
    if (ENABLE_DOMAIN_CHECK) {
      _ASSERT_DOMAIN(domain);
    }
  }
}
function _ASSERT_DOMAIN(domain) {
  ASSERT(!!domain, 'domains should be an array', domain);
  ASSERT(domain.length % PAIR_SIZE === 0, 'domains should contain pairs so len should be even', domain, domain.length, domain.length % PAIR_SIZE);
  let phi = SUB - 2; // this means that the lowest `lo` can be, is SUB, csis requires at least one value gap
  for (let index = 0, step = PAIR_SIZE; index < domain.length; index += step) {
    let lo = domain[index];
    let hi = domain[index + 1];
    ASSERT(typeof lo === 'number', 'domains should just be numbers', domain);
    ASSERT(typeof hi === 'number', 'domains should just be numbers', domain);
    ASSERT(lo >= SUB, `lo should be gte to SUB  [${lo}]`, domain);
    ASSERT(hi >= SUB, `hi should be gte to SUB  [${hi}]`, domain);
    ASSERT(hi <= SUP, `hi should be lte to SUP [${hi}]`, domain);
    ASSERT(lo <= hi, `pairs should be lo<=hi ${lo} <= ${hi}`, domain);
    ASSERT(lo > phi + 1, `domains should be in csis form internally, end point apis should normalize input to this: ${domain}`, domain);
    ASSERT((lo % 1) === 0, 'domain should only contain integers', domain);
    ASSERT((hi % 1) === 0, 'domain should only contain integers', domain);
    phi = hi;
  }
}

// use this to verify that all domains set to an fdvar
// are "fresh", and at least not in use by any fdvar yet

function ASSERT_UNUSED_DOMAIN(domain) {
  /* istanbul ignore if */
  if (ENABLED) {
    if (ENABLE_DOMAIN_CHECK) {
      _ASSERT_UNUSED_DOMAIN(domain);
    }
  }
}
function _ASSERT_UNUSED_DOMAIN(domain) {
  // Note: if this expando is blowing up your test, make sure to include fixtures/helpers.fixt.coffee in your test file!
  ASSERT(!domain._fdvar_in_use, 'domains should be unique and not shared');
  domain._fdvar_in_use = true; // asserted just so automatic removal strips this line as well
}

function ASSERT_DOMAIN_EMPTY_SET(domain) {
  /* istanbul ignore if */
  if (ENABLED) {
    if (ENABLE_EMPTY_CHECK) {
      _ASSERT_DOMAIN_EMPTY_SET(domain);
    }
  }
}
function _ASSERT_DOMAIN_EMPTY_SET(domain) {
  if (domain._trace) {
    THROW(`Domain already marked as set to empty...: ${domain._trace}`);
  }
  // Note: if this expando is blowing up your test, make sure to include fixtures/helpers.fixt.coffee in your test file!
  domain._trace = new Error().stack;
}

function ASSERT_DOMAIN_EMPTY_CHECK(domain) {
  /* istanbul ignore if */
  if (!ENABLED) {
    return;
  }

  if (!domain.length && !domain.__skipEmptyCheck) { // __skipEmptyCheck is to circumvent this check in tests
    /* istanbul ignore if */
    if (ENABLE_EMPTY_CHECK) {
      if (domain._trace) {
        THROW(`Domain should not be empty but was set empty at: ${domain._trace}`);
      }
      THROW('Domain should not be empty but was set empty at an untrapped point (investigate!)');
    }
    THROW('Domain should not be empty but was set empty (ASSERT_DOMAIN_EMPTY_CHECK is disabled so no trace)');
  }
  ASSERT_DOMAIN(domain);
}

function ASSERT_DOMAIN_EMPTY_SET_OR_CHECK(domain) {
  /* istanbul ignore if */
  if (!ENABLED) {
    return;
  }

  if (domain.length) {
    ASSERT_DOMAIN(domain);
  } else {
    ASSERT_DOMAIN_EMPTY_SET(domain);
  }
}

//__REMOVE_ABOVE_FOR_ASSERTS__

// given a value return value.id or value
// intended to return the name of a variable where the
// value can be either that variable, or just its name
// @returns {string}

function GET_NAME(e) {
  // e can be the empty string (TOFIX: let's not allow this...)
  if (e.id != null) {
    return e.id;
  }
  return e;
}

// @see GET_NAME
// @returns {string[]}

function GET_NAMES(es) {
  let var_names = [];
  for (let i = 0; i < es.length; i++) {
    let e = es[i];
    var_names.push(GET_NAME(e));
  }

  return var_names;
}

// Abstraction for throwing because throw statements cause deoptimizations
// All explicit throws should use this function. Also helps with tooling
// later, catching and reporting explicits throws and what not.

function THROW(msg) {
  throw new Error(msg);
}

// BODY_STOP

export {
  // __REMOVE_BELOW_FOR_DIST__
  ENABLED,
  ENABLE_DOMAIN_CHECK,
  ENABLE_EMPTY_CHECK,
  // __REMOVE_ABOVE_FOR_DIST__

  REJECTED,
  SUB,
  SUP,
  LOG_NONE,
  LOG_STATS,
  LOG_SOLVES,
  LOG_MAX,
  LOG_MIN,
  NOT_FOUND,
  NO_SUCH_VALUE,
  SOMETHING_CHANGED,
  ZERO_CHANGES,

  ASSERT,
  ASSERT_DOMAIN,
  _ASSERT_DOMAIN,
  ASSERT_DOMAIN_EMPTY_CHECK,
  ASSERT_DOMAIN_EMPTY_SET,
  _ASSERT_DOMAIN_EMPTY_SET,
  ASSERT_DOMAIN_EMPTY_SET_OR_CHECK,
  ASSERT_UNUSED_DOMAIN,
  _ASSERT_UNUSED_DOMAIN,
  GET_NAME,
  GET_NAMES,
  THROW,
};