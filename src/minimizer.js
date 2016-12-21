// problem optimizer
// take an input problem and determine whether constraints can be pruned
// or domains cut before actually generating their propagators

import {
  SUB,
  SUP,

  ASSERT,
  ASSERT_LOG2,
  THROW,
} from './helpers';
import {
  ML_UNUSED,
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
  ML_8V_SUM,
  ML_PRODUCT,
  ML_DISTINCT,
  ML_PLUS,
  ML_MINUS,
  ML_MUL,
  ML_DIV,
  ML_JMP,
  ML_NOOP,
  ML_NOOP2,
  ML_NOOP3,
  ML_NOOP4,
  ML_STOP,

  SIZEOF_V,
  SIZEOF_8V,
  SIZEOF_VV,
  SIZEOF_V8,
  SIZEOF_88,
  SIZEOF_VVV,
  SIZEOF_8VV,
  SIZEOF_V8V,
  SIZEOF_VV8,
  SIZEOF_88V,
  SIZEOF_V88,
  SIZEOF_8V8,
  SIZEOF_888,
  SIZEOF_COUNT,
  SIZEOF_C8_COUNT,

  ml__debug,
  ml_dec8,
  ml_dec16,
  ml_enc8,
  ml_enc16,
  ml_eliminate,
  ml_pump,
  ml_skip,
  ml_jump,
} from './ml';
import {
  domain__debug,
  domain_containsValue,
  domain_createRange,
  domain_createValue,
  domain_getValue,
  domain_intersection,
  domain_intersectionValue,
  domain_isSolved,
  domain_max,
  domain_min,
  domain_removeGte,
  domain_removeGtUnsafe,
  domain_removeLte,
  domain_removeLtUnsafe,
  domain_removeValue,
  domain_sharesNoElements,
  domain_size,
} from './domain';

// BODY_START

const MINIMIZER_STABLE = 0;
const MINIMIZER_SOLVED = 1;
const MINIMIZER_REJECTED = 2;

const MINIMIZE_ALIASED = false;

