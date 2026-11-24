/**
 * Plain Node tests for the maths (no dependencies). Run: node test/run.js
 * Loads the browser scripts into a sandbox, since model.js never touches the DOM.
 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

var ctx = vm.createContext({ console: console, Math: Math, Float32Array: Float32Array, Float64Array: Float64Array });
['helpers.js', 'i18n.js', 'data.js', 'model.js', 'ai.js'].forEach(function (f) {
  // helpers.js references `document` only inside functions that tests never call
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
var run = function (code) { return vm.runInContext(code, ctx); };

var passed = 0;
var test = function (name, fn) { fn(); passed++; console.log('ok  ' + name); };

test('zar formats whole rand with a thousands space', function () {
  assert.strictEqual(run('zar(1250000)'), 'R1 250 000');
  assert.strictEqual(run('zar(-4500)'), '-R4 500');
  assert.strictEqual(run('zar(0.4)'), 'R0');
});
test('zarShort compacts to k and m', function () {
  assert.strictEqual(run('zarShort(450000)'), 'R450k');
  assert.strictEqual(run('zarShort(1200000)'), 'R1.2m');
  assert.strictEqual(run('zarShort(2000000)'), 'R2m');
});
test('default budget adds up to 100% once tax and UIF are counted', function () {
  assert.strictEqual(run('basicPct()'), 30);
  assert.strictEqual(run('discPct()'), 40);
  var total = run('basicPct() + discPct() + taxPct() + savePct()');
  assert.ok(Math.abs(total - 100) < 1e-9, 'expected 100, got ' + total);
  assert.strictEqual(Math.round(run('savePct()')), 14);
});
test('debt payoff: zero debt, unpayable debt, and a normal loan', function () {
  assert.strictEqual(run('payoffYears({debt:0,debtRate:12,debtPay:0})'), 0);
  assert.strictEqual(run('payoffYears({debt:100000,debtRate:12,debtPay:500})'), Infinity); // interest is R1 000 a month
  var y = run('payoffYears({debt:100000,debtRate:12,debtPay:2000})');
  assert.ok(y > 5.5 && y < 6.5, 'expected about 5.9 years, got ' + y);
  assert.strictEqual(run('payoffYears({debt:12000,debtRate:0,debtPay:1000})'), 1);
});
test('simulation is deterministic and ordered p10 <= p50 <= p90', function () {
  var a = run('simulate(basePlan(), true)'), b = run('simulate(basePlan(), true)');
  assert.deepStrictEqual(a.p50, b.p50);
  for (var i = 0; i < a.ages.length; i++) assert.ok(a.p10[i] <= a.p50[i] && a.p50[i] <= a.p90[i]);
  assert.strictEqual(a.ages[0], 35);
  assert.strictEqual(a.ages[a.ages.length - 1], 90);
});
test('saving more or retiring later never lowers the chance savings last', function () {
  var base = run('simulate(basePlan(), false)').success;
  assert.ok(run('simulate(Object.assign(basePlan(),{saveRate:0.25}), false)').success >= base);
  assert.ok(run('simulate(Object.assign(basePlan(),{retire:70}), false)').success >= base);
});
test('success is 100% when other income covers all retirement spending', function () {
  assert.strictEqual(run('simulate(Object.assign(basePlan(),{pension:1e7}), false)').success, 1);
});
test('goal funding formula', function () {
  assert.ok(Math.abs(run('requiredMonthly(0, 5)')) < 1e-9);
  var m = run('requiredMonthly(120000, 10)'); // about R120 000 / 120 months, a little less with growth
  assert.ok(m < 1000 && m > 900, 'got ' + m);
});
test('retirement deduction limit uses 27.5% of income up to the R430 000 cap', function () {
  run('S.income = 600000');  assert.strictEqual(run('retirementDeductionLimit()'), 165000);
  run('S.income = 3000000'); assert.strictEqual(run('retirementDeductionLimit()'), 430000);
});

/* ---------- Stacy (js/ai.js) ---------- */
run('S = defaults(); T = {}; derive();'); // earlier tests changed S, so start clean
// JSON round-trip: objects made inside the vm sandbox have a different Object prototype
var parse = function (q) { ctx.__q = q; return JSON.parse(run('JSON.stringify(parseWhatIf(__q, D.base).changes)')); };
var ask = function (q) { ctx.__q = q; return run('askStacy(__q)'); };

