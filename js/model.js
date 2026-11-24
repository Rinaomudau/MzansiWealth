/**
 * model.js - state, persistence and all the maths. No DOM access in this file,
 * so it can be tested in Node (see test/run.js).
 */
'use strict';

/* ---------- state ---------- */
var S = defaults(); // your answers (saved on this device)
var T = {};         // "what if" overrides, only for the current visit
var D = {};         // derived results, rebuilt by derive()

var loadState = function () {
  try {
    var raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var o = JSON.parse(raw), d = defaults();
    S = Object.assign(d, o, { cats: Object.assign(d.cats, o.cats), goals: Object.assign(d.goals, o.goals), pots: Object.assign(d.pots, o.pots) });
  } catch (e) { /* storage unavailable or corrupt: start fresh */ }
};
var saveState = function () {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
};
var resetState = function () { S = defaults(); T = {}; saveState(); };

/** Slider keys that point inside the two-pot balances. */
var POTKEYS = { potVested: 'vested', potSavings: 'savings', potRetirement: 'retirement' };

/* ---------- income tax (SARS) ---------- */
/** Tax from the bracket table, before any rebates or credits. */
var bracketTax = function (taxable) {
  if (taxable <= 0) return 0;
  for (var i = TAX.brackets.length - 1; i >= 0; i--) {
    var b = TAX.brackets[i];
    if (taxable > b.from) return b.base + (taxable - b.from) * b.rate;
  }
  return 0;
};
/** Rate on the next rand earned at this taxable income. */
var marginalRate = function (taxable) {
  for (var i = TAX.brackets.length - 1; i >= 0; i--) if (taxable > TAX.brackets[i].from) return TAX.brackets[i].rate;
  return TAX.brackets[0].rate;
};
/** Rebates stack with age: primary for everyone, plus secondary from 65 and tertiary from 75. */
var rebateFor = function (age) {
  return TAX.rebatePrimary + (age >= 65 ? TAX.rebateSecondary : 0) + (age >= 75 ? TAX.rebateTertiary : 0);
};
/** Medical scheme fees tax credit for a year. members counts you and your dependants. */
var medicalCredit = function (members) {
  var m = Math.max(0, Math.round(members || 0));
  return 12 * ((m >= 1 ? TAX.medMain : 0) + (m >= 2 ? TAX.medFirstDep : 0) + Math.max(0, m - 2) * TAX.medExtraDep);
};
/**
 * Gross pay to take-home pay for one year. extra is other taxable income on top of pay
 * (used to price a savings-pot withdrawal). The retirement deduction is limited to 27.5% of pay and R430 000.
 */
var payBreakdown = function (gross, o) {
  o = o || {};
  var age = o.age != null ? o.age : S.age, ownPct = o.ownRet != null ? o.ownRet : S.ownRet;
  var med = o.medMembers != null ? o.medMembers : S.medMembers, extra = o.extra || 0;
  var own = gross * ownPct / 100;
  var ded = Math.min(own, SA.retirementDeductPct * gross, SA.retirementDeductCap);
  var taxable = Math.max(0, gross + extra - ded);
  var before = bracketTax(taxable), rebate = rebateFor(age), credit = medicalCredit(med);
  var paye = Math.max(0, before - rebate - credit);
  var uif = Math.min(gross / 12, TAX.uifMonthlyCeiling) * TAX.uifRate * 12;
  var spendable = gross - paye - uif; // what is left for spending and saving, your own retirement contribution included
  return { gross: gross, own: own, ded: ded, taxable: taxable, before: before, rebate: rebate, credit: credit, paye: paye, uif: uif,
           spendable: spendable, net: spendable - own, effective: gross > 0 ? paye / gross : 0, marginal: marginalRate(taxable),
           taxShare: gross > 0 ? (paye + uif) / gross : 0 };
};
/** Tax and UIF as a % of gross pay: the part of income that never reaches your budget. */
var taxPct = function () { return payBreakdown(S.income).taxShare * 100; };