function cr_optimizeConstraints(ml, getVar, addVar, domains, names, addAlias, getAlias) {
  ASSERT_LOG2('cr_optimizeConstraints', ml, domains.map(domain__debug));
  console.log('sweeping');
  let change = true;
  let onlyJumps = true;
  let emptyDomain = false;
  let lastPcOffset = 0;
  let lastOp = 0;
  let pc = 0;
  let loops = 0;
  while (change) {
    ++loops;
    //console.log('- looping', loops);
    console.time('-> loop ' + loops);
    ASSERT_LOG2('cr outer loop');
    change = false;
    pc = 0;
    let ops = cr_innerLoop();
    ASSERT_LOG2('changed?', change, 'only jumps?', onlyJumps, 'empty domain?', emptyDomain);
    if (emptyDomain) {
      console.log('Empty domain at', lastPcOffset, 'for opcode', lastOp, [ml__debug(ml, lastPcOffset, 1, domains, names)], ml.slice(lastPcOffset, lastPcOffset + 10));
      console.error('Empty domain, problem rejected');
    }
    console.timeEnd('-> loop ' + loops);
    console.log('   - ops this loop:', ops);
    if (emptyDomain) return MINIMIZER_REJECTED;
    if (onlyJumps) return MINIMIZER_SOLVED;
  }
  return MINIMIZER_STABLE;

  function getDomainOrRestartForAlias(index, argDelta) {
    ASSERT(argDelta >= 0, 'expecting delta for compilation');
    let D = domains[index];
    if (D !== false) return D;

    ASSERT_LOG2(' ~ domain for', index, 'is falsy so this should be an alias, recompiling and restarting same op');
    // if the domain is falsy then there was an alias (or a bug)
    // write the alias back to ML and restart the current op
    // caller should ensure to check return value and return on
    // a falsy result as well so the loop can restart.
    let aliasIndex = getAlias(index);
    ASSERT_LOG2(' - alias(' + index + ') = ' + aliasIndex);
    ASSERT(typeof aliasIndex === 'number' && aliasIndex >= 0, 'should have this alias');
    ml.writeUInt16BE(aliasIndex, lastPcOffset + argDelta);
    ASSERT(pc === lastPcOffset, 'expecting to restart'); // caller should stop and loop will restart this op with aliased index as if nothing happened
    return false;
  }

  function cr_innerLoop() {
    let ops = 0;
    onlyJumps = true;
    while (pc < ml.length && !emptyDomain) {
      ++ops;
      let pcStart = pc;
      lastPcOffset = pc;
      let op = ml[pc];
      lastOp = op;

      ASSERT_LOG2('# CRc[' + pcStart + ']:', op, '(0x' + op.toString(16) + ')');
      switch (op) {
        case ML_UNUSED:
          ASSERT_LOG2('reading a op=zero which should not happen', ml.slice(Math.max(pc - 100, 0), pc), '<here>', ml.slice(pc, pc + 100));
          return THROW(' ! optimizer problem @', pc);

        case ML_STOP:
          ASSERT_LOG2(' ! good end @', pcStart);
          return ops;

        case ML_VV_EQ:
          ASSERT_LOG2('- eq vv @', pcStart);
          cr_vv_eq(ml);
          break;

        case ML_V8_EQ:
          ASSERT_LOG2('- eq v8 @', pcStart);
          cr_v8_eq(ml);
          break;

        case ML_88_EQ:
          ASSERT_LOG2('- eq 88 @', pcStart);
          cr_88_eq(ml);
          break;

        case ML_VV_NEQ:
          ASSERT_LOG2('- neq vv @', pcStart);
          cr_vv_neq(ml);
          break;

        case ML_V8_NEQ:
          ASSERT_LOG2('- neq v8 @', pcStart);
          cr_v8_neq(ml);
          break;

        case ML_88_NEQ:
          ASSERT_LOG2('- neq 88 @', pcStart);
          cr_88_neq(ml);
          break;

        case ML_VV_LT:
          ASSERT_LOG2('- lt vv @', pcStart);
          cr_vv_lt(ml);
          break;

        case ML_V8_LT:
          ASSERT_LOG2('- lt v8 @', pcStart);
          cr_v8_lt(ml);
          break;

        case ML_8V_LT:
          ASSERT_LOG2('- lt 8v @', pcStart);
          cr_8v_lt(ml);
          break;

        case ML_88_LT:
          ASSERT_LOG2('- lt 88 @', pcStart);
          cr_88_lt(ml);
          break;

        case ML_VV_LTE:
          ASSERT_LOG2('- lte vv @', pcStart);
          cr_vv_lte(ml);
          break;

        case ML_V8_LTE:
          ASSERT_LOG2('- lte v8 @', pcStart);
          cr_v8_lte(ml);
          break;

        case ML_8V_LTE:
          ASSERT_LOG2('- lte 8v @', pcStart);
          cr_8v_lte(ml);
          break;

        case ML_88_LTE:
          ASSERT_LOG2('- lte 88 @', pcStart);
          cr_88_lte(ml);
          break;

        case ML_DISTINCT:
          ASSERT_LOG2('- distinct @', pcStart);
          cr_distinct(ml);
          break;

        case ML_PLUS:
          ASSERT_LOG2('- plus @', pcStart);
          cr_plus(ml);
          break;

        case ML_MINUS:
          ASSERT_LOG2('- minus @', pcStart);
          cr_minus(ml);
          break;

        case ML_MUL:
          ASSERT_LOG2('- mul @', pcStart);
          cr_mul(ml);
          break;

        case ML_DIV:
          ASSERT_LOG2('- div @', pcStart);
          cr_div(ml);
          break;

        case ML_VVV_ISEQ:
          ASSERT_LOG2('- iseq vvv @', pcStart);
          cr_vvv_isEq(ml);
          break;

        case ML_V8V_ISEQ:
          ASSERT_LOG2('- iseq v8v @', pcStart);
          cr_v8v_isEq(ml);
          break;

        case ML_VV8_ISEQ:
          ASSERT_LOG2('- iseq vv8 @', pcStart);
          cr_vv8_isEq(ml);
          break;

        case ML_88V_ISEQ:
          ASSERT_LOG2('- iseq 88v @', pcStart);
          cr_88v_isEq(ml);
          break;

        case ML_V88_ISEQ:
          ASSERT_LOG2('- iseq v88 @', pcStart);
          cr_v88_isEq(ml);
          break;

        case ML_888_ISEQ:
          ASSERT_LOG2('- iseq 888 @', pcStart);
          cr_888_isEq(ml);
          break;

        case ML_VVV_ISNEQ:
          ASSERT_LOG2('- isneq vvv @', pcStart);
          cr_vvv_isNeq(ml);
          break;

        case ML_V8V_ISNEQ:
          ASSERT_LOG2('- isneq v8v @', pcStart);
          cr_v8v_isNeq(ml);
          break;

        case ML_VV8_ISNEQ:
          ASSERT_LOG2('- isneq vv8 @', pcStart);
          cr_vv8_isNeq(ml);
          break;

        case ML_88V_ISNEQ:
          ASSERT_LOG2('- isneq 88v @', pcStart);
          cr_88v_isNeq(ml);
          break;

        case ML_V88_ISNEQ:
          ASSERT_LOG2('- isneq v88 @', pcStart);
          cr_v88_isNeq(ml);
          break;

        case ML_888_ISNEQ:
          ASSERT_LOG2('- isneq 888 @', pcStart);
          cr_888_isNeq(ml);
          break;

        case ML_VVV_ISLT:
          ASSERT_LOG2('- islt vvv @', pcStart);
          cr_vvv_isLt(ml);
          break;

        case ML_8VV_ISLT:
          ASSERT_LOG2('- islt 8vv @', pcStart);
          cr_8vv_isLt(ml);
          break;

        case ML_V8V_ISLT:
          ASSERT_LOG2('- islt v8v @', pcStart);
          cr_v8v_isLt(ml);
          break;

        case ML_VV8_ISLT:
          ASSERT_LOG2('- islt vv8 @', pcStart);
          cr_vv8_isLt(ml);
          break;

        case ML_88V_ISLT:
          ASSERT_LOG2('- islt 88v @', pcStart);
          cr_88v_isLt(ml);
          break;

        case ML_V88_ISLT:
          ASSERT_LOG2('- islt v88 @', pcStart);
          cr_v88_isLt(ml);
          break;

        case ML_8V8_ISLT:
          ASSERT_LOG2('- islt 8v8 @', pcStart);
          cr_8v8_isLt(ml);
          break;

        case ML_888_ISLT:
          ASSERT_LOG2('- islt 888 @', pcStart);
          cr_888_isLt(ml);
          break;

        case ML_VVV_ISLTE:
          ASSERT_LOG2('- islte vvv @', pcStart);
          cr_vvv_isLte(ml);
          break;

        case ML_8VV_ISLTE:
          ASSERT_LOG2('- islte 8vv @', pcStart);
          cr_8vv_isLte(ml);
          break;

        case ML_V8V_ISLTE:
          ASSERT_LOG2('- islte v8v @', pcStart);
          cr_v8v_isLte(ml);
          break;

        case ML_VV8_ISLTE:
          ASSERT_LOG2('- islte vv8 @', pcStart);
          cr_vv8_isLte(ml);
          break;

        case ML_88V_ISLTE:
          ASSERT_LOG2('- islte 88v @', pcStart);
          cr_88v_isLte(ml);
          break;

        case ML_V88_ISLTE:
          ASSERT_LOG2('- islte v88 @', pcStart);
          cr_v88_isLte(ml);
          break;

        case ML_8V8_ISLTE:
          ASSERT_LOG2('- islte 8v8 @', pcStart);
          cr_8v8_isLte(ml);
          break;

        case ML_888_ISLTE:
          ASSERT_LOG2('- islte 888 @', pcStart);
          cr_888_isLte(ml);
          break;

        case ML_8V_SUM:
          ASSERT_LOG2('- sum @', pcStart);
          cr_sum(ml);
          break;

        case ML_PRODUCT:
          ASSERT_LOG2('- product @', pcStart);
          cr_product(ml);
          break;

        case ML_NOOP:
          ASSERT_LOG2('- noop @', pc);
          cr_moveTo(ml, pc, 1);
          break;
        case ML_NOOP2:
          ASSERT_LOG2('- noop2 @', pc);
          cr_moveTo(ml, pc, 2);
          break;
        case ML_NOOP3:
          ASSERT_LOG2('- noop3 @', pc);
          cr_moveTo(ml, pc, 3);
          break;
        case ML_NOOP4:
          ASSERT_LOG2('- noop4 @', pc);
          cr_moveTo(ml, pc, 4);
          break;
        case ML_JMP:
          ASSERT_LOG2('- jmp @', pc);
          let delta = ml_dec16(ml, pc + 1);
          cr_moveTo(ml, pc, SIZEOF_V + delta);
          break;

        default:
          THROW('unknown op: 0x' + op.toString(16));
      }
      if (pc === pcStart) ASSERT_LOG2(' - restarting op from same pc...');
    }
    if (emptyDomain) return ops;
    return THROW('Derailed; expected to find STOP before EOF');
  }

  function cr_moveTo(ml, offset, len) {
    ASSERT_LOG2(' - trying to move from', offset, 'to', offset + len, 'delta = ', len);
    switch (ml_dec8(ml, offset + len)) {
      case ML_NOOP:
      case ML_NOOP2:
      case ML_NOOP3:
      case ML_NOOP4:
      case ML_JMP:
        ASSERT_LOG2('- moving to another jump so merging them now');
        ml_jump(ml, offset, len);
        pc = offset; // restart, make sure the merge worked
        break;
      default:
        pc = offset + len;
        break;
    }
  }

  function cr_vv_eq() {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);

    if (indexA !== indexB) {
      let A = getDomainOrRestartForAlias(indexA, 1);
      let B = getDomainOrRestartForAlias(indexB, 3);
      if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED) return; // there was an alias; restart op

      ASSERT_LOG2(' = cr_vv_eq', indexA, indexB, domain__debug(A), domain__debug(B));
      if (!A || !B) return emptyDomain = true;

      let R = domain_intersection(A, B);
      ASSERT_LOG2(' ->', domain__debug(R));
      if (A !== R || B !== R) {
        if (!R) return emptyDomain = true;
        domains[indexA] = R;
        change = true;
      }

      ASSERT_LOG2(' - Mapping', indexB, 'to be an alias for', indexA);
      addAlias(indexB, indexA);
      domains[indexB] = false; // mark as aliased. this is not a change per se.
    }

    // the vars are now intersected and aliased. we can remove this constraint.
    ml_eliminate(ml, offset, SIZEOF_VV);
  }

  function cr_v8_eq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);

    let A = getDomainOrRestartForAlias(indexA, 1);
    ASSERT_LOG2(' = cr_v8_eq', indexA, domain__debug(A), vB);
    if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

    if (!A) return emptyDomain = true;

    if (!domain_containsValue(A, vB)) {
      ASSERT_LOG2(' - A did not contain literal', vB, 'so search rejects');
      return emptyDomain = true;
    }

    let oA = A;
    A = domain_createValue(vB);
    if (A !== oA) {
      ASSERT_LOG2(' - A (', indexA, ') updated to', domain__debug(A));
      domains[indexA] = A;
      change = true;
    }

    // domain must be solved now since B was a literal (a solved constant)
    ml_eliminate(ml, offset, SIZEOF_V8);
  }

  function cr_88_eq(ml) {
    // (artifact) either remove constraint if they are equal or reject if they are not

    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);

    ASSERT_LOG2(' = cr_88_eq', vA, vB);

    if (vA !== vB) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_88);
  }

  function cr_vv_neq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_vv_neq', indexA, indexB, domain__debug(A), domain__debug(B));
    if (!A || !B) return emptyDomain = true;

    // if either is solved then the other domain should
    // become the result of unsolved_set "minus" solved_set
    let vA = domain_getValue(A);
    if (vA >= 0) {
      let oB = B;
      B = domain_removeValue(B, vA);
      if (oB !== B) {
        ASSERT_LOG2(' - B (', indexB, ') was updated from', domain__debug(oB), 'to', domain__debug(B));
        if (!B) return emptyDomain = true;
        change = true;
        domains[indexB] = B;
      }
    }
    let vB = domain_getValue(B);
    if (domain_getValue(B) >= 0) {
      let oA = A;
      A = domain_removeValue(A, vB);
      if (A !== oA) {
        ASSERT_LOG2(' - A (', indexA, ') was updated from', domain__debug(oA), 'to', domain__debug(A));
        if (!A) return emptyDomain = true;
        change = true;
        domains[indexA] = A;
      }
    }
    if (vA < 0) {
      // check A again if not already solved... B may have affected it
      vA = domain_getValue(A);
      if (vA >= 0) {
        let oB = B;
        B = domain_removeValue(B, vA);
        if (oB !== B) {
          ASSERT_LOG2(' - B (', indexB, ') was updated in the rebound from', domain__debug(oB), 'to', domain__debug(B));
          if (!B) return emptyDomain = true;
          change = true;
          domains[indexB] = B;
        }
      }
    }

    ASSERT_LOG2(' ->', domain__debug(A), domain__debug(B));

    // solved if the two domains (now) intersects to an empty domain
    if (domain_sharesNoElements(A, B)) {
      ASSERT_LOG2(' - No element overlapping between', indexA, 'and', indexB, '(', domain__debug(A), ' & ', domain__debug(B), ') so we can eliminate this neq');
      ml_eliminate(ml, offset, SIZEOF_VV);
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VV;
    }
  }

  function cr_v8_neq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);

    let A = getDomainOrRestartForAlias(indexA, 1);
    if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v8_neq', indexA, domain__debug(A), vB);
    if (!A) return emptyDomain = true;

    // remove the literal from A and remove constraint
    let oA = A;
    A = domains[indexA] = domain_removeValue(A, vB);
    ASSERT_LOG2(' ->', domain__debug(A));
    if (A !== oA) {
      if (!A) return emptyDomain = true;
      change = true;
    }

    ml_eliminate(ml, offset, SIZEOF_V8);
  }

  function cr_88_neq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);

    ASSERT_LOG2(' = cr_88_neq', vA, vB);

    if (vA === vB) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_88);
  }

  function cr_vv_lt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_vv_lt {', indexA, '} < {', indexB, '}   -->  ', domain__debug(A), '<', domain__debug(B));
    if (!A || !B) return emptyDomain = true;

    // relative comparison is easy; cut away any non-intersecting
    // values that violate the desired outcome. only when a A and
    // B have multiple intersecting values we have to keep this
    // constraint
    let oA = A;
    A = domain_removeGte(A, domain_max(B));
    if (A !== oA) {
      ASSERT_LOG2(' - updated A', domain__debug(A), 'max B=', domain_max(B));
      if (!A) return emptyDomain = true;
      domains[indexA] = A;
      change = true;
    }

    let oB = B;
    B = domain_removeLte(B, domain_min(A));
    if (B !== oB) {
      ASSERT_LOG2(' - updated B', domain__debug(B), 'min A=', domain_min(A));
      if (!B) return emptyDomain = true;
      domains[indexB] = B;
      change = true;
      pc = offset; // repeat because B changed which may affect A
      return;
    }

    ASSERT_LOG2(' ->', domain__debug(A), domain__debug(B));

    // any value in A must be < any value in B
    if (domain_max(A) < domain_min(B)) {
      ml_eliminate(ml, offset, SIZEOF_VV);
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VV;
    }
  }

  function cr_v8_lt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);

    let A = getDomainOrRestartForAlias(indexA, 1);
    if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v8_lt', indexA, domain__debug(A), vB);
    if (domain_min(A) >= vB) return emptyDomain = true;

    let oA = A;
    // remove any value gte vB and remove constraint
    A = domains[indexA] = domain_removeGte(A, vB);
    ASSERT_LOG2(' ->', domain__debug(A));

    if (A !== oA) {
      if (!A) return emptyDomain = true;
      change = true;
    }

    ml_eliminate(ml, offset, SIZEOF_V8);
  }

  function cr_8v_lt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let vA = ml_dec8(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);

    let B = getDomainOrRestartForAlias(indexB, 2);
    if (B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_8v_lt', vA, indexB, domain__debug(B));
    if (vA >= domain_max(B)) return emptyDomain = true;

    let oB = B;
    // remove any value lte vA and remove constraint
    B = domains[indexB] = domain_removeLte(B, vA);
    ASSERT_LOG2(' ->', domain__debug(B));
    if (B !== oB) {
      if (!B) return emptyDomain = true;
      change = true;
    }

    ml_eliminate(ml, offset, SIZEOF_8V);
  }

  function cr_88_lt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);

    ASSERT_LOG2(' = cr_88_lt', vA, vB);
    if (vA >= vB) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_88);
  }

  function cr_vv_lte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_vv_lte', indexA, indexB, domain__debug(A), domain__debug(B));
    if (!A || !B) return emptyDomain = true;

    // relative comparison is easy; cut away any non-intersecting
    // values that violate the desired outcome. only when a A and
    // B have multiple intersecting values we have to keep this
    // constraint

    let oA = A;
    A = domain_removeGtUnsafe(A, domain_max(B));
    if (A !== oA) {
      ASSERT_LOG2(' - updated A', domain__debug(A), 'max B=', domain_max(B));
      if (!A) return emptyDomain = true;
      domains[indexA] = A;
      change = true;
    }

    // A is (now) empty so just remove it
    let oB = B;
    B = domain_removeLtUnsafe(B, domain_min(A));
    if (B !== oB) {
      ASSERT_LOG2(' - updated B', domain__debug(B), 'max A=', domain_min(A));
      if (!B) return emptyDomain = true;
      domains[indexB] = B;
      change = true;
    }

    ASSERT_LOG2(' ->', domain__debug(A), domain__debug(B));

    // any value in A must be < any value in B
    if (domain_max(A) <= domain_min(B)) {
      ml_eliminate(ml, offset, SIZEOF_VV);
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VV;
    }
  }

  function cr_v8_lte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);

    let A = getDomainOrRestartForAlias(indexA, 1);
    if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v8_lte', indexA, domain__debug(A), vB);
    if (domain_max(A) > vB) return emptyDomain = true;

    let oA = A;
    // remove any value gt vB and remove constraint
    A = domains[indexA] = domain_removeGtUnsafe(A, vB);
    ASSERT_LOG2(' ->', domain__debug(A));
    if (A !== oA) {
      if (!A) return emptyDomain = true;
      change = true;
    }

    ml_eliminate(ml, offset, SIZEOF_V8);
  }

  function cr_8v_lte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let vA = ml_dec8(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);

    let B = getDomainOrRestartForAlias(indexB, 2);
    if (B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_8v_lte', vA, indexB, domain__debug(B));
    if (vA > domain_min(B)) return emptyDomain = true;

    let oB = B;
    // remove any value lt vA and remove constraint
    B = domains[indexB] = domain_removeLtUnsafe(B, vA);
    ASSERT_LOG2(' ->', domain__debug(B));
    if (B !== oB) {
      if (!B) return emptyDomain = true;
      change = true;
    }

    ml_eliminate(ml, offset, SIZEOF_8V);
  }

  function cr_88_lte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);

    ASSERT_LOG2(' = cr_88_lte', vA, vB);
    if (vA > vB) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_88);
  }

  function cr_distinct(ml) {
    let offset = pc;
    let offsetCount = offset + 1;
    let argCount = ml_dec16(ml, offsetCount);
    let offsetArgs = offset + SIZEOF_COUNT;

    ASSERT_LOG2(' = cr_distinct', argCount, 'x');
    ASSERT_LOG2('  -', Array.from(Array(argCount)).map((n, i) => ml_dec16(ml, offsetArgs + i * 2)));
    ASSERT_LOG2('  -', Array.from(Array(argCount)).map((n, i) => domain__debug(domains[ml_dec16(ml, offsetArgs + i * 2)])));

    let countStart = argCount;

    // a distinct is basically a pyramid of neq's; one for each unique pair of the set
    // to prevent generating an array we'll decode every var during the loop...
    // we loop back to front because we're splicing out vars while looping
    for (let i = argCount - 1; i >= 0; --i) {
      let indexA = ml_dec16(ml, offsetArgs + i * 2);

      let A = getDomainOrRestartForAlias(indexA, SIZEOF_COUNT + i * 2);
      if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

      ASSERT_LOG2('  - loop i=', i, 'index=', indexA, 'domain=', domain__debug(A));
      if (!A) return emptyDomain = true;

      let v = domain_getValue(A);
      if (v >= 0) {
        ASSERT_LOG2('  - solved, so removing', v, 'from all other domains');
        // if v is solved, remove v from all other domains, then remove v from the list
        for (let j = 0; j >= 0; --j) {
          if (j !== i) {
            let indexB = ml_dec16(ml, offsetArgs + j * 2);
            ASSERT(indexA !== indexB, 'same var should not occur multiple times...'); // what about constants? could be artifacts (A=1,B=1,distinct(A,B))
            ASSERT_LOG2('    - loop j=', j, 'index=', indexB, 'domain=', domain__debug(domains[indexB]));

            let oB = getDomainOrRestartForAlias(indexB, SIZEOF_COUNT + j * 2);
            if (oB === MINIMIZE_ALIASED) return; // there was an alias; restart op

            let B = domains[indexB] = domain_removeValue(oB, v);
            if (B !== oB) {
              ASSERT_LOG2('    -> changed B=', domain__debug(B));
              if (!B) return emptyDomain = true;
              change = true;
            }
          }
        }

        // now
        // - move all indexes bigger than the current back one position
        // - compile the new count back in
        // - compile a NOOP in the place of the last element
        ASSERT_LOG2('  - moving further domains one space forward (from ', i + 1, ' / ', argCount, ')', i + 1 < argCount);
        for (let k = i + 1; k < argCount; ++k) {
          ASSERT_LOG2('    - moving ', (k + 1) + 'th var');
          ml[offsetArgs + k * 2] = ml[offsetArgs + (k + 1) * 2];
          ml[offsetArgs + k * 2 + 1] = ml[offsetArgs + (k + 1) * 2 + 1];
        }
        --argCount;
      }
    }

    if (argCount <= 1) {
      ASSERT(argCount >= 0, 'should be zero or one');
      ASSERT_LOG2(' - Count is', argCount, '; eliminating constraint');
      ml_eliminate(ml, offset, SIZEOF_COUNT + 2 * countStart);
    } else if (argCount === 2) {
      ASSERT_LOG2(' - Count=2, recompiling to regular neq');
      // recompile as neq
      // list of vars should not have any holes (not even after elimination above) so we can just copy them.
      // ml len of this distinct should be 7 bytes (op=1, count=2, A=2, B=2)
      // note: skip the count when reading!
      ml_enc8(ml, offset, ML_VV_NEQ);
      ml_pump(ml, offsetCount, 0, 2, 4); // copies the first arg over count and the second arg over the first
      // this should open up at least 2 bytes, maybe more, so skip anything from the old op right after the new op
      ml_skip(ml, offset + SIZEOF_VV, (SIZEOF_COUNT + 2 * countStart) - SIZEOF_VV);
      ASSERT_LOG2(' - changed to a neq');
      pc = offset; // revisit
    } else {
      if (argCount !== countStart) {
        ASSERT_LOG2('  - recompiling new count (', argCount, ')');
        ml_enc16(ml, offset + 1, argCount);
        ASSERT_LOG2('  - compiling noop into empty spots');
        ml_skip(ml, offsetArgs + argCount * 2, (countStart - argCount) * 2);
      }

      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_COUNT + countStart * 2;
    }
  }

  function cr_plus(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    let R = getDomainOrRestartForAlias(indexR, 5);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_plus', '{', indexR, '} = {', indexA, '} ==? {', indexB, '} -->', domain__debug(R), '=', domain__debug(A), '==?', domain__debug(B));
    if (!A || !B || !R) return emptyDomain = true;

    let oA = A;
    let oB = B;
    let oR = R;

    // note: A + B = C   ==>   <loA + loB, hiA + hiB>
    // but:  A - B = C   ==>   <loA - hiB, hiA - loB>   (so the lo/hi of B gets swapped!)
    // keep in mind that any number oob <sub,sup> gets pruned in either case

    let minR = domain_min(R);
    let maxR = domain_max(R);
    A = domain_removeLtUnsafe(A, minR - domain_max(B));
    A = domain_removeGtUnsafe(A, maxR - domain_min(B));
    ASSERT_LOG2('    - updated A:', domain__debug(A), '<' + minR + '-' + domain_max(B) + '=' + (minR - domain_max(B)) + ', ' + maxR + '-' + domain_min(B) + '=' + (maxR - domain_min(B)) + '>');
    if (!A) return emptyDomain = true;
    let minA = domain_min(A);
    let maxA = domain_max(A);
    B = domain_removeLtUnsafe(B, minR - maxA);
    B = domain_removeGtUnsafe(B, maxR - minA);
    ASSERT_LOG2('    - updated B:', domain__debug(B), 'A minmax:', minA, maxA);
    if (!B) return emptyDomain = true;
    let minB = domain_min(B);
    let maxB = domain_max(B);
    R = domain_removeLtUnsafe(R, minA + minB);
    R = domain_removeGtUnsafe(R, maxA + maxB);
    ASSERT_LOG2('    - updated R:', domain__debug(R), 'B minmax:', minB, maxB);
    if (!R) return emptyDomain = true;
    if (oR !== R || oB !== B) {
      minR = domain_min(R);
      maxR = domain_max(R);
      A = domain_removeLtUnsafe(A, minR - maxB);
      A = domain_removeGtUnsafe(A, maxR - minB);
      ASSERT_LOG2('    - updated A:', domain__debug(A), 'R minmax:', minR, maxR);
      if (!A) return emptyDomain = true;
      if (oR !== R || oA !== A) {
        B = domain_removeLtUnsafe(B, minR - domain_max(A));
        B = domain_removeGtUnsafe(B, maxR - domain_min(A));
        ASSERT_LOG2('    - updated B:', domain__debug(B), 'A minmax:', domain_min(A), domain_max(A));
        if (!B) return emptyDomain = true;
      }
    }

    ASSERT_LOG2(' ->', domain__debug(R), '=', domain__debug(A), '+', domain__debug(B));

    if (oA !== A || oB !== B || oR !== R) {
      change = true;
      domains[indexA] = A;
      domains[indexB] = B;
      domains[indexR] = R;
    }

    ASSERT((domain_isSolved(A) + domain_isSolved(B) + domain_isSolved(R)) !== 2, 'if two vars are solved the third should be solved as well');

    if (domain_isSolved(R) && domain_isSolved(A)) {
      ASSERT(domain_isSolved(B), 'if two are solved then all three must be solved');
      ml_eliminate(ml, offset, SIZEOF_VVV);
    } else {
      let vA = domain_getValue(A);
      if (vA >= 0) {
        ASSERT(!domain_isSolved(B) && !domain_isSolved(R), 'case checked earlier');
        if (vA === 0) {
          ASSERT_LOG2(' - A=0 so B+0==R, rewriting op to eq');
          // rewrite to B == R
          cr_vvv2vv(ml, offset, ML_VV_EQ, indexR, indexB);
          pc = offset; // revisit
        } else {
          let sizeB = domain_size(B);
          let sizeR = domain_size(R);
          maxB = domain_max(B);
          if (sizeB === 2 && sizeR === 2 && maxB === domain_min(R)) {
            ASSERT_LOG2(' - A is solved, size(B)=size(R)=2 and max(B)=min(R), so B<R');
            cr_vvv2vv(ml, offset, ML_VV_LT, indexB, indexR);
            pc = offset; // revisit
          } else if (maxB <= 1 && domain_size(R) === 2) {
            ASSERT(domain_max(R) > 1, 'if B <= 1 then R must be >1 because R=B+A and A is non-zero and B is not solved (both checked above) so R must be at least [1,2]');
            // B = R ==? A or B = R !=? A, that depends on max(R)==A
            ASSERT_LOG2(' - A>0,B<=1,size(R)=2. Morphing to iseq: ', (domain_max(R) === vA ? 'B = R ==? A' : 'B = R !=? A'), '->', domain__debug(B), '=', domain__debug(R), (domain_max(R) === vA ? '==?' : '!=?'), vA);
            cr_vvv2v8v(ml, offset, domain_max(R) === vA ? ML_V8V_ISEQ : ML_V8V_ISNEQ, indexR, vA, indexB);
            pc = offset; // revisit (dont think we need to...)
          } else if (domain_max(R) <= 1 && domain_size(B) === 2) {
            // A = R ==? B or A = R !=? B, that depends on max(B)==A
            ASSERT_LOG2(' - A>0 R<=1 and size(B)=2. Morphing to iseq: ', (maxB === vA ? 'R = B ==? A' : 'R = B !=? A'), '->', domain__debug(R), '=', domain__debug(B), (maxB === vA ? '==?' : '!=?'), vA);
            cr_vvv2v8v(ml, offset, maxB === vA ? ML_V8V_ISEQ : ML_V8V_ISNEQ, indexB, vA, indexR);
            pc = offset; // revisit (dont think we need to...)
          } else {
            ASSERT_LOG2(' - not only jumps..., new pc =', offset + SIZEOF_VVV);
            onlyJumps = false;
            pc = offset + SIZEOF_VVV;
          }
        }
      } else {
        let vB = domain_getValue(B);
        if (vB >= 0) {
          ASSERT(!domain_isSolved(A) && !domain_isSolved(R), 'case checked earlier');
          if (vB === 0) {
            ASSERT_LOG2(' - B=0 so A+0==R, rewriting op to eq');
            // rewrite to A == R
            cr_vvv2vv(ml, offset, ML_VV_EQ, indexA, indexR);
            pc = offset; // revisit
          } else {
            let sizeA = domain_size(A);
            let sizeR = domain_size(R);
            maxA = domain_max(A);
            if (sizeA === 2 && sizeR === 2 && maxA === domain_min(R)) {
              ASSERT_LOG2(' - B is solved, size(A)=size(R)=2 and max(A)=min(R), so A<R');
              cr_vvv2vv(ml, offset, ML_VV_LT, indexA, indexR);
              pc = offset; // revisit
            } else if (domain_max(A) <= 1 && domain_size(R) === 2) {
              ASSERT(domain_max(R) > 1, 'if A <= 1 then R must be >1 because R=A+B and B is non-zero and A is not solved (both checked above) so R must be at least [1,2]');
              // A = R ==? B or A = R !=? B, that depends on max(R)==B
              ASSERT_LOG2(' - B>0,A<=1,size(R)=2. Morphing to iseq: ', (domain_max(R) === vB ? 'A = R ==? B' : 'A = R !=? B'), '->', domain__debug(A), '=', domain__debug(R), (domain_max(R) === vB ? '==?' : '!=?'), vB);
              cr_vvv2v8v(ml, offset, domain_max(R) === vB ? ML_V8V_ISEQ : ML_V8V_ISNEQ, indexR, vB, indexA);
              pc = offset; // revisit (dont think we need to...)
            } else if (domain_max(R) <= 1 && domain_size(B) === 2) {
              // A = R ==? B or A = R !=? B, that depends on max(A)==B
              ASSERT_LOG2(' - B>0,R<=1,size(R)=2. Morphing to iseq: ', (domain_max(A) === vB ? 'R = A ==? B' : 'R = A !=? B'), '->', domain__debug(R), '=', domain__debug(A), (domain_max(A) === vB ? '==?' : '!=?'), vB);
              cr_vvv2v8v(ml, offset, domain_max(A) === vB ? ML_V8V_ISEQ : ML_V8V_ISNEQ, indexA, vB, indexR);
              pc = offset; // revisit (dont think we need to...)
            } else {
              ASSERT_LOG2(' - not only jumps..., new pc =', offset + SIZEOF_VVV);
              onlyJumps = false;
              pc = offset + SIZEOF_VVV;
            }
          }
        } else {
          ASSERT_LOG2(' - not only jumps..., new pc =', offset + SIZEOF_VVV);
          onlyJumps = false;
          pc = offset + SIZEOF_VVV;
        }
      }
    }
  }

  function cr_minus(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    let R = getDomainOrRestartForAlias(indexR, 5);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_minus', indexA, indexB, indexR, domain__debug(A), domain__debug(B), domain__debug(R));
    if (!A || !B || !R) return emptyDomain = true;

    let oA = A;
    let oB = B;
    let oR = R;

    // C = A - B   -> A = B + C, B = C - A
    // note: A - B = C   ==>   <loA - hiB, hiA - loB>
    // but:  A + B = C   ==>   <loA + loB, hiA + hiB>   (so the lo/hi of B gets swapped!)
    // keep in mind that any number oob <sub,sup> gets pruned in either case

    let minR = domain_min(R);
    let maxR = domain_max(R);
    A = domain_removeLtUnsafe(A, minR + domain_min(B));
    A = domain_removeGtUnsafe(A, maxR + domain_max(B));
    ASSERT_LOG2('    - updated A:', domain__debug(A), '<' + minR + '+' + domain_min(B) + '=' + (minR + domain_min(B)) + ', ' + maxR + '+' + domain_max(B) + '=' + (maxR + domain_max(B)) + '>');
    if (!A) return emptyDomain = true;
    let minA = domain_min(A);
    let maxA = domain_max(A);
    B = domain_removeLtUnsafe(B, minA - maxR);
    B = domain_removeGtUnsafe(B, maxA - minR);
    ASSERT_LOG2('    - updated B:', domain__debug(B), 'A minmax:', minA, maxA);
    if (!B) return emptyDomain = true;
    let minB = domain_min(B);
    let maxB = domain_max(B);
    R = domain_removeLtUnsafe(R, minA - maxB);
    R = domain_removeGtUnsafe(R, maxA - minB);
    ASSERT_LOG2('    - updated R:', domain__debug(R), 'B minmax:', minB, maxB);
    if (!R) return emptyDomain = true;
    if (oR !== R || oB !== B) {
      minR = domain_min(R);
      maxR = domain_max(R);
      A = domain_removeLtUnsafe(A, minR + minB);
      A = domain_removeGtUnsafe(A, maxR + maxB);
      ASSERT_LOG2('    - updated A:', domain__debug(A), 'R minmax:', minR, maxR);
      if (!A) return emptyDomain = true;
      if (oR !== R || oA !== A) {
        B = domain_removeLtUnsafe(B, domain_min(A) - maxR);
        B = domain_removeGtUnsafe(B, domain_max(A) - minR);
        ASSERT_LOG2('    - updated B:', domain__debug(B), 'A minmax:', domain_min(A), domain_max(A));
        if (!B) return emptyDomain = true;
      }
    }

    ASSERT_LOG2(' ->', domain__debug(A), domain__debug(B), domain__debug(R));

    if (oA !== A || oB !== B || oR !== R) {
      change = true;
      domains[indexA] = A;
      domains[indexB] = B;
      domains[indexR] = R;
    }

    ASSERT((domain_isSolved(A) + domain_isSolved(B) + domain_isSolved(R)) !== 2, 'if two vars are solved the third should be solved as well');

    if (domain_isSolved(R) && domain_isSolved(A)) {
      ASSERT(domain_isSolved(B), 'if two are solved then all three must be solved');
      ml_eliminate(ml, offset, SIZEOF_VVV);
    } else if (domain_getValue(A) === 0) {
      ASSERT_LOG2(' - A=0 so B==R, rewriting op to eq');
      cr_vvv2vv(ml, offset, ML_VV_EQ, indexB, indexR);
      pc = offset; // revisit
    } else if (domain_getValue(B) === 0) {
      ASSERT_LOG2(' - B=0 so A==R, rewriting op to eq');
      cr_vvv2vv(ml, offset, ML_VV_EQ, indexA, indexR);
      pc = offset; // revisit
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VVV;
    }
  }

  function cr_mul(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    let R = getDomainOrRestartForAlias(indexR, 5);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_mul', indexA, indexB, indexR, domain__debug(A), domain__debug(B), domain__debug(R));
    if (!A || !B || !R) return emptyDomain = true;

    let oA = A;
    let oB = B;
    let oR = R;

    // C = A * B, B = C / A, A = C / B
    // note: A * B = C   ==>   <loA * loB, hiA * hiB>
    // but:  A / B = C   ==>   <loA / hiB, hiA / loB> and has rounding/div-by-zero issues! instead use "inv-mul" tactic
    // keep in mind that any number oob <sub,sup> gets pruned in either case. x/0=0
    // when dividing "do the opposite" of integer multiplication. 5/4=[] because there is no int x st 4*x=5
    // only outer bounds are evaluated here...

    let minR = domain_min(R);
    let maxR = domain_max(R);
    let minB = domain_min(B);
    let maxB = domain_max(B);
    A = domain_removeLtUnsafe(A, maxB ? Math.floor(minR / maxB) : SUB);
    A = domain_removeGtUnsafe(A, minB ? Math.ceil(maxR / minB) : SUP);
    ASSERT_LOG2('    - updated A:', domain__debug(A), '<floor(' + minR + '/' + domain_max(B) + ')=' + Math.floor(minR / domain_max(B)) + ', ceil(' + maxR + '/' + domain_min(B) + ')=' + Math.ceil(maxR / domain_min(B)) + '>');
    if (!A) return emptyDomain = true;
    let minA = domain_min(A);
    let maxA = domain_max(A);
    B = domain_removeLtUnsafe(B, maxA ? Math.floor(minR / maxA) : SUB);
    B = domain_removeGtUnsafe(B, minA ? Math.ceil(maxR / minA) : SUP);
    ASSERT_LOG2('    - updated B:', domain__debug(B), 'A minmax:', minA, maxA);
    if (!B) return emptyDomain = true;
    minB = domain_min(B);
    maxB = domain_max(B);
    R = domain_removeLtUnsafe(R, minA * minB);
    R = domain_removeGtUnsafe(R, maxA * maxB);
    ASSERT_LOG2('    - updated R:', domain__debug(R), 'B minmax:', minB, maxB);
    if (!R) return emptyDomain = true;
    if (oR !== R || oB !== B) {
      minR = domain_min(R);
      maxR = domain_max(R);
      A = domain_removeLtUnsafe(A, maxB ? Math.floor(minR / maxB) : SUB);
      A = domain_removeGtUnsafe(A, minB ? Math.ceil(maxR / minB) : SUP);
      ASSERT_LOG2('    - updated A:', domain__debug(A), 'R minmax:', minR, maxR);
      if (!A) return emptyDomain = true;
      if (oR !== R || oA !== A) {
        minA = domain_min(A);
        maxA = domain_max(A);
        B = domain_removeLtUnsafe(B, maxA ? Math.floor(minR / maxA) : SUB);
        B = domain_removeGtUnsafe(B, minA ? Math.ceil(maxR / minA) : SUP);
        ASSERT_LOG2('    - updated B:', domain__debug(B), 'A minmax:', domain_min(A), domain_max(A));
        if (!B) return emptyDomain = true;
      }
    }

    ASSERT_LOG2(' ->', domain__debug(A), domain__debug(B), domain__debug(R));

    if (oA !== A || oB !== B || oR !== R) {
      change = true;
      domains[indexA] = A;
      domains[indexB] = B;
      domains[indexR] = R;
    }

    ASSERT((domain_isSolved(A) + domain_isSolved(B) + domain_isSolved(R)) !== 2, 'if two vars are solved the third should be solved as well');

    if (domain_isSolved(R) && domain_isSolved(A)) {
      ASSERT(domain_isSolved(B), 'if two are solved then all three must be solved');
      ml_eliminate(ml, offset, SIZEOF_VVV);
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VVV;
    }
  }

  function cr_div(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    let R = getDomainOrRestartForAlias(indexR, 5);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_mul', indexA, indexB, indexR, domain__debug(A), domain__debug(B), domain__debug(R));
    if (!A || !B || !R) return emptyDomain = true;

    let oA = A;
    let oB = B;
    let oR = R;

    // R = A / B, A = R * B, B = A / R
    // note: A * B = C   ==>   <loA * loB, hiA * hiB> and has rounding/div-by-zero issues!
    // but:  A / B = C   ==>   <loA / hiB, hiA / loB> use "inv-div" tactic
    // keep in mind that any number oob <sub,sup> gets pruned in either case. x/0=0
    // when dividing do integer division where 4/2=2 and 4/3=[] and [1,2]/2=1 and [4,5]/3=[]
    // if the divisor is solved to 0 the result is empty, otherwise; x / <0, y> = <0, SUP>
    // only outer bounds are evaluated here...

    let minR = domain_min(R);
    let maxR = domain_max(R);
    let minB = domain_min(B);
    let maxB = domain_max(B);
    A = domain_removeLtUnsafe(A, minR * minB);
    A = domain_removeGtUnsafe(A, maxR * maxB);
    ASSERT_LOG2('    - updated A:', domain__debug(A), '<floor(' + minR + '*' + minB + ')=' + (minR * minB) + ', (' + maxR + '*' + maxB + ')=' + (maxR / maxB) + '>');
    if (!A) return emptyDomain = true;
    let minA = domain_min(A);
    let maxA = domain_max(A);
    B = domain_removeLtUnsafe(B, maxR ? Math.floor(minA / maxR) : SUB);
    B = domain_removeGtUnsafe(B, minR ? Math.ceil(maxA / minR) : SUP);
    ASSERT_LOG2('    - updated B:', domain__debug(B), 'A minmax:', minA, maxA);
    if (!B) return emptyDomain = true;
    minB = domain_min(B);
    maxB = domain_max(B);
    R = domain_removeLtUnsafe(R, maxB ? Math.floor(minA / maxB) : SUB);
    R = domain_removeGtUnsafe(R, minB ? Math.ceil(maxA / minB) : SUP);
    ASSERT_LOG2('    - updated R:', domain__debug(R), 'B minmax:', minB, maxB);
    if (!R) return emptyDomain = true;
    if (oR !== R || oB !== B) {
      minR = domain_min(R);
      maxR = domain_max(R);
      A = domain_removeLtUnsafe(A, minR * minB);
      A = domain_removeGtUnsafe(A, maxR * maxB);
      ASSERT_LOG2('    - updated A:', domain__debug(A), 'R minmax:', minR, maxR);
      if (!A) return emptyDomain = true;
      if (oR !== R || oA !== A) {
        minA = domain_min(A);
        maxA = domain_max(A);
        B = domain_removeLtUnsafe(B, maxR ? Math.floor(minA / maxR) : SUB);
        B = domain_removeGtUnsafe(B, minR ? Math.ceil(maxA / minR) : SUP);
        ASSERT_LOG2('    - updated B:', domain__debug(B), 'A minmax:', domain_min(A), domain_max(A));
        if (!B) return emptyDomain = true;
      }
    }

    ASSERT_LOG2(' ->', domain__debug(A), domain__debug(B), domain__debug(R));

    if (oA !== A || oB !== B || oR !== R) {
      change = true;
      domains[indexA] = A;
      domains[indexB] = B;
      domains[indexR] = R;
    }

    ASSERT((domain_isSolved(A) + domain_isSolved(B) + domain_isSolved(R)) !== 2, 'if two vars are solved the third should be solved as well');

    if (domain_isSolved(R) && domain_isSolved(A)) {
      ASSERT(domain_isSolved(B), 'if two are solved then all three must be solved');
      ml_eliminate(ml, offset, SIZEOF_VVV);
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VVV;
    }
  }

  function cr_vvv_isEq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    let R = getDomainOrRestartForAlias(indexR, 5);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_vvv_isEq', indexA, indexB, indexR, domain__debug(A), domain__debug(B), domain__debug(R));
    if (!A || !B || !R) return emptyDomain = true;

    let remove = false;
    let vA = domain_getValue(A);
    let vB = domain_getValue(B);
    if (vA >= 0 && vB >= 0) {
      ASSERT_LOG2(' - A and B are solved so we can determine R');
      let result = A === B ? 1 : 0;
      if (domain_containsValue(R, result)) {
        R = domains[indexR] = domain_createValue(result);
        remove = true;
        change = true;
      } else {
        return emptyDomain = true;
      }
    } else {
      if (domain_max(R) > 1) {
        ASSERT_LOG2(' - Trimming R (', domain__debug(R), ') to bool');
        R = domains[indexR] = domain_createRange(0, 1);
        if (!R) return emptyDomain = true;
        change = true;
      }
    }

    // R should be 0 if A==B. R should be 1 if A!==B. R can only end up <= 1.
    let vR = domain_getValue(R);
    if (vR === 0) {
      ASSERT_LOG2(' ! changing iseq to neq and revisiting');
      cr_vvv2vv(ml, offset, ML_VV_NEQ, indexA, indexB);
      pc = offset; // make it repeat with the new neq
      return;
    }
    if (vR === 1) {
      ASSERT_LOG2(' ! changing iseq to eq and revisiting');
      cr_vvv2vv(ml, offset, ML_VV_EQ, indexA, indexB);
      pc = offset; // make it repeat with the new eq
      return;
    }

    ASSERT(domain_min(R) === 0 && domain_max(R) === 1, 'R wasnt solved so it must be a bool domain at this point');
    if (domain_max(A) < domain_min(B) || domain_min(A) > domain_max(B)) {
      ASSERT_LOG2(' - no overlap between', indexA, 'and', indexB, ' (', domain__debug(A), domain__debug(B), ') so R becomes 0 and constraint is removed');
      // B is solved but A doesn't contain that value, R becomes 0 and the constraint is removed
      R = domains[indexR] = domain_createValue(0);
      change = true;
      remove = true;
    }

    ASSERT(domain_min(R) === 0 && domain_max(R) >= 1, 'R should be boolable at this point');

    ASSERT_LOG2(' ->', domain__debug(A), domain__debug(B), domain__debug(R));

    if (remove) {
      ml_eliminate(ml, offset, SIZEOF_VVV);
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VVV;
    }
  }

  function cr_v8v_isEq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 4;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let R = getDomainOrRestartForAlias(indexR, 4);
    ASSERT_LOG2(' = cr_v8v_isEq', '{', indexR, '} = {', indexA, '} ==?', vB, '-->', domain__debug(R), '=', domain__debug(A), '==?', vB);
    if (A === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    if (!A || !R) return emptyDomain = true;

    let vR = domain_getValue(R);
    if (vR >= 0) {
      cr_v8v2v88(ml, offset, ML_V88_ISEQ, indexA, vB, vR);
      pc = offset; // revisit
      return;
    }

    // okay, R isnt solved (yet)
    let remove = false;
    let oR = R;
    if (!domain_containsValue(A, vB)) {
      R = domain_createValue(vR = 0);
      remove = true;
    } else if (domain_isSolved(A)) {
      // A and B are solved and A contains B so R=1
      R = domain_createValue(vR = 1);
      remove = true;
    } else if (domain_min(R) > 1) {
      return emptyDomain = true;
    } else if (domain_max(R) > 1) {
      R = domain_createRange(0, 1);
    }

    if (R !== oR) {
      ASSERT_LOG2(' - R updated from', domain__debug(oR), 'to', domain__debug(R));
      if (!R) return emptyDomain = true;
      domains[indexR] = R;
      change = true;
    }

    // R should be 0 if A==B. R should be 1 if A!==B. R can only end up <= 1.
    if (vR === 0) {
      ASSERT_LOG2(' ! vR=0 so changing iseq to neq and revisiting');
      cr_v8v2v8(ml, offset, ML_V8_NEQ, indexA, vB);
      pc = offset; // make it repeat with the new neq
      return;
    }
    if (vR === 1) {
      ASSERT_LOG2(' ! vR=1 so changing iseq to eq and revisiting');
      cr_v8v2v8(ml, offset, ML_V8_EQ, indexA, vB);
      pc = offset; // make it repeat with the new eq
      return;
    }

    ASSERT(domain_min(R) === 0 && domain_max(R) >= 1, 'R should be boolable at this point');
    ASSERT_LOG2(' ->', domain__debug(A), vB, domain__debug(R));

    if (remove) {
      ASSERT(domain_isSolved(A) && domain_isSolved(R), 'A and R should be solved because otherwise the op should be morphed to a regular eq/neq');
      ml_eliminate(ml, offset, SIZEOF_V8V);
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;

      // if A=[0 1], B=0|1, R=[0 1] we can recompile this to a simpler op
      ASSERT(domain_max(A) !== 0, 'if it were zero then it would be solved and that case is caught above');
      if (vB <= 1 && domain_max(A) === 1) {
        // - B=0: 0==B=1, 1==B=0: A!=R
        // - B=1: 0==B=0, 1==B=1: A==R
        cr_v8v2vv(ml, offset, vB === 0 ? ML_VV_NEQ : ML_VV_EQ, indexA, indexR);
        pc = offset; // revisit
      } else {
        pc = offset + SIZEOF_V8V;
      }
    }
  }

  function cr_vv8_isEq(ml) {
    let offset = pc;
    let offsetR = offset + 5;
    let vR = ml_dec8(ml, offsetR);

    ASSERT_LOG2(' = cr_vv8_isEq', vR, 'immediately recompile to eq or neq');

    // we know R is solved so just recompile it to eq or neq
    if (vR === 0) {
      ASSERT_LOG2(' ! changing iseq to neq and revisiting');
      // compile a neq and restart
      ml_enc8(ml, offset, ML_VV_NEQ);
      ml_skip(ml, offset + SIZEOF_VV, SIZEOF_VV8 - SIZEOF_VV);
      pc = offset; // make it repeat with the new neq
      return;
    }

    if (vR === 1) {
      ASSERT_LOG2(' ! changing iseq to eq and revisiting');
      // compile an eq and restart
      ml_enc8(ml, offset, ML_VV_EQ);
      ml_skip(ml, offset + SIZEOF_VV, SIZEOF_VV8 - SIZEOF_VV);
      pc = offset; // make it repeat with the new eq
      return;
    }

    // it's technically possible to input a problem where the result var is solved to a non-bool value...
    return emptyDomain = true;
  }

  function cr_88v_isEq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 3;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let R = getDomainOrRestartForAlias(indexR, 4);
    if (R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_88v_isEq', indexR, vA, vB, domain__debug(R));
    if (!R) return emptyDomain = true;

    ASSERT_LOG2(' - A and B are solved so we can determine R');

    let oR = R;
    let vR = vA === vB ? 1 : 0;
    if (!domain_containsValue(R, vR)) return emptyDomain = true;
    R = domains[indexR] = domain_createValue(vR);
    if (R !== oR) change = true;

    ASSERT_LOG2(' ->', vA, vB, domain__debug(R));

    ml_eliminate(ml, offset, SIZEOF_88V);
  }

  function cr_v88_isEq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 4;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v88_isEq', vR, '= {', indexA, '} ==?', vB, ' --> ', vR, '=', domain__debug(A), '==?', vB);
    if (!A) return emptyDomain = true;
    if (vR > 1) return emptyDomain = true; // R must be bool bound

    ASSERT_LOG2(' - B and R are solved so we can determine A');

    let oA = A;
    if (vR === 1) {
      if (!domain_containsValue(A, vB)) return emptyDomain = true;
      A = domain_createValue(vB);
    } else {
      A = domain_removeValue(A, vB);
      if (!A) return emptyDomain = true;
    }
    if (A !== oA) {
      ASSERT_LOG2(' - A (', indexA, ') changed from', domain__debug(oA), 'to', domain__debug(A));
      domains[indexA] = A;
      change = true;
    }

    ASSERT_LOG2(' ->', vR, '=', domain__debug(A), '==?', vB);

    ml_eliminate(ml, offset, SIZEOF_V88);
  }

  function cr_888_isEq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 3;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    ASSERT_LOG2(' = cr_888_isEq', vA, vB, vR);
    ASSERT_LOG2(' - already resolved, only need to verify it');
    if (vR > 1) return emptyDomain = true; // R must be bool bound

    // isEq !== shouldEq
    if ((vA === vB) !== (vR === 1)) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_888);
  }

  function cr_vvv_isNeq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    let R = getDomainOrRestartForAlias(indexR, 5);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_isNeq', indexA, indexB, indexR, domain__debug(A), domain__debug(B), domain__debug(R));
    if (!A || !B || !R) return emptyDomain = true;

    let remove = false;
    if (domain_getValue(A) >= 0 && domain_getValue(B) >= 0) {
      ASSERT_LOG2(' - A and B are solved so we can determine R');
      let result = A !== B ? 1 : 0;
      if (domain_containsValue(R, result)) {
        R = domains[indexR] = domain_createValue(result);
        remove = true;
        change = true;
      } else {
        return emptyDomain = true;
      }
    } else {
      if (domain_min(R) > 1) return emptyDomain = true;
      if (domain_max(R) > 1) {
        ASSERT_LOG2(' - Trimming R (', domain__debug(R), ') to bool');
        ASSERT(domain_min(R) === 0, 'should be min zero'); // TODO: why? we havent asserted it not being solved yet
        R = domains[indexR] = domain_createRange(0, 1);
        change = true;
      }
    }

    // R should be 0 if A==B. R should be 1 if A!==B. R can only end up <= 1.
    let vR = domain_getValue(R);
    if (vR === 0) {
      ASSERT_LOG2(' ! changing isneq to eq and revisiting');
      cr_vvv2vv(ml, offset, ML_VV_EQ, indexA, indexB);
      pc = offset; // make it repeat with the new neq
      return;
    }
    if (vR === 1) {
      ASSERT_LOG2(' ! changing isneq to neq and revisiting');
      cr_vvv2vv(ml, offset, ML_VV_NEQ, indexA, indexB);
      pc = offset; // make it repeat with the new eq
      return;
    }

    ASSERT(domain_min(R) === 0 && domain_max(R) >= 1, 'R should be boolable at this point');

    ASSERT_LOG2(' ->', domain__debug(A), domain__debug(B), domain__debug(R));

    if (remove) {
      ml_eliminate(ml, offset, SIZEOF_VVV);
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VVV;
    }
  }

  function cr_v8v_isNeq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 4;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let R = getDomainOrRestartForAlias(indexR, 4);
    if (A === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v8v_isNeq', indexA, indexR, domain__debug(A), vB, domain__debug(R));
    if (!A || !R) return emptyDomain = true;

    let vA = domain_getValue(A);
    if (vA >= 0) {
      ASSERT_LOG2(' - A and B are solved so we can determine R');
      let result = vA !== vB ? 1 : 0;
      if (!domain_containsValue(R, result)) return emptyDomain = true;
      R = domains[indexR] = domain_createValue(result);
      change = true;

      ml_eliminate(ml, offset, SIZEOF_V8V);
      return;
    }

    if (domain_max(R) > 1) {
      if (domain_min(R) > 1) return emptyDomain = true;
      ASSERT_LOG2(' - Trimming R (', domain__debug(R), ') to bool');
      R = domains[indexR] = domain_createRange(0, 1); // TODO: we havent asserted R isnt solved so this isnt safe
      if (!R) return emptyDomain = true;
      change = true;
    }

    let vR = domain_getValue(R);
    if (vR === 0) {
      ASSERT_LOG2(' ! vR=0 so changing isneq to eq and revisiting');
      cr_v8v2v8(ml, offset, ML_V8_EQ, indexA, vB);
      pc = offset; // make it repeat with the new neq
      return;
    }
    if (vR === 1) {
      ASSERT_LOG2(' ! vR=1 so changing isneq to neq and revisiting');
      cr_v8v2v8(ml, offset, ML_V8_NEQ, indexA, vB);
      pc = offset; // make it repeat with the new eq
      return;
    }

    ASSERT(domain_min(R) === 0 && domain_max(R) >= 1, 'R should be boolable at this point');

    ASSERT_LOG2(' ->', domain__debug(A), vB, domain__debug(R));
    ASSERT_LOG2(' - not only jumps...');
    onlyJumps = false;

    // if A=[0 1], B=0|1, R=[0 1] we can recompile this to a simpler op
    ASSERT(domain_max(A) !== 0, 'if max(A) were zero then it would be solved and that case is caught above');
    if (vB <= 1 && domain_max(A) === 1) {
      // - B=0: 0!=B=0, 1!=B=1: A==R
      // - B=1: 0!=B=1, 1!=B=0: A!=R
      cr_v8v2vv(ml, offset, vB === 0 ? ML_VV_EQ : ML_VV_NEQ, indexA, indexR);
      pc = offset; // revisit
    } else {
      pc = offset + SIZEOF_V8V;
    }
  }

  function cr_vv8_isNeq(ml) {
    let offset = pc;
    let offsetR = offset + 4;
    let vR = ml_dec16(ml, offsetR);

    ASSERT_LOG2(' = cr_vv8_isNeq', vR, 'immediately recompile to neq or eq');

    // we know R is solved so just recompile it to eq or neq
    if (vR === 0) {
      ASSERT_LOG2(' ! changing isneq to eq and revisiting');
      // compile a neq and restart
      ml_enc8(ml, offset, ML_VV_EQ);
      ml_skip(ml, offset + SIZEOF_VV, SIZEOF_VV8 - SIZEOF_VV);
      pc = offset; // make it repeat with the new neq
      return;
    }

    if (vR === 1) {
      ASSERT_LOG2(' ! changing isneq to neq and revisiting');
      // compile an eq and restart
      ml_enc8(ml, offset, ML_VV_NEQ);
      ml_skip(ml, offset + SIZEOF_VV, SIZEOF_VV8 - SIZEOF_VV);
      pc = offset; // make it repeat with the new eq
      return;
    }

    // it's technically possible to input a problem where the result var is solved to a non-bool value...
    return emptyDomain = true;
  }

  function cr_88v_isNeq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 3;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let R = getDomainOrRestartForAlias(indexR, 3);
    if (R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_88v_isNeq', indexR, vA, vB, domain__debug(R));
    if (!R) return emptyDomain = true;

    ASSERT_LOG2(' - A and B are solved so we can determine R');

    let oR = R;
    let vR = vA !== vB ? 1 : 0;
    if (!domain_containsValue(R, vR)) return emptyDomain = true;
    R = domains[indexR] = domain_createValue(vR);
    if (R !== oR) change = true;

    ASSERT_LOG2(' ->', vA, vB, domain__debug(R));

    ml_eliminate(ml, offset, SIZEOF_88V);
  }

  function cr_v88_isNeq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 4;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v88_isNeq', indexA, domain__debug(A), vB, vR);
    if (!A) return emptyDomain = true;
    if (vR > 1) return emptyDomain = true; // R must be bool bound

    ASSERT_LOG2(' - B and R are solved so we can determine A');

    let oA = A;
    if (vR === 1) {
      A = domain_removeValue(A, vB);
      if (!A) return emptyDomain = true;
    } else {
      if (!domain_containsValue(A, vB)) return emptyDomain = true;
      A = domain_createValue(vB);
    }
    if (A !== oA) {
      domains[indexA] = A;
      change = true;
    }

    ASSERT_LOG2(' ->', domain__debug(A), vB, vR);
    ml_eliminate(ml, offset, SIZEOF_V88);
  }

  function cr_888_isNeq(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 3;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    ASSERT_LOG2(' = cr_888_isEq', vA, vB, vR);
    ASSERT_LOG2(' - already resolved, only need to verify it');
    if (vR > 1) return emptyDomain = true; // R must be bool bound

    // isNeq !== shouldNeq
    if ((vA !== vB) !== (vR === 1)) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_888);
  }

  function cr_vvv_isLt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    let R = getDomainOrRestartForAlias(indexR, 5);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_vvv_isLt', indexA, indexB, indexR, domain__debug(A), domain__debug(B), domain__debug(R));
    if (!A || !B || !R) return emptyDomain = true;

    let oR = R;
    R = domain_removeGtUnsafe(R, 1);
    let vR = domain_getValue(R);
    if (vR < 0) {
      // if R isn't set you can't really update A or B. so we don't.
      if (domain_max(A) < domain_min(B)) R = domain_createValue(vR = 1);
      else if (domain_min(A) >= domain_max(B)) R = domain_createValue(vR = 0);
    }
    if (R !== oR) {
      change = true;
      domains[indexR] = R;
    }

    // if R is solved replace this isLt with an lt or "gt" and repeat.
    // the appropriate op can then prune A and B accordingly.
    // in this context, the inverse for lt is an lte with swapped args
    if (vR === 1) {
      ASSERT_LOG2(' ! result var solved to 1 so compiling an lt in its place');
      cr_vvv2vv(ml, offset, ML_VV_LT, indexA, indexB);
      pc = offset; // make it repeat with the new lt
    } else if (vR === 0) {
      ASSERT_LOG2(' ! result var solved to 0 so compiling an lte with swapped args in its place');
      cr_vvv2vv(ml, offset, ML_VV_LTE, indexB, indexA);
      // replace isLt with a regular lte
      pc = offset; // make it repeat with the new lt
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VVV;
    }
  }

  function cr_8vv_isLt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 4;
    let vA = ml_dec8(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let B = getDomainOrRestartForAlias(indexB, 2);
    let R = getDomainOrRestartForAlias(indexR, 4);
    if (B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_8vv_isLt', indexB, indexR, vA, domain__debug(B), domain__debug(R));
    if (!B || !R) return emptyDomain = true;

    let oR = R;
    R = domain_removeGtUnsafe(R, 1);
    let vR = domain_getValue(R);
    if (vR < 0) {
      // if R isn't set you can't really update A or B. so we don't.
      if (vA < domain_min(B)) R = domain_createValue(vR = 1);
      else if (vA >= domain_max(B)) R = domain_createValue(vR = 0);
    }
    if (R !== oR) {
      change = true;
      domains[indexR] = R;
    }

    // if R is solved replace this isLt with an lt or "gt" and repeat.
    // the appropriate op can then prune A and B accordingly.
    // in this context, the inverse for lt is an lte with swapped args
    if (vR === 1) {
      ASSERT_LOG2(' ! result var solved to 1 so compiling an lt in its place');
      cr_8vv28v(ml, offset, ML_8V_LT, vA, indexB);
      pc = offset; // make it repeat with the new lt
    } else if (vR === 0) {
      ASSERT_LOG2(' ! result var solved to 0 so compiling an lte with swapped args in its place');
      cr_8vv2v8(ml, offset, ML_V8_LTE, indexB, vA);
      pc = offset; // make it repeat with the new lt
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;

      // if A=0|1, B=[0 1], R=[0 1] we can recompile this to a simpler op
      ASSERT(domain_max(B) !== 0, 'if max(B) were zero then R would be solved and that case is caught above');
      if (vA <= 1 && domain_max(B) === 1) {
        // - A=0: A<0=0, A<1=1: B=R
        // - A=1: A<0=0, A<1=0: R=0, remove constraint (already done above)
        ASSERT(vA === 0, 'the path for A=1 is handled above');
        cr_8vv2vv(ml, offset, ML_VV_EQ, indexB, indexR);
        pc = offset; // revisit
      } else {
        pc = offset + SIZEOF_8VV;
      }
    }
  }

  function cr_v8v_isLt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 4;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let R = getDomainOrRestartForAlias(indexR, 4);
    if (A === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v8v_isLt', indexA, indexR, domain__debug(A), vB, domain__debug(R));
    if (!A || !R) return emptyDomain = true;

    let oR = R;
    R = domain_removeGtUnsafe(R, 1);
    let vR = domain_getValue(R);
    if (vR < 0) {
      // if R isn't set you can't really update A or B. so we don't.
      if (domain_max(A) < vB) R = domain_createValue(vR = 1);
      else if (domain_min(A) >= vB) R = domain_createValue(vR = 0);
    }
    if (R !== oR) {
      change = true;
      domains[indexR] = R;
    }

    // if R is solved replace this isLt with an lt or "gt" and repeat.
    // the appropriate op can then prune A and B accordingly.
    // in this context, the inverse for lt is an lte with swapped args
    if (vR === 1) {
      ASSERT_LOG2(' ! result var solved to 1 so compiling an lt in its place');
      cr_v8v2v8(ml, offset, ML_V8_LT, indexA, vB);
      pc = offset; // make it repeat with the new lt
    } else if (vR === 0) {
      ASSERT_LOG2(' ! result var solved to 0 so compiling an lte with swapped args in its place');
      cr_v8v28v(ml, offset, ML_8V_LTE, vB, indexA);
      pc = offset; // make it repeat with the new lt
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;

      // if A=[0 1], B=0|1, R=[0 1] we can recompile this to a simpler op
      ASSERT(domain_max(A) !== 0, 'if max(A) were zero then R would be solved and that case is caught above');
      if (vB <= 1 && domain_max(A) === 1) {
        // - B=0: 0<B=0, 1<B=0: R=0, remove constraint (already done above)
        // - B=1: 0<B=1, 1<B=0: A!=R
        ASSERT(vB === 0, 'the path for B=0 is handled above');
        cr_v8v2vv(ml, offset, ML_VV_NEQ, indexA, indexR);
        pc = offset; // revisit
      } else {
        pc = offset + SIZEOF_V8V;
      }
    }
  }

  function cr_vv8_isLt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_vv8_isLt', indexA, indexB, domain__debug(A), domain__debug(B), vR);
    if (!A || !B) return emptyDomain = true;

    // R is solved so just replace the reifier by its non-reifier component

    // if R is solved replace this isLt with an lt or "gt" and repeat.
    // the appropriate op can then prune A and B accordingly.
    // in this context, the inverse for lt is an lte with swapped args
    if (vR === 1) {
      ASSERT_LOG2(' ! result var solved to 1 so compiling an lt in its place');
      cr_vv82vv(ml, offset, ML_VV_LT, indexA, indexB);
      pc = offset; // make it repeat with the new lt
    } else if (vR === 0) {
      ASSERT_LOG2(' ! result var solved to 0 so compiling an lte with swapped args in its place');
      cr_vv82vv(ml, offset, ML_VV_LTE, indexB, indexA);
      pc = offset; // make it repeat with the new lt
    } else {
      ASSERT_LOG2(vR > 1, 'possible artifact but unresolvable regardless');
      return emptyDomain = true;
    }
  }

  function cr_88v_isLt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 3;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let R = getDomainOrRestartForAlias(indexR, 3);
    if (R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_88v_isLt', indexR, vA, vB, domain__debug(R));
    if (!R) return emptyDomain = true;

    // we know A and B so determine R and remove constraint
    let oR = R;
    if (vA < vB) R = domain_intersectionValue(R, 1);
    else R = domain_intersectionValue(R, 0);
    if (R !== oR) {
      if (!R) return emptyDomain = true;
      change = true;
      domains[indexR] = R;
    }

    ml_eliminate(ml, offset, SIZEOF_88V);
  }

  function cr_v88_isLt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 4;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v88_isLt', indexA, domain__debug(A), vB, vR);
    if (!A) return emptyDomain = true;

    // we know A and R so determine B and remove constraint
    if (vR === 1) {
      A = domains[indexA] = domain_removeGte(A, vB);
    } else if (vR === 0) {
      A = domains[indexA] = domain_removeLtUnsafe(A, vB);
    } else {
      return emptyDomain = true;
    }

    if (!A) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_V88);
  }

  function cr_8v8_isLt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 4;
    let vA = ml_dec8(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    let B = getDomainOrRestartForAlias(indexB, 2);
    if (B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_8v8_isLt', indexB, vA, domain__debug(B), vR);
    if (!B) return emptyDomain = true;

    // we know A and R so determine B and remove constraint
    if (vR === 1) {
      B = domains[indexB] = domain_removeLte(B, vA);
    } else if (vR === 0) {
      B = domains[indexB] = domain_removeGtUnsafe(B, vA);
    } else {
      return emptyDomain = true;
    }

    if (!B) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_8V8);
  }

  function cr_888_isLt(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 3;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    ASSERT_LOG2(' = cr_888_isLt', vA, vB, vR);

    // just check
    if ((vA < vB) !== (vR === 1)) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_888);
  }

  function cr_vvv_isLte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    let R = getDomainOrRestartForAlias(indexR, 5);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_vvv_isLte', indexA, indexB, indexR, domain__debug(A), domain__debug(B), domain__debug(R));
    if (!A || !B || !R) return emptyDomain = true;

    let oR = R;
    R = domain_removeGtUnsafe(R, 1);
    let vR = domain_getValue(R);
    if (vR < 0) {
      // if R isn't set you can't really update A or B. so we don't.
      if (domain_max(A) <= domain_min(B)) R = domain_createValue(vR = 1);
      else if (domain_min(A) > domain_max(B)) R = domain_createValue(vR = 0);
    }
    if (R !== oR) {
      change = true;
      domains[indexR] = R;
    }

    // if R is solved replace this isLt with an lt or "gt" and repeat.
    // the appropriate op can then prune A and B accordingly.
    // in this context, the inverse for lt is an lte with swapped args
    if (vR === 1) {
      ASSERT_LOG2(' ! result var solved to 1 so compiling an lte in its place');
      cr_vvv2vv(ml, offset, ML_VV_LTE, indexA, indexB);
      pc = offset; // make it repeat with the new lt
    } else if (vR === 0) {
      ASSERT_LOG2(' ! result var solved to 0 so compiling an lt with swapped args in its place');
      // replace isLt with a regular lte
      cr_vvv2vv(ml, offset, ML_VV_LT, indexB, indexA);
      pc = offset; // make it repeat with the new lt
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_VVV;
    }
  }

  function cr_8vv_isLte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 4;
    let vA = ml_dec8(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let B = getDomainOrRestartForAlias(indexB, 2);
    let R = getDomainOrRestartForAlias(indexR, 4);
    if (B === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_8vv_isLte', indexB, indexR, '->', vA, domain__debug(B), domain__debug(R));
    if (!B || !R) return emptyDomain = true;

    let oR = R;
    R = domain_removeGtUnsafe(R, 1);
    let vR = domain_getValue(R);
    if (vR < 0) {
      // if R isn't set you can't really update A or B. so we don't.
      if (vA <= domain_min(B)) R = domain_createValue(vR = 1);
      else if (vA > domain_max(B)) R = domain_createValue(vR = 0);
    }
    if (R !== oR) {
      change = true;
      domains[indexR] = R;
    }

    // if R is solved replace this isLt with an lt or "gt" and repeat.
    // the appropriate op can then prune A and B accordingly.
    // in this context, the inverse for lt is an lte with swapped args
    if (vR === 1) {
      ASSERT_LOG2(' ! result var solved to 1 so compiling an lte in its place');
      cr_8vv28v(ml, offset, ML_8V_LTE, vA, indexB);
      pc = offset; // make it repeat with the new lt
    } else if (vR === 0) {
      ASSERT_LOG2(' ! result var solved to 0 so compiling an lt with swapped args in its place');
      cr_8vv2v8(ml, offset, ML_V8_LT, indexB, vA);
      pc = offset; // make it repeat with the new lt
    } else {
      // if A=0|1, B=[0 1], R=[0 1] we can recompile this to a simpler op
      ASSERT(domain_max(B) !== 0, 'if max(B) were zero then R would be solved and that case is caught above');
      if (vA <= 1 && domain_max(B) === 1) {
        // - A=0: A<=0=1, A<=1=1: R=1, remove constraint (Already done above)
        // - A=1: A<=0=0, A<=1=1: B==R
        ASSERT(vA === 1, 'the path for A=0 is handled above');
        cr_8vv2vv(ml, offset, ML_VV_EQ, indexB, indexR);
        pc = offset; // revisit
      } else {
        ASSERT_LOG2(' - not only jumps...');
        onlyJumps = false;
        pc = offset + SIZEOF_8VV;
      }
    }
  }

  function cr_v8v_isLte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 4;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let R = getDomainOrRestartForAlias(indexR, 4);
    if (A === MINIMIZE_ALIASED || R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v8v_isLte', indexA, indexR, domain__debug(A), vB, domain__debug(R));
    if (!A || !R) return emptyDomain = true;

    let oR = R;
    R = domain_removeGtUnsafe(R, 1);
    let vR = domain_getValue(R);
    if (vR < 0) {
      // if R isn't set you can't really update A or B. so we don't.
      if (domain_max(A) <= vB) R = domain_createValue(vR = 1);
      else if (domain_min(A) > vB) R = domain_createValue(vR = 0);
    }
    if (R !== oR) {
      change = true;
      domains[indexR] = R;
    }

    // if R is solved replace this isLt with an lt or "gt" and repeat.
    // the appropriate op can then prune A and B accordingly.
    // in this context, the inverse for lt is an lte with swapped args
    if (vR === 1) {
      ASSERT_LOG2(' ! result var solved to 1 so compiling an lte in its place');
      cr_v8v2v8(ml, offset, ML_V8_LTE, indexA, vB);
      pc = offset; // make it repeat with the new lt
    } else if (vR === 0) {
      ASSERT_LOG2(' ! result var solved to 0 so compiling an lt with swapped args in its place');
      cr_v8v28v(ml, offset, ML_8V_LT, vB, indexA);
      pc = offset; // make it repeat with the new lt
    } else {
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;

      // if A=[0 1], B=0|1, R=[0 1] we can recompile this to a simpler op
      ASSERT(domain_max(A) !== 0, 'if max(A) were zero then R would be solved and that case is caught above');
      if (vB <= 1 && domain_max(A) === 1) {
        // - B=0: 0<=B=1, 1<=B=0: B!=R
        // - B=1: 0<=B=1, 1<=B=1: R=1, remove constraint (already done above)
        ASSERT(vB === 0, 'the path for A=1 is handled above');
        cr_v8v2vv(ml, offset, ML_VV_NEQ, indexA, indexR);
        pc = offset; // revisit
      } else {
        pc = offset + SIZEOF_V8V;
      }
    }
  }

  function cr_vv8_isLte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 5;
    let indexA = ml_dec16(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    let B = getDomainOrRestartForAlias(indexB, 3);
    if (A === MINIMIZE_ALIASED || B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_vv8_isLte', indexA, indexB, domain__debug(A), domain__debug(B), vR);
    if (!A || !B) return emptyDomain = true;

    // R is solved so just replace the reifier by its non-reifier component

    // if R is solved replace this isLt with an lt or "gt" and repeat.
    // the appropriate op can then prune A and B accordingly.
    // in this context, the inverse for lt is an lte with swapped args
    if (vR === 1) {
      ASSERT_LOG2(' ! result var solved to 1 so compiling an lte in its place');
      cr_vv82vv(ml, offset, ML_VV_LTE, indexA, indexB);
      pc = offset; // make it repeat with the new lt
    } else if (vR === 0) {
      ASSERT_LOG2(' ! result var solved to 0 so compiling an lt with swapped args in its place');
      cr_vv82vv(ml, offset, ML_VV_LTE, indexB, indexA);
      pc = offset; // make it repeat with the new lt
    } else {
      ASSERT_LOG2(vR > 1, 'possible artifact but unresolvable regardless');
      return emptyDomain = true;
    }
  }

  function cr_88v_isLte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 3;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let indexR = ml_dec16(ml, offsetR);

    let R = getDomainOrRestartForAlias(indexR, 3);
    if (R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_88v_isLte', vA, vB, domain__debug(R));
    if (!R) return emptyDomain = true;

    // we know A and B so determine R and remove constraint
    let oR = R;
    if (vA <= vB) R = domain_intersectionValue(R, 1);
    else R = domain_intersectionValue(R, 0);
    if (R !== oR) {
      if (!R) return emptyDomain = true;
      change = true;
      domains[indexR] = R;
    }

    ml_eliminate(ml, offset, SIZEOF_88V);
  }

  function cr_v88_isLte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 3;
    let offsetR = offset + 4;
    let indexA = ml_dec16(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    let A = getDomainOrRestartForAlias(indexA, 1);
    if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_v88_isLte', indexA, domain__debug(A), vB, vR);
    if (!A) return emptyDomain = true;

    // we know A and R so determine B and remove constraint
    if (vR === 1) {
      A = domains[indexA] = domain_removeGtUnsafe(A, vB);
    } else if (vR === 0) {
      A = domains[indexA] = domain_removeLte(A, vB);
    } else {
      return emptyDomain = true;
    }

    if (!A) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_V88);
  }

  function cr_8v8_isLte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 4;
    let vA = ml_dec8(ml, offsetA);
    let indexB = ml_dec16(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    let B = getDomainOrRestartForAlias(indexB, 2);
    if (B === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_8v8_isLte', indexB, vA, domain__debug(B), vR);
    if (!B) return emptyDomain = true;

    // we know A and R so determine B and remove constraint
    if (vR === 1) {
      B = domains[indexB] = domain_removeLtUnsafe(B, vA);
    } else if (vR === 0) {
      B = domains[indexB] = domain_removeGte(B, vA);
    } else {
      return emptyDomain = true;
    }

    if (!B) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_8V8);
  }

  function cr_888_isLte(ml) {
    let offset = pc;
    let offsetA = offset + 1;
    let offsetB = offset + 2;
    let offsetR = offset + 3;
    let vA = ml_dec8(ml, offsetA);
    let vB = ml_dec8(ml, offsetB);
    let vR = ml_dec8(ml, offsetR);

    ASSERT_LOG2(' = cr_888_isLte', vA, vB, vR);

    // just check
    if ((vA <= vB) !== (vR === 1)) return emptyDomain = true;

    ml_eliminate(ml, offset, SIZEOF_888);
  }

  function cr_sum(ml) {
    let offset = pc;
    ASSERT_LOG2(' - parsing sum:', ml.slice(offset, offset + 10));
    let offsetCount = offset + 1;
    let argCount = ml_dec16(ml, offsetCount);
    let offsetConstant = offset + 3;
    let fixedConstant = ml_dec8(ml, offsetConstant);
    let oplen = SIZEOF_C8_COUNT + argCount * 2 + 2;
    ASSERT_LOG2(' - ml for this sum:', ml.slice(offset, offset + oplen));
    let offsetArgs = offset + SIZEOF_C8_COUNT;
    let offsetR = offsetArgs + argCount * 2;
    let indexR = ml_dec16(ml, offsetR);

    let R = getDomainOrRestartForAlias(indexR, SIZEOF_C8_COUNT + argCount * 2);
    ASSERT_LOG2(' - offset R =', offsetR, 'indexR=', indexR, 'R=', domain__debug(R));
    if (R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_sum', argCount, 'x');
    ASSERT_LOG2('  -> {' + indexR + '=' + domain__debug(R) + '} = ', Array.from(Array(argCount)).map((n, i, x) => (x = ml_dec16(ml, offsetArgs + i * 2)) + '=>' + domain__debug(domains[x])).join(' '));
    ASSERT_LOG2(' - start loop, backwards');

    // a sum is basically a pyramid of plusses; (A+B)+(C+D) etc
    // to prevent generating an array we'll decode every var during the loop...
    // we loop back to front because we're splicing out vars while looping

    // replace all constants by one constant
    // prune the result var by the outer bounds of the sum of the args
    // in limited cases we can prune some of the arg values if the result forces
    // that (if the result is max 10 then inputs can be pruned of any value > 10)
    // we cant really do anything else

    let sumLo = 0;
    let sumHi = 0;
    for (let i = argCount - 1; i >= 0; --i) {
      let indexOffsetDelta = SIZEOF_C8_COUNT + i * 2;
      let indexA = ml_dec16(ml, offset + indexOffsetDelta);
      let A = getDomainOrRestartForAlias(indexA, indexOffsetDelta);
      ASSERT_LOG2('   - sum arg:', i, 'index:', indexA, 'domain:', domain__debug(A));
      if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op
      if (!A) return emptyDomain = true;
      let min = domain_min(A);
      let max = domain_max(A);
      sumLo += min;
      sumHi += max;
    }

    ASSERT_LOG2(' - total min=', sumLo, ', max=', sumHi, '. applying bounds to this R:', domain__debug(R));

    // trim the result to <low, hi>, which is the sum of the lows and his of all the args
    let oR = R;
    R = domain_removeLtUnsafe(R, sumLo);
    R = domain_removeGtUnsafe(R, sumHi);
    ASSERT_LOG2(' - Updated R from', domain__debug(oR), 'to', domain__debug(R));
    if (R !== oR) {
      if (!R) return emptyDomain = true;
      change = true;
      domains[indexR] = R;
    }

    let minR = domain_min(R);
    let maxR = domain_max(R);

    ASSERT_LOG2(' - Now back propagating R to the args', minR, maxR);

    // now trim the args for any value that can not amount to a valid result according to R
    // we use the min and max of R, subtract the total hi or lo from that number without the
    // hi or lo of the current var and the result will be the value that this var can at
    // least or most add to the total sum. oob values can be cut.
    let constants = 0;
    let constantSum = 0;
    let var1 = -1; // for 1 and 2 var optim, track which vars were non-constants
    let var2 = -1;
    for (let i = 0; i < argCount; ++i) {
      let indexOffsetDelta = SIZEOF_C8_COUNT + i * 2;
      let indexA = ml_dec16(ml, offset + indexOffsetDelta);
      let A = getDomainOrRestartForAlias(indexA, indexOffsetDelta);
      if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op
      let oA = A;
      A = domain_removeLtUnsafe(A, minR - (sumHi - domain_max(A)));
      A = domain_removeGtUnsafe(A, maxR - (sumLo - domain_min(A)));
      ASSERT_LOG2('   - sum arg:', i, 'index:', indexA, 'before:', domain__debug(oA), 'after:', domain__debug(A));
      if (A !== oA) {
        ASSERT_LOG2('   - updated', indexA, 'from', domain__debug(oA), 'to', domain__debug(A));
        if (!A) return emptyDomain = true;
        change = true;
        domains[indexA] = A;
      }
      let vA = domain_getValue(A);
      if (vA >= 0) {
        ++constants;
        constantSum += vA;
      } else if (var1 === -1) {
        var1 = i;
      } else if (var2 === -1) {
        var2 = i;
      }
    }

    ASSERT_LOG2(' -> There are now', constants, 'constants and', argCount - constants, 'non-constants left. Constants sum to', constantSum);
    ASSERT_LOG2(constants && !constantSum && (argCount - constants) <= 2 ? ' - Dropping the zero-valued constants and rewriting the remaining args' : ' - No zero-valued constants to drop');
    ASSERT_LOG2(' -> Result of vars: ', Array.from(Array(argCount)).map((n, i) => domain__debug(domains[ml_dec16(ml, offsetArgs + i * 2)])).join(' '), ' Result:', domain__debug(R));

    if (argCount - constants === (constantSum ? 1 : 2)) {
      ASSERT_LOG2(' - Two concrete vars/values left to sum, rewriting to a plus');
      ASSERT_LOG2(' - Var 1 is the', var1, 'th arg and var 2 is', (constantSum ? 'the constant ' + constantSum : 'the ' + var2 + 'th arg'));
      ASSERT(constantSum ? var2 === -1 : var2 >= 0, 'if there are non-zero constants there should not be a second non-constant here otherwise expecting a second var');
      // there are either two non-constants and no constants,
      // or one non-constant and some constants left
      // consolidate the constants into one and recompile the
      // whole sum as a regular plus
      // compile a jmp for the unused var fields

      // TODO: note: use the plus opcode that accepts a literal
      let newIndexA = ml_dec16(ml, offsetArgs + var1 * 2);
      let newIndexB = constants ? getVar(addVar(undefined, constantSum, undefined, true)) : ml_dec16(ml, offsetArgs + var2 * 2);

      ASSERT(argCount >= 2, 'need at least two vars to have enough space for a plus');
      ml_enc8(ml, offset, ML_PLUS);
      ml_enc16(ml, offset + 1, newIndexA);
      ml_enc16(ml, offset + 3, newIndexB);
      ml_enc16(ml, offset + 5, indexR);
      ml_skip(ml, offset + SIZEOF_VVV, oplen - SIZEOF_VVV);

      ASSERT_LOG2(' - Changed to a plus to a plus on index', newIndexA, 'and', (constants ? 'constant value ' + constantSum : 'index ' + newIndexB));
      ASSERT_LOG2(' - ml now:', ml);
      // revisit immediately
      pc = offset;
    } else if (!constantSum && (argCount - constants) === 1) { // ignore the constants that are zero!
      ASSERT_LOG2(' - One concrete vars/values left to sum (sum arg index', var1, '), rewriting to an eq');
      // artifact; a sum with exactly one var is just an eq to R
      ASSERT(!constantSum && var1 >= 0 && var2 < 0, 'should have found exactly one var', 'constants:', constants, 'constantSum:', constantSum, 'var1:', var1, 'var2:', var2);

      let newIndexA = ml_dec16(ml, offsetArgs + var1 * 2);

      // if R is a constant we use ML_V8_EQ and otherwise ML_VV_EQ
      if (minR === maxR) {
        ASSERT_LOG2(' - compiling ML_V8_EQ because R solved to', minR);
        ml_enc8(ml, offset, ML_V8_EQ);
        ml_enc16(ml, offset + 1, newIndexA);
        ASSERT(minR <= 255, 'support 16bit if this fails'); // TODO: just support it by compiling it as a new anonymous (solved) var
        ml_enc8(ml, offset + 3, minR); // this can fail if R solved to >255.. that requires 16 or 32bit support here
        ml_skip(ml, offset + SIZEOF_V8, oplen - SIZEOF_V8);
      } else {
        ASSERT_LOG2(' - compiling ML_VV_EQ because R is not yet solved', minR, maxR);
        // the len of this sum is op+len+var+R or 1 + 2 + 2 + 2 = 7. the len
        // of an eq is 5 (1+2+2) so just replace it and append a noop2 to it
        ml_enc8(ml, offset, ML_VV_EQ);
        ml_enc16(ml, offset + 1, newIndexA);
        ml_enc16(ml, offset + 3, indexR);
        ml_skip(ml, offset + SIZEOF_VV, oplen - SIZEOF_VV);
      }

      ASSERT_LOG2(' - changed to a product to an eq on index', newIndexA, 'and index ' + indexR);
      ASSERT_LOG2(' - ml now:', ml);
      // revisit it immediately
      pc = offset;
    } else if (argCount - constants === 0) {
      // eliminate. skip (count+1)*2+2 bytes
      ASSERT_LOG2(' - eliminating constraint since all vars are constants');
      oR = R;
      R = domain_intersection(R, domain_createValue(constantSum));
      if (oR !== R) {
        ASSERT_LOG2(' - Updated R from', domain__debug(oR), 'to', domain__debug(R));
        if (!R) return emptyDomain = true;
        change = true;
        domains[indexR] = R;
      }

      ml_eliminate(ml, offset, SIZEOF_C8_COUNT + argCount * 2 + 2); // sizeof(op)=x; op+count+vars+result -> 8bit+16bit+8bit+n*16bit+16bit
    } else if (constants) {
      ASSERT_LOG2(' - Unable to morph but there are', constants, 'constants to consolidate to value', constantSum + fixedConstant);
      ASSERT((constantSum + fixedConstant) < 256, 'TODO: support >8bit');
      // there are constants and they did not morph or eliminate the constraint; consolidate them.
      ml_enc16(ml, offset + 1, argCount - constants);
      ml_enc8(ml, offset + 3, constantSum + fixedConstant);
      // loop through the constants and move non-constants to the left
      ASSERT_LOG2(' - Moving constants out...');
      let tgtIndex = 0;
      for (let i = 0; i < argCount; ++i) {
        let indexOffsetDelta = SIZEOF_C8_COUNT + i * 2;
        let indexA = ml_dec16(ml, offset + indexOffsetDelta);
        let A = getDomainOrRestartForAlias(indexA, indexOffsetDelta);
        ASSERT_LOG2('   - index:', indexA, 'domain:', domain__debug(A), 'constant:', domain_isSolved(A));
        ASSERT(A !== MINIMIZE_ALIASED, 'A didnt change so it shouldnt have been aliased since last explicit check');
        if (!domain_isSolved(A)) {
          ASSERT_LOG2('     - not a constant so moving 2 bytes from', offset + indexOffsetDelta, 'to', offset + SIZEOF_C8_COUNT + tgtIndex);
          // move forward (wont change anything until a constant was skipped...)
          ml_enc8(ml, offset + SIZEOF_C8_COUNT + tgtIndex++, ml_dec8(ml, offset + indexOffsetDelta));
          ml_enc8(ml, offset + SIZEOF_C8_COUNT + tgtIndex++, ml_dec8(ml, offset + indexOffsetDelta + 1));
        }
      }
      ASSERT_LOG2(' - Non-constants should now all be moved to the left. Moving result var from', offsetR, 'to', offset + SIZEOF_C8_COUNT + tgtIndex);
      ml_enc8(ml, offset + SIZEOF_C8_COUNT + tgtIndex++, ml_dec8(ml, offsetR));
      ml_enc8(ml, offset + SIZEOF_C8_COUNT + tgtIndex++, ml_dec8(ml, offsetR + 1));
      ASSERT_LOG2(' - Now blanking out', constants * 2, 'trailing empty bytes starting at', offset + SIZEOF_C8_COUNT + (argCount - constants) * 2 + 2);
      // now "blank out" the remainder
      ml_skip(ml, offset + SIZEOF_C8_COUNT + (argCount - constants) * 2 + 2, constants * 2);
      pc = offset; // TODO: temp while debugging + oplen;
    } else {
      ASSERT(argCount - (constantSum ? constants : 0) > 1, 'There no other valid options here', 'count', argCount, 'constants', constants, 'count-constants', argCount - constants, 'constantsum', constantSum);
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_C8_COUNT + argCount * 2 + 2; // skip the 16bit indexes manually
    }
    ASSERT_LOG2(' - ml after sum:', ml.slice(offset, offset + SIZEOF_C8_COUNT + 2 * argCount + 2));
  }

  function cr_product(ml) {
    let offset = pc;
    ASSERT_LOG2(' - parsing product:', ml.slice(offset, offset + 10));
    let offsetCount = offset + 1;
    let argCount = ml_dec16(ml, offsetCount);
    let argLen = argCount * 2;
    let oplen = SIZEOF_COUNT + argLen + 2;
    ASSERT_LOG2(' - ml for this product:', ml.slice(offset, offset + oplen));
    let offsetArgs = offset + SIZEOF_COUNT;
    let offsetR = offsetArgs + argLen;
    let indexR = ml_dec16(ml, offsetR);

    let R = getDomainOrRestartForAlias(indexR, SIZEOF_COUNT + argLen);
    if (R === MINIMIZE_ALIASED) return; // there was an alias; restart op

    ASSERT_LOG2(' = cr_product', argCount, 'x');
    ASSERT_LOG2('  -> {' + indexR + '=' + domain__debug(R) + '} = ', Array.from(Array(argCount)).map((n, i, x) => (x = ml_dec16(ml, offsetArgs + i * 2)) + '=>' + domain__debug(domains[x])).join(' '));
    ASSERT_LOG2(' - start loop, backwards');

    // a product is basically a pyramid of muls; (A*B)*(C*D) etc
    // to prevent generating an array we'll decode every var during the loop...
    // we loop back to front because we're splicing out vars while looping

    // replace all constants by one constant
    // prune the result var by the outer bounds of the product of the args
    // in limited cases we can prune some of the arg values if the result forces
    // that (if the result is max 10 then inputs can be pruned of any value > 10)
    // we cant really do anything else

    let productLo = 1;
    let productHi = 1;
    for (let i = argCount - 1; i >= 0; --i) {
      let indexA = ml_dec16(ml, offsetArgs + i * 2);
      let A = getDomainOrRestartForAlias(indexA, SIZEOF_COUNT + i * 2);
      ASSERT_LOG2('    - index=', indexA, 'dom=', domain__debug(A));
      if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op
      if (!A) return emptyDomain = true;
      let min = domain_min(A);
      let max = domain_max(A);
      productLo *= min;
      productHi *= max;
    }

    ASSERT_LOG2(' - total min=', productLo, ', max=', productHi, '. applying bounds to this R:', domain__debug(R));

    // trim the result to <low, hi>, which is the product of the lows and his of all the args
    let oR = R;
    R = domain_removeLtUnsafe(R, productLo);
    R = domain_removeGtUnsafe(R, productHi);
    ASSERT_LOG2(' - Updated R from', domain__debug(oR), 'to', domain__debug(R));
    if (R !== oR) {
      if (!R) return emptyDomain = true;
      change = true;
      domains[indexR] = R;
    }

    let minR = domain_min(R);
    let maxR = domain_max(R);

    ASSERT_LOG2(' - Now back propagating R to the args', minR, maxR);

    // now trim the args for any value that can not amount to a valid result according to R
    // we use the min and max of R, subtract the total hi or lo from that number without the
    // hi or lo of the current var and the result will be the value that this var can at
    // least or most add to the total product. oob values can be cut.
    let constants = 0;
    let constantsProduct = 1;
    let var1 = -1; // for 1 and 2 var optim, track which vars were non-constants
    let var2 = -1;
    for (let i = 0; i < argCount; ++i) {
      let indexA = ml_dec16(ml, offsetArgs + i * 2);
      let A = getDomainOrRestartForAlias(indexA, 1 + 2 + i * 2);
      if (A === MINIMIZE_ALIASED) return; // there was an alias; restart op
      let oA = A;
      //ASSERT_LOG2('lte, A=', domain__debug(A), 'max=',domain_max(A), 'producthi=',productHi, 'ta=',productHi / domain_max(A), 'min(R)/ta=', minR/(productHi / domain_max(A)));
      let ta = productHi / domain_max(A);
      if (ta) A = domain_removeLtUnsafe(A, Math.floor(minR / ta));
      ta = productLo / domain_min(A);
      //ASSERT_LOG2('gte', ta, maxR/ta)
      if (ta) A = domain_removeGtUnsafe(A, Math.ceil(maxR / ta));
      if (A !== oA) {
        ASSERT_LOG2(' - updated domain from', domain__debug(oA), 'to', domain__debug(A));
        if (!A) return emptyDomain = true;
        change = true;
        domains[indexA] = A;
      }
      let vA = domain_getValue(A);
      if (vA >= 0) {
        ++constants;
        constantsProduct *= vA;
      } else if (var1 === -1) {
        var1 = i;
      } else if (var2 === -1) {
        var2 = i;
      }
    }

    ASSERT_LOG2(' -> There are now', constants, 'constants and', argCount - constants, 'non-constants left. Constants mul to', constantsProduct);
    ASSERT_LOG2(' -> Result of vars: ', Array.from(Array(argCount)).map((n, i) => domain__debug(domains[ml_dec16(ml, offsetArgs + i * 2)])).join(' '), ' Result:', domain__debug(R));

    if (argCount - constants === (constants ? 1 : 2)) {
      ASSERT(constants ? var2 === -1 : var2 >= 0, 'if there are constants there should not be a second non-constant here otherwise expecting a second var');
      // there are either two non-constants and no constants,
      // or one non-constant and some constants left
      // consolidate the constants into one and recompile the
      // whole product as a regular mul
      // compile a jmp for the unused var fields

      // TODO: note: use the mul opcode that accepts a literal
      let newIndexA = ml_dec16(ml, offsetArgs + var1 * 2);
      let newIndexB = constants ? getVar(addVar(undefined, constantsProduct, undefined, true)) : ml_dec16(ml, offsetArgs + var2 * 2);

      ASSERT(argCount >= 2, 'need at least two vars to have enough space for a plus');
      ml_enc8(ml, offset, ML_MUL);
      ml_enc16(ml, offset + 1, newIndexA);
      ml_enc16(ml, offset + 3, newIndexB);
      ml_enc16(ml, offset + 5, indexR);

      // this distinct has at least two var args. a distinct of 2+ takes 1+2+n*2
      // bytes. a plus takes 1+2+2+2 bytes. so this morph should be fine.
      ml_skip(ml, offset + SIZEOF_VVV, oplen - SIZEOF_VVV);

      ASSERT_LOG2(' - changed to a mul on index', newIndexA, 'and', (constants ? 'constant value ' + constantsProduct : 'index ' + newIndexB));
      // revisit immediately
      pc = offset;
    } else if (!constants && argCount === 1) {
      // artifact; a product with exactly one var is just an eq to R
      ASSERT(!constants && var1 >= 0 && var2 < 0, 'should have found exactly one var');

      let newIndexA = ml_dec16(ml, offsetArgs + var1 * 2);

      // if R is a constant we use ML_V8_EQ and otherwise ML_VV_EQ
      if (minR === maxR) {
        ml_enc8(ml, offset, ML_V8_EQ);
        ml_enc16(ml, offset + 1, newIndexA);
        ml_enc8(ml, offset + 3, minR); // this can fail if R solved to >255.. that requires 16 or 32bit support here
        ml_skip(ml, offset + SIZEOF_V8, oplen - SIZEOF_V8);
      } else {
        // the len of this sum is op+len+var+R or 1 + 2 + 2 + 2 = 7. the len
        // of an eq is 5 (1+2+2) so just replace it and append a noop2 to it
        ml_enc8(ml, offset, ML_VV_EQ);
        ml_enc16(ml, offset + 1, newIndexA);
        ml_enc16(ml, offset + 3, indexR);
        ml_skip(ml, offset + SIZEOF_VV, oplen - SIZEOF_VV);
      }

      ASSERT_LOG2(' - changed to a product to an eq on index', newIndexA, 'and index ' + indexR);
      ASSERT_LOG2(' - ml now:', ml);
      // revisit it immediately
      pc = offset;
    } else if (argCount - constants === 0) {
      // eliminate. skip (count+1)*2+2 bytes
      ASSERT_LOG2(' - eliminating constraint since all vars are constants');
      oR = R;
      R = domain_intersection(R, domain_createValue(constantsProduct));
      if (oR !== R) {
        ASSERT_LOG2(' - Updated R from', domain__debug(oR), 'to', domain__debug(R));
        if (!R) return emptyDomain = true;
        change = true;
        domains[indexR] = R;
      }
      let delta = SIZEOF_COUNT + argLen + 2; // sizeof(op)=x; op+count+vars+result -> 8bit+16bit+n*16bit+16bit
      ml_eliminate(ml, offset, delta);
    } else {
      ASSERT(argCount - constants > 2, 'There no other valid options here');
      ASSERT_LOG2(' - not only jumps...');
      onlyJumps = false;
      pc = offset + SIZEOF_COUNT + argLen + 2; // skip the 16bit indexes manually
    }
  }
}

function cr_vvv2vv(ml, offset, opCode, indexA, indexB) {
  ASSERT_LOG2(' -| cr_vvv2vv |', opCode, indexA, indexB);
  ml_enc8(ml, offset, opCode);
  ml_enc16(ml, offset + 1, indexA);
  ml_enc16(ml, offset + 3, indexB);
  ml_skip(ml, offset + SIZEOF_VV, SIZEOF_VVV - SIZEOF_VV);
}

function cr_vvv2v8v(ml, offset, opCode, indexA, constant, indexR) {
  ASSERT_LOG2(' -| cr_vvv2v8v |', opCode, indexA, constant, indexR);
  ml_enc8(ml, offset, opCode);
  ml_enc16(ml, offset + 1, indexA);
  ml_enc8(ml, offset + 3, constant);
  ml_enc16(ml, offset + 4, indexR);
  ml_skip(ml, offset + SIZEOF_V8V, SIZEOF_VVV - SIZEOF_V8V);
}

function cr_vv82vv(ml, offset, opCode, indexA, indexB) {
  ASSERT_LOG2(' -| cr_vv82vv |', opCode, indexA, indexB);
  ml_enc8(ml, offset, opCode);
  ml_enc16(ml, offset + 1, indexA);
  ml_enc16(ml, offset + 3, indexB);
  ml_skip(ml, offset + SIZEOF_VV, SIZEOF_VV8 - SIZEOF_VV);
}

function cr_8vv2vv(ml, offset, opCode, indexA, indexB) {
  ASSERT_LOG2(' -| cr_8vv2vv |', opCode, indexA, indexB);
  ml_enc8(ml, offset, opCode);
  ml_enc16(ml, offset + 1, indexA);
  ml_enc8(ml, offset + 3, indexB);
  ml_skip(ml, offset + SIZEOF_VV, SIZEOF_8VV - SIZEOF_VV);
}

function cr_8vv2v8(ml, offset, opCode, indexA, vB) {
  ASSERT_LOG2(' -| cr_8vv2v8 |', opCode, indexA, vB);
  ml_enc8(ml, offset, opCode);
  ml_enc16(ml, offset + 1, indexA);
  ml_enc8(ml, offset + 3, vB);
  ml_skip(ml, offset + SIZEOF_V8, SIZEOF_8VV - SIZEOF_V8);
}

function cr_8vv28v(ml, offset, opCode, vA, indexB) {
  ASSERT_LOG2(' -| cr_8vv28v |', opCode, vA, indexB);
  ml_enc8(ml, offset, opCode);
  ml_enc8(ml, offset + 1, vA);
  ml_enc16(ml, offset + 3, indexB);
  ml_skip(ml, offset + SIZEOF_8V, SIZEOF_8VV - SIZEOF_8V);
}

function cr_v8v2vv(ml, offset, opCode, indexA, indexB) {
  ASSERT_LOG2(' -| cr_v8v2vv |', opCode, indexA, indexB);
  ml_enc8(ml, offset, opCode);
  ml_enc16(ml, offset + 1, indexA);
  ml_enc8(ml, offset + 3, indexB);
  ml_skip(ml, offset + SIZEOF_VV, SIZEOF_V8V - SIZEOF_VV);
}

function cr_v8v2v8(ml, offset, opCode, indexA, vB) {
  ASSERT_LOG2(' -| cr_v8v2v8 |', opCode, indexA, vB);
  ml_enc8(ml, offset, opCode);
  ml_enc16(ml, offset + 1, indexA);
  ml_enc8(ml, offset + 3, vB);
  ml_skip(ml, offset + SIZEOF_V8, SIZEOF_V8V - SIZEOF_V8);
}

function cr_v8v28v(ml, offset, opCode, vA, indexB) {
  ASSERT_LOG2(' -| cr_v8v2v8 |', opCode, vA, indexB);
  ml_enc8(ml, offset, opCode);
  ml_enc8(ml, offset + 1, vA);
  ml_enc16(ml, offset + 3, indexB);
  ml_skip(ml, offset + SIZEOF_8V, SIZEOF_V8V - SIZEOF_8V);
}

function cr_v8v2v88(ml, offset, opCode, indexA, vB, vR) {
  ASSERT_LOG2(' -| cr_v8v2v88 |', opCode, indexA, vB, vR);
  ml_enc8(ml, offset, opCode);
  ml_enc16(ml, offset + 1, indexA);
  ml_enc8(ml, offset + 3, vB);
  ml_enc8(ml, offset + 4, vR);
  ml_skip(ml, offset + SIZEOF_V88, SIZEOF_V8V - SIZEOF_V88);
}

// BODY_STOP

export {
  MINIMIZER_STABLE,
  MINIMIZER_SOLVED,
  MINIMIZER_REJECTED,
  cr_optimizeConstraints,
};