test('stacy parses retirement age, saving points and monthly amounts', function () {
  assert.deepStrictEqual(parse('What if I retire at 60?'), { retire: 60 });
  assert.strictEqual(parse('what if I work 3 years longer').retire, 68);
  assert.strictEqual(parse('What if I save 5% more?').saveRate, run('Math.round(D.base.saveRate * 100)') + 5);
  assert.strictEqual(parse('what if I save R3 000 a month').saveRate, 9); // 36 000 / 420 000
  assert.strictEqual(parse('what if I earn R45 000 a month').income, 540000);
  assert.strictEqual(parse('what if I get a 10% raise').income, 462000);
  assert.strictEqual(parse('go high risk').style, 'risky');
  assert.strictEqual(parse('what if I invest everything').investPct, 100);
});
test('stacy ignores sentences with no change and never invents one', function () {
  assert.deepStrictEqual(parse('hello there'), {});
  assert.deepStrictEqual(parse('asdf qwer'), {});
});
test('stacy what-if answers match the simulation exactly', function () {
  var r = ask('What if I save 5% more?');
  var direct = run('simulate(applyChanges(D.base, {saveRate: Math.round(D.base.saveRate * 100) + 5}), true)').success;
  assert.strictEqual(r.success, direct);
  assert.ok(/helps/.test(r.text));
});
test('stacy ranks moves best first and gains are never inflated by unit mix-ups', function () {
  var moves = run('rankMoves(D.base)');
  for (var i = 1; i < moves.length; i++) assert.ok(moves[i - 1].gain >= moves[i].gain);
  moves.forEach(function (m) { assert.ok(m.gainPts <= 100 && m.gainPts >= -100); });
  var s5 = moves.filter(function (m) { return m.id === 'save5'; })[0];
  assert.strictEqual(s5.gainPts, Math.round((run('simulate(applyChanges(D.base, {saveRate: Math.round(D.base.saveRate * 100) + 5}), false)').success - run('simulate(D.base, false)').success) * 100));
});
test('stacy answers by topic using the person\'s own numbers', function () {
  assert.ok(/R46\s000/.test(ask('tell me about the tfsa').text));
  assert.ok(/27\.5%/.test(ask('what are my tax deductions').text));
  assert.ok(/no debt/.test(ask('what about my debt').text));
  assert.ok(/not sure/.test(ask('zxcv').text));
  assert.ok(/not a cloud AI/.test(ask('are you an ai?').text));
});
test('coach flags a thin buffer and unpayable debt', function () {
  var flags = run('healthFlags()').map(function (f) { return f.text; }).join(' ');
  assert.ok(/under 3 months/.test(flags));
  run('S.debt = 100000; S.debtPay = 500; S.debtRate = 24;');
  flags = run('healthFlags()').map(function (f) { return f.text; }).join(' ');
  assert.ok(/does not cover the interest/.test(flags));
  run('S = defaults(); derive();');
});