/* ---------- budget ---------- */
var sumCats = function (t) {
  return CATS.filter(function (c) { return c.t === t; })
    .reduce(function (a, c) { return a + (S.cats[c.id] || 0); }, 0);
};
var basicPct = function () { return sumCats('b'); };
var discPct = function () { return sumCats('d'); };
/** Savings are what is left after needs, wants AND tax and UIF. */
var savePct = function () { return Math.max(0, 100 - basicPct() - discPct() - taxPct()); };
var monthlySpend = function () { return S.income * (basicPct() + discPct()) / 1200; };

/** Scale every category of one type so they add up to target % */
var scaleCats = function (t, target) {
  var cs = CATS.filter(function (c) { return c.t === t; }), cur = sumCats(t);
  cs.forEach(function (c) { S.cats[c.id] = cur > 0 ? S.cats[c.id] * target / cur : target / cs.length; });
};

/** Peer shares are of take-home pay, so scale them to your gross pay to compare like with like. */
var peerSplit = function () {
  var p = PEERS[S.situation].slice(), keep = 1 - taxPct() / 100;
  if (S.housing === 'rent') { p[0] += 3; p[1] -= 3; }
  return p.map(function (x) { return x * keep; });
};
var peerCat = function (c) {
  var p = peerSplit();
  return c.t === 'b' ? c.d * p[0] / DEF_B : c.d * p[1] / DEF_D;
};

/* ---------- plans: the baseline and the "what if" version ---------- */
var basePlan = function () {
  return Object.assign({}, S, { saveRate: savePct() / 100, spendNow: S.income * (basicPct() + discPct()) / 100 });
};
var whatIfPlan = function () {
  var b = basePlan();
  return Object.assign({}, b, {
    saveRate: (T.saveRate != null ? T.saveRate : savePct()) / 100,
    income: T.income != null ? T.income : S.income,
    retire: Math.max(S.age + 1, T.retire != null ? T.retire : S.retire),
    style: T.style || S.style,
    investPct: T.investPct != null ? T.investPct : S.investPct,
    replacement: T.replacement != null ? T.replacement : S.replacement
  });
};
var hasWhatIf = function () { return Object.keys(T).length > 0; };

/* ---------- debt ---------- */
/** Years until the debt is gone; 0 if none, Infinity if the payment can't beat the interest. */
var payoffYears = function (p) {
  if (p.debt <= 0) return 0;
  var i = p.debtRate / 1200;
  if (p.debtPay <= 0) return Infinity;
  if (i === 0) return p.debt / p.debtPay / 12;
  if (p.debtPay <= p.debt * i) return Infinity;
  return -Math.log(1 - p.debt * i / p.debtPay) / Math.log(1 + i) / 12;
};

/* ---------- Monte Carlo simulation ---------- */
var SIMS = 500, MAX_YEARS = 90;

/** Fixed random draws (seeded), so the chart doesn't jitter while you move a slider. */
var Z = (function () {
  var s = 20261120;
  var rnd = function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    var t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  var rows = [], i, j;
  for (i = 0; i < SIMS; i++) {
    var r = new Float32Array(MAX_YEARS);
    for (j = 0; j < MAX_YEARS; j += 2) {
      var u = rnd() || 1e-9, v = rnd(), m = Math.sqrt(-2 * Math.log(u));
      r[j] = m * Math.cos(2 * Math.PI * v);
      r[j + 1] = m * Math.sin(2 * Math.PI * v);
    }
    rows.push(r);
  }
  return rows;
})();

/**
 * Simulate a plan in today's rand. Pay is saved until retirement, then spending
 * (less other retirement income) is drawn down until the plan ends.
 * full = true also returns the 10th, 50th and 90th percentile for every year.
 */
