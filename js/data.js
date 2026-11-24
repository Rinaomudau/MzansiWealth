/**
 * data.js - constants, South African rules and default state.
 * Change the numbers here and the whole app follows.
 */
'use strict';

var APP_ID = 'rinao-wealth';
var APP_NAME = 'Rinao Wealth';
var APP_TAGLINE = 'Smarter money. Better living.';

/**
 * Income tax for individuals, SARS 2027 tax year (1 March 2026 to 28 February 2027).
 * Source: sars.gov.za rates of tax for individuals and medical tax credit pages.
 * Each bracket: income above `from` is taxed at `rate`, on top of `base` rand of tax.
 */
var TAX = {
  year: '2026/27',
  brackets: [
    { from: 0,       base: 0,      rate: 0.18 },
    { from: 245100,  base: 44118,  rate: 0.26 },
    { from: 383100,  base: 79998,  rate: 0.31 },
    { from: 530200,  base: 125599, rate: 0.36 },
    { from: 695800,  base: 185215, rate: 0.39 },
    { from: 887000,  base: 259783, rate: 0.41 },
    { from: 1878600, base: 666339, rate: 0.45 }
  ],
  rebatePrimary: 17820, rebateSecondary: 9765, rebateTertiary: 3249, // all ages / 65+ / 75+
  medMain: 376, medFirstDep: 376, medExtraDep: 254,                  // medical scheme fees tax credit, per month
  uifRate: 0.01, uifMonthlyCeiling: 17712                            // employee UIF: 1% of pay up to R17 712 a month
};

/** Two-pot retirement system (from 1 September 2024). */
var TWOPOT = {
  minWithdrawal: 2000,   // smallest savings-pot withdrawal
  savingsShare: 1 / 3,   // share of new contributions that goes to the savings pot
  defaultFee: 345        // example fund admin fee: R300 plus 15% VAT. Funds differ, so this is editable.
};

/** South African rules, SARS 2026/27 tax year (1 March 2026 to 28 February 2027). */
var SA = {
  tfsaAnnual: 46000,        // tax-free savings account, per tax year
  tfsaLifetime: 500000,     // tax-free savings account, lifetime
  retirementDeductPct: 0.275, // retirement fund deduction: share of income...
  retirementDeductCap: 430000, // ...capped at this amount a year
  oldAgeGrantMonthly: 2400  // SASSA older persons grant, means-tested
};

/** Spending categories. t: 'b' = basic need, 'd' = discretionary. d = default % of income. */
var CATS = [
  { id: 'housing',   n: 'Housing (rent or bond)',        t: 'b', d: 14 },
  { id: 'food',      n: 'Groceries',                     t: 'b', d: 5 },
  { id: 'utilities', n: 'Electricity, water and data',   t: 'b', d: 3 },
  { id: 'health',    n: 'Medical aid and healthcare',    t: 'b', d: 4 },
  { id: 'transport', n: 'Transport and fuel',            t: 'b', d: 4 },
  { id: 'dining',    n: 'Eating out and takeaways',      t: 'd', d: 6 },
  { id: 'fun',       n: 'Entertainment',                 t: 'd', d: 5 },
  { id: 'shop',      n: 'Shopping',                      t: 'd', d: 8 },
  { id: 'travel',    n: 'Travel and holidays',           t: 'd', d: 5 },
  { id: 'subs',      n: 'Subscriptions',                 t: 'd', d: 3 },
  { id: 'care',      n: 'Personal care',                 t: 'd', d: 4 },
  { id: 'family',    n: 'Family support and giving',     t: 'd', d: 5 },
  { id: 'other',     n: 'Other',                         t: 'd', d: 4 }
];
/** Default totals, used to scale peer averages down to single categories. */
var DEF_B = CATS.filter(function (c) { return c.t === 'b'; }).reduce(function (a, c) { return a + c.d; }, 0);
var DEF_D = CATS.filter(function (c) { return c.t === 'd'; }).reduce(function (a, c) { return a + c.d; }, 0);