/* ---------- tax, take-home pay and two-pot (SARS 2026/27) ---------- */
run('S = defaults(); T = {}; derive();');
var pay = function (g, o) { ctx.__o = o || {}; ctx.__g = g; return run('payBreakdown(__g, __o)'); };
test('PAYE matches the SARS table, rebates and thresholds', function () {
  assert.strictEqual(pay(99000, { medMembers: 0 }).paye, 0);                     // below the R99 000 threshold
  assert.strictEqual(pay(153250, { age: 66, medMembers: 0 }).paye, 0);            // 65+ threshold
  assert.strictEqual(Math.round(pay(420000, { medMembers: 0 }).paye), 73617);     // 91 437 - 17 820
  assert.strictEqual(Math.round(pay(2000000, { medMembers: 0 }).paye), 720969 - 17820);
  assert.strictEqual(run('Math.round(bracketTax(383100))'), 79998);               // brackets join up
  assert.strictEqual(run('Math.round(bracketTax(1878600))'), 666339);
});
test('medical credits and UIF follow the published figures', function () {
  assert.strictEqual(run('medicalCredit(1)'), 376 * 12);
  assert.strictEqual(run('medicalCredit(2)'), 752 * 12);
  assert.strictEqual(run('medicalCredit(4)'), (752 + 254 * 2) * 12);
  assert.strictEqual(pay(420000, { medMembers: 0 }).uif, 17712 * 0.01 * 12);      // capped at R177.12 a month
  assert.ok(Math.abs(pay(60000, { medMembers: 0 }).uif - 600) < 1e-9);            // 1% when below the cap
});
test('retirement contributions lower tax, and take-home is always below gross', function () {
  var a = pay(600000, { ownRet: 0, medMembers: 0 }), b = pay(600000, { ownRet: 10, medMembers: 0 });
  assert.ok(b.paye < a.paye);
  assert.ok(Math.abs((a.paye - b.paye) - 60000 * a.marginal) < 1);                // R60 000 deducted at the top rate
  assert.ok(a.net < a.gross && a.net > 0);
  assert.strictEqual(pay(900000, { ownRet: 50, medMembers: 0 }).ded, 0.275 * 900000); // deduction is capped at 27.5%
});
test('savings are what is left after needs, wants and tax', function () {
  run('S = defaults(); S.cats.housing = 60; derive();');
  assert.strictEqual(run('savePct()'), 0);                                         // spending plus tax over 100% leaves nothing
  run('S = defaults(); derive();');
});
test('two-pot rules: minimum R2 000, capped at the pot, taxed at the marginal rate', function () {
  var r = function (a) { ctx.__a = a; return run('twoPotResult(__a)'); };
  assert.strictEqual(r(1500).valid, false); assert.strictEqual(r(1500).issues[0], 'min');
  assert.strictEqual(r(50000).issues[0], 'max');                                   // default savings pot is R8 000
  var ok = r(5000);
  assert.strictEqual(ok.valid, true);
  assert.ok(Math.abs(ok.tax - 5000 * ok.marginal) < 1);                           // stays inside one bracket
  assert.strictEqual(Math.round(ok.net), Math.round(5000 - ok.tax - ok.fee));
  assert.ok(ok.grown > 5000 && ok.successAfter <= ok.successNow);
});
test('backup: export then import round-trips, and bad files are rejected', function () {
  run('S = defaults(); S.age = 41; S.cats.food = 9; S.pots.savings = 12345; derive();');
  var text = run('exportData()');
  var res = JSON.parse(run('JSON.stringify(importData(' + JSON.stringify(text) + '))'));
  assert.strictEqual(res.ok, true); assert.strictEqual(res.state.age, 41); assert.strictEqual(res.state.cats.food, 9); assert.strictEqual(res.state.pots.savings, 12345);
  var bad = function (t) { return JSON.parse(run('JSON.stringify(importData(' + JSON.stringify(t) + '))')); };
  assert.strictEqual(bad('not json').ok, false);
  assert.strictEqual(bad('{"app":"other","data":{}}').ok, false);
  var hostile = bad('{"app":"rinao-wealth","data":{"age":"x","income":-5,"style":"__proto__","cats":{"food":9999},"evil":1}}');
  assert.strictEqual(hostile.ok, true);
  assert.strictEqual(hostile.state.age, 35); assert.strictEqual(hostile.state.income, 0);   // bad types fall back, ranges clamp
  assert.strictEqual(hostile.state.style, 'moderate');                                      // '__proto__' is not a real style
  assert.strictEqual(hostile.state.cats.food, 100); assert.strictEqual(hostile.state.evil, undefined);
  run('S = defaults(); derive();');
});

console.log('\n' + passed + ' tests passed');
