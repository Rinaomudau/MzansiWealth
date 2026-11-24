/**
 * controller.js - turns clicks, typing and navigation into model changes, then redraws.
 */
'use strict';

var refresh = function () {
  derive();
  syncInputs();
  drawActiveView();
};

/* ---------- applying changes to the model ---------- */
var setAnswer = function (key, value) {
  if (key === 'basicS') {
    var d = discPct(), cap = 100 - taxPct(); // needs, wants and tax must fit inside your gross pay
    scaleCats('b', value);
    if (value + d > cap) scaleCats('d', Math.max(0, cap - value));
    return;
  }
  if (key === 'discS') { scaleCats('d', Math.max(0, Math.min(value, 100 - taxPct() - basicPct()))); return; }
  if (key === 'incomeM') { S.income = value * 12; return; }
  if (POTKEYS[key]) { S.pots[POTKEYS[key]] = value; return; }
  S[key] = value;
  if ((key === 'age' || key === 'retire') && S.retire <= S.age) S.retire = S.age + 1;
};

var applyWhatIf = function () {
  if (T.saveRate != null) {
    var target = Math.max(0, 100 - taxPct() - T.saveRate), d = discPct(), b = basicPct(), need = b + d - target;
    if (need > 0) { // cut discretionary first, then basics
      var nd = Math.max(0, d - need);
      scaleCats('d', nd);
      var left = b + nd - target;
      if (left > 0) scaleCats('b', Math.max(0, b - left));
    } else {
      scaleCats('d', d - need);
    }
  }
  ['income', 'retire', 'style', 'investPct', 'replacement'].forEach(function (k) { if (T[k] != null) S[k] = T[k]; });
  if (S.retire <= S.age) S.retire = S.age + 1;
  T = {};
  saveState();
  refresh();
};

/* ---------- events ---------- */
document.addEventListener('input', function (e) {
  var el = e.target, ds = el.dataset;
  if (ds.k) setAnswer(ds.k, el.tagName === 'SELECT' ? el.value : (+el.value || 0));
  else if (ds.t) { if (ds.t === 'incomeM') T.income = (+el.value || 0) * 12; else T[ds.t] = +el.value; }
  else if (ds.cat) S.cats[ds.cat] = clamp(+el.value || 0, 0, 100);
  else if (ds.gk) {
    var parts = ds.gk.split('.');
    S.goals[parts[0]][parts[1]] = (parts[1] === 'amount' && el.value === '') ? null : (+el.value || 0);
  } else return;
  saveState();
  refresh();
});

document.addEventListener('click', function (e) {
  var style = e.target.closest('[data-style]');
  if (style) { T.style = style.dataset.style; refresh(); return; }
  var goal = e.target.closest('[data-goal]');
  if (goal) { var o = S.goals[goal.dataset.goal]; o.on = !o.on; saveState(); renderGoalCards(); refresh(); return; }
  var ask = e.target.closest('[data-ask]');
  if (ask) { sendQuestion(ask.dataset.ask, ask.textContent); return; }
  var apply = e.target.closest('[data-apply]');
  if (apply) {
    try { T = Object.assign({}, JSON.parse(apply.dataset.apply)); } catch (err) { return; }
    location.hash = '#projection'; return;
  }
  var task = e.target.closest('[data-task]');
  if (task && e.target.tagName === 'INPUT') { S.done[task.dataset.task] = e.target.checked; saveState(); refresh(); }
});

var sendQuestion = function (text, label) {
  text = String(text || '').trim();
  if (!text) return;
  postChat('you', label || text); // tapped questions show their translation, but are matched in English
  var r = askStacy(text);
  postChat('stacy', r.text, r.changes);
};
var sendFromBox = function () { var b = $('#askBox'); sendQuestion(b.value); b.value = ''; b.focus(); };
$('#askBtn').onclick = sendFromBox;
$('#askBox').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendFromBox(); } });

document.addEventListener('pointermove', showFanTip);
document.addEventListener('pointerout', hideFanTip);

$('#applyT').onclick = applyWhatIf;
$('#resetT').onclick = function () { T = {}; refresh(); };
$('#catReset').onclick = function () { S.cats = defaults().cats; saveState(); refresh(); };

var resetArmed = false;
$('#reset').onclick = function () {
  var btn = this;
  if (!resetArmed) {
    resetArmed = true;
    btn.textContent = t('Click again to erase all your answers');
    setTimeout(function () { resetArmed = false; btn.textContent = t('Reset and start over'); }, 4000);
    return;
  }
  resetState();
  resetArmed = false;
  btn.textContent = t('Reset and start over');
  renderGoalCards();
  location.hash = '#overview';
  refresh();
};