/** Peer averages [basic %, discretionary %, savings %] of TAKE-HOME pay, by situation. Illustrative, not official data. */
var PEERS = {
  'single':       [33, 47, 20],
  'married':      [35, 50, 15],
  'married-kids': [40, 48, 12],
  'single-kids':  [42, 47, 11]
};

/**
 * Investment styles. mu and sd are nominal yearly return and volatility, in rand terms.
 * These are planning assumptions, not forecasts.
 */
var STY = {
  safe:     { name: 'No risk',       mu: 0.07, sd: 0.015, text: 'About 7% a year, very steady' },
  moderate: { name: 'Moderate risk', mu: 0.09, sd: 0.09,  text: 'About 9% a year, can swing' },
  risky:    { name: 'High risk',     mu: 0.11, sd: 0.16,  text: 'About 11% a year, big swings' }
};
var CASH_RATE = 0.065; // return on the share of savings you keep in cash

/** Goals. amt: a number in rand, 'auto' (6 months of spending) or 'debt' (your debt balance). */
var GOALS = [
  { id: 'emergency', n: 'Emergency fund',   d: 'Six months of essential spending, so surprises never become debt.', amt: 'auto', yrs: 2 },
  { id: 'debt',      n: 'Become debt-free', d: 'Clear your current balance on a fixed timeline.', amt: 'debt', yrs: 4 },
  { id: 'house',     n: 'Home deposit',     d: 'Put money aside for a deposit on a home.', amt: 150000, yrs: 6 },
  { id: 'edu',       n: 'Education fund',   d: 'Save for your own or your children\'s studies.', amt: 200000, yrs: 12 },
  { id: 'car',       n: 'Car',              d: 'Pay cash for your next vehicle instead of financing it.', amt: 120000, yrs: 3 },
  { id: 'travel',    n: 'Big trip',         d: 'A trip you won\'t put on a credit card.', amt: 30000, yrs: 2 }
];

var VIEWS = [
  ['overview', 'Overview'], ['advisor', 'Ask Stacy'], ['profile', 'Tell us about you'], ['takehome', 'Take-home pay'],
  ['budget', 'Savings and expenses'], ['compare', 'How you compare'], ['projection', 'What if'],
  ['twopot', 'Two-pot withdrawals'], ['goals', 'Pick your goals'], ['stokvel', 'Stokvel planner'], ['learn', 'Money words'], ['plan', 'Action plan'], ['backup', 'Backup and print']
];

// New key: budget percentages now count tax, so answers saved by version 1 would mean something different.
var STORAGE_KEY = 'rinao-wealth-v2';

var defaults = function () {
  var cats = {}, goals = {};
  CATS.forEach(function (c) { cats[c.id] = c.d; });
  GOALS.forEach(function (g) { goals[g.id] = { on: false, amount: null, years: g.yrs }; });
  return {
    age: 35, retire: 65, life: 90,
    situation: 'married', housing: 'own',
    income: 420000,          // yearly gross, R35 000 a month
    saved: 50000,
    ownRet: 0,               // your own retirement fund contribution through payslip, % of gross (part of your savings)
    medMembers: 2,           // people covered by your medical scheme, you included (0 if none)
    employerPct: 5,          // employer contribution to your retirement fund, % of income
    debt: 0, debtRate: 12, debtPay: 0,
    cats: cats,
    style: 'moderate', investPct: 80,
    wageGrowth: 1,           // pay growth above inflation, % a year
    inflation: 5,            // % a year (CPI was 5.2% in October 2026)
    replacement: 70,         // retirement spending as % of today's spending
    pension: 0,              // other retirement income, rand a year in today's money
    pots: { vested: 30000, savings: 8000, retirement: 12000 }, // two-pot balances, part of 'saved'
    potFee: TWOPOT.defaultFee, withdraw: 20000,
    goals: goals,
    done: {},
    lastBackup: ''
  };
};