var simulate = function (p, full) {
  var m = STY[p.style], pc = p.investPct / 100;
  var mu = pc * m.mu + (1 - pc) * CASH_RATE, sd = pc * m.sd;
  var infl = p.inflation / 100, g = p.wageGrowth / 100;
  var years = Math.min(MAX_YEARS, p.life - p.age), payoff = payoffYears(p);
  var retSpend = Math.max(0, p.spendNow * p.replacement / 100 * Math.pow(1 + g, Math.max(0, p.retire - p.age)) - p.pension);
  var bal = new Float64Array(SIMS).fill(p.saved);
  var out = { ages: [p.age], p10: [p.saved], p50: [p.saved], p90: [p.saved], success: 0, retSpend: retSpend };
  var pctl = function () {
    var a = Float64Array.from(bal).sort();
    return [a[Math.floor(SIMS * 0.1)], a[Math.floor(SIMS * 0.5)], a[Math.floor(SIMS * 0.9)]];
  };
  for (var t = 0; t < years; t++) {
    var age = p.age + t, working = age < p.retire;
    var contrib = working ? p.income * Math.pow(1 + g, t) * (p.saveRate + p.employerPct / 100) + (t >= payoff ? p.debtPay * 12 : 0) : 0;
    var spend = working ? 0 : retSpend;
    for (var i = 0; i < SIMS; i++) {
      var real = (1 + mu + sd * Z[i][t]) / (1 + infl) - 1;
      bal[i] = Math.max(0, bal[i] * (1 + real) + contrib - spend);
    }
    if (full) {
      var q = pctl();
      out.ages.push(age + 1); out.p10.push(q[0]); out.p50.push(q[1]); out.p90.push(q[2]);
    }
  }
  var ok = 0;
  for (var k = 0; k < SIMS; k++) if (bal[k] > 1) ok++;
  out.success = ok / SIMS;
  return out;
};
var valueAtAge = function (res, age, key) {
  var i = res.ages.indexOf(age);
  return i < 0 ? null : res[key][i];
};

/** Current value behind a slider key, for syncing screens with the model. */
var answerValue = function (k) {
  if (k === 'basicS') return basicPct();
  if (k === 'discS') return discPct();
  if (k === 'incomeM') return S.income / 12;
  if (POTKEYS[k]) return S.pots[POTKEYS[k]];
  return S[k];
};

/* ---------- derived results and the wealth score ---------- */
var scoreLabel = function (s) { return s >= 80 ? t('Strong') : s >= 60 ? t('On track') : s >= 40 ? t('Getting there') : t('Needs attention'); };

var derive = function () {
  var b = basePlan(), e = whatIfPlan();
  var rb = simulate(b, true), re = hasWhatIf() ? simulate(e, true) : rb;
  var pay = payoffYears(S);
  var savingsPts = Math.min(1, savePct() / 20) * 35;
  var lastPts = rb.success * 45;
  var debtPts = S.debt <= 0 ? 20 : (isFinite(pay) ? 20 * (1 - Math.min(1, S.debt / S.income) * 0.6) : 4);
  D = { base: b, whatIf: e, rb: rb, re: re, pay: pay, tax: payBreakdown(S.income), peerSave: peerSplit()[2],
        score: Math.round(clamp(savingsPts + lastPts + debtPts, 0, 100)) };
};

/* ---------- two-pot retirement system ---------- */
/** Real yearly return on your savings under the current investment style. */
var realReturn = function () {
  var m = STY[S.style], pc = S.investPct / 100;
  return (1 + pc * m.mu + (1 - pc) * CASH_RATE) / (1 + S.inflation / 100) - 1;
};
/**
 * What a savings-pot withdrawal really costs. The withdrawal is added to your income for the year and taxed at
 * your marginal rates (the fund withholds tax on a SARS directive, and the final bill is settled on assessment).
 */
var twoPotResult = function (amount) {
  var pot = S.pots.savings, a = Math.max(0, Math.round(+amount || 0)), issues = [];
  if (pot < TWOPOT.minWithdrawal) issues.push('empty');
  else if (a < TWOPOT.minWithdrawal) issues.push('min');
  else if (a > pot) issues.push('max');
  var before = payBreakdown(S.income), after = payBreakdown(S.income, { extra: a });
  var tax = Math.max(0, after.paye - before.paye), fee = a > 0 ? S.potFee : 0, net = Math.max(0, a - tax - fee);
  var n = Math.max(0, S.retire - S.age), real = realReturn();
  var grown = a * Math.pow(1 + real, n);
  var successNow = D.rb ? D.rb.success : simulate(basePlan(), false).success;
  var successAfter = simulate(Object.assign({}, basePlan(), { saved: Math.max(0, S.saved - a) }), false).success;
  return { amount: a, pot: pot, issues: issues, valid: issues.length === 0, tax: tax, fee: fee, net: net,
           taxRate: a > 0 ? tax / a : 0, keepRate: a > 0 ? net / a : 0, grown: grown, years: n,
           successNow: successNow, successAfter: successAfter, delta: Math.round((successAfter - successNow) * 100),
           marginal: after.marginal };
};

