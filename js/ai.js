/**
 * ai.js - "Stacy", the on-device advisor. No DOM access, no network, so it runs
 * offline and can be tested in Node.
 *
 * It is not a cloud language model. It combines three things:
 *   1. a natural-language parser that turns sentences into what-if changes,
 *   2. an intent matcher that answers questions using YOUR numbers,
 *   3. a coach that ranks the moves that help your plan most, using the
 *      same 500-scenario simulation as the rest of the app.
 */
'use strict';

/* ---------- 1. natural-language what-if parser ---------- */

var NUM_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20 };

/** Pull a number out of text like "60", "R2 500", "R15k", "2.5m", "five". */
var parseAmount = function (s) {
  var m = /r?\s*(\d[\d\s,]*(?:\.\d+)?)\s*(k|m|million|thousand)?/i.exec(s);
  if (!m) return null;
  var n = parseFloat(m[1].replace(/[\s,]/g, ''));
  var u = (m[2] || '').toLowerCase();
  if (u === 'k' || u === 'thousand') n *= 1e3;
  if (u === 'm' || u === 'million') n *= 1e6;
  return n;
};

/**
 * Turn a sentence into overrides for the what-if sliders (the T object).
 * Returns { changes: {...} }. Empty changes means nothing understood.
 */
var parseWhatIf = function (text, plan) {
  var q = ' ' + String(text).toLowerCase().replace(/[?!]/g, ' ') + ' ';
  Object.keys(NUM_WORDS).forEach(function (w) { q = q.replace(new RegExp('\\b' + w + '\\b', 'g'), String(NUM_WORDS[w])); });
  var ch = {}, m;
  var curSave = Math.round(plan.saveRate * 100);

  if ((m = /retir\w*\s*(?:at|by|when|age)?\s*(?:i'?m|i am|is)?\s*(\d{2})\b/.exec(q)) || (m = /work(?:ing)?\s*(?:until|till|to)\s*(\d{2})\b/.exec(q))) {
    ch.retire = clamp(+m[1], plan.age + 1, 80); 
  } else if ((m = /(?:work|retire)\w*\s*(\d{1,2})\s*(?:more\s*)?(?:years?|yrs?)\s*(longer|later|more)/.exec(q))) {
    ch.retire = clamp(plan.retire + +m[1], plan.age + 1, 80); 
  } else if ((m = /retire\w*\s*(\d{1,2})\s*(?:years?|yrs?)\s*(earlier|sooner|early)/.exec(q))) {
    ch.retire = clamp(plan.retire - +m[1], plan.age + 1, 80); 
  }

  if ((m = /sav\w*\s*(?:rate)?\s*(?:to|at|of)\s*(\d{1,2})\s*%/.exec(q))) {
    ch.saveRate = clamp(+m[1], 0, 60); 
  } else if ((m = /(?:save|saving)\s*(\d{1,2})\s*%?\s*more/.exec(q)) || (m = /(\d{1,2})\s*(?:%|points?|percent)\s*more\s*(?:in\s*)?(?:sav\w*|of my income)/.exec(q))) {
    ch.saveRate = clamp(curSave + +m[1], 0, 60); 
  } else if ((m = /(?:save|saving)\s*(?:r\s?)?(\d[\d\s,]*(?:\.\d+)?\s*k?)\s*(?:a|per|\/)\s*month/.exec(q))) {
    var amt = parseAmount(m[1]);
    if (amt != null && plan.income > 0) { ch.saveRate = clamp(Math.round(amt * 12 / plan.income * 100), 0, 60);  }
  }

  if ((m = /(?:earn|income|salary|make|raise)\w*\s*(?:of|to|at)?\s*(?:r\s?)?(\d[\d\s,]*(?:\.\d+)?\s*(?:k|m)?)\s*(?:a|per|\/)\s*month/.exec(q)) && parseAmount(m[1]) >= 3000) {
    ch.income = clamp(parseAmount(m[1]) * 12, 60000, 3000000); 
  } else if ((m = /(?:get a\s*|receive a\s*|earn\s*|salary\s*(?:up|goes up|rises?)\s*(?:by)?\s*)(\d{1,2})\s*%\s*(?:raise|more|increase|pay rise)?/.exec(q)) && /raise|earn|salary|increase|pay rise/.test(q)) {
    ch.income = Math.round(plan.income * (1 + +m[1] / 100)); 
  }

  if (/\b(no[- ]risk|safe|conservative|cash only)\b/.test(q)) { ch.style = 'safe';  }
  else if (/\b(high[- ]risk|aggressive|risky)\b/.test(q)) { ch.style = 'risky';  }
  else if (/\bmoderate\b/.test(q)) { ch.style = 'moderate';  }

  if ((m = /(?:spend|live on)\s*(\d{2,3})\s*%\s*(?:of (?:what i spend now|today'?s? spending)|in retirement|as much)/.exec(q)) || (m = /replacement\s*(?:of|at|to)?\s*(\d{2,3})\s*%/.exec(q))) {
    ch.replacement = clamp(Math.round(+m[1] / 5) * 5, 40, 120); 
  }
  if ((m = /invest\w*\s*(\d{1,3})\s*%/.exec(q))) { ch.investPct = clamp(Math.round(+m[1] / 5) * 5, 0, 100);  }
  else if (/invest\s*(?:all|everything|100)/.test(q)) { ch.investPct = 100;  }

  return { changes: ch };
};

/** Apply what-if changes to a plan. In changes saveRate is a percent; in a plan it is a fraction. */
var applyChanges = function (plan, ch) {
  var out = Object.assign({}, plan, ch);
  if (ch.saveRate != null) out.saveRate = ch.saveRate / 100;
  return out;
};

/** Apply what-if changes to a plan. In changes saveRate is a percent; in a plan it is a fraction. */
var applyChanges = function (plan, ch) {
  var out = Object.assign({}, plan, ch);
  if (ch.saveRate != null) out.saveRate = ch.saveRate / 100;
  return out;
};

/** Describe what-if changes using labels the app already translates. */
var describeChanges = function (ch) {
  var d = [];
  if (ch.retire != null) d.push(t('Retirement age') + ': ' + ch.retire);
  if (ch.saveRate != null) d.push(t('Saving rate') + ': ' + ch.saveRate + '%');
  if (ch.income != null) d.push(t('Monthly income') + ': ' + zar(ch.income / 12));
  if (ch.style != null) d.push(t('Investment style') + ': ' + t(STY[ch.style].name));
  if (ch.replacement != null) d.push(t('Retirement spending vs. today') + ': ' + ch.replacement + '%');
  if (ch.investPct != null) d.push(t('Share of savings invested') + ': ' + ch.investPct + '%');
  return d.join(' · ');
};

/* ---------- 2. the coach: ranks the moves that help most ---------- */

/** Candidate moves, each as overrides for a what-if plan. */
var candidateMoves = function (plan) {
  var sr = Math.round(plan.saveRate * 100);
  var moves = [
    { id: 'save2',   title: t('Save 2 more points of income'), how: t('About {0} more a month.', [zar(plan.income * 0.02 / 12)]), changes: { saveRate: Math.min(60, sr + 2) } },
    { id: 'save5',   title: t('Save 5 more points of income'), how: t('About {0} more a month.', [zar(plan.income * 0.05 / 12)]), changes: { saveRate: Math.min(60, sr + 5) } },
    { id: 'work2',   title: t('Work 2 years longer'), how: t('Retire at {0} instead of {1}.', [Math.min(80, plan.retire + 2), plan.retire]), changes: { retire: Math.min(80, plan.retire + 2) } },
    { id: 'raise10', title: t('Grow your income by 10%'), how: t('Keep spending steady and save the difference.'), changes: { income: Math.round(plan.income * 1.1) } },
    { id: 'lean',    title: t('Plan to spend 10% less in retirement'), how: t('Aim for {0}% of today\'s spending.', [Math.round(plan.replacement * 0.9 / 5) * 5]), changes: { replacement: Math.max(40, Math.round(plan.replacement * 0.9 / 5) * 5) } },
    { id: 'invest',  title: t('Put all long-term savings to work'), how: t('Invest 100% instead of {0}%.', [plan.investPct]), changes: { investPct: 100 } }
  ];
  return moves.filter(function (mv) {
    if (mv.id === 'invest' && plan.investPct >= 100) return false;
    if (mv.changes.saveRate != null && mv.changes.saveRate === sr) return false;
    if (mv.changes.retire != null && mv.changes.retire === plan.retire) return false;
    if (mv.changes.replacement != null && mv.changes.replacement === plan.replacement) return false;
    return true;
  });
};

/** Run each move through the simulation and rank by the gain in "chance savings last". */
var rankMoves = function (plan) {
  var base = simulate(plan, false).success;
  return candidateMoves(plan).map(function (mv) {
    var gain = simulate(applyChanges(plan, mv.changes), false).success - base;
    return Object.assign({}, mv, { gain: gain, gainPts: Math.round(gain * 100) });
  }).sort(function (a, b) { return b.gain - a.gain; });
};

/** Plain-language health flags from the user's own numbers. */
var healthFlags = function () {
  var f = [], sv = savePct(), tx = D.tax;
  if (S.saved < monthlySpend() * 3) f.push({ lvl: 'b', text: t('Your savings cover under 3 months of spending. Build a cash buffer of about {0} first.', [zar(monthlySpend() * 6)]) });
  if (sv < 10) f.push({ lvl: 'b', text: t('You are saving under 10% of income. Even 2 extra points a month changes your odds.') });
  if (S.debt > 0 && S.debtRate >= 18) f.push({ lvl: 'b', text: t('Debt at {0}% costs more than most investments earn. Paying it down is a guaranteed return.', [S.debtRate]) });
  if (S.debt > 0 && !isFinite(payoffYears(S))) f.push({ lvl: 'b', text: t('Your debt payment does not cover the interest, so the balance never falls.') });
  if (S.debt > S.income * 0.5) f.push({ lvl: 'w', text: t('Your debt is over half of a year\'s income. Make it your first goal.') });
  if (tx.marginal >= 0.31 && S.ownRet < 10) f.push({ lvl: 'w', text: t('Your next rand is taxed at {0}%. Retirement contributions are deductible, so R1 000 costs you about {1} after tax.', [Math.round(tx.marginal * 100), zar(1000 * (1 - tx.marginal))]) });
  if (S.employerPct === 0) f.push({ lvl: 'w', text: t('You entered no employer retirement contribution. Ask whether your employer offers a fund.') });
  if (S.retire - S.age < 15 && D.rb.success < 0.8) f.push({ lvl: 'w', text: t('With under 15 years to retirement there is little time to catch up, so saving rate and retirement age matter most.') });
  if (basicPct() > 50) f.push({ lvl: 'w', text: t('Basic needs take {0}% of income. Housing is usually the biggest lever.', [Math.round(basicPct())]) });
  if (!f.length) f.push({ lvl: 'g', text: t('No red flags. Your basics look healthy; focus on keeping contributions steady.') });
  return f;
};

/** Narrative summary of the whole plan in 3 to 4 sentences. */
var coachSummary = function () {
  var rb = D.rb, p = Math.round(rb.success * 100), sv = Math.round(savePct());
  var tone = p >= 80 ? t('You are in good shape.') : p >= 50 ? t('You are partway there.') : t('Your plan needs attention, and small changes help a lot.');
  var s = tone + ' ' + t('You save {0}% of your income ({1} a month). In {2}% of 500 simulated markets your money lasts to age {3}.', [sv, zar(S.income * savePct() / 1200), p, S.life]);
  var top = rankMoves(D.base).filter(function (m) { return m.gainPts > 0; })[0];
  if (top) s += ' ' + t('The biggest move in your numbers: {0}, worth about +{1} points.', [top.title, top.gainPts]);
  else if (p >= 99) s += ' ' + t('Your plan already holds up in almost every scenario.');
  return s;
};

/* ---------- 3. question answering ---------- */

var INTENTS = [
  { id: 'twopot',  re: /two[- ]?pot|savings pot|retirement pot|vested|\bwithdraw\w*\b|\bcash out\b/ },
  { id: 'greet',   re: /\b(hi|hello|hey|molo|sawubona|howzit|good (morning|afternoon|evening))\b/ },
  { id: 'whatif',  re: /\bwhat if\b|\bif i\b|\bsuppose\b|\bimagine\b|\bwhat would happen\b/ },
  { id: 'score',   re: /\bscore\b|\bhow am i doing\b|\bhow healthy\b|\bam i on track\b|\bon track\b/ },
  { id: 'retire',  re: /\bretire\w*\b|\benough\b|\brun out\b|\blast\b|\bpension\b|\bnest egg\b/ },
  { id: 'save',    re: /\bsave\b|\bsaving\w*\b|\bmore money\b|\bimprove\b|\bbiggest\b|\bbest move\b|\bwhat should i\b|\bhelp\b|\badvice\b/ },
  { id: 'debt',    re: /\bdebt\b|\bloan\b|\bcredit card\b|\bowe\b|\binterest\b/ },
  { id: 'budget',  re: /\bbudget\b|\bspend\w*\b|\bexpens\w*\b|\boverspend\w*\b|\bcut\b|\bwants?\b|\bneeds?\b/ },
  { id: 'takehome', re: /take[- ]?home|\bnet (pay|salary|income)\b|\bpaye\b|\buif\b|after tax|\bgross\b|pay ?slip|\bmarginal\b|\bhow much tax\b/ },
  { id: 'tfsa',    re: /\btfsa\b|\btax[- ]free\b/ },
  { id: 'tax',     re: /\btax\b|\bsars\b|\bdeduct\w*\b|\bra\b|\bretirement annuity\b/ },
  { id: 'emerg',   re: /\bemergency\b|\brainy day\b|\bbuffer\b/ },
  { id: 'goals',   re: /\bgoal\w*\b|\bhouse\b|\bhome\b|\bcar\b|\bstudy\b|\beducation\b|\btrip\b/ },
  { id: 'invest',  re: /\binvest\w*\b|\bindex\b|\betf\b|\bstocks?\b|\brisk\b/ },
  { id: 'infl',    re: /\binflation\b|\bcpi\b|\bprices\b/ },
  { id: 'how',     re: /\bhow does\b|\bhow do you\b|\bexplain\b|\bmonte carlo\b|\bsimulat\w*\b|\bwho are you\b|\bwhat are you\b|\bare you (an )?ai\b/ }
];

var matchIntent = function (q) {
  for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i].re.test(q)) return INTENTS[i].id;
  return null;
};

/** Plain-language summary of a savings-pot withdrawal. */
var twoPotText = function (r) {
  if (r.issues.indexOf('empty') >= 0) return t('Your savings pot holds {0}, below the R2 000 minimum, so you cannot withdraw yet.', [zar(r.pot)]);
  if (r.issues.indexOf('min') >= 0) return t('The smallest savings pot withdrawal is R2 000, so {0} is too little.', [zar(r.amount)]);
  var capped = r.issues.indexOf('max') >= 0 ? t('Your savings pot holds only {0}. For {1}:', [zar(r.pot), zar(r.amount)]) + ' ' : '';
  return capped + t('Withdrawing {0}: tax about {1} ({2}%), fee about {3}, you receive about {4}. Left invested it could be about {5} by age {6}, and your odds go from {7}% to {8}%.',
    [zar(r.amount), zar(r.tax), Math.round(r.taxRate * 100), zar(r.fee), zar(r.net), zar(r.grown), S.retire, Math.round(r.successNow * 100), Math.round(r.successAfter * 100)]);
};

/**
 * Answer a question using the person's own numbers. Questions are matched in English;
 * the answer comes back in the chosen language.
 * Returns { text, changes? } where changes can be applied as a what-if.
 */
var askStacy = function (question) {
  var q = String(question || '').toLowerCase().trim();
  if (!q) return { text: t('Ask me anything about your plan, for example “Can I retire at 60?”') };
  var rb = D.rb, p = Math.round(rb.success * 100), sv = Math.round(savePct());
  var intent = matchIntent(q);

  // Two-pot questions come first: "withdraw R30 000" must never be read as a retirement what-if.
  if (intent === 'twopot') {
    var wm = /(?:withdraw\w*|take(?: out)?|cash out|need|access)\s*(?:r\s?)?(\d[\d\s,]*(?:\.\d+)?\s*(?:k|m)?)/i.exec(question), amt = wm ? parseAmount(wm[1]) : null;
    if (amt != null && amt >= 100) return { text: twoPotText(twoPotResult(amt)) };
    return { text: t('Vested pot: old rules. Savings pot: one withdrawal a tax year, minimum R2 000, taxed at {0}% for you. Retirement pot: locked. Your savings pot holds {1}.', [Math.round(D.tax.marginal * 100), zar(S.pots.savings)]) };
  }

  var parsed = parseWhatIf(question, D.base), hasChange = Object.keys(parsed.changes).length > 0;
  // Any sentence that clearly describes a change is treated as a what-if.
  if (hasChange && intent !== 'tax' && intent !== 'tfsa') {
    var plan = applyChanges(D.base, parsed.changes);
    var after = simulate(plan, true), delta = Math.round((after.success - rb.success) * 100), np = Math.round(after.success * 100);
    var med = valueAtAge(after, plan.retire, 'p50');
    var verdict = delta > 0 ? t('That helps: your chance of lasting to {0} moves from {1}% to {2}% (+{3} points).', [S.life, p, np, delta])
                : delta < 0 ? t('That hurts: your chance of lasting to {0} falls from {1}% to {2}% ({3} points).', [S.life, p, np, delta])
                : t('That barely changes anything: you stay at about {0}%.', [p]);
    return { text: t('Tested: {0}.', [describeChanges(parsed.changes)]) + ' ' + verdict + (med != null ? ' ' + t('Median savings at {0} would be about {1} in today\'s rand.', [plan.retire, zarShort(med)]) : ''),
             changes: parsed.changes, success: after.success };
  }

  switch (intent) {
    case 'greet':
      return { text: t('Molo! I\'m Stacy, your money guide. Your wealth score is {0}/100. What would you like to look at?', [D.score]) };
    case 'score':
      return { text: t('Your wealth score is {0}/100 ({1}). Watch this:', [D.score, scoreLabel(D.score)]) + ' ' + healthFlags()[0].text };
    case 'retire': {
      var med2 = valueAtAge(rb, S.retire, 'p50');
      return { text: t('Retiring at {0}, your money lasts to age {1} in {2}% of simulated markets. Median savings at {0}: about {3}.', [S.retire, S.life, p, med2 == null ? '–' : zarShort(med2)]) };
    }
    case 'save': {
      var top = rankMoves(D.base).filter(function (m) { return m.gainPts > 0; }).slice(0, 3);
      if (!top.length) return { text: t('Your plan already holds up in nearly every scenario. Keep contributions steady and review every six months.') };
      return { text: t('Best moves, by gain in your chance of not running out:') + '\n' +
        top.map(function (m, i) { return t('{0}. {1}: +{2} points. {3}', [i + 1, m.title, m.gainPts, m.how]); }).join('\n'), changes: top[0].changes };
    }
    case 'debt': {
      if (S.debt <= 0) return { text: t('You have no debt, so every spare rand can work for you.') };
      var py = payoffYears(S);
      return { text: isFinite(py)
        ? t('Your {0} debt at {1}% clears in {2} years at {3} a month. Paying the highest-rate debt first saves most.', [zar(S.debt), S.debtRate, py.toFixed(1), zar(S.debtPay)])
        : t('Your payment of {0} does not cover monthly interest of about {1}. Raise it first.', [zar(S.debtPay), zar(S.debt * S.debtRate / 1200)]) };
    }
    case 'budget': {
      var gaps = CATS.map(function (c) { return { c: c, gap: S.cats[c.id] - peerCat(c) }; }).filter(function (x) { return x.gap >= 0.5; })
        .sort(function (a, b) { return b.gap - a.gap; }).slice(0, 3);
      var split = [Math.round(basicPct()), Math.round(discPct()), sv];
      if (!gaps.length) return { text: t('You spend {0}% on needs, {1}% on wants and save {2}%.', split) + ' ' + t('No category is meaningfully above your peers. Nice work.') };
      return { text: t('You spend {0}% on needs, {1}% on wants and save {2}%.', split) + ' ' + t('Above your peers:') + '\n' +
        gaps.map(function (x) { return t('• {0}: {1} points above, about {2} a year.', [t(x.c.n), Math.round(x.gap * 10) / 10, zar(S.income * x.gap / 100)]); }).join('\n') };
    }
    case 'takehome': {
      var tx = D.tax, more = payBreakdown(S.income, { ownRet: Math.min(27.5, S.ownRet + 5) }), cut = tx.paye - more.paye;
      return { text: t('On {0} a month gross you take home about {1} after tax of {2} and UIF of {3}. Your next rand is taxed at {4}%.',
        [zar(S.income / 12), zar(tx.net / 12), zar(tx.paye / 12), zar(tx.uif / 12), Math.round(tx.marginal * 100)]) +
        (cut > 1 && S.ownRet < 27.5 ? ' ' + t('Tip: another 5% of pay into a retirement fund cuts your tax by about {0} a year.', [zar(cut)]) : '') };
    }
    case 'tfsa':
      return { text: t('A tax-free savings account takes up to {0} a year and {1} in total. Going over costs a 40% penalty.', [zar(SA.tfsaAnnual), zar(SA.tfsaLifetime)]) };
    case 'tax':
      return { text: t('Retirement fund contributions are deductible up to {0}% of income, maximum {1} a year (about {2} for you).', [Math.round(SA.retirementDeductPct * 1000) / 10, zar(SA.retirementDeductCap), zar(retirementDeductionLimit())]) };
    case 'emerg':
      return { text: t('Aim for 6 months of spending in easy-access savings: {0} for you. You have {1} saved.', [zar(monthlySpend() * 6), zar(S.saved)]) };
    case 'goals': {
      var ag = activeGoals();
      if (!ag.length) return { text: t('No goals picked yet. Open “Pick your goals”.') };
      var tot = ag.reduce(function (a, g) { return a + requiredMonthly(goalAmount(g), S.goals[g.id].years); }, 0);
      return { text: t('Your {0} goals need about {1} a month, against the {2} you save now.', [ag.length, zar(tot), zar(S.income * savePct() / 1200)]) };
    }
    case 'invest':
      return { text: t('Your style is “{0}” with {1}% invested. Higher risk can earn more but swings more. I cannot recommend products.', [t(STY[S.style].name), S.investPct]) };
    case 'infl':
      return { text: t('Inflation is set to {0}% a year. All results are in today\'s rand.', [S.inflation]) };
    case 'how':
      return { text: t('I\'m Stacy, a maths assistant that runs on your device. I\'m not a cloud AI or a licensed adviser, and nothing leaves your browser.') };
    case 'whatif':
      return { text: t('Tell me a change and I\'ll test it, like “What if I retire at 60?” or “What if I save 5% more?”') };
    default:
      return { text: t('I\'m not sure I followed. Try “What if I retire at 60?”') };
  }
};

/** Tap-to-ask questions. They are matched in English, but each button shows its translation. */
var STACY_PROMPTS = [
  'How am I doing?',
  'What is my best move?',
  'Can I retire at 60?',
  'What if I save 5% more?',
  'What if I work 3 years longer?',
  'What is my take-home pay?',
  'What does a R10 000 savings pot withdrawal cost?',
  'Explain my tax benefits'
];
