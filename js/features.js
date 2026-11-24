/* features.js - stokvel planner and money words. Data stays in this browser. */
'use strict';
(function () {
  var KEY = 'rinao-wealth-stokvel-v1', data = { name: '', memberCount: 10, contribution: 500, frequency: 'monthly', fee: 0, members: [] };
  try { data = Object.assign(data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* first visit */ }
  var $e = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (v) { return 'R' + (Number(v) || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 }); };
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ } };
  var FIELDS = { 'sv-name': 'name', 'sv-members': 'memberCount', 'sv-contribution': 'contribution', 'sv-frequency': 'frequency', 'sv-fee': 'fee' };

  var drawStokvel = function () {
    var n = Math.max(2, Math.min(1000, +data.memberCount || 2)), gross = n * Math.max(0, +data.contribution || 0);
    var fee = Math.max(0, +data.fee || 0), net = Math.max(0, gross - fee);
    $e('sv-results').innerHTML =
      '<div class="tile"><small>' + esc(t('Collected per round')) + '</small><strong>' + money(gross) + '</strong></div>' +
      '<div class="tile"><small>' + esc(t('Shared costs')) + '</small><strong>' + money(fee) + '</strong></div>' +
      '<div class="tile"><small>' + esc(t('Estimated payout')) + '</small><strong class="good">' + money(net) + '</strong></div>';
    var paid = data.members.filter(function (m) { return m.paid; }).length;
    $e('sv-members-list').innerHTML = data.members.length
      ? '<p class="hint" style="margin:0 0 8px">' + esc(t('Paid: {0} of {1}', [paid, data.members.length])) + '</p>' +
        data.members.map(function (m, i) {
          return '<div class="delta"><label><input type="checkbox" data-paid="' + i + '" ' + (m.paid ? 'checked' : '') + '> ' + esc(m.name) + '</label>' +
                 '<button class="tog" type="button" data-remove="' + i + '">' + esc(t('Remove')) + '</button></div>';
        }).join('')
      : '<p class="hint">' + esc(t('No members added yet.')) + '</p>';
    Object.keys(FIELDS).forEach(function (id) { if (document.activeElement !== $e(id)) $e(id).value = data[FIELDS[id]]; });
  };

  Object.keys(FIELDS).forEach(function (id) {
    $e(id).addEventListener('input', function () {
      var k = FIELDS[id]; data[k] = (k === 'name' || k === 'frequency') ? this.value : Math.max(0, +this.value || 0);
      save(); drawStokvel();
    });
  });
  $e('sv-save').onclick = function () { data.name = $e('sv-name').value.trim(); save(); $e('sv-status').textContent = t('Stokvel plan saved on this device.'); };
  $e('sv-add-member').onclick = function () {
    var name = $e('sv-member-name').value.trim();
    if (!name) { $e('sv-status').textContent = t('Enter a name first.'); return; }
    data.members.push({ name: name, paid: false }); $e('sv-member-name').value = ''; $e('sv-status').textContent = ''; save(); drawStokvel();
  };
  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches('[data-paid]')) { var m = data.members[+e.target.dataset.paid]; if (m) m.paid = e.target.checked; save(); drawStokvel(); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-remove]');
    if (b) { data.members.splice(+b.dataset.remove, 1); save(); drawStokvel(); }
  });

  /* Money words: each term and its meaning in the chosen language, with the English beside it. */
  var TERMS = [
    ['Budget', 'A plan for income and spending.'], ['Savings', 'Money kept for future needs.'], ['Debt', 'Money that you owe.'],
    ['Interest', 'The cost of borrowing, or the return earned on savings.'], ['Stokvel', 'A community savings group.'],
    ['Emergency fund', 'Money set aside for unexpected expenses.'], ['Compound growth', 'Growth earned on your money and on earlier growth. Returns are not guaranteed.'],
    ['Take-home pay', 'The money that reaches your bank account after tax and other deductions.']
  ];
  var drawLearn = function () {
    $e('language-phrases').innerHTML = TERMS.map(function (x) {
      return '<div class="phrase"><h3>' + esc(t(x[0])) + '</h3>' + (I18N.lang !== 'en' ? '<small class="en">' + esc(x[0]) + '</small>' : '') + '<p>' + esc(t(x[1])) + '</p></div>';
    }).join('');
  };

  window.RW_redraw = function () { drawStokvel(); drawLearn(); };
  window.RW_redraw();
}());
