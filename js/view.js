/**
 * view.js - everything that draws to the page. Reads from the model, never changes it.
 */
'use strict';

/* ---------- one-time scaffolding ---------- */
var buildScaffolding = function () {
  $('#nav').innerHTML = VIEWS.map(function (v, i) {
    return '<a href="#' + v[0] + '" data-v="' + v[0] + '"><b>' + (i === 0 ? '★' : i) + '</b>' + t(v[1]) + '</a>';
  }).join('');

  var slider = function (host, key, label, min, max, step, fmt, opt) {
    opt = opt || {};
    var attr = opt.t ? 'data-t' : 'data-k', out = opt.t ? 'data-to' : 'data-o', id = 'r-' + (opt.t ? 't-' : '') + key;
    $(host).innerHTML = '<div class="fld"><label for="' + id + '"><span>' + label + '</span><output ' + out + '="' + key + '" data-f="' + fmt + '"></output></label>' +
      '<input id="' + id + '" type="range" ' + attr + '="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '">' +
      (opt.hint ? '<div class="hint">' + opt.hint + '</div>' : '') + '</div>';
  };
  slider('#f-age', 'age', t('Your age'), 18, 70, 1, 'n');
  slider('#f-retire', 'retire', t('Retire at'), 40, 80, 1, 'age');
  slider('#f-income', 'incomeM', t('Monthly income, before tax'), 5000, 250000, 500, 'zar');
  slider('#f-employer', 'employerPct', t('Employer retirement contribution (% of income)'), 0, 20, 0.5, 'pct', { hint: t('Check your payslip. Set to 0 if you have none.') });
  slider('#f-saved', 'saved', t('Currently saved and invested'), 0, 2000000, 5000, 'zar');
  slider('#f-basic', 'basicS', t('Basic needs (% of income)'), 10, 80, 1, 'pct');
  slider('#f-disc', 'discS', t('Discretionary spending (% of income)'), 0, 80, 1, 'pct');
  slider('#t-saveRate', 'saveRate', t('Saving rate'), 0, 60, 1, 'pct', { t: 1 });
  slider('#t-income', 'incomeM', t('Monthly income'), 5000, 250000, 500, 'zar', { t: 1 });
  slider('#t-retire', 'retire', t('Retirement age'), 40, 80, 1, 'age', { t: 1 });
  slider('#t-investPct', 'investPct', t('Share of savings invested'), 0, 100, 5, 'pct', { t: 1 });
  slider('#t-replacement', 'replacement', t('Retirement spending vs. today'), 40, 120, 5, 'pct', { t: 1 });
  slider('#f-pension', 'pension', t('Other retirement income (per year)'), 0, 600000, 6000, 'zar',
    { hint: t('Pension or annuity, in today\'s rand. The old-age grant is {0} a month, means-tested.', [zar(SA.oldAgeGrantMonthly)]) });
  slider('#f-inflation', 'inflation', t('Inflation'), 0, 10, 0.5, 'pct', { hint: t('Consumer inflation was 5.2% in October 2026 (Stats SA).') });
  slider('#f-wage', 'wageGrowth', t('Pay growth above inflation'), 0, 4, 0.5, 'pct');
  slider('#f-life', 'life', t('Plan until age'), 75, 100, 1, 'n');
  slider('#f-ownRet', 'ownRet', t('Retirement fund contribution from your payslip (% of gross)'), 0, 27.5, 0.5, 'pct',
    { hint: t('Already part of your savings. Here it only lowers tax. Deductible up to 27.5% of pay.') });
  slider('#f-medMembers', 'medMembers', t('People on your medical scheme (you and dependants)'), 0, 8, 1, 'n',
    { hint: t('Medical scheme members earn a tax credit: R376 a month each for the first two, R254 for each extra.') });
  slider('#f-potVested', 'potVested', t('Vested pot'), 0, 2000000, 5000, 'zar');
  slider('#f-potSavings', 'potSavings', t('Savings pot'), 0, 300000, 1000, 'zar');
  slider('#f-potRetirement', 'potRetirement', t('Retirement pot'), 0, 2000000, 5000, 'zar');
  slider('#f-withdraw', 'withdraw', t('Amount to withdraw from the savings pot'), 0, 300000, 1000, 'zar');

  $('#styleBtns').innerHTML = Object.keys(STY).map(function (k) {
    return '<button type="button" data-style="' + k + '" aria-pressed="false"><b>' + t(STY[k].name) + '</b><span>' + t(STY[k].text) + '</span></button>';
  }).join('');
  $('#catRows').innerHTML = CATS.map(function (c) {
    return '<tr><td>' + t(c.n) + '</td><td><span class="pill" style="color:' + (c.t === 'b' ? 'var(--need)' : 'var(--want)') + '">' + (c.t === 'b' ? t('Need') : t('Want')) + '</span></td>' +
      '<td class="n"><input class="catin" type="number" min="0" max="100" step="0.5" data-cat="' + c.id + '" aria-label="' + t('{0} percent', [t(c.n)]) + '"></td><td class="n" data-cm="' + c.id + '"></td></tr>';
  }).join('');
};

