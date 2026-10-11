// Nivaz survey results — for the admin only. Log in with the admin mobile number; the database shows the
// answers only to the admin (part 11 rules), so this page shows nothing to anyone else.
(function () {
  'use strict';
  const D = window.NIVAZ_SURVEY, CFG = window.NIVAS_CONFIG;
  const $ = id => document.getElementById(id);
  const app = $('app'), tip = $('tip');
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { storageKey: 'nivaz-survey-admin' } });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = e => {
    const m = (e && e.message) || String(e);
    if (/expired|invalid/i.test(m)) return 'That code is wrong or has expired. Request a new one.';
    if (/rate|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if (/not found|signups/i.test(m)) return "There's no Nivaz account with this number.";
    if (/fetch|network/i.test(m)) return "Couldn't reach Nivaz. Check your internet and try again.";
    return m;
  };
  const ist = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const when = s => ist.format(new Date(s));
  const fmt = n => Number(n).toLocaleString('en-IN');
  const flat = who => D[who].sections.reduce((out, sec) => out.concat(sec.qs.map(q => Object.assign({ sec }, q))), []);
  const LENGTH = { core: 'Quick', full: 'Detailed' };

  let rows = [], contacts = [], note = '', confirmDelete = false;
  const F = { who: 'resident', version: 'all', channel: 'all', days: 'all' };
  const open = new Set();   // text questions showing every answer

  // ---------------- logging in ----------------
  function renderLogin(msg) {
    app.innerHTML = `<h1>Survey results</h1><p class="muted">For the Nivaz admin only. Log in with your admin mobile number.</p>
      <div class="card" id="box"><form id="phoneF" novalidate>
        <label for="ph">Mobile number<input id="ph" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="98480 12345"></label>
        <div class="err" id="err1">${esc(msg || '')}</div><button type="submit">Send me a login code</button></form></div>`;
    $('phoneF').onsubmit = async e => {
      e.preventDefault();
      const err = $('err1'), d = $('ph').value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
      err.textContent = '';
      if (!/^[6-9]\d{9}$/.test(d)) { err.textContent = 'Enter your 10-digit mobile number.'; return; }
      const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Sending…';
      const phone = '+91' + d;
      const r = await sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
      if (r.error) { b.disabled = false; b.textContent = 'Send me a login code'; err.textContent = plain(r.error); return; }
      $('box').innerHTML = `<form id="codeF" novalidate><label for="cd">Enter the 6-digit code sent to ${esc(phone)}<input id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></label>
        <div class="err" id="err2"></div><button type="submit">Log in</button></form>`;
      $('codeF').onsubmit = async ev => {
        ev.preventDefault();
        const e2 = $('err2'), code = $('cd').value.replace(/\D/g, ''); e2.textContent = '';
        if (code.length !== 6) { e2.textContent = 'Enter the 6-digit code.'; return; }
        const v = await sb.auth.verifyOtp({ phone, token: code, type: 'sms' });
        if (v.error) { e2.textContent = plain(v.error); return; }
        start();
      };
    };
  }
  async function logout() { await sb.auth.signOut().catch(() => {}); rows = []; contacts = []; renderLogin(); }

  async function start() {
    app.innerHTML = '<p class="muted">Checking…</p>';
    const { data: ok, error } = await sb.rpc('is_admin');
    if (error) { renderLogin(plain(error)); return; }
    if (!ok) {
      app.innerHTML = '<h1>Survey results</h1><p id="notadmin">This page is only for the Nivaz admin.</p><button type="button" class="ghost" id="lo">Log out</button>';
      $('lo').onclick = logout;
      return;
    }
    await load();
  }
  async function fetchAll(table, cols) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select(cols).order('created_at', { ascending: false }).range(from, from + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) return out;
    }
  }
  async function load() {
    app.style.opacity = rows.length ? '.55' : '';
    try {
      rows = await fetchAll('survey_responses', 'id,survey,version,answers,questions_version,source,channel,seconds_taken,created_at');
      contacts = await fetchAll('survey_contacts', 'id,response_id,survey,phone,gmail,wants_testing,wants_call,wants_draw,wants_pilot,note,created_at');
    } catch (e) { app.style.opacity = ''; app.innerHTML = `<p class="err">${esc(plain(e))}</p>`; return; }
    app.style.opacity = '';
    render();
  }

  // ---------------- the results ----------------
  function filtered() {
    const now = Date.now();
    return rows.filter(r => r.survey === F.who &&
      (F.version === 'all' || r.version === F.version) &&
      (F.channel === 'all' || (r.channel || '') === F.channel) &&
      (F.days === 'all' || now - Date.parse(r.created_at) <= +F.days * 864e5));
  }
  const median = xs => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function render() {
    hideTip();
    const R = filtered();
    const count = who => rows.filter(r => r.survey === who).length;
    const channels = Array.from(new Set(rows.map(r => r.channel || ''))).sort();
    const opt = (v, label, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(label)}</option>`;
    let h = `<div class="topline"><h1 style="margin:0">Survey results</h1><div class="row"><button type="button" class="ghost" id="refresh">Refresh</button><button type="button" class="ghost" id="lo">Log out</button></div></div>
      <div class="filters">
        <label>When<select id="f_days">${opt('all', 'All time', F.days)}${opt('7', 'Last 7 days', F.days)}${opt('30', 'Last 30 days', F.days)}</select></label>
        <div><div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:4px">Survey</div><div class="seg" role="group" aria-label="Survey">
          <button type="button" data-who="resident" aria-pressed="${F.who === 'resident'}">Residents (${count('resident')})</button>
          <button type="button" data-who="owner" aria-pressed="${F.who === 'owner'}">Owners (${count('owner')})</button></div></div>
        <label>Length<select id="f_version">${opt('all', 'Quick and detailed', F.version)}${opt('core', 'Quick only', F.version)}${opt('full', 'Detailed only', F.version)}</select></label>
        <label>Channel<select id="f_channel">${opt('all', 'All channels', F.channel)}${channels.map(c => opt(c, c || '(no tag)', F.channel)).join('')}</select></label>
      </div>
      <div class="row"><button type="button" id="csv"${R.length ? '' : ' disabled'}>Download these answers (CSV)</button></div>`;
    const week = R.filter(r => Date.now() - Date.parse(r.created_at) <= 7 * 864e5).length;
    const mins = median(R.map(r => r.seconds_taken).filter(x => typeof x === 'number'));
    const interviews = R.filter(r => r.source === 'interview').length;
    h += `<div class="tiles">
      <div class="tile"><div class="l">Responses</div><div class="v" id="t_total">${fmt(R.length)}</div><div class="s">${R.filter(r => r.version === 'core').length} quick · ${R.filter(r => r.version === 'full').length} detailed</div></div>
      <div class="tile"><div class="l">In the last 7 days</div><div class="v">${fmt(week)}</div></div>
      <div class="tile"><div class="l">Typical time taken</div><div class="v">${mins == null ? '—' : Math.max(1, Math.round(mins / 60)) + ' min'}</div><div class="s">middle answer</div></div>
      <div class="tile"><div class="l">Interviews</div><div class="v">${fmt(interviews)}</div><div class="s">filled in by you</div></div></div>`;
    if (!R.length) h += '<p class="muted" id="none">No answers match these filters yet.</p>';
    else D[F.who].sections.forEach(sec => {
      h += `<section class="sec"><h2>${esc(sec.id)} · ${esc(sec.title)}</h2>`;
      sec.qs.forEach(q => { if (!q.consent) h += card(Object.assign({ sec }, q), R); });
      h += '</section>';
    });
    h += contactsCard();
    app.innerHTML = h;
  }

  function card(q, R) {
    const head = `<h3><small>${esc(q.id)}</small>${esc(q.q)}</h3>`;
    if (q.toContact) return `<div class="qcard empty">${head}<p class="sub">These answers are kept with the contact details at the bottom.</p></div>`;
    const vals = [];
    R.forEach(r => { const v = r.answers && r.answers[q.id]; if (v !== undefined && v !== null && v !== '') vals.push({ v, at: r.created_at }); });
    const n = vals.length;
    if (!n) return `<div class="qcard empty" data-q="${esc(q.id)}">${head}<p class="sub">No answers yet</p></div>`;
    let sub = `${n} answered`, body = '';
    if (q.t === 'one' || q.t === 'all' || q.t === 'top3') {
      if (q.t === 'all') sub += ` · they could pick ${q.max ? 'up to ' + q.max : 'more than one'}, so the percentages add up to more than 100%`;
      if (q.t === 'top3') sub += " · how often each was in someone's top 3, and how often it was their first choice";
      body = choiceBody(q, vals, n);
    } else if (q.t === 'stars') body = starsBody(q, vals, n);
    else if (q.t === 'nps') body = npsBody(vals, n);
    else if (q.t === 'grid') body = gridBody(q, vals);
    else if (q.t === 'num') body = numBody(q, vals);
    else if (q.t === 'text') body = textBody(q, vals);
    return `<div class="qcard" data-q="${esc(q.id)}">${head}<p class="sub">${esc(sub)}</p>${body}</div>`;
  }

  function barList(list, n) {
    return '<ul class="bars">' + list.map(it => {
      const pct = Math.round(100 * it.count / n), extra = it.extra || '';
      const w = it.count ? Math.max(0.6, (it.count / n) * 85).toFixed(1) : 0;
      return `<li tabindex="0" data-tip="${esc(`${it.count} of ${n} · ${pct}%${extra}`)}" data-label="${esc(it.label)}">` +
        `<div class="lab">${esc(it.label)}</div><div class="track"><span class="bar${it.count ? '' : ' zero'}" style="width:${w}%"></span>` +
        `<span class="val">${it.count} · ${pct}%${esc(extra)}</span></div></li>`;
    }).join('') + '</ul>';
  }
  function choiceBody(q, vals, n) {
    const counts = new Map(), first = new Map(), others = [];
    // options that end the survey (e.g. "Under 18") are never saved, so they are left out
    const base = (typeof q.o === 'function' ? [] : (q.o || []).slice()).filter(o => !(q.end && q.end[o]));
    if (q.other && base.indexOf('Other') < 0) base.push('Other');
    base.forEach(o => counts.set(o, 0));
    vals.forEach(({ v }) => (Array.isArray(v) ? v : [v]).forEach((x, i) => {
      let k = String(x);
      if (k.indexOf('Other: ') === 0) { others.push(k.slice(7)); k = 'Other'; }
      counts.set(k, (counts.get(k) || 0) + 1);
      if (q.t === 'top3' && i === 0) first.set(k, (first.get(k) || 0) + 1);
    }));
    let list = Array.from(counts.entries());
    if (!base.length) list = list.filter(e => e[1] > 0);
    // single-choice answers keep their own order (they are usually scales or bands); lists go biggest first
    if (q.t !== 'one' || !base.length) list.sort((a, b) => b[1] - a[1]);
    // in pick-several lists, options nobody chose are named in one line instead of a column of empty bars
    const unpicked = q.t === 'one' ? [] : list.filter(e => !e[1]).map(e => e[0]);
    if (unpicked.length) list = list.filter(e => e[1]);
    const items = list.map(([label, count]) => ({ label, count, extra: q.t === 'top3' && first.get(label) ? ' · 1st for ' + first.get(label) : '' }));
    return barList(items, n) +
      (unpicked.length ? `<p class="others"><b>Not picked yet:</b> ${unpicked.map(esc).join(' · ')}</p>` : '') +
      (others.length ? `<p class="others"><b>"Other" answers:</b> ${others.map(esc).join(' · ')}</p>` : '');
  }
  function starsBody(q, vals, n) {
    const c = [0, 0, 0, 0, 0, 0]; let sum = 0;
    vals.forEach(({ v }) => { const k = Math.round(+v); if (k >= 1 && k <= 5) { c[k]++; sum += k; } });
    const lab = k => k + ' star' + (k > 1 ? 's' : '') + (k === 1 && q.lo ? ' (' + q.lo + ')' : '') + (k === 5 && q.hi ? ' (' + q.hi + ')' : '');
    return `<p class="stat">${(sum / n).toFixed(1)} <small>out of 5, on average</small></p>` + barList([5, 4, 3, 2, 1].map(k => ({ label: lab(k), count: c[k] })), n);
  }
  function npsBody(vals, n) {
    let lo = 0, mid = 0, hi = 0, sum = 0;
    vals.forEach(({ v }) => { const x = +v; sum += x; if (x <= 6) lo++; else if (x <= 8) mid++; else hi++; });
    const score = Math.round(100 * (hi - lo) / n);
    return `<p class="stat">${score > 0 ? '+' : ''}${score} <small>recommend score · average ${(sum / n).toFixed(1)} out of 10</small></p>` +
      barList([{ label: '9–10 (likely)', count: hi }, { label: '7–8', count: mid }, { label: '0–6 (not likely)', count: lo }], n) +
      '<p class="others">Recommend score = % who picked 9–10 minus % who picked 0–6. It runs from −100 to +100.</p>';
  }
  function gridBody(q, vals) {
    const its = typeof q.items === 'function' ? q.items('full') : q.items;
    if (q.scale === 'stars') {
      const st = its.map(it => { let s = 0, c = 0; vals.forEach(({ v }) => { const x = v && v[it]; if (typeof x === 'number') { s += x; c++; } }); return { it, avg: c ? s / c : null, c }; })
        .sort((a, b) => (b.avg == null ? -1 : b.avg) - (a.avg == null ? -1 : a.avg));
      return '<p class="sub" style="margin-top:-4px">Highest average first.</p><div class="tbl"><table><thead><tr><th>Row</th><th>Average (out of 5)</th><th>Answers</th></tr></thead><tbody>' +
        st.map(s => `<tr><td>${esc(s.it)}</td><td class="n">${s.avg == null ? '—' : `<span class="mini" style="width:${Math.round(s.avg / 5 * 60)}px"></span>${s.avg.toFixed(1)}`}</td><td class="n">${s.c}</td></tr>`).join('') + '</tbody></table></div>';
    }
    const scale = q.scale;
    const head = ['Must have', 'Would use', 'Most'].find(s => scale.indexOf(s) >= 0) || null;
    const st = its.map(it => {
      const c = {}; let t = 0; scale.forEach(s => { c[s] = 0; });
      vals.forEach(({ v }) => { const x = v && v[it]; if (x != null && c[x] != null) { c[x]++; t++; } });
      return { it, c, t };
    });
    if (head) st.sort((a, b) => (b.t ? b.c[head] / b.t : -1) - (a.t ? a.c[head] / a.t : -1));
    return (head ? `<p class="sub" style="margin-top:-4px">Sorted by “${esc(head)}”. Percentages are of the people who answered that row.</p>` : '<p class="sub" style="margin-top:-4px">Percentages are of the people who answered that row.</p>') +
      `<div class="tbl"><table><thead><tr><th>Row</th>${scale.map(s => `<th>${esc(s)}</th>`).join('')}<th>Answers</th></tr></thead><tbody>` +
      st.map(s => `<tr><td>${esc(s.it)}</td>${scale.map(sc => {
        const p = s.t ? Math.round(100 * s.c[sc] / s.t) : 0;
        return `<td class="n">${sc === head && s.t ? `<span class="mini" style="width:${Math.round(p * 0.6)}px"></span>` : ''}${s.t ? p + '%' : '—'}</td>`;
      }).join('')}<td class="n">${s.t}</td></tr>`).join('') + '</tbody></table></div>';
  }
  function numBody(q, vals) {
    const xs = vals.map(({ v }) => +v).filter(x => isFinite(x));
    if (!xs.length) return '';
    const u = q.unit || '', avg = xs.reduce((s, x) => s + x, 0) / xs.length;
    return `<p class="stat">${esc(u)}${fmt(median(xs))} <small>middle answer</small></p><p class="sub">Average ${esc(u)}${fmt(Math.round(avg))} · lowest ${esc(u)}${fmt(Math.min.apply(null, xs))} · highest ${esc(u)}${fmt(Math.max.apply(null, xs))}</p>`;
  }
  function textBody(q, vals) {
    const all = open.has(q.id), shown = all ? vals : vals.slice(0, 20);
    return '<ol class="texts">' + shown.map(({ v, at }) => `<li>${esc(v)}<span class="d">${esc(when(at))}</span></li>`).join('') + '</ol>' +
      (vals.length > 20 ? `<button type="button" class="linkbtn" data-more="${esc(q.id)}">${all ? 'Show fewer' : 'Show all ' + vals.length}</button>` : '');
  }

  function contactsCard() {
    const C = contacts, by = k => C.filter(c => c[k]).length;
    let h = `<section class="sec"><h2>Contact details</h2><div class="qcard danger-zone" id="contacts">
      <p id="c_count">${C.length} ${C.length === 1 ? 'person' : 'people'} left a phone number or Gmail: ${by('wants_testing')} to test the app, ${by('wants_call')} for a follow-up call, ${by('wants_draw')} for the lucky draw, ${by('wants_pilot')} for the owner pilot.</p>
      <p class="sub">These are for all surveys, whatever the filters above. The survey promised to delete them when the research ends.</p>`;
    if (note) h += `<p class="ok" id="c_note">${esc(note)}</p>`;
    h += `<div class="stack"><button type="button" id="ccsv"${C.length ? '' : ' disabled'}>Download contacts (CSV)</button>`;
    h += confirmDelete
      ? `<p style="margin:6px 0 0"><b>Delete all ${C.length} contact details? This can't be undone. The answers stay.</b></p><button type="button" class="danger" id="cdelyes">Yes, delete them all</button><button type="button" class="ghost" id="cdelno">Cancel</button>`
      : `<button type="button" class="danger" id="cdel"${C.length ? '' : ' disabled'}>Delete all contact details</button>`;
    return h + '</div><div class="err" id="cerr"></div></div></section>';
  }

  // ---------------- downloads ----------------
  function csvCell(v) {
    if (v == null) return '';
    let s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // stops spreadsheets running typed-in formulas
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function download(name, lines) {
    const blob = new Blob(['﻿' + lines.map(l => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const today = () => new Date().toISOString().slice(0, 10);
  function answersCsv() {
    const qs = flat(F.who).filter(q => !q.consent && !q.toContact), cols = [];
    qs.forEach(q => {
      if (q.t === 'grid') (typeof q.items === 'function' ? q.items('full') : q.items).forEach(it => cols.push({ h: `${q.id} · ${q.q} · ${it}`, get: a => a[q.id] && a[q.id][it] }));
      else cols.push({ h: `${q.id} · ${q.q}`, get: a => a[q.id] });
    });
    const head = ['Response id', 'Survey', 'Length', 'Source', 'Channel', 'Sent (India time)', 'Minutes taken', 'Questions version'].concat(cols.map(c => c.h));
    const lines = [head].concat(filtered().map(r => [r.id, r.survey, LENGTH[r.version] || r.version, r.source, r.channel || '', when(r.created_at),
      r.seconds_taken == null ? '' : Math.round(r.seconds_taken / 60), r.questions_version].concat(cols.map(c => c.get(r.answers || {})))));
    download(`nivaz-survey-${F.who}s-${today()}.csv`, lines);
  }
  function contactsCsv() {
    const yn = b => (b ? 'yes' : '');
    download(`nivaz-survey-contacts-${today()}.csv`, [['Response id', 'Survey', 'Phone', 'Gmail', 'Test the app', 'Follow-up call', 'Lucky draw', 'Owner pilot', 'Other owners to talk to', 'Sent (India time)']]
      .concat(contacts.map(c => [c.response_id, c.survey, c.phone, c.gmail, yn(c.wants_testing), yn(c.wants_call), yn(c.wants_draw), yn(c.wants_pilot), c.note, when(c.created_at)])));
  }
  async function clearContacts() {
    const b = $('cdelyes'); b.disabled = true; b.textContent = 'Deleting…';
    const { data, error } = await sb.rpc('survey_clear_contacts');
    if (error) { $('cerr').textContent = plain(error); b.disabled = false; b.textContent = 'Yes, delete them all'; return; }
    confirmDelete = false; note = `Deleted ${data} contact detail${data === 1 ? '' : 's'}. The answers are kept.`;
    contacts = await fetchAll('survey_contacts', 'id,response_id,survey,phone,gmail,wants_testing,wants_call,wants_draw,wants_pilot,note,created_at').catch(() => []);
    render();
  }

  // ---------------- clicks, filters and the hover readout ----------------
  app.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || !app.contains(b)) return;
    if (b.dataset.who) { F.who = b.dataset.who; render(); }
    else if (b.dataset.more) { if (open.has(b.dataset.more)) open.delete(b.dataset.more); else open.add(b.dataset.more); render(); }
    else if (b.id === 'refresh') { note = ''; load(); }
    else if (b.id === 'lo') logout();
    else if (b.id === 'csv') answersCsv();
    else if (b.id === 'ccsv') contactsCsv();
    else if (b.id === 'cdel') { confirmDelete = true; note = ''; render(); }
    else if (b.id === 'cdelno') { confirmDelete = false; render(); }
    else if (b.id === 'cdelyes') clearContacts();
  });
  app.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'f_days') F.days = t.value; else if (t.id === 'f_version') F.version = t.value; else if (t.id === 'f_channel') F.channel = t.value; else return;
    render();
  });
  function showTip(li, x, y) {
    tip.textContent = '';
    const b = document.createElement('b'); b.textContent = li.dataset.tip;
    const s = document.createElement('span'); s.textContent = li.dataset.label;
    tip.appendChild(b); tip.appendChild(s); tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 14)) + 'px';
    tip.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y + 14)) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  app.addEventListener('pointermove', e => { const li = e.target.closest('li[data-tip]'); if (li) showTip(li, e.clientX, e.clientY); else hideTip(); });
  app.addEventListener('pointerleave', hideTip);
  app.addEventListener('focusin', e => { const li = e.target.closest('li[data-tip]'); if (li) { const r = li.getBoundingClientRect(); showTip(li, r.left + 20, r.top + 10); } });
  app.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });

  sb.auth.getSession().then(({ data }) => { if (data && data.session) start(); else renderLogin(); }, () => renderLogin());
})();