$('#copyPlan').onclick = function () {
  var text = planAsText(), box = $('#planText');
  box.value = text;
  var done = function () { $('#copyMsg').textContent = t('Copied to your clipboard.'); box.style.display = 'none'; };
  var fallback = function () { box.style.display = 'block'; box.select(); $('#copyMsg').textContent = t('Select the text above and copy it.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
};


/* ---------- backup and print ---------- */
var bkSay = function (msg, cls) { var m = $('#bkMsg'); m.textContent = msg; m.className = 'hint ' + (cls || ''); };
$('#bkDownload').onclick = function () {
  S.lastBackup = new Date().toISOString().slice(0, 10);
  saveState();
  var blob = new Blob([exportData()], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'imali-yami-backup-' + S.lastBackup + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  drawBackup();
  bkSay(t('Backup downloaded. Keep the file somewhere safe.'), 'good');
};
$('#bkFile').onchange = function () {
  var f = this.files && this.files[0];
  pendingImport = null; $('#bkPreview').innerHTML = ''; bkSay('');
  if (!f) return;
  if (f.size > 1000000) { bkSay(t('That file is too large to be a backup.'), 'bad'); return; }
  var rd = new FileReader();
  rd.onerror = function () { bkSay(t('The file could not be read.'), 'bad'); };
  rd.onload = function () {
    var r = importData(String(rd.result));
    if (!r.ok) { bkSay(r.error, 'bad'); return; }
    pendingImport = r.state;
    var x = r.state;
    $('#bkPreview').innerHTML = '<div class="tile"><small>' + t('Backup contains') + '</small><span>' + t('Age {0}, retiring at {1}', [x.age, x.retire]) + '<br>' + t('Gross pay {0} a month', [zar(x.income / 12)]) + '<br>' + t('Saved {0}', [zar(x.saved)]) + (x.lastBackup ? '<br>' + t('Backed up on {0}', [x.lastBackup]) : '') + '</span></div>' +
      '<div class="actions"><button class="btn" id="bkApply" type="button">' + t('Replace my current plan') + '</button></div>';
    bkSay(t('Backup read successfully. Confirm to replace your current answers.'));
  };
  rd.readAsText(f);
};
document.addEventListener('click', function (e) {
  if (e.target.id !== 'bkApply' || !pendingImport) return;
  S = pendingImport; T = {}; pendingImport = null;
  saveState(); renderGoalCards();
  $('#bkPreview').innerHTML = ''; $('#bkFile').value = '';
  refresh();
  bkSay(t('Your plan has been restored.'), 'good');
});
$('#bkPrint').onclick = function () { $('#printSheet').innerHTML = buildPrintSheet(); window.print(); };

/* ---------- routing ---------- */
var route = function () {
  var id = location.hash.slice(1);
  if (!VIEWS.some(function (v) { return v[0] === id; })) id = 'overview';
  showView(id);
  window.scrollTo(0, 0);
  refresh();
};
window.addEventListener('hashchange', route);

/* ---------- language ---------- */
var i18nReg = [];   // every piece of static page text, so it can be re-translated when the language changes
var norm = function (x) { return x.replace(/\s+/g, ' ').trim(); };
var scanStatic = function (el) {
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.hasAttribute('data-no-i18n')) return;
  ['placeholder', 'aria-label', 'title'].forEach(function (a) {
    var v = el.getAttribute(a);
    if (v && v.trim()) i18nReg.push({ n: el, attr: a, key: norm(v) });
  });
  Array.prototype.forEach.call(el.childNodes, function (c) {
    if (c.nodeType === 3) {
      var k = norm(c.nodeValue);
      if (k) i18nReg.push({ n: c, key: k, pre: /^\s/.test(c.nodeValue) ? ' ' : '', post: /\s$/.test(c.nodeValue) ? ' ' : '' });
    } else if (c.nodeType === 1) scanStatic(c);
  });
};
var applyStatic = function () {
  i18nReg.forEach(function (r) {
    var v = t(r.key);
    if (r.attr) r.n.setAttribute(r.attr, v); else r.n.nodeValue = (r.pre || '') + v + (r.post || '');
  });
  document.documentElement.lang = I18N.lang;
  document.title = APP_NAME + ' | ' + t(APP_TAGLINE);
  $('#langSel').value = I18N.lang;
};
var currentViewId = function () {
  var id = location.hash.slice(1);
  return VIEWS.some(function (v) { return v[0] === id; }) ? id : 'overview';
};
/** Switch language: save it, retranslate the page, and redraw everything that is built by script. */
var setLanguage = function (code) {
  if (!I18N.has(code)) return;
  I18N.lang = code; saveLang(code);
  applyStatic();
  buildScaffolding(); renderGoalCards();
  chat = []; $('#chatLog').innerHTML = ''; $('#chips').innerHTML = '';
  if (window.RW_redraw) window.RW_redraw();
  showView(currentViewId());
  refresh();
};
var buildLangList = function () {
  $('#lgList').innerHTML = LANGS.map(function (l) { return '<button type="button" class="lgbtn" data-lang="' + l[0] + '" lang="' + l[0] + '">' + l[1] + '</button>'; }).join('');
  $('#langSel').innerHTML = LANGS.map(function (l) { return '<option value="' + l[0] + '" lang="' + l[0] + '">' + l[1] + '</option>'; }).join('');
};
var openGate = function () { $('#langGate').hidden = false; document.querySelector('.app').inert = true; var b = $('#lgList button'); if (b) b.focus(); };
var closeGate = function () { $('#langGate').hidden = true; document.querySelector('.app').inert = false; };
$('#lgList').addEventListener('click', function (e) {
  var b = e.target.closest('[data-lang]');
  if (!b) return;
  setLanguage(b.dataset.lang); closeGate();
  var m = $('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); }
});
$('#langSel').addEventListener('change', function () { setLanguage(this.value); });

/* ---------- start ---------- */
scanStatic(document.body);   // before any script-built content exists, so only the page's own text is registered
buildLangList();
var hadLanguage = loadLang(); // a saved choice means the person never sees the picker again
applyStatic();
buildScaffolding();
renderGoalCards();
route();
if (!hadLanguage) openGate();