/* ---------- keep inputs and labels in step with the model ---------- */
var syncInputs = function () {
  var E = D.whatIf;
  $$('[data-k]').forEach(function (el) {
    var k = el.dataset.k, v = answerValue(k);
    if (k === 'basicS' || k === 'discS' || k === 'incomeM') v = Math.round(v);
    if (k === 'retire') el.min = S.age + 1;
    setInputValue(el, v);
  });
  $$('[data-t]').forEach(function (el) {
    var k = el.dataset.t, v;
    if (k === 'saveRate') v = Math.round(E.saveRate * 100);
    else if (k === 'incomeM') v = Math.round(E.income / 12);
    else v = E[k];
    if (k === 'retire') el.min = S.age + 1;
    setInputValue(el, v);
  });
  $$('[data-cat]').forEach(function (el) { setInputValue(el, Math.round(S.cats[el.dataset.cat] * 10) / 10); });
  $$('[data-o]').forEach(function (o) {
    var k = o.dataset.o;
    if (k === 'score') { o.textContent = D.score; return; }
    if (k === 'scoreLabel') { o.textContent = scoreLabel(D.score); return; }
    o.textContent = FMT[o.dataset.f || 'n'](answerValue(k));
  });
  $$('[data-to]').forEach(function (o) {
    var k = o.dataset.to;
    var v = k === 'saveRate' ? E.saveRate * 100 : k === 'incomeM' ? E.income / 12 : E[k];
    o.textContent = FMT[o.dataset.f](v);
  });
  $$('[data-style]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.style === E.style)); });
};

var tile = function (label, value, sub, cls) {
  return '<div class="tile"><small>' + label + '</small><strong class="' + (cls || '') + '">' + value + '</strong><span>' + (sub || '') + '</span></div>';
};
var pctRound = function (x) { return Math.round(x * 100); };
var r1 = function (x) { return Math.round(x * 10) / 10; };

/* ---------- overview ---------- */
var drawOverview = function () {
  var rb = D.rb, pay = D.pay, score = D.score, r = S.retire;
  var arc = $('#ringArc');
  arc.setAttribute('stroke-dasharray', (score / 100 * 264) + ' 264');
  arc.setAttribute('stroke', score >= 60 ? 'var(--save)' : score >= 40 ? '#e0a526' : 'var(--want)');
  var med = valueAtAge(rb, r, 'p50');
  $('#tiles').innerHTML =
    tile(t('Saved each month'), zar(S.income * savePct() / 1200), t('{0}% of income', [Math.round(savePct())])) +
    tile(t('Median savings at {0}', [r]), med == null ? '–' : zarShort(med), t('In today\'s rand')) +
    tile(t('Chance savings last'), pctRound(rb.success) + '%', t('Through age {0}', [S.life]), rb.success >= 0.8 ? 'good' : rb.success < 0.5 ? 'bad' : 'warn') +
    tile(t('Net worth now'), zar(S.saved - S.debt), S.debt > 0 ? (isFinite(pay) ? t('Debt-free in {0}', [pay < 1 ? t('under a year') : t('{0} years', [pay.toFixed(1)])]) : t('Payment doesn\'t cover interest')) : t('No debt'));

  var ins = [], sv = savePct(), ps = D.peerSave;
  ins.push(['', t('Tax and UIF take {0}% of gross pay. About {1} a month reaches you.', [Math.round(taxPct()), zar(D.tax.spendable / 12)]) + ' <a href="#takehome">' + t('See the breakdown') + '</a>']);
  ins.push(sv >= ps ? ['g', t('You save {0}% of income, at or above the {1}% typical for your peers.', [Math.round(sv), ps])]
                    : ['w', t('You save {0}% of income. Peers like you save about {1}%.', [Math.round(sv), ps])]);
  ins.push(rb.success >= 0.8 ? ['g', t('In {0}% of simulated markets your money lasts to age {1}.', [pctRound(rb.success), S.life])]
         : rb.success >= 0.5 ? ['w', t('In {0}% of simulated markets your money lasts to age {1}. Aim for 80% or more.', [pctRound(rb.success), S.life])]
         : ['b', t('Only {0}% of simulated markets leave you money at {1}. See What if for ideas.', [pctRound(rb.success), S.life])]);
  if (S.debt > 0) ins.push(isFinite(pay) ? ['w', t('Your {0} debt at {1}% clears in {2} years.', [zar(S.debt), S.debtRate, pay.toFixed(1)])]
                                         : ['b', t('Your monthly debt payment doesn\'t cover the interest. Raise it so the balance can fall.')]);
  else ins.push(['g', t('You have no debt, so every spare rand can work for you.')]);
  if (S.housing === 'rent' && S.age >= 45) ins.push(['w', t('Renting means housing costs continue after you stop working. Plan for them.')]);
  $('#insights').innerHTML = ins.map(function (x) { return '<li class="' + x[0] + '">' + x[1] + '</li>'; }).join('');
};

/* ---------- profile ---------- */
var drawProfile = function () {
  var m = $('#debtMsg');
  m.textContent = S.debt > 0
    ? (isFinite(D.pay) ? t('At {0} a month you\'re debt-free in {1} years, paying about {2} in interest.', [zar(S.debtPay), D.pay.toFixed(1), zar(S.debtPay * 12 * D.pay - S.debt)])
                       : t('This payment doesn\'t cover the monthly interest, so the balance would never fall.'))
    : '';
};

/* ---------- budget ---------- */
var drawBudget = function () {
  var b = basicPct(), d = discPct(), s = savePct(), inc = S.income;
  var tx = taxPct(), parts = [[b, 'var(--need)', t('Basic needs')], [d, 'var(--want)', t('Discretionary')], [tx, '#8a6d4b', t('Tax and UIF')], [s, 'var(--save)', t('Savings')]];
  var C = 2 * Math.PI * 38, tot = Math.max(100, b + d + tx), off = 0;
  var svg = '<circle cx="50" cy="50" r="38" fill="none" stroke="#eadfcc" stroke-width="16"/>';
  parts.forEach(function (p) {
    var len = p[0] / tot * C;
    svg += '<circle cx="50" cy="50" r="38" fill="none" stroke="' + p[1] + '" stroke-width="16" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 50 50)"/>';
    off += len;
  });
  svg += '<text x="50" y="49" text-anchor="middle" font-family="Trebuchet MS,Segoe UI,sans-serif" font-weight="700" font-size="10" fill="#2a1a14">' + zarShort(inc / 12) + '</text>' +
         '<text x="50" y="60" text-anchor="middle" font-size="6" fill="#6b5a4c">' + t('per month') + '</text>';
  $('#donut').innerHTML = svg;
  $('#budLegend').innerHTML = parts.map(function (p) {
    return '<li><span><i style="background:' + p[1] + '"></i>' + p[2] + '</span><span>' + zar(inc * p[0] / 1200) + ' · ' + Math.round(p[0]) + '%</span></li>';
  }).join('') + (b + d + tx >= 100 ? '<li style="color:var(--bad);display:block;border:0">' + t('Spending plus tax uses all of your gross pay, leaving nothing to save.') + '</li>' : '');
  CATS.forEach(function (c) { var el = $('[data-cm="' + c.id + '"]'); if (el) el.textContent = zar(inc * S.cats[c.id] / 1200); });
};

/* ---------- compare ---------- */
var drawCompare = function () {
  var ps = peerSplit(), b = basicPct(), d = discPct(), s = savePct(), inc = S.income;
  var who = { single: t('single'), married: t('married with no kids'), 'married-kids': t('married with kids'), 'single-kids': t('single with kids') }[S.situation];
  $('#peerLabel').textContent = t('Compared with typical households that are {0} and {1}. Peer figures are illustrative.', [who, S.housing === 'rent' ? t('rent their home') : t('own their home')]);
  var rows = [[t('Basic needs'), b, ps[0], 'var(--need)'], [t('Discretionary'), d, ps[1], 'var(--want)'], [t('Savings'), s, ps[2], 'var(--save)']];
  $('#cmpBars').innerHTML = rows.map(function (r) {
    return '<div class="cmp"><strong>' + r[0] + '</strong><div><div class="bar"><i style="width:' + Math.min(100, r[1]) + '%;background:' + r[3] + '"></i></div>' +
      '<div class="bar peer"><i style="width:' + r[2] + '%;background:#bfae98"></i></div></div>' +
      '<span style="text-align:right"><b>' + Math.round(r[1]) + '%</b><br><small style="color:var(--mute)">' + t('peers {0}%', [Math.round(r[2])]) + '</small></span></div>';
  }).join('') +
    '<div class="key"><span><i style="background:var(--need)"></i>' + t('You') + '</span><span><i style="background:#bfae98"></i>' + t('Peers') + '</span></div>' +
    '<p style="margin:1em 0 0;font-weight:600">' + (s >= ps[2] ? t('You save as much as or more than your peers. Keep it up.') : d > ps[1] ? t('You spend more on discretionary items, so you save less than your peers.') : t('You spend more on basic needs, so you save less than your peers.')) + '</p>';

  var gaps = CATS.map(function (c) { return { c: c, you: S.cats[c.id], pe: peerCat(c), gap: S.cats[c.id] - peerCat(c) }; });
  $('#catCmp').innerHTML = gaps.map(function (x) {
    return '<tr><td>' + t(x.c.n) + '</td><td class="n">' + r1(x.you) + '%</td><td class="n">' + r1(x.pe) + '%</td></tr>';
  }).join('');

  var m = STY[S.style], pc = S.investPct / 100;
  var real = (1 + pc * m.mu + (1 - pc) * CASH_RATE) / (1 + S.inflation / 100) - 1, n = Math.max(1, S.retire - S.age);
  var top = gaps.filter(function (x) { return x.gap >= 0.5; }).sort(function (a, b) { return b.gap - a.gap; }).slice(0, 3);
  $('#opps').innerHTML = top.length ? top.map(function (x) {
    var yr = inc * x.gap / 100, fv = real === 0 ? yr * n : yr * ((Math.pow(1 + real, n) - 1) / real);
    return '<div class="delta"><span><b>' + t(x.c.n) + '</b><br><small style="color:var(--mute)">' + t('{0} points above peers', [r1(x.gap)]) + '</small></span>' +
      '<span style="text-align:right"><b class="good">' + t('{0} a year', [zar(yr)]) + '</b><br><small style="color:var(--mute)">' + t('≈ {0} by {1}', [zarShort(fv), S.retire]) + '</small></span></div>';
  }).join('') : '<p style="color:var(--mute)">' + t('No category is meaningfully above your peers. Nice work.') + '</p>';
};

/* ---------- projection ---------- */
var fanData = null;
var drawProjection = function () {
  var rb = D.rb, re = D.re, e = D.whatIf, showBase = hasWhatIf();
  var W = 760, H = 340, L = 62, R = 14, TP = 14, B = 32, ages = re.ages;
  var x = function (a) { return L + (a - ages[0]) / (ages[ages.length - 1] - ages[0]) * (W - L - R); };
  var ymax = niceMax(Math.max.apply(null, re.p90.concat(showBase ? rb.p90 : [0], [1])));
  var y = function (v) { return TP + (1 - v / ymax) * (H - TP - B); };
  var s = '', i;
  for (i = 0; i <= 4; i++) {
    var v = ymax * i / 4, yy = y(v);
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#eadfcc"/><text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="#6b5a4c">' + zarShort(v) + '</text>';
  }
  var step = ages.length > 45 ? 10 : 5;
  for (var a = Math.ceil(ages[0] / step) * step; a <= ages[ages.length - 1]; a += step)
    s += '<text x="' + x(a) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="#6b5a4c">' + a + '</text>';
  var pt = function (series) { return ages.map(function (a, j) { return x(a) + ',' + y(series[j]); }); };
  s += '<polygon points="' + pt(re.p90).concat(pt(re.p10).reverse()).join(' ') + '" fill="#1f6f8b" opacity=".2"/>';
  if (showBase) s += '<polyline points="' + pt(rb.p50).join(' ') + '" fill="none" stroke="#2a1a14" stroke-width="2" stroke-dasharray="6 4"/>';
  s += '<polyline points="' + pt(re.p50).join(' ') + '" fill="none" stroke="#1f6f8b" stroke-width="3" stroke-linejoin="round"/>';
  if (e.retire <= ages[ages.length - 1])
    s += '<line x1="' + x(e.retire) + '" x2="' + x(e.retire) + '" y1="' + TP + '" y2="' + (H - B) + '" stroke="#2e7d4f" stroke-dasharray="4 4" stroke-width="1.5"/>' +
         '<text x="' + (x(e.retire) + 6) + '" y="' + (TP + 12) + '" font-size="11" fill="#2e7d4f" font-weight="600">' + t('Retire at {0}', [e.retire]) + '</text>';
  s += '<line id="hov" y1="' + TP + '" y2="' + (H - B) + '" stroke="#2a1a14" stroke-width="1" style="display:none"/>' +
       '<rect x="' + L + '" y="' + TP + '" width="' + (W - L - R) + '" height="' + (H - TP - B) + '" fill="transparent" id="hit"/>';
  $('#fan').innerHTML = s;
  fanData = { ages: ages, re: re, x: x, y: y, W: W, L: L };
  $('#baseKey').style.display = showBase ? '' : 'none';

  var med = valueAtAge(re, e.retire, 'p50'), lo = valueAtAge(re, e.retire, 'p10'), hi = valueAtAge(re, e.retire, 'p90');
  $('#projTiles').innerHTML =
    tile(t('Chance savings last'), pctRound(re.success) + '%', showBase ? t('Now {0}%', [pctRound(rb.success)]) : t('Through age {0}', [e.life]), re.success >= 0.8 ? 'good' : re.success < 0.5 ? 'bad' : 'warn') +
    tile(t('Median at {0}', [e.retire]), med == null ? '–' : zarShort(med), lo == null ? '' : t('Range {0} to {1}', [zarShort(lo), zarShort(hi)])) +
    tile(t('Safe income from savings'), med == null ? '–' : t('{0}/mo', [zar(med * 0.04 / 12)]), t('4% yearly withdrawal of the median')) +
    tile(t('Needed in retirement'), t('{0}/mo', [zar(re.retSpend / 12)]), t('After {0}/yr other income', [zar(e.pension)]));

  var cur = re.success, opts = [
    [t('Save 2 more points of income'), { saveRate: e.saveRate + 0.02 }],
    [t('Work 2 years longer'), { retire: e.retire + 2 }],
    [t('Earn 10% more, same spending'), { income: e.income * 1.1 }],
    [t('Spend 10% less in retirement'), { replacement: e.replacement * 0.9 }],
    [t('Invest all your savings'), { investPct: 100 }],
    [t('Switch to no-risk investing'), { style: 'safe' }]];
  $('#sens').innerHTML = opts.map(function (o) {
    var dlt = Math.round((simulate(Object.assign({}, e, o[1]), false).success - cur) * 100);
    return '<div class="delta"><span>' + o[0] + '</span><b class="' + (dlt > 0 ? 'good' : dlt < 0 ? 'bad' : '') + '">' + t('{0} points', [(dlt > 0 ? '+' : '') + dlt]) + '</b></div>';
  }).join('');
};

var showFanTip = function (ev) {
  if (!fanData || ev.target.id !== 'hit') return;
  var r = $('#fan').getBoundingClientRect(), vx = (ev.clientX - r.left) / r.width * fanData.W;
  var ages = fanData.ages, re = fanData.re, x = fanData.x, y = fanData.y;
  var i = clamp(Math.round((vx - fanData.L) / (x(ages[1]) - x(ages[0]))), 0, ages.length - 1);
  var hov = $('#hov'); hov.setAttribute('x1', x(ages[i])); hov.setAttribute('x2', x(ages[i])); hov.style.display = '';
  var tip = $('#tip');
  tip.style.display = 'block';
  tip.style.left = (x(ages[i]) / fanData.W * r.width) + 'px';
  tip.style.top = (y(re.p50[i]) / 340 * r.height) + 'px';
  tip.innerHTML = '<b>' + t('Age {0}', [ages[i]]) + '</b><br>' + t('Median {0}', [zar(re.p50[i])]) + '<br>' + t('Range {0} to {1}', [zarShort(re.p10[i]), zarShort(re.p90[i])]);
};
var hideFanTip = function (ev) {
  if (ev.target.id !== 'hit') return;
  $('#tip').style.display = 'none';
  var h = $('#hov'); if (h) h.style.display = 'none';
};

/* ---------- goals ---------- */
var renderGoalCards = function () {
  $('#goalCards').innerHTML = GOALS.filter(function (g) { return g.id !== 'debt' || S.debt > 0; }).map(function (g) {
    var o = S.goals[g.id];
    return '<div class="goal ' + (o.on ? 'on' : '') + '"><h3>' + t(g.n) + '<button type="button" class="tog" data-goal="' + g.id + '" aria-pressed="' + o.on + '">' + (o.on ? t('Picked') : t('Add')) + '</button></h3><p>' + t(g.d) + '</p>' +
      (o.on ? '<div class="two"><div><label for="ga-' + g.id + '">' + t('Target (R)') + '</label><input id="ga-' + g.id + '" type="number" min="0" step="1000" value="' + goalAmount(g) + '" data-gk="' + g.id + '.amount"></div>' +
              '<div><label for="gy-' + g.id + '">' + t('Years') + '</label><input id="gy-' + g.id + '" type="number" min="1" max="40" value="' + o.years + '" data-gk="' + g.id + '.years"></div></div>' +
              '<p data-gm="' + g.id + '" style="margin:.8em 0 0;font-weight:600;color:var(--ink)"></p>' : '') + '</div>';
  }).join('');
};
var drawGoals = function () {
  var tot = 0, sel = activeGoals();
  sel.forEach(function (g) {
    var m = requiredMonthly(goalAmount(g), S.goals[g.id].years); tot += m;
    var el = $('[data-gm="' + g.id + '"]'); if (el) el.textContent = t('{0} a month', [zar(m)]);
  });
  var avail = S.income * savePct() / 1200;
  if (!sel.length) {
    $('#goalSum').innerHTML = '<h2>' + t('Your goal budget') + '</h2><p style="margin:.6em 0 0;color:var(--mute)">' + t('Pick one or more goals above to see what they cost each month.') + '</p>';
    return;
  }
  var after = simulate(Object.assign({}, D.base, { saveRate: Math.max(0, D.base.saveRate - tot * 12 / S.income) }), false).success;
  var pct = avail > 0 ? tot / avail : Infinity, big = 'font:700 1.6rem var(--disp)';
  $('#goalSum').innerHTML = '<h2>' + t('Your goal budget') + '</h2>' +
    '<div class="grid3" style="margin:14px 0"><div><small style="color:var(--mute)">' + t('Goals need') + '</small><br><strong style="' + big + '">' + t('{0}/mo', [zar(tot)]) + '</strong></div>' +
    '<div><small style="color:var(--mute)">' + t('You save now') + '</small><br><strong style="' + big + '">' + t('{0}/mo', [zar(avail)]) + '</strong></div>' +
    '<div><small style="color:var(--mute)">' + t('Retirement odds if funded from savings') + '</small><br><strong style="' + big + '" class="' + (after >= 0.8 ? 'good' : after < 0.5 ? 'bad' : 'warn') + '">' + pctRound(D.rb.success) + '% → ' + pctRound(after) + '%</strong></div></div>' +
    '<div class="meter"><i style="width:' + Math.min(100, pct * 100) + '%;background:' + (pct > 1 ? 'var(--want)' : 'var(--save)') + '"></i></div>' +
    '<p style="margin:.8em 0 0">' + (pct <= 1
      ? t('Your savings cover these goals with {0} a month to spare.', [zar(avail - tot)])
      : t('These goals cost {0} a month more than you save today. Extend the timelines or trim a target.', [zar(tot - avail)])) + '</p>';
};

/* ---------- plan ---------- */
var drawPlan = function () {
  var ts = buildTasks(), done = ts.filter(function (x) { return S.done[x.id]; }).length;
  $('#tasks').innerHTML = ts.map(function (x) {
    return '<label class="task ' + (S.done[x.id] ? 'done' : '') + '" data-task="' + x.id + '"><input type="checkbox" ' + (S.done[x.id] ? 'checked' : '') + '><span><b>' + x.t + '</b><small>' + x.s + '</small></span></label>';
  }).join('');
  $('#progTxt').textContent = t('{0} of {1} done', [done, ts.length]);
  $('#progBar').style.width = (done / ts.length * 100) + '%';
  $('#saTax').innerHTML = '<h2>' + t('South African tax benefits') + '</h2><ul class="avoid" style="padding-left:1.1em;margin:.8em 0 0">' +
    '<li>' + t('Tax-free savings account: up to {0} a year, {1} in a lifetime. Going over costs a 40% penalty.', [zar(SA.tfsaAnnual), zar(SA.tfsaLifetime)]) + '</li>' +
    '<li>' + t('Retirement fund deduction: {0}% of income, up to {1} a year. For you, about {2}.', [Math.round(SA.retirementDeductPct * 1000) / 10, zar(SA.retirementDeductCap), zar(retirementDeductionLimit())]) + '</li></ul>' +
    '<p class="hint" style="font-size:.82rem;color:var(--mute);margin:.8em 0 0">' + t('SARS rules for the 2026/27 tax year.') + '</p>';
};


/* ---------- advisor (Stacy) ---------- */
var chat = [];   // conversation lives only for this visit
var drawAdvisor = function () {
  $('#coachText').textContent = coachSummary();
  $('#coachFlags').innerHTML = healthFlags().map(function (f) { return '<li class="' + f.lvl + '">' + f.text + '</li>'; }).join('');
  $('#coachMoves').innerHTML = rankMoves(D.base).slice(0, 4).map(function (m, i) {
    var cls = m.gainPts > 0 ? 'good' : '';
    return '<div class="delta move"><span><b>' + (i + 1) + '. ' + m.title + '</b><br><small style="color:var(--mute)">' + m.how + '</small></span>' +
      '<span style="text-align:right;white-space:nowrap"><b class="' + cls + '">' + t('{0} pts', [(m.gainPts > 0 ? '+' : '') + m.gainPts]) + '</b><br>' +
      '<button type="button" class="tog" data-apply=\'' + JSON.stringify(m.changes).replace(/'/g, '') + '\'>' + t('Test it') + '</button></span></div>';
  }).join('');
  if (!$('#chips').children.length) {
    $('#chips').innerHTML = STACY_PROMPTS.map(function (q) { return '<button type="button" class="chip" data-ask="' + q + '">' + t(q) + '</button>'; }).join('');
  }
  if (!chat.length) postChat('stacy', askStacy('hello').text);
};

/** Add a message to the conversation. Text is set with textContent so typed input is never run as HTML. */
var postChat = function (who, text, changes) {
  chat.push({ who: who, text: text });
  var log = $('#chatLog'), m = document.createElement('div');
  m.className = 'msg ' + who;
  var b = document.createElement('div'); b.className = 'bubble'; b.textContent = text;
  m.appendChild(b);
  if (changes && Object.keys(changes).length) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'tog apply'; btn.textContent = t('Test this in What if');
    btn.setAttribute('data-apply', JSON.stringify(changes));
    m.appendChild(btn);
  }
  log.appendChild(m);
  log.scrollTop = log.scrollHeight;
};


/* ---------- take-home pay ---------- */
var drawTakeHome = function () {
  var t_ = D.tax, pct = function (x) { return (Math.round(x * 1000) / 10) + '%'; };
  $('#thTiles').innerHTML =
    tile(t('Take-home pay'), t('{0}/mo', [zar(t_.net / 12)]), t('After tax, UIF and your retirement contribution'), 'good') +
    tile(t('Income tax (PAYE)'), t('{0}/mo', [zar(t_.paye / 12)]), t('{0} of gross pay', [pct(t_.effective)])) +
    tile('UIF', t('{0}/mo', [zar(t_.uif / 12)]), t('1% of pay, up to a cap')) +
    tile(t('Next rand taxed at'), pct(t_.marginal), t('Your marginal rate'));
  var rows = [
    [t('Gross pay'), t_.gross, ''],
    [t('Less retirement contribution you can deduct'), -t_.ded, ''],
    [t('Taxable income'), t_.taxable, 'b'],
    [t('Tax from the table'), t_.before, ''],
    [S.age >= 65 ? t('Less rebates for your age') : t('Less rebate'), -Math.min(t_.before, t_.rebate), ''],
    [t('Less medical scheme credit'), -Math.min(Math.max(0, t_.before - t_.rebate), t_.credit), ''],
    [t('Income tax (PAYE)'), t_.paye, 'b'],
    ['UIF', t_.uif, ''],
    [t('Your retirement contribution (a saving, not a cost)'), t_.own, ''],
    [t('Take-home pay'), t_.net, 'b']
  ];
  $('#thRows').innerHTML = rows.map(function (r) {
    var st = r[2] ? ' style="font-weight:700"' : '';
    return '<tr' + st + '><td>' + r[0] + '</td><td class="n">' + zar(r[1] / 12) + '</td><td class="n">' + zar(r[1]) + '</td></tr>';
  }).join('');
  var br = TAX.brackets, inc = t_.taxable;
  $('#thBrackets').innerHTML = br.map(function (b, i) {
    var top = i + 1 < br.length ? br[i + 1].from : Infinity, part = Math.max(0, Math.min(inc, top) - b.from);
    var label = top === Infinity ? t('Above {0}', [zar(b.from)]) : t('{0} to {1}', [zarShort(b.from), zarShort(top)]);
    return '<tr' + (inc > b.from && inc <= top ? ' style="background:var(--sand)"' : '') + '><td>' + label + '</td><td class="n">' + Math.round(b.rate * 100) + '%</td><td class="n">' + (part > 0 ? zar(part) : '–') + '</td></tr>';
  }).join('');
  var more = payBreakdown(S.income, { ownRet: Math.min(27.5, S.ownRet + 5) }), saved = t_.paye - more.paye;
  $('#thTip').textContent = saved > 1 && S.ownRet < 27.5
    ? t('Tip: another 5% of pay into a retirement fund cuts your tax by about {0} a year.', [zar(saved)])
    : t('You already use the retirement deduction fully, or your pay is below the tax threshold.');
  var needs = basicPct(), wants = discPct(), sv = savePct(), tx = taxPct();
  var seg = [[tx, '#8a6d4b', t('Tax and UIF')], [needs, 'var(--need)', t('Basic needs')], [wants, 'var(--want)', t('Discretionary')], [sv, 'var(--save)', t('Savings')]];
  $('#thMeter').innerHTML = seg.map(function (x) { return '<i style="width:' + x[0] + '%;background:' + x[1] + '"></i>'; }).join('');
  $('#thLegend').innerHTML = seg.map(function (x) {
    return '<li><span><i style="background:' + x[1] + '"></i>' + x[2] + '</span><span>' + zar(S.income * x[0] / 1200) + ' · ' + Math.round(x[0]) + '%</span></li>';
  }).join('');
};

/* ---------- two-pot ---------- */
var drawTwoPot = function () {
  var r = twoPotResult(S.withdraw), P = S.pots, sum = P.vested + P.savings + P.retirement;
  $('#potSum').textContent = sum > S.saved ? t('Pots add up to {0}, more than the {1} saved on your profile. Update it so the projection matches.', [zar(sum), zar(S.saved)]) : t('Pots add up to {0}.', [zar(sum)]);
  var warn = { empty: t('Your savings pot is below the R2 000 minimum, so no withdrawal is possible yet.'),
               min: t('The smallest withdrawal is R2 000.'), max: t('Your savings pot holds {0}, so you cannot withdraw more than that.', [zar(P.savings)]) };
  $('#potWarn').textContent = r.valid ? '' : warn[r.issues[0]];
  $('#potWarn').className = 'hint ' + (r.valid ? '' : 'bad');
  var ok = r.amount > 0;
  $('#potTiles').innerHTML =
    tile(t('Tax on the withdrawal'), ok ? zar(r.tax) : '–', ok ? t('{0}% (your marginal rate)', [Math.round(r.taxRate * 100)]) : '', ok ? 'bad' : '') +
    tile(t('Fund fee'), ok ? zar(r.fee) : '–', t('Example fee, editable')) +
    tile(t('You receive'), ok ? zar(r.net) : '–', ok ? t('You keep {0}c of every rand', [Math.round(r.keepRate * 100)]) : '', ok ? 'good' : '') +
    tile(t('Retirement odds'), ok ? pctRound(r.successNow) + '% → ' + pctRound(r.successAfter) + '%' : pctRound(r.successNow) + '%', t('Chance savings last to {0}', [S.life]));
  $('#potCost').innerHTML = ok
    ? '<h2>' + t('The long-term cost') + '</h2><p style="margin:.6em 0 0;font-size:1.05rem">' +
      t('Taking {0} puts {1} in your hand. Left invested, it could grow to about {2} in today\'s rand by age {3}.', [zar(r.amount), zar(r.net), zar(r.grown), S.retire]) + ' ' +
      (r.delta < 0 ? t('In your plan, that lowers your chance of not running out of money by about {0} points.', [Math.abs(r.delta)]) : t('In your plan, the effect on your chance of not running out of money is small.')) + '</p>'
    : '<h2>' + t('The long-term cost') + '</h2><p style="margin:.6em 0 0;color:var(--mute)">' + t('Move the slider to try an amount.') + '</p>';
  var amts = [2000, 5000, 10000, 20000, 30000, 50000].filter(function (a) { return a <= P.savings; });
  if (P.savings >= TWOPOT.minWithdrawal && amts.indexOf(P.savings) < 0) amts.push(P.savings);
  $('#potTable').innerHTML = amts.length ? amts.map(function (a) {
    var q = twoPotResult(a);
    return '<tr><td>' + zar(a) + '</td><td class="n">' + zar(q.tax) + '</td><td class="n">' + zar(q.net) + '</td><td class="n">' + Math.round(q.keepRate * 100) + '%</td></tr>';
  }).join('') : '<tr><td colspan="4" style="color:var(--mute)">' + t('Your savings pot is below the R2 000 minimum.') + '</td></tr>';
  var mo = S.income * (S.ownRet + S.employerPct) / 1200;
  $('#potFlow').textContent = mo > 0 ? t('One third of your fund contributions goes to the savings pot: about {0} a month.', [zar(mo * TWOPOT.savingsShare)])
                                    : t('One third of your fund contributions goes to the savings pot.');
};

/* ---------- backup and print ---------- */
var pendingImport = null;
var drawBackup = function () {
  $('#bkLast').textContent = S.lastBackup ? t('Last backup: {0}.', [S.lastBackup]) : t('You have not downloaded a backup yet.');
};
var buildPrintSheet = function () {
  var t_ = D.tax, ts = buildTasks(), today = new Date().toISOString().slice(0, 10);
  var kv = function (a, b) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td></tr>'; };
  return '<div class="ps-strip"></div><h1>' + APP_NAME + ' <small>' + t(APP_TAGLINE) + '</small></h1><p>' + t('Personal wealth plan, prepared {0}', [today]) + '</p>' +
    '<h2>' + t('Where you stand') + '</h2><table>' +
    kv(t('Age / retirement age'), S.age + ' / ' + S.retire) +
    kv(t('Gross pay'), t('{0} a month', [zar(S.income / 12)])) +
    kv(t('Take-home pay (after tax, UIF, retirement contribution)'), t('{0} a month', [zar(t_.net / 12)])) +
    kv(t('Income tax (PAYE) / marginal rate'), t('{0} a month', [zar(t_.paye / 12)]) + ' / ' + Math.round(t_.marginal * 100) + '%') +
    kv(t('Saving'), t('{0}% of gross, {1} a month', [Math.round(savePct()), zar(S.income * savePct() / 1200)])) +
    kv(t('Saved and invested today'), zar(S.saved)) +
    kv(t('Debt'), zar(S.debt)) +
    kv(t('Wealth score'), D.score + ' / 100 (' + scoreLabel(D.score) + ')') +
    kv(t('Chance savings last to {0}', [S.life]), pctRound(D.rb.success) + '%') +
    kv(t('Median savings at {0}', [S.retire]) + ' (' + t('In today\'s rand') + ')', zarShort(valueAtAge(D.rb, S.retire, 'p50') || 0)) +
    '</table><h2>' + t('Action checklist') + '</h2><ul class="ps-tasks">' +
    ts.map(function (x) { return '<li><span class="box">' + (S.done[x.id] ? '&#10003;' : '') + '</span><div><b>' + x.t + '</b><br>' + x.s + '</div></li>'; }).join('') +
    '</ul><p class="ps-note">' + t('Educational estimates only, not financial advice. Real results will differ. Tax uses SARS rules for 2026/27. Ask an authorised adviser before big decisions.') + '</p>';
};

/* ---------- routing helpers ---------- */
var showView = function (id) {
  $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'v-' + id); });
  $$('#nav a').forEach(function (a) {
    if (a.dataset.v === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
};
var drawActiveView = function () {
  var on = $('.view.on'), id = on ? on.id : '';
  ({ 'v-overview': drawOverview, 'v-advisor': drawAdvisor, 'v-takehome': drawTakeHome, 'v-twopot': drawTwoPot, 'v-backup': drawBackup, 'v-profile': drawProfile, 'v-budget': drawBudget, 'v-compare': drawCompare,
     'v-projection': drawProjection, 'v-goals': drawGoals, 'v-plan': drawPlan }[id] || function () {})();
};
