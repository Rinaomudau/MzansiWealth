/**
 * helpers.js - DOM shortcuts and number formatting (South African rand).
 * Plain browser JavaScript: no frameworks, no build step.
 */
'use strict';

var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

/** Rand, whole numbers, with a non-breaking space as thousands separator: R1 250 000 */
var zar = function (n) {
  var s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 && Math.round(Math.abs(n)) > 0 ? '-' : '') + 'R' + s;
};

/** Compact rand for charts and tiles: R450k, R1.2m */
var zarShort = function (n) {
  var a = Math.abs(n), s;
  if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'm';
  else if (a >= 1e3) s = Math.round(a / 1e3) + 'k';
  else s = String(Math.round(a));
  return (n < 0 ? '-' : '') + 'R' + s;
};

/** Output formatters keyed by the data-f attribute in the HTML */
var FMT = {
  zar: zar,
  pct: function (v) { return (Math.round(v * 10) / 10) + '%'; },
  yrs: function (v) { return t('{0} yrs', [v]); },
  age: function (v) { return t('Age {0}', [v]); },
  n: function (v) { return v; }
};

/** Round an axis maximum up to 1, 2, 2.5, 5 or 10 times a power of ten */
var niceMax = function (v) {
  var p = Math.pow(10, Math.floor(Math.log10(v || 1))), f = v / p;
  return p * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10);
};

/** Only touch an input's value if the person isn't typing in it right now */
var setInputValue = function (el, v) {
  if (document.activeElement !== el && String(el.value) !== String(v)) el.value = v;
};