/* ---------- backup: export and import ---------- */
var exportData = function () {
  return JSON.stringify({ app: APP_ID, version: 2, exportedAt: new Date().toISOString(), data: S }, null, 2);
};
var IMPORT_LIMITS = { age: [18, 70], retire: [40, 80], life: [75, 100], income: [0, 1e8], saved: [0, 1e9], employerPct: [0, 100],
  ownRet: [0, 100], medMembers: [0, 20], debt: [0, 1e9], debtRate: [0, 100], debtPay: [0, 1e7], investPct: [0, 100], wageGrowth: [0, 20],
  inflation: [0, 50], replacement: [0, 300], pension: [0, 1e8], potFee: [0, 1e5], withdraw: [0, 1e9] };
/**
 * Check a backup file's text and turn it into a clean state. Unknown keys are dropped, every value is
 * type-checked and clamped, so a damaged or hand-edited file cannot break the app.
 * Returns { ok: true, state } or { ok: false, error }.
 */
var importData = function (text) {
  var o;
  try { o = JSON.parse(text); } catch (e) { return { ok: false, error: t('That file is not a valid backup (it could not be read).') }; }
  if (!o || typeof o !== 'object' || o.app !== APP_ID || !o.data || typeof o.data !== 'object')
    return { ok: false, error: t('That file is not a {0} backup.', [APP_NAME]) };
  var d = defaults(), x = o.data, out = defaults();
  var num = function (v, lo, hi, fallback) { return (typeof v === 'number' && isFinite(v)) ? clamp(v, lo, hi) : fallback; };
  Object.keys(IMPORT_LIMITS).forEach(function (k) { if (k in x) out[k] = num(x[k], IMPORT_LIMITS[k][0], IMPORT_LIMITS[k][1], d[k]); });
  if (out.retire <= out.age) out.retire = Math.min(80, out.age + 1);
  var own = function (o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }; // blocks '__proto__' and similar
  if (own(STY, x.style)) out.style = x.style;
  if (own(PEERS, x.situation)) out.situation = x.situation;
  if (x.housing === 'rent' || x.housing === 'own') out.housing = x.housing;
  if (x.cats && typeof x.cats === 'object') CATS.forEach(function (c) { out.cats[c.id] = num(x.cats[c.id], 0, 100, d.cats[c.id]); });
  if (x.pots && typeof x.pots === 'object') Object.keys(d.pots).forEach(function (k) { out.pots[k] = num(x.pots[k], 0, 1e9, d.pots[k]); });
  if (x.goals && typeof x.goals === 'object') GOALS.forEach(function (g) {
    var y = x.goals[g.id]; if (!y || typeof y !== 'object') return;
    out.goals[g.id] = { on: y.on === true, amount: y.amount == null ? null : num(y.amount, 0, 1e9, null), years: num(y.years, 1, 40, g.yrs) };
  });
  if (x.done && typeof x.done === 'object') Object.keys(x.done).slice(0, 100).forEach(function (k) { if (k.length <= 40 && x.done[k] === true) out.done[k] = true; });
  if (typeof x.lastBackup === 'string' && x.lastBackup.length <= 40) out.lastBackup = x.lastBackup;
  return { ok: true, state: out };
};

/* ---------- goals ---------- */
var goalAmount = function (g) {
  var o = S.goals[g.id];
  if (o.amount != null) return o.amount;
  if (g.amt === 'auto') return Math.round(monthlySpend() * 6 / 1000) * 1000;
  if (g.amt === 'debt') return S.debt;
  return g.amt;
};
/** Monthly saving needed to reach amount in `years`, assuming about 1.5% a year above inflation. */
var requiredMonthly = function (amount, years) {
  var i = 0.015 / 12, n = Math.max(1, years * 12);
  return amount * i / (Math.pow(1 + i, n) - 1);
};
var activeGoals = function () {
  return GOALS.filter(function (g) { return S.goals[g.id].on && (g.id !== 'debt' || S.debt > 0); });
};

