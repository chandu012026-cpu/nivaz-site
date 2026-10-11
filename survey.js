// Nivaz survey page: one question per screen; the answers are saved through submit_survey (database part 11).
// Links:  survey.html?for=resident   survey.html?for=owner
//   add &full=1  to ask every question instead of the short (core) set
//   add &ch=tag  to see where people came from, e.g. &ch=whatsapp-kondapur (letters, numbers, - _ . only)
//   add &src=interview  when you fill it in for someone you're talking to
(function () {
  'use strict';
  const D = window.NIVAZ_SURVEY, CFG = window.NIVAS_CONFIG;
  const P = new URLSearchParams(location.search);
  const $ = id => document.getElementById(id);
  const app = $('app'), nav = $('nav'), backBtn = $('back'), nextBtn = $('next'), prog = $('progress');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: keep going without saving */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const KEY = who => 'nivaz-survey-v' + D.version + '-' + who;
  const source = P.get('src') === 'interview' ? 'interview' : 'link';
  const channel = (P.get('ch') || '').replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, 40);
  let S = null, flat = [], screen = 'start', timer = 0, sb = null;

  const client = () => sb || (sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false } }));
  const fresh = (who, mode) => ({ who, mode, a: {}, other: {}, contact: {}, pos: -1, hist: [], consent: '', started: 0, v: D.version });
  const build = () => { flat = []; D[S.who].sections.forEach(sec => sec.qs.forEach(q => flat.push(Object.assign({ sec }, q)))); };
  const save = () => { if (S && S.consent === 'yes') LS.set(KEY(S.who), S); };
  const opts = q => {
    const o = (typeof q.o === 'function' ? q.o(S.a, S.mode) : (q.o || [])).slice();
    if (q.other && o.indexOf('Other') < 0) o.push('Other');
    return o;
  };
  const items = q => (typeof q.items === 'function' ? q.items(S.mode) : q.items) || [];

  function visible(q) {
    if (q.consent) return false;
    if (S.mode === 'core' && !q.core) return false;
    if (q.sec.when && !q.sec.when(S.a)) return false;
    if (q.when && !q.when(S.a)) return false;
    if ((q.t === 'one' || q.t === 'all' || q.t === 'top3') && !opts(q).length) return false;
    return true;
  }
  function answered(q) {
    if (q.toContact) return !!(S.contact[q.toContact] || '').trim();
    const v = S.a[q.id];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    if (typeof v === 'string') return v.trim() !== '';
    return true;
  }
  const visList = () => flat.filter(visible);
  function nextPos(from) { for (let i = from + 1; i < flat.length; i++) if (visible(flat[i])) return i; return -1; }

  function hint(q) {
    switch (q.t) {
      case 'one': return 'Pick one';
      case 'all': return q.max ? 'Pick up to ' + q.max : 'Pick all that apply';
      case 'top3': return 'Pick 3, in order: tap your first choice first';
      case 'stars': return q.lo ? '' : '1 star = lowest, 5 stars = highest';
      case 'nps': return 'Tap a number';
      case 'grid': return q.scale === 'stars' ? "Tap the stars for each row. Skip any that don't apply." : "Answer each row. Skip any that don't apply.";
      case 'num': return 'Type an amount';
      case 'text': return 'Optional. A few words is fine.';
    }
    return '';
  }
  const starRow = (val, attr) => '<div class="stars">' + [1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="star${val >= n ? ' on' : ''}" ${attr(n)} aria-pressed="${val === n}">★</button>`).join('') + '</div>';

  function contactBox(fields) {
    let h = '<div class="contactbox">';
    if (fields.indexOf('gmail') >= 0) h += `<label>Gmail address<input id="c_gmail" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="yourname@gmail.com" value="${esc(S.contact.gmail || '')}"></label><span class="note">Google Play needs a Gmail address to add you as a tester.</span>`;
    if (fields.indexOf('phone') >= 0) h += `<label>Mobile number<input id="c_phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="98480 12345" value="${esc(S.contact.phone || '')}"></label>`;
    return h + '<span class="note">Kept apart from your answers, and deleted after the research.</span></div>';
  }

  function control(q) {
    const v = S.a[q.id];
    if (q.t === 'one' || q.t === 'all' || q.t === 'top3') {
      const list = opts(q), sel = q.t === 'one' ? (v != null ? [v] : []) : (v || []);
      const picked = sel.filter(x => x !== q.only).length;
      const full = (q.t === 'all' && q.max && picked >= q.max) || (q.t === 'top3' && picked >= 3);
      const kind = q.t === 'one' ? 'single' : q.t === 'top3' ? 'multi rank' : 'multi';
      let h = '<div class="opts" role="group" aria-labelledby="qt">';
      list.forEach((o, i) => {
        const on = sel.indexOf(o) >= 0, rank = q.t === 'top3' && on ? sel.indexOf(o) + 1 : '';
        h += `<button type="button" class="opt ${kind}" data-opt="${i}" aria-pressed="${on}"${!on && full && o !== q.only ? ' disabled' : ''}><span class="mk">${rank}</span><span>${esc(o)}</span></button>`;
      });
      h += '</div>';
      if (sel.indexOf('Other') >= 0) h += `<div class="othertext"><input id="othertext" maxlength="120" placeholder="Type it here" aria-label="Other, type it here" value="${esc(S.other[q.id] || '')}"></div>`;
      if (q.ask && q.t === 'one' && q.ask[v]) h += contactBox(q.ask[v]);
      return h;
    }
    if (q.t === 'stars') return starRow(v, n => `data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}"`) +
      (q.lo ? `<div class="ends"><span>1 = ${esc(q.lo)}</span><span>5 = ${esc(q.hi)}</span></div>` : '');
    if (q.t === 'nps') return '<div class="nps">' + Array.from({ length: 11 }, (_, n) =>
      `<button type="button" class="${v === n ? 'on' : ''}" data-nps="${n}" aria-pressed="${v === n}">${n}</button>`).join('') +
      '</div><div class="ends"><span>0 = not at all likely</span><span>10 = definitely</span></div>';
    if (q.t === 'grid') {
      const cur = v || {};
      return items(q).map((it, r) => `<div class="grow"><div class="lbl">${esc(it)}</div>` + (q.scale === 'stars'
        ? starRow(cur[it], n => `data-row="${r}" data-val="${n}" aria-label="${esc(it)}: ${n} star${n > 1 ? 's' : ''}"`)
        : '<div class="pills">' + q.scale.map((s, c) => `<button type="button" class="pill" data-row="${r}" data-col="${c}" aria-pressed="${cur[it] === s}">${esc(s)}</button>`).join('') + '</div>') + '</div>').join('');
    }
    if (q.t === 'num') return `<div class="numrow"><span>${esc(q.unit || '')}</span><input id="numin" inputmode="numeric" maxlength="7" placeholder="e.g. 1500" aria-labelledby="qt" value="${v != null ? esc(v) : ''}"></div>`;
    if (q.t === 'text') return `<textarea id="textin" maxlength="500" aria-labelledby="qt">${esc(q.toContact ? S.contact[q.toContact] || '' : v || '')}</textarea>`;
    return '';
  }

  function updateNext(q) {
    const a = answered(q);
    nextBtn.textContent = a || q.req ? 'Next' : 'Skip';
    nextBtn.disabled = !!q.req && !a;
  }

  function renderQ(top) {
    clearTimeout(timer);
    if (S.pos < 0) return renderFinish();
    const q = flat[S.pos], vis = visList(), k = Math.max(0, vis.indexOf(q));
    screen = 'q'; prog.hidden = false; nav.hidden = false;
    $('pbar').style.width = Math.round(100 * k / Math.max(1, vis.length)) + '%';
    $('psec').textContent = q.sec.title;
    $('pnum').textContent = (k + 1) + ' of ' + vis.length;
    const firstInSec = vis.find(x => x.sec === q.sec) === q;
    app.innerHTML = (firstInSec && q.sec.lead ? `<p class="seclead">${esc(q.sec.lead)}</p>` : '') +
      (q.lead ? `<p class="qlead">${esc(q.lead)}</p>` : '') +
      `<h1 class="qtext" id="qt">${esc(q.q)}</h1>` + (hint(q) ? `<p class="qhint">${esc(hint(q))}</p>` : '') + control(q);
    updateNext(q);
    app.onclick = e => onClick(e, q);
    app.oninput = e => onInput(e, q);
    if (top) window.scrollTo(0, 0);
  }

  function onClick(e, q) {
    const b = e.target.closest('button');
    if (!b || b.disabled || !app.contains(b)) return;
    const id = q.id;
    if (b.dataset.opt != null) {
      const o = opts(q)[+b.dataset.opt];
      if (q.t === 'one') {
        S.a[id] = S.a[id] === o ? undefined : o;
      } else {
        let cur = (S.a[id] || []).slice();
        const i = cur.indexOf(o);
        if (i >= 0) cur.splice(i, 1);
        else if (q.only && o === q.only) cur = [o];
        else {
          cur = cur.filter(x => x !== q.only);
          if ((q.t === 'top3' && cur.length >= 3) || (q.max && cur.length >= q.max)) return;
          cur.push(o);
        }
        S.a[id] = cur.length ? cur : undefined;
      }
    } else if (b.dataset.star) S.a[id] = +b.dataset.star;
    else if (b.dataset.nps != null) S.a[id] = +b.dataset.nps;
    else if (b.dataset.row != null) {
      const it = items(q)[+b.dataset.row], cur = Object.assign({}, S.a[id] || {});
      const val = b.dataset.val ? +b.dataset.val : q.scale[+b.dataset.col];
      if (cur[it] === val) delete cur[it]; else cur[it] = val;
      S.a[id] = Object.keys(cur).length ? cur : undefined;
    } else return;
    if (S.a[id] === undefined) delete S.a[id];
    save(); renderQ(false);
    const v = S.a[id];
    const auto = v !== undefined && ((q.t === 'one' && v !== 'Other' && !(q.ask && q.ask[v])) || q.t === 'stars' || q.t === 'nps');
    if (auto) { const at = S.pos; timer = setTimeout(() => { if (screen === 'q' && S.pos === at) goNext(); }, 280); }
    else if (q.t === 'one' && v === 'Other') { const t = $('othertext'); if (t) t.focus(); }
  }

  function onInput(e, q) {
    const t = e.target;
    if (t.id === 'othertext') S.other[q.id] = t.value;
    else if (t.id === 'c_gmail') S.contact.gmail = t.value.trim();
    else if (t.id === 'c_phone') S.contact.phone = t.value;
    else if (t.id === 'numin') {
      const d = t.value.replace(/[^0-9]/g, '').slice(0, 7);
      if (d !== t.value) t.value = d;
      if (d) S.a[q.id] = +d; else delete S.a[q.id];
    } else if (t.id === 'textin') {
      if (q.toContact) S.contact[q.toContact] = t.value;
      else if (t.value.trim()) S.a[q.id] = t.value; else delete S.a[q.id];
    } else return;
    save(); updateNext(q);
  }

  function goNext() {
    clearTimeout(timer);
    if (screen !== 'q') return;
    const q = flat[S.pos], v = S.a[q.id];
    if (q.req && !answered(q)) return;
    if (q.end) {
      const hit = Object.keys(q.end).find(k => (Array.isArray(v) ? v.indexOf(k) >= 0 : v === k));
      if (hit) return renderEnd(q.end[hit]);
    }
    S.hist.push(S.pos);
    S.pos = nextPos(S.pos);
    save();
    if (S.pos < 0) renderFinish(); else renderQ(true);
  }
  function goBack() {
    clearTimeout(timer);
    while (S.hist.length) {
      const p = S.hist.pop();
      if (flat[p] && visible(flat[p])) { S.pos = p; save(); return renderQ(true); }
    }
    renderConsent();
  }

  // ---- what gets sent
  function valueOf(q) {
    let v = S.a[q.id];
    if (v == null) return undefined;
    const other = x => (x === 'Other' && (S.other[q.id] || '').trim() ? 'Other: ' + S.other[q.id].trim().slice(0, 120) : x);
    if (q.t === 'one') return opts(q).indexOf(v) >= 0 ? other(v) : undefined;
    if (q.t === 'all' || q.t === 'top3') { const o = opts(q); v = v.filter(x => o.indexOf(x) >= 0).map(other); return v.length ? v : undefined; }
    if (q.t === 'grid') { const o = {}; items(q).forEach(it => { if (v[it] != null) o[it] = v[it]; }); return Object.keys(o).length ? o : undefined; }
    if (q.t === 'text') { v = String(v).trim().slice(0, 500); return v || undefined; }
    if (q.t === 'num') return typeof v === 'number' && isFinite(v) ? v : undefined;
    return v;
  }
  function collect() {
    const out = {};
    if (S.who === 'resident') out['A1.1'] = 'Yes';
    flat.forEach(q => {
      if (q.consent || q.toContact || !visible(q)) return;
      const v = valueOf(q);
      if (v !== undefined) out[q.id] = v;
    });
    return out;
  }
  function contactDetails() {
    const c = {}, need = {};
    flat.forEach(q => {
      if (!visible(q)) return;
      if (q.ask && q.flag && q.ask[S.a[q.id]]) { c[q.flag] = true; q.ask[S.a[q.id]].forEach(f => { need[f] = true; }); }
      if (q.toContact && (S.contact[q.toContact] || '').trim()) c[q.toContact] = S.contact[q.toContact].trim().slice(0, 500);
    });
    if (need.phone && (S.contact.phone || '').trim()) c.phone = S.contact.phone.trim();
    if (need.gmail && (S.contact.gmail || '').trim()) c.gmail = S.contact.gmail.trim();
    return c.phone || c.gmail || c.note ? c : null;
  }

  // ---- screens
  function renderStart() {
    screen = 'start'; prog.hidden = true; nav.hidden = true;
    let who = null, mode = P.get('full') === '1' ? 'full' : 'core';
    const draw = () => {
      const m = who ? D[who].minutes : { core: 15, full: 40 };
      app.innerHTML = `<h1>Help us build Nivaz</h1>
        <p>Nivaz is a new app for finding and living in PGs, hostels, co-living and 1 RKs in Hyderabad. Tell us what works today and what doesn't.</p>
        <div class="who">
          <button type="button" data-who="resident" aria-pressed="${who === 'resident'}"><b>I live in a PG, or I'm looking for one</b><span>PGs, hostels, co-living and 1 RKs</span></button>
          <button type="button" data-who="owner" aria-pressed="${who === 'owner'}"><b>I run a PG or hostel</b><span>Owners, family members who run it, managers and wardens</span></button>
        </div>
        <p class="qhint" style="margin-bottom:8px">How much time do you have?</p>
        <div class="seg"><button type="button" data-mode="core" aria-pressed="${mode === 'core'}">Quick · about ${m.core} min</button><button type="button" data-mode="full" aria-pressed="${mode === 'full'}">Detailed · about ${m.full} min</button></div>
        <button type="button" class="big" id="go"${who ? '' : ' disabled'}>Continue</button>`;
    };
    draw();
    app.oninput = null;
    app.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.who) { who = b.dataset.who; draw(); }
      else if (b.dataset.mode) { mode = b.dataset.mode; draw(); }
      else if (b.id === 'go' && who) start(who, mode);
    };
  }

  function start(who, mode) {
    const saved = LS.get(KEY(who));
    app.oninput = null;
    if (saved && saved.v === D.version && saved.consent === 'yes' && saved.a) {
      screen = 'resume'; prog.hidden = true; nav.hidden = true;
      const n = Object.keys(saved.a).filter(k => k !== 'A1.1').length;
      app.innerHTML = `<h1>Welcome back</h1><p>You've answered ${n} question${n === 1 ? '' : 's'} so far. Carry on where you left off?</p>
        <div class="stack"><button type="button" id="cont">Continue</button><button type="button" class="ghost" id="restart">Start again</button></div>`;
      app.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.id === 'cont') {
          S = saved; S.hist = S.hist || []; S.other = S.other || {}; S.contact = S.contact || {}; build();
          if (S.pos >= flat.length) S.pos = -1;
          if (S.pos >= 0 && !visible(flat[S.pos])) S.pos = nextPos(S.pos);
          if (S.pos < 0) renderFinish(); else renderQ(true);
        } else if (b.id === 'restart') { LS.del(KEY(who)); S = fresh(who, mode); build(); renderConsent(); }
      };
      return;
    }
    S = fresh(who, mode); build(); renderConsent();
  }

  function renderConsent() {
    clearTimeout(timer);
    screen = 'consent'; prog.hidden = true; nav.hidden = true;
    const m = D[S.who].minutes[S.mode];
    app.innerHTML = (source === 'interview' ? '<span class="badge">Interview</span>' : '') +
      `<h1>Before we start</h1>
      <p><b>Hi! We're building Nivaz, an app for finding and living in PGs, hostels, co-living and 1 RKs in Hyderabad.</b> This survey takes about ${m} minutes.</p>
      <ul class="tight">
        <li>Your answers are anonymous. We never ask for your name, ID or Aadhaar number.</li>
        <li>Skip any question you like.</li>
        <li>We use the answers only to design Nivaz. We never share them with your PG owner, other residents or anyone else.</li>
        <li>At the end you can choose to leave your number or Gmail, ${S.who === 'resident' ? 'to test the app or join the lucky draw' : 'to test the app or join the free pilot'}. We delete these after the research.</li>
        <li>This survey is for people aged 18 and above.</li>
      </ul>
      <p class="muted" style="font-size:14px">More in our <a href="privacy.html#surveys" target="_blank" rel="noopener">privacy policy</a>.</p>
      <p><b>Shall we start?</b></p>
      <div class="stack"><button type="button" id="yes">Yes, let's start</button><button type="button" class="ghost" id="no">No, thanks</button></div>`;
    app.oninput = null;
    app.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'yes') {
        if (S.consent !== 'yes') { S.consent = 'yes'; S.started = Date.now(); }
        if (S.who === 'resident') S.a['A1.1'] = 'Yes';
        S.hist = []; S.pos = nextPos(-1); save(); renderQ(true);
      } else if (b.id === 'no') renderEnd('declined');
    };
    window.scrollTo(0, 0);
  }

  const ENDS = {
    declined: ['No problem', 'Thank you for your time.'],
    not_for_you: ['Thank you!', 'This survey is for people who live in, have lived in, or are looking for a PG, hostel, co-living or 1 RK.'],
    under18: ['Thank you!', 'This survey is for people aged 18 and above, so we stop here. Nothing you answered has been saved.']
  };
  function renderEnd(code) {
    clearTimeout(timer);
    const who = S.who;
    LS.del(KEY(who));
    screen = 'end'; prog.hidden = true; nav.hidden = true;
    app.innerHTML = `<h1>${esc(ENDS[code][0])}</h1><p id="endmsg" data-end="${esc(code)}">${esc(ENDS[code][1])}</p>` +
      (code === 'not_for_you' ? '<p>Do you run a PG or hostel? <a href="survey.html?for=owner">Take the owner survey</a></p>' : '') +
      '<p><a href="index.html">About Nivaz</a></p>';
    app.onclick = null; app.oninput = null;
    S = null;
  }

  function renderFinish() {
    clearTimeout(timer);
    screen = 'finish'; prog.hidden = false; nav.hidden = true;
    $('pbar').style.width = '100%'; $('psec').textContent = 'All done'; $('pnum').textContent = '';
    const n = Object.keys(collect()).filter(k => k !== 'A1.1').length;
    app.innerHTML = `<h1>That's everything. Thank you!</h1>
      <p>You answered ${n} question${n === 1 ? '' : 's'}. Tap <b>Send</b> to save your answers.</p>
      <div class="err" id="senderr" role="alert"></div>
      <div class="stack"><button type="button" id="send">Send my answers</button><button type="button" class="ghost" id="fback">Back to the questions</button></div>`;
    app.oninput = null;
    app.onclick = e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.id === 'send') send(b);
      else if (b.id === 'fback') goBack();
    };
    window.scrollTo(0, 0);
  }

  async function send(b) {
    const err = $('senderr');
    b.disabled = true; b.textContent = 'Sending…'; err.textContent = '';
    const payload = {
      survey: S.who, version: S.mode, consent: 'yes', answers: collect(), contact: contactDetails(),
      source, channel, lang: 'en', questions_version: D.version,
      seconds: Math.max(0, Math.round((Date.now() - (S.started || Date.now())) / 1000))
    };
    try {
      const { error } = await client().rpc('submit_survey', { p: payload });
      if (error) throw error;
      LS.del(KEY(S.who));
      renderThanks();
    } catch (e) {
      const m = (e && e.message) || String(e);
      err.textContent = /busy/.test(m) ? 'Lots of people are answering right now. Please tap Send again in a minute.'
        : /adults_only/.test(m) ? 'Sorry, this survey is for people aged 18 and above.'
        : /fetch|network|load failed/i.test(m) ? "Couldn't send. Check your internet and tap Send again. Your answers are kept on this phone."
        : 'Something went wrong. Please tap Send again. (' + m + ')';
      b.disabled = false; b.textContent = 'Send my answers';
    }
  }

  function renderThanks() {
    screen = 'thanks'; prog.hidden = true; nav.hidden = true;
    const who = S.who, mode = S.mode, other = who === 'resident' ? 'owner' : 'resident';
    const base = location.origin + location.pathname, link = base + '?for=' + who;
    const msg = who === 'resident'
      ? 'Help build Nivaz, a new app for PGs and hostels in Hyderabad. Take the 15-minute survey: '
      : 'PG owners: help build Nivaz, a new app to fill beds and run your PG. Take the 20-minute survey: ';
    app.innerHTML = `<div class="ok" id="done">Thank you! Your answers have been saved.</div>
      <h2>Know someone who should take it?</h2>
      <div class="stack"><a class="btnlink" href="https://wa.me/?text=${encodeURIComponent(msg + link)}" target="_blank" rel="noopener">Share on WhatsApp</a>
      <button type="button" class="ghost" id="copy">Copy the link</button></div>
      <p class="muted" id="copied" style="font-size:14px;word-break:break-all"></p>
      <p>${who === 'resident' ? 'Do you also run a PG?' : 'Do you also live in a PG?'} <a href="${esc(base + '?for=' + other)}">Take the ${other} survey</a></p>` +
      (source === 'interview' ? '<button type="button" class="big" id="nextint">Start the next interview</button>' : '');
    app.oninput = null;
    app.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'copy') {
        const shown = () => { $('copied').textContent = link; };
        if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => { b.textContent = 'Link copied'; shown(); }, shown); else shown();
      } else if (b.id === 'nextint') { S = fresh(who, mode); build(); renderConsent(); }
    };
    window.scrollTo(0, 0);
  }

  nextBtn.addEventListener('click', goNext);
  backBtn.addEventListener('click', goBack);
  const pre = P.get('for');
  if (pre === 'resident' || pre === 'owner') start(pre, P.get('full') === '1' ? 'full' : 'core');
  else renderStart();
})();
