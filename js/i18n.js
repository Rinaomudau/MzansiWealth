/**
 * i18n.js - language support. No DOM access here, so it also runs in Node tests.
 *
 * The English sentence itself is the key: t('Save more') returns the text in the chosen language, and falls
 * back to the English if a translation is missing. Sentences with numbers use {0}, {1}... placeholders:
 *   t('You save {0}% of income', [12])
 * Translations live in js/lang/<code>.js, one file per language. To fix or improve a translation, edit the
 * text on the right of the colon in that file. Keep any {0} placeholders and numbers exactly as they are.
 */
'use strict';

/** Display order. Each name is written in its own language so people can find theirs. */
var LANGS = [
  ['en', 'English'], ['af', 'Afrikaans'], ['zu', 'isiZulu'], ['xh', 'isiXhosa'], ['nso', 'Sepedi'], ['tn', 'Setswana'],
  ['st', 'Sesotho'], ['ve', 'Tshivenda'], ['ts', 'Xitsonga'], ['ss', 'siSwati'], ['nr', 'isiNdebele']
];
var LANG_KEY = 'rinao-wealth-language';  // same key the first phrasebook used, so saved choices carry over

var I18N = {
  lang: 'en',
  dict: {},
  add: function (code, map) { this.dict[code] = Object.assign(this.dict[code] || {}, map); },
  has: function (code) { return LANGS.some(function (l) { return l[0] === code; }); }
};

/** Translate a sentence. args fills {0}, {1}... in the result. */
var t = function (key, args) {
  var d = I18N.dict[I18N.lang], s = (d && d[key]) || key;
  return args ? s.replace(/\{(\d+)\}/g, function (m, i) { return args[i] != null ? args[i] : m; }) : s;
};

var loadLang = function () {
  try { var c = localStorage.getItem(LANG_KEY); if (c && I18N.has(c)) { I18N.lang = c; return true; } } catch (e) { /* private mode */ }
  return false;
};
var saveLang = function (code) { try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* private mode */ } };