/* ---------- South African tax helpers ---------- */
var retirementDeductionLimit = function () {
  return Math.min(SA.retirementDeductPct * S.income, SA.retirementDeductCap);
};

/* ---------- action plan ---------- */
var buildTasks = function () {
  var mo = S.income * savePct() / 1200, list = [];
  var gap = CATS.filter(function (c) { return S.cats[c.id] - peerCat(c) >= 0.5; })
    .sort(function (a, b) { return (S.cats[b.id] - peerCat(b)) - (S.cats[a.id] - peerCat(a)); })[0];
  var r1 = function (x) { return Math.round(x * 10) / 10; };

  list.push({ id: 'auto', t: t('Automate {0} a month into savings', [zar(mo)]), s: t('Set up a debit order for the day your salary lands.') });
  list.push({ id: 'match', t: t('Claim your employer\'s retirement contribution'), s: t('Your employer adds {0}%. If they match extra, pay in enough to get it all.', [S.employerPct]) });
  list.push({ id: 'ra', t: t('Check your retirement fund deduction'), s: t('Retirement fund contributions are deductible up to {0} a year for you.', [zar(retirementDeductionLimit())]) });
  list.push({ id: 'tfsa', t: t('Put long-term savings in a tax-free savings account'), s: t('Up to {0} a year (about {1} a month). Growth and withdrawals are tax-free.', [zar(SA.tfsaAnnual), zar(SA.tfsaAnnual / 12)]) });
  if (gap) t.push({ id: 'gap', t: t('Trim “{0}” by a few points', [t(gap.n)]), s: t('You spend {0}% against {1}% for peers: {2} a year.', [r1(S.cats[gap.id]), r1(peerCat(gap)), zar(S.income * (S.cats[gap.id] - peerCat(gap)) / 100)]) });
  if (S.debt > 0) t.push({ id: 'debt', t: isFinite(D.pay) ? t('Pay {0} a month toward your debt', [zar(S.debtPay)]) : t('Raise your debt payment above the monthly interest'),
    s: isFinite(D.pay) ? t('Debt-free in {0} years. Pay extra whenever you can.', [D.pay.toFixed(1)]) : t('Interest is about {0} a month.', [zar(S.debt * S.debtRate / 1200)]) });
  list.push({ id: 'invest', t: t('Invest {0}% of long-term savings in low-cost index funds', [S.investPct]), s: t('Matches your “{0}” setting. Keep the rest in cash.', [t(STY[S.style].name)]) });
  activeGoals().forEach(function (g) {
    var o = S.goals[g.id];
    list.push({ id: 'g-' + g.id, t: t('Open a separate account for “{0}”', [t(g.n)]),
      s: t('Move {0} a month to reach {1} in {2} years.', [zar(requiredMonthly(goalAmount(g), o.years)), zar(goalAmount(g)), o.years]) });
  });
  list.push({ id: 'backup', t: t('Download a backup of your plan'), s: t('Your answers live only in this browser. A backup file keeps them safe.') });
  list.push({ id: 'review', t: t('Review this plan every six months'), s: t('Update income, spending and goals so projections stay current.') });
  return list;
};

var planAsText = function () {
  var ts = buildTasks();
  return t('MY WEALTH PLAN') + ' (' + APP_NAME + ')\n\n' +
    t('Age {0}, retiring at {1}. Gross pay {2} a month, about {3} take-home. Saving {4}% ({5} a month).', [S.age, S.retire, zar(S.income / 12), zar(D.tax.net / 12), Math.round(savePct()), zar(S.income * savePct() / 1200)]) + '\n' +
    t('Chance savings last to {0}: {1}%. Wealth score: {2}/100.', [S.life, Math.round(D.rb.success * 100), D.score]) + '\n\n' + t('ACTIONS') + '\n' +
    ts.map(function (x) { return '[' + (S.done[x.id] ? 'x' : ' ') + '] ' + x.t + ' - ' + x.s; }).join('\n') +
    '\n\n' + t('Educational estimates only, not financial advice.');
};

loadState();
