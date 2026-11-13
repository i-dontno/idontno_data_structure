(function () {
  'use strict';
  var D = window.IDN_DATA;
  if (!D) return;
  var KEY = D.course.storage_key;
  var slug = document.body.getAttribute('data-slug') || '';
  var lessons = [];
  D.modules.forEach(function (m) { m.lessons.forEach(function (l) { if (!l.soon) lessons.push(l); }); });

  /* ---------- progress ---------- */
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { done: s.done || {}, last: s.last || '' }; }
    catch (e) { return { done: {}, last: '' }; }
  }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  var st = load();
  if (slug && slug !== 'home') { st.last = slug; save(st); }

  function doneCount() { return lessons.filter(function (l) { return st.done[l.slug]; }).length; }

  function ring(el, frac, size, stroke, light) {
    if (!el) return;
    var r = (size - stroke) / 2, c = 2 * Math.PI * r;
    el.innerHTML = '<svg viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (light ? 'rgba(255,255,255,.15)' : '#e3dfd3') + '" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (light ? '#ffa94d' : '#0b7a6f') + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-opacity="' + (frac > 0 ? 1 : 0) + '" stroke-dasharray="' + (c * frac) + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      (light ? '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="' + size * 0.2 + '" font-weight="800">' + Math.round(frac * 100) + '%</text>' : '') +
      '</svg>';
  }

  function paint() {
    var n = doneCount(), T = lessons.length;
    Array.prototype.forEach.call(document.querySelectorAll('[data-lesson]'), function (a) {
      a.classList.toggle('done', !!st.done[a.getAttribute('data-lesson')]);
    });
    var p = document.getElementById('idn-prog-txt');
    if (p) p.textContent = n + ' of ' + T + ' done';
    var pr = document.getElementById('idn-prog');
    if (pr) pr.setAttribute('aria-label', n + ' of ' + T + ' lessons completed');
    ring(document.getElementById('idn-ring'), T ? n / T : 0, 30, 4, false);
    ring(document.getElementById('idn-ring-big'), T ? n / T : 0, 120, 10, true);
    var big = document.getElementById('idn-big-txt');
    if (big) big.textContent = n + ' of ' + T + ' lessons completed';
    Array.prototype.forEach.call(document.querySelectorAll('[data-modcount]'), function (el) {
      var m = D.modules[+el.getAttribute('data-modcount')];
      var ls = m.lessons.filter(function (l) { return !l.soon; });
      el.textContent = ls.filter(function (l) { return st.done[l.slug]; }).length + ' / ' + ls.length + ' done';
    });
    var btn = document.getElementById('idn-done');
    if (btn) {
      var on = !!st.done[slug];
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.querySelector('span').textContent = on ? 'Completed' : 'Mark as complete';
    }
    var cont = document.getElementById('idn-continue');
    if (cont) {
      var target = null;
      if (st.last) target = lessons.filter(function (l) { return l.slug === st.last; })[0];
      if (target && st.done[target.slug]) {
        var i = lessons.indexOf(target);
        target = lessons.slice(i + 1).concat(lessons.slice(0, i)).filter(function (l) { return !st.done[l.slug]; })[0] || target;
      }
      if (target) { cont.href = target.slug + '.html'; cont.querySelector('span').textContent = 'Continue: ' + target.title; }
    }
  }

  var btn = document.getElementById('idn-done');
  if (btn) btn.addEventListener('click', function () {
    if (st.done[slug]) delete st.done[slug]; else st.done[slug] = 1;
    save(st); paint();
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { st = load(); paint(); } });
  paint();

  /* ---------- mobile drawer ---------- */
  var menu = document.getElementById('idn-menu');
  function setOpen(o) { document.body.classList.toggle('idn-open', o); if (menu) menu.setAttribute('aria-expanded', o ? 'true' : 'false'); }
  if (menu) menu.addEventListener('click', function () { setOpen(!document.body.classList.contains('idn-open')); });
  var bd = document.querySelector('.idn-backdrop');
  if (bd) bd.addEventListener('click', function () { setOpen(false); });
  var cur = document.querySelector('.idn-side a.cur');
  if (cur && cur.scrollIntoView) { var side = document.querySelector('.idn-side'); side.scrollTop = cur.offsetTop - side.clientHeight / 3; }

  /* ---------- search ---------- */
  var inp = document.getElementById('idn-q'), box = document.getElementById('idn-res');
  if (!inp || !box) return;
  var idx = [];
  D.modules.forEach(function (m) {
    m.lessons.forEach(function (l) {
      idx.push({ l: l, m: m, hay: (l.title + ' ' + l.summary + ' ' + (l.topics || []).join(' ')).toLowerCase() });
    });
  });
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hl(s, words) {
    var out = esc(s);
    words.forEach(function (w) { if (w.length > 1) out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return out;
  }
  var sel = -1, items = [];
  function run() {
    var q = inp.value.trim().toLowerCase();
    if (!q) { box.classList.remove('on'); inp.setAttribute('aria-expanded', 'false'); return; }
    var words = q.split(/\s+/);
    var res = idx.map(function (r) {
      var score = 0;
      for (var i = 0; i < words.length; i++) {
        if (r.hay.indexOf(words[i]) < 0) return null;
        if (r.l.title.toLowerCase().indexOf(words[i]) > -1) score += 5;
      }
      return { r: r, s: score - (r.l.soon ? 3 : 0) };
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).slice(0, 8);
    sel = -1;
    if (!res.length) { box.innerHTML = '<div class="none">No lessons match "' + esc(inp.value.trim()) + '".</div>'; }
    else box.innerHTML = res.map(function (x) {
      var l = x.r.l, topic = '';
      (l.topics || []).some(function (t) { if (words.every(function (w) { return t.toLowerCase().indexOf(w) > -1; })) { topic = t; return true; } });
      var sub = 'Module ' + x.r.m.num + (l.soon ? ' · coming soon' : '') + (topic ? ' · ' + hl(topic, words) : '');
      return l.soon ? '<a role="option" aria-disabled="true" tabindex="-1"><b>' + hl(l.title, words) + '</b><small>' + sub + '</small></a>'
        : '<a role="option" href="' + l.slug + '.html"><b>' + hl(l.title, words) + '</b><small>' + sub + '</small></a>';
    }).join('');
    items = box.querySelectorAll('a[href]');
    box.classList.add('on'); inp.setAttribute('aria-expanded', 'true');
  }
  inp.addEventListener('input', run);
  inp.addEventListener('focus', run);
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      Array.prototype.forEach.call(items, function (a, i) { a.classList.toggle('sel', i === sel); });
    } else if (e.key === 'Enter') {
      var a = items[sel >= 0 ? sel : 0];
      if (a) location.href = a.getAttribute('href');
    } else if (e.key === 'Escape') { inp.value = ''; run(); inp.blur(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.idn-search')) box.classList.remove('on'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && !document.activeElement.isContentEditable) {
      e.preventDefault(); inp.focus();
    }
  });
})();
