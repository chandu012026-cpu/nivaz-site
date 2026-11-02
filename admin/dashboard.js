/* Nivaz team console — the admin web dashboard for the Super admin and Nivaz Support.
   Login: mobile number + SMS code (the same Supabase login as the apps), then a 6-digit code from an authenticator app
   (Supabase MFA, TOTP). Lists come from the dash_* functions in supabase/19_admin_dashboard.sql, which check the role and
   the authenticator step in the database. Changes reuse the actions the phone app uses (same checks there).
   Plain JS, no build step: open index.html from any static web server. */
(function () {
  "use strict";
  const cfg = window.NIVAS_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "nivaz-team-console" }
  });
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $("#view"), gate = $("#gate"), app = $("#app");
  const S = { me: null, role: null, ov: null, ovAt: 0 };
  const isAdmin = () => S.role === "admin";

  // ---------------------------------------------------------------- formatting
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const TZ = "Asia/Kolkata";
  const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
  const num = n => n == null || n === "" ? "—" : nf.format(Number(n));
  const inr = n => n == null || n === "" ? "—" : "₹" + nf.format(Number(n));
  const inrShort = n => { n = Number(n) || 0; if (n >= 1e7) return "₹" + nf.format(Math.round(n / 1e5) / 100) + " Cr"; if (n >= 1e5) return "₹" + nf.format(Math.round(n / 1e3) / 100) + " L"; if (n >= 1000) return "₹" + nf.format(Math.round(n / 100) / 10) + "K"; return "₹" + nf.format(n); };
  const asDate = d => d ? new Date(d) : null;
  const fmtDate = d => d ? asDate(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "—";
  const fmtDay = d => d ? asDate(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ }) : "—";
  const fmtMonth = d => d ? asDate(d).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: TZ }) : "—";
  const fmtTime = t => t ? asDate(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }) : "—";
  const clock = t => asDate(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
  const today = () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  function ago(t) {
    if (!t) return "—";
    const m = Math.round((Date.now() - new Date(t)) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    const d = Math.round(h / 24); return d === 1 ? "yesterday" : d + " days ago";
  }
  function hoursText(h) {
    if (h == null) return "—"; h = Number(h);
    if (h < 1) return Math.max(1, Math.round(h * 60)) + " min";
    if (h < 48) return (Math.round(h * 10) / 10) + " h";
    return Math.round(h / 24) + " days";
  }
  const digits = p => String(p || "").replace(/\D/g, "");
  function phone(p) { const d = digits(p); return d.length === 12 && d.startsWith("91") ? "+91 " + d.slice(2, 7) + " " + d.slice(7) : (p ? esc(p) : "—"); }
  function contact(p, msg) {
    const d = digits(p); if (d.length !== 12) return "";
    return `<span class="contact"><a href="tel:+${d}">Call</a><a href="https://wa.me/${d}${msg ? "?text=" + encodeURIComponent(msg) : ""}" target="_blank" rel="noopener">WhatsApp</a></span>`;
  }
  const plural = (n, one, many) => `${num(n)} ${Number(n) === 1 ? one : many}`;
  const link = (href, text) => `<a class="go" href="#${href}">${esc(text)}</a>`;
  const personLink = (id, name) => id ? link("person/" + id, name || "Someone") : esc(name || "—");
  const propLink = (id, name) => id ? link("property/" + id, name || "Property") : esc(name || "—");
  const st = (cls, word) => `<span class="st ${cls}"><i></i>${esc(word)}</span>`;
  const TYPE = { hostel_pg: "Hostel / PG", coliving: "Co-living", one_rk: "1 RK" };
  const GENDER = { women: "Women", men: "Men", coed: "Co-ed" };
  const CAT = { electrical: "Electrical", plumbing: "Plumbing", wifi: "Wi-Fi", ac: "AC", housekeeping: "Housekeeping", food: "Food",
    furniture: "Furniture", security: "Security", water_purifier: "Water purifier", other: "Other" };
  const ROLE = { admin: "Super admin", support: "Nivaz Support", owner: "Owner", staff: "Staff", resident: "Resident", manager: "Manager" };
  const propStatus = (s, waiting) => waiting ? st("warn", "Waiting for approval") : s === "live" ? st("ok", "Live") : s === "paused" ? st("", "Paused") : st("", "Draft");
  const BOOK = { awaiting_payment: ["", "Waiting for payment"], pending: ["warn", "Paid, owner to accept"], confirmed: ["ok", "Accepted"],
    moved_in: ["ok", "Moved in"], declined: ["", "Declined"], cancelled: ["", "Cancelled"] };
  const bookStatus = s => st(...(BOOK[s] || ["", s]));
  const TOKEN = { not_paid: ["", "Not paid"], reported: ["warn", "UPI to check"], paid: ["ok", "Paid"], failed: ["bad", "Failed"] };
  const VISIT = { requested: ["warn", "Waiting for an answer"], confirmed: ["ok", "Confirmed"], reschedule_asked: ["warn", "Asked to reschedule"],
    done: ["ok", "Visited"], cancelled: ["", "Cancelled"] };
  const COMPLAINT = { raised: ["warn", "New"], assigned: ["warn", "Assigned"], in_progress: ["warn", "Being fixed"], resolved: ["ok", "Fixed"] };
  const FEE = { due: ["warn", "Due"], reported: ["warn", "Paid, to confirm"], paid: ["ok", "Received"], waived: ["", "Waived"] };
  const CASH = { pending: ["warn", "To pay"], paid: ["ok", "Paid"], cancelled: ["", "Cancelled"] };
  function payStatus(p) {
    if (p.status === "created") return p.kind === "refund" ? st("bad", "Owed") : p.utr ? st("warn", "To check") : st("", "Not finished");
    return st(...({ success: ["ok", p.kind === "refund" ? "Sent" : "Paid"], failed: ["bad", "Failed"], refunded: ["", "Refunded"] }[p.status] || ["", p.status]));
  }
  const KIND = { token: "Token", rent: "Rent", refund: "Refund", deposit: "Deposit", meal_addon: "Meals" };

  // ---------------------------------------------------------------- errors
  const MESSAGES = {
    not_allowed: "You don't have permission to do that.",
    mfa_required: "Enter the code from your authenticator app first.",
    not_found: "That item no longer exists. Refresh and try again.",
    not_pending: "This was already answered. Refresh to see the latest.",
    fee_not_due: "This fee isn't due any more. Refresh to see the latest.",
    fee_not_reported: "The owner hasn't said they paid yet.",
    fee_needs_upi: "Add the UPI ID and name that owners pay the fee to.",
    utr_invalid: "Enter the 12-digit UPI reference number (UTR).",
    utr_used: "That UPI reference number is already used for another payment.",
    payout_upi_invalid: "That doesn't look like a UPI ID. It looks like name@bank.",
    amount_invalid: "Enter an amount in rupees, from 0 to 1,00,000.",
    phone_invalid: "Enter a 10-digit Indian mobile number.",
    admin_only: "Only the Super admin can do that.",
    upi_required: "Add the owner's UPI ID before putting the listing live.",
    invalid_input: "Something doesn't look right. Check and try again."
  };
  function friendly(err) {
    const raw = (err && (err.message || err.error_description || err.msg)) || String(err || "");
    for (const k in MESSAGES) if (raw.includes(k)) return MESSAGES[k];
    if (/Failed to fetch|NetworkError|network|abort/i.test(raw)) return "No connection. Check your internet and try again.";
    if (/JWT expired|invalid JWT|session/i.test(raw)) return "Your login expired. Log in again.";
    return raw || "Something went wrong. Try again.";
  }
  class DashError extends Error {}
  function mkErr(error, fn) {
    const e = new DashError(friendly(error)); e.code = error.code; e.raw = error; e.fn = fn;
    e.missing = ["PGRST202", "42883"].includes(error.code);
    e.mfa = /mfa_required/.test(error.message || "");
    e.login = /login_required|JWT expired|invalid JWT/.test(error.message || "");
    return e;
  }
  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw mkErr(error, fn);
    return data;
  }
  // A direct change to one row (the Super admin's existing powers, checked by the database's own rules)
  async function patch(table, id, values) {
    const { data, error } = await sb.from(table).update(values).eq("id", id).select("id");
    if (error) throw mkErr(error, table);
    if (!data || !data.length) throw new DashError(MESSAGES.not_allowed);
    return data[0];
  }

  // ---------------------------------------------------------------- toast and dialog
  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 4200); }
  // A small form in a dialog. fields: [{ id, label, hint, type, value, placeholder, inputmode, required, rows }]
  // run(values) does the work; if it throws, the message shows in the dialog and it stays open.
  function ask({ title, text, fields = [], ok = "Confirm", danger = false, run }) {
    const dlg = $("#dlg");
    return new Promise(resolve => {
      dlg.innerHTML = `<form method="dialog" novalidate>
        <h2 id="dlgTitle">${esc(title)}</h2>${text ? `<p>${text}</p>` : ""}
        ${fields.map(f => `<label class="fld">${esc(f.label)}${f.hint ? `<span>${esc(f.hint)}</span>` : ""}
          ${f.type === "textarea" ? `<textarea id="f_${f.id}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || "")}">${esc(f.value || "")}</textarea>`
          : `<input id="f_${f.id}" type="${f.type || "text"}" value="${esc(f.value == null ? "" : f.value)}" placeholder="${esc(f.placeholder || "")}"${f.inputmode ? ` inputmode="${f.inputmode}"` : ""} autocomplete="off">`}
          </label>`).join("")}
        <div class="err" id="dlgErr" role="alert"></div>
        <div class="btns"><button type="button" class="btn" id="dlgNo">Cancel</button><button type="submit" class="btn ${danger ? "danger" : "primary"}" id="dlgOk">${esc(ok)}</button></div>
      </form>`;
      const close = v => { dlg.close(); resolve(v); };
      $("#dlgNo", dlg).onclick = () => close(null);
      dlg.oncancel = e => { e.preventDefault(); close(null); };
      $("form", dlg).onsubmit = async e => {
        e.preventDefault();
        const vals = {}; fields.forEach(f => vals[f.id] = $("#f_" + f.id, dlg).value.trim());
        const missing = fields.find(f => f.required && !vals[f.id]);
        if (missing) { $("#dlgErr", dlg).textContent = `Fill in "${missing.label}".`; return; }
        const btn = $("#dlgOk", dlg); btn.disabled = true;
        try { const r = run ? await run(vals) : vals; close(r == null || r === false ? vals : r); }   // a function that returns nothing still means "done"
        catch (ex) { $("#dlgErr", dlg).textContent = friendly(ex); btn.disabled = false; }
      };
      dlg.showModal();
      const first = $("input,textarea", dlg) || $("#dlgOk", dlg); setTimeout(() => first.focus(), 30);
    });
  }

  // ---------------------------------------------------------------- CSV
  function csvCell(v) {
    if (v == null) return "";
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;      // keep spreadsheet programs from running typed text as a formula
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadCsv(name, cols, rows) {
    const head = cols.map(c => csvCell(c.h)).join(",");
    const body = rows.map(r => cols.map(c => csvCell(c.csv(r))).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + head + "\r\n" + body + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `nivaz-${name}-${new Date().toLocaleDateString("en-CA", { timeZone: TZ })}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------------------------------------------------------------- tables
  // cols: [{ h, n (number column), cell(row) -> html, csv(row) -> value }]
  function table(cols, rows, caption) {
    if (!rows.length) return "";
    cols = cols.filter(c => !c.hide);                 // "hide" columns are for the CSV only
    return `<div class="tablewrap"><table class="t">${caption ? `<caption class="sr">${esc(caption)}</caption>` : ""}
      <thead><tr>${cols.map(c => `<th scope="col"${c.n ? ' class="n"' : ""}>${esc(c.h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r, i) => `<tr data-i="${i}">${cols.map(c => `<td${c.n ? ' class="n"' : c.wrap ? ' class="wrap"' : c.acts ? ' class="acts"' : ""}>${c.cell(r)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  }
  function segHtml(key, opts, cur) {
    return `<div class="seg" role="group" data-seg="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(v) === String(cur)}">${esc(l)}</button>`).join("")}</div>`;
  }

  // One list page: header, filters, a table, paging and "Download CSV". The filters live in the address (so Back and reload
  // keep them), but changing one only reloads the table.
  //   o: { name, title, lede, tabs, segs: [{ key, opts, def }], search: placeholder, sorts: [[v, l]], extra(st) -> html,
  //        fetch(st, limit, offset) -> rows (with .total), all: rows already complete (no paging), cols(st), csv, bind(root, rows, reload),
  //        empty(st) -> text, limit }
  function listPage(r, o) {
    const limit = o.limit || 50;
    const stt = { q: r.params.get("q") || "", page: Math.max(0, parseInt(r.params.get("page") || "0", 10) || 0), sort: r.params.get("sort") || (o.sorts ? o.sorts[0][0] : "") };
    (o.segs || []).forEach(s => stt[s.key] = r.params.get(s.key) || s.def);
    view.innerHTML = `${o.tabs || ""}<div class="ph"><div><h1>${esc(o.title)}</h1>${o.lede ? `<p class="lede">${o.lede}</p>` : ""}</div>
        <button type="button" class="btn" id="csvBtn">Download CSV</button></div>
      <div class="filters">
        ${(o.segs || []).map(s => segHtml(s.key, s.opts, stt[s.key])).join("")}
        ${o.extra ? o.extra(stt) : ""}
        ${o.search ? `<input type="search" id="lq" placeholder="${esc(o.search)}" value="${esc(stt.q)}" aria-label="${esc(o.search)}">` : ""}
        ${o.sorts ? `<label class="nowrap muted">Sort <select id="lsort">${o.sorts.map(([v, l]) => `<option value="${v}"${v === stt.sort ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>` : ""}
      </div>
      <div id="lt"><div class="empty">Loading…</div></div>`;
    let lastRows = [], seq = 0;
    const url = () => {
      const p = new URLSearchParams();
      (o.segs || []).forEach(s => { if (stt[s.key] !== s.def) p.set(s.key, stt[s.key]); });
      if (stt.q) p.set("q", stt.q); if (stt.page) p.set("page", stt.page); if (o.sorts && stt.sort !== o.sorts[0][0]) p.set("sort", stt.sort);
      (o.keep || []).forEach(k => { if (stt[k]) p.set(k, stt[k]); });
      const h = "#" + o.name + (p.toString() ? "?" + p : "");
      if (location.hash !== h) history.replaceState(null, "", h);
    };
    async function reload() {
      const my = ++seq, box = $("#lt"); url(); box.classList.add("loading");
      let rows;
      try { rows = await o.fetch(stt, limit, stt.page * limit); }
      catch (e) { if (my !== seq) return; box.classList.remove("loading"); return showErr(e, box); }
      if (my !== seq) return;
      box.classList.remove("loading");
      lastRows = rows;
      const total = o.all ? rows.length : rows.length ? Number(rows[0].total) : 0;
      if (!rows.length) { box.innerHTML = `<div class="panel empty">${esc(o.empty ? o.empty(stt) : "Nothing here.")}</div>`; return; }
      const from = o.all ? 1 : stt.page * limit + 1, to = o.all ? rows.length : stt.page * limit + rows.length;
      box.innerHTML = table(o.cols(stt), rows, o.title) + `<div class="pager"><span class="num">${o.all ? plural(total, "row", "rows") : `${num(from)}–${num(to)} of ${num(total)}`}</span>
        ${o.all ? "" : `<span class="btns"><button type="button" class="btn sm" data-pg="-1"${stt.page ? "" : " disabled"}>Previous</button>
        <button type="button" class="btn sm" data-pg="1"${to < total ? "" : " disabled"}>Next</button></span>`}</div>`;
      $$("[data-pg]", box).forEach(b => b.onclick = () => { stt.page = Math.max(0, stt.page + Number(b.dataset.pg)); reload(); view.scrollIntoView({ block: "start" }); });
      if (o.bind) o.bind(box, rows, reload);
    }
    $$("[data-seg]", view).forEach(g => g.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      stt[g.dataset.seg] = b.dataset.v; stt.page = 0;
      $$("button", g).forEach(x => x.setAttribute("aria-pressed", x === b)); reload();
    }));
    const lq = $("#lq"); let qt;
    if (lq) lq.addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(() => { stt.q = lq.value.trim(); stt.page = 0; reload(); }, 350); });
    const ls = $("#lsort"); if (ls) ls.onchange = () => { stt.sort = ls.value; stt.page = 0; reload(); };
    if (o.wire) o.wire(stt, reload);
    $("#csvBtn").onclick = async () => {
      const btn = $("#csvBtn"); btn.disabled = true; btn.textContent = "Preparing…";
      try {
        let all = [];
        if (o.all) all = lastRows;
        else for (let off = 0; off < 20000; off += 500) { const part = await o.fetch(stt, 500, off); all = all.concat(part); if (part.length < 500) break; }
        downloadCsv(o.csv || o.name, o.cols(stt).filter(c => c.csv), all);
        toast(`Downloaded ${plural(all.length, "row", "rows")}.`);
      } catch (e) { toast(friendly(e)); }
      btn.disabled = false; btn.textContent = "Download CSV";
    };
    reload();
    return { reload, stt };
  }

  function showErr(e, box) {
    if (e && e.missing && String(e.fn || "").startsWith("dash_")) return showNotInstalled();
    if (e && e.mfa) return startSecondStep();
    if (e && e.login) return showLogin();
    (box || view).innerHTML = `<div class="err-box" role="alert"><b>That didn't load.</b> ${esc(friendly(e))}</div>`;
  }

  // ---------------------------------------------------------------- login
  function brand() { return `<div class="brand"><i aria-hidden="true">N</i><span>Nivaz<small>Team console</small></span></div>`; }
  function showGate(html, wide) {
    app.hidden = true; gate.hidden = false;
    gate.innerHTML = `<div class="gate-card${wide ? " wide" : ""}">${brand()}${html}</div>`;
    const f = $("input", gate); if (f) setTimeout(() => f.focus(), 30);
  }
  function authMsg(error) {
    const m = (error && (error.message || "")) + " " + (error && (error.code || "")) + " " + (error && error.status ? error.status : "");
    if (/sms_send_failed|Error sending|provider|twilio/i.test(m)) return "We couldn't send a text to this number right now. Try again in a few minutes. (If you're still testing, use a test number saved in Supabase.)";
    if (/otp_disabled|Signups not allowed|not found|user_not_found/i.test(m)) return "This number isn't on Nivaz yet. Log in once in the Nivaz app with it, then ask the Super admin to give it a role.";
    if (/rate limit|too many|over_sms_send_rate_limit|429/i.test(m)) return "Too many tries. Wait a minute, then try again.";
    if (/otp_expired|expired|invalid/i.test(m)) return "That code is wrong or has expired. Check the SMS, or ask for a new code.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "No connection. Check your internet and try again.";
    return (error && error.message) || "Something went wrong. Try again.";
  }
  function showLogin(errText) {
    S.me = null; S.role = null;
    showGate(`<h1>Log in</h1><p>For the Nivaz Super admin and Nivaz Support. We'll text you a 6-digit code.</p>
      <form id="lgF" novalidate>
        <label class="fld" for="lgPhone">Mobile number</label>
        <div class="phonefield"><span class="cc">+91</span><input id="lgPhone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="10-digit number" aria-label="Mobile number"></div>
        <div class="err" id="lgErr" role="alert">${esc(errText || "")}</div>
        <button class="btn primary" type="submit">Send code</button>
      </form>`);
    $("#lgF").onsubmit = async e => {
      e.preventDefault();
      const d = digits($("#lgPhone").value).replace(/^(91|0)(?=\d{10}$)/, "");
      if (!/^[6-9]\d{9}$/.test(d)) return $("#lgErr").textContent = "Enter a 10-digit Indian mobile number.";
      const btn = $("button[type=submit]", gate); btn.disabled = true; btn.textContent = "Sending…";
      const { error } = await sb.auth.signInWithOtp({ phone: "+91" + d, options: { shouldCreateUser: false } });
      if (error) { btn.disabled = false; btn.textContent = "Send code"; return $("#lgErr").textContent = authMsg(error); }
      showCode("+91" + d);
    };
  }
  function showCode(ph) {
    showGate(`<h1>Enter the SMS code</h1><p>Sent to <b>${phone(ph)}</b>.</p>
      <form id="lcF" novalidate>
        <input id="lgCode" class="codefield" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="SMS code" placeholder="••••••">
        <div class="err" id="lgErr" role="alert"></div>
        <button class="btn primary" type="submit">Continue</button>
        <div class="row"><button class="btn link" type="button" id="lgBack">Use another number</button><button class="btn link" type="button" id="lgAgain" disabled>Send again</button></div>
      </form>`);
    let left = 30; const again = $("#lgAgain");
    const tick = setInterval(() => { left--; if (left <= 0) { clearInterval(tick); again.disabled = false; again.textContent = "Send again"; } else again.textContent = `Send again in ${left}s`; }, 1000);
    again.textContent = "Send again in 30s";
    again.onclick = async () => { again.disabled = true; const { error } = await sb.auth.signInWithOtp({ phone: ph, options: { shouldCreateUser: false } }); $("#lgErr").textContent = error ? authMsg(error) : ""; if (!error) toast("New code sent."); };
    $("#lgBack").onclick = () => { clearInterval(tick); showLogin(); };
    $("#lcF").onsubmit = async e => {
      e.preventDefault();
      const c = digits($("#lgCode").value); if (c.length < 6) return $("#lgErr").textContent = "Enter the 6-digit code from the SMS.";
      const btn = $("button[type=submit]", gate); btn.disabled = true; btn.textContent = "Checking…";
      const { error } = await sb.auth.verifyOtp({ phone: ph, token: c, type: "sms" });
      if (error) { btn.disabled = false; btn.textContent = "Continue"; return $("#lgErr").textContent = authMsg(error); }
      clearInterval(tick); afterLogin();
    };
  }
  function showNotTeam(me) {
    showGate(`<h1>This dashboard is for the Nivaz team.</h1>
      <p>${me && me.phone ? `You're logged in as <b>${phone(me.phone)}</b>, which isn't a Super admin or Nivaz Support number.` : "This number isn't on the Nivaz team."}
      If you should have access, ask the Super admin to give your number a role.</p>
      <button class="btn" type="button" id="lgOut">Log out</button>`);
    $("#lgOut").onclick = logout;
  }
  function showNotInstalled() {
    showGate(`<h1>Part 19 isn't run yet</h1>
      <p>The dashboard needs one more database step before it can show anything.</p>
      <ol class="howto"><li>Open Supabase and go to <b>SQL Editor</b>, then <b>New query</b>.</li>
        <li>Paste the whole of <b>19_admin_dashboard.sql</b> (run part 18 first if you haven't).</li>
        <li>Press <b>Run</b>, then come back here and press <b>Check again</b>.</li></ol>
      <div class="row"><button class="btn primary" type="button" id="lgAgain">Check again</button><button class="btn" type="button" id="lgOut">Log out</button></div>`, true);
    $("#lgAgain").onclick = () => afterLogin();
    $("#lgOut").onclick = logout;
  }
  async function afterLogin() {
    let me;
    try { me = await rpc("dash_whoami"); }
    catch (e) {
      if (e.missing) return showNotInstalled();
      if (e.login) return showLogin();
      return showGate(`<h1>Can't reach Nivaz</h1><p>${esc(friendly(e))}</p><button class="btn primary" type="button" id="lgAgain">Try again</button>`), ($("#lgAgain").onclick = afterLogin);
    }
    if (!me || !me.role) return showNotTeam(me);
    S.me = me; S.role = me.role;
    const { data: lvl } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (lvl && lvl.currentLevel === "aal2") return enterApp();
    startSecondStep();
  }
  // The second login step: a 6-digit code from Google Authenticator (or any authenticator app)
  async function startSecondStep() {
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error) return showLogin(authMsg(error));
    const ready = (data.totp || [])[0];
    if (ready) return showTotp(ready.id, false);
    // First time: clear any half-finished set-ups, then show a new QR code
    for (const f of data.all || []) if (f.factor_type === "totp" && f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data: en, error: e2 } = await sb.auth.mfa.enroll({ factorType: "totp", issuer: "Nivaz", friendlyName: "Nivaz dashboard " + new Date().toISOString().slice(0, 16) });
    if (e2) {
      const off = /enroll_not_enabled|disabled|not enabled/i.test(e2.message + " " + (e2.code || ""));
      return showGate(off ? `<h1>Turn on authenticator apps first</h1><p>The second login step uses an authenticator app, and it's switched off for this Supabase project.</p>
        <ol class="howto"><li>Open Supabase, then <b>Authentication</b>.</li><li>Under <b>Configuration</b>, open <b>Multi-Factor</b>.</li>
        <li>Set <b>TOTP (App Authenticator)</b> to <b>Enabled</b> and press <b>Save</b>.</li></ol>
        <div class="row"><button class="btn primary" type="button" id="lgAgain">Try again</button><button class="btn" type="button" id="lgOut">Log out</button></div>`
        : `<h1>Couldn't start the second step</h1><p>${esc(authMsg(e2))}</p><div class="row"><button class="btn primary" type="button" id="lgAgain">Try again</button><button class="btn" type="button" id="lgOut">Log out</button></div>`, true),
        ($("#lgAgain").onclick = startSecondStep), ($("#lgOut").onclick = logout);
    }
    showTotp(en.id, true, en.totp);
  }
  function showTotp(factorId, first, totp) {
    showGate(first ? `<h1>Set up your second step</h1>
      <p>Each time you log in on a new computer, you'll type a 6-digit code from an authenticator app as well as the SMS code. It keeps Nivaz safe if someone gets hold of your SIM.</p>
      <ol class="steps"><li>On your phone, install <b>Google Authenticator</b> from the Play Store (any authenticator app works).</li>
        <li>Open it, tap <b>+</b>, then <b>Scan a QR code</b>, and scan this:</li></ol>
      <div class="qr"><img alt="QR code to scan with your authenticator app" src="${esc(totp.qr_code)}">
        <div class="muted">Can't scan? Choose <b>Enter a setup key</b> and type:<br><span class="secret">${esc(totp.secret)}</span></div></div>
      <form id="ltF" novalidate>
        <label class="fld" for="lgTotp">3. Type the 6-digit code the app shows for Nivaz</label>
        <input id="lgTotp" class="codefield" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">
        <div class="err" id="lgErr" role="alert"></div>
        <button class="btn primary" type="submit">Finish set-up</button>
        <div class="row"><button class="btn link" type="button" id="lgOut">Log out</button></div>
      </form>` : `<h1>Enter your authenticator code</h1>
      <p>Open <b>Google Authenticator</b> on your phone and type the 6-digit code shown for <b>Nivaz</b>.</p>
      <form id="ltF" novalidate>
        <input id="lgTotp" class="codefield" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="Authenticator code" placeholder="••••••">
        <div class="err" id="lgErr" role="alert"></div>
        <button class="btn primary" type="submit">Continue</button>
        <div class="row"><button class="btn link" type="button" id="lgOut">Log out</button><span class="faint">Lost your phone? See the note below.</span></div>
      </form>
      <p class="note" style="margin-top:14px">The code changes every 30 seconds. If you lost the phone with the app, the Super admin can reset it in Supabase:
        <b>Authentication</b>, <b>Users</b>, your number, then remove the authenticator factor. Then log in again here to set up a new one.</p>`, first);
    $("#lgOut").onclick = logout;
    $("#ltF").onsubmit = async e => {
      e.preventDefault();
      const code = digits($("#lgTotp").value); if (code.length !== 6) return $("#lgErr").textContent = "Type the 6 digits from the app.";
      const btn = $("button[type=submit]", gate); btn.disabled = true;
      const { data: ch, error: ce } = await sb.auth.mfa.challenge({ factorId });
      if (ce) { btn.disabled = false; return $("#lgErr").textContent = authMsg(ce); }
      const { error: ve } = await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code });
      if (ve) { btn.disabled = false; return $("#lgErr").textContent = /mfa_verification_failed|Invalid TOTP|invalid/i.test(ve.message + (ve.code || "")) ? "That code didn't work. Type the 6 digits the app shows right now (they change every 30 seconds), and check that your phone's time is set automatically." : authMsg(ve); }
      if (first) toast("Second step set up. You'll be asked for an app code when you log in on a new computer.");
      enterApp();
    };
  }
  async function logout() { try { await sb.auth.signOut(); } catch (_) {} location.hash = ""; showLogin(); }

  // ---------------------------------------------------------------- the frame
  const NAV = [
    [null, [["overview", "Overview"]]],
    ["Places", [["properties", "Properties", a => a.waiting_listings], ["partners", "Partners"]]],
    ["People", [["bookings", "Bookings and visits", a => a.bookings_waiting + a.visits_waiting_long],
                ["complaints", "Complaints and disputes", a => a.complaints_overdue ? -a.complaints_overdue : a.complaints_open + a.disputes_open],
                ["reviews", "Reviews"]]],
    ["Money", [["payments", "Payments", a => a.upi_to_check + a.refunds_owed], ["fees", "Owner fees", a => a.fees_reported], ["cashback", "Cashback", a => a.cashback_pending]]],
    ["Nivaz", [["analytics", "Analytics"], ["activity", "Activity log"], ["team", "Team and roles"], ["settings", "Settings", null, true]]]
  ];
  const SECTION = { property: "properties", person: null, visits: "bookings", disputes: "complaints", dispute: "complaints" };
  function drawNav() {
    const a = (S.ov && S.ov.attention) || null, cur = route().name, sec = SECTION[cur] !== undefined ? SECTION[cur] : cur;
    $("#nav").innerHTML = NAV.map(([g, items]) => `<div class="navgrp">${g ? `<h2>${g}</h2>` : ""}${items.filter(([, , , adminOnly]) => !adminOnly || isAdmin()).map(([k, l, f]) => {
      const n = a && f ? f(a) : 0;
      return `<a href="#${k}"${k === sec ? ' aria-current="page"' : ""}><span>${esc(l)}</span>${n ? `<span class="cnt${n < 0 ? " bad" : ""}" title="${n < 0 ? "Past their fix time" : "Waiting"}">${Math.abs(n)}</span>` : ""}</a>`;
    }).join("")}</div>`).join("");
  }
  async function loadOverview(force) {
    if (!force && S.ov && Date.now() - S.ovAt < 60000) return S.ov;
    S.ov = await rpc("dash_overview"); S.ovAt = Date.now(); drawNav(); return S.ov;
  }
  function enterApp() {
    gate.hidden = true; app.hidden = false;
    $("#who").innerHTML = `<span><b>${esc(S.me.name || "Nivaz team")}</b> <span class="role">${esc(ROLE[S.role])}</span></span><button class="btn sm" type="button" id="outBtn">Log out</button>`;
    $("#outBtn").onclick = logout;
    $("#sideFoot").textContent = "Times are India time (IST).";
    drawNav(); render();
    loadOverview().catch(() => {});
  }

  // ---------------------------------------------------------------- routing
  function route() {
    const h = location.hash.replace(/^#\/?/, "") || "overview", [path, qs] = h.split("?"), [name, id] = path.split("/");
    return { name: name || "overview", id, params: new URLSearchParams(qs || "") };
  }
  const PAGES = {};
  let renderSeq = 0;
  async function render() {
    if (app.hidden) return;
    const r = route(), my = ++renderSeq;
    drawNav(); closeSearch();
    view.innerHTML = `<div class="empty">Loading…</div>`;
    const page = PAGES[r.name] || PAGES.overview;
    try { await page(r, () => my === renderSeq); } catch (e) { if (my === renderSeq) showErr(e); }
    if (my === renderSeq && !r.params.has("keepfocus")) view.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", render);

  // ---------------------------------------------------------------- charts (SVG, drawn to the container's width)
  function niceMax(v) { if (v <= 0) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  // Columns over time. series: [{ name, color (css var), values: [] }]; stacked when more than one.
  function columns(box, cats, series, { fmt = num, tipHead = c => c, label, whole = false } = {}) {
    const W = Math.max(320, box.clientWidth || 600), H = 230, L = 46, R = 10, T = 16, B = 26, pw = W - L - R, ph = H - T - B;
    const totals = cats.map((_, i) => series.reduce((s, x) => s + (Number(x.values[i]) || 0), 0));
    const top = Math.max(...totals, 0), ticks = 4, band = pw / cats.length, bw = Math.min(24, band * .62);
    const max = whole ? Math.max(ticks, Math.ceil(top * 1.08 / ticks) * ticks) : niceMax(top * 1.08);   // counts: whole-number steps
    const y = v => T + ph - (v / max) * ph, every = Math.max(1, Math.ceil(cats.length * 46 / pw));
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label || "")}">`;
    for (let k = 0; k <= ticks; k++) { const v = max * k / ticks, yy = Math.round(y(v)) + .5;
      s += `<line class="${k ? "gl" : "ax"}" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end">${esc(fmt(v))}</text>`; }
    cats.forEach((c, i) => {
      const x = L + i * band + (band - bw) / 2; let base = y(0), parts = "";
      const nz = series.map((se, j) => [j, Number(se.values[i]) || 0]).filter(([, v]) => v > 0), topJ = nz.length ? nz[nz.length - 1][0] : -1;
      nz.forEach(([j, v], n) => {
        const gap = n > 0 ? 2 : 0, segTop = base - (v / max) * ph, yb = base - gap, hh = Math.max(1, yb - segTop);
        const r = j === topJ ? Math.min(4, hh / 2, bw / 2) : 0;
        parts += r ? `<path class="mk" fill="var(${series[j].color})" d="M${x},${yb}V${segTop + r}Q${x},${segTop} ${x + r},${segTop}H${x + bw - r}Q${x + bw},${segTop} ${x + bw},${segTop + r}V${yb}Z"/>`
                   : `<rect class="mk" fill="var(${series[j].color})" x="${x}" y="${segTop}" width="${bw}" height="${hh}"/>`;
        base = segTop;
      });
      s += `<g data-i="${i}">${parts}<rect class="hit" x="${L + i * band}" y="${T}" width="${band}" height="${ph}" tabindex="0" aria-label="${esc(tipHead(c))}: ${esc(series.map(se => (series.length > 1 ? se.name + " " : "") + fmt(se.values[i] || 0)).join(", "))}"/></g>`;
      if (i % every === (cats.length - 1) % every) s += `<text x="${L + i * band + band / 2}" y="${H - 8}" text-anchor="middle">${esc(c)}</text>`;
    });
    const li = cats.length - 1; if (totals[li] > 0) s += `<text class="val" x="${L + li * band + band / 2}" y="${y(totals[li]) - 6}" text-anchor="middle">${esc(fmt(totals[li]))}</text>`;
    s += `</svg><div class="tip" hidden></div>`;
    box.classList.add("chart"); box.innerHTML = s;
    const tip = $(".tip", box), svg = $("svg", box);
    const show = g => {
      const i = +g.dataset.i; svg.classList.add("dim"); $$("g", svg).forEach(x => x.classList.toggle("on", x === g));
      tip.innerHTML = `<div class="h">${esc(tipHead(cats[i]))}</div>` + (series.length > 1
        ? series.map(se => `<div class="k"><span><i class="ln" style="background:var(${se.color})"></i>${esc(se.name)}</span><b>${esc(fmt(se.values[i] || 0))}</b></div>`).join("") + `<div class="k"><span>Total</span><b>${esc(fmt(totals[i]))}</b></div>`
        : `<b>${esc(fmt(series[0].values[i] || 0))}</b> <span class="muted">${esc(series[0].name)}</span>`);
      tip.hidden = false; const bx = box.getBoundingClientRect(), sx = bx.width / W;
      tip.style.left = Math.min(Math.max(80, (L + i * band + band / 2) * sx), bx.width - 80) + "px"; tip.style.top = (y(totals[i]) * sx) + "px";
    };
    const hide = () => { tip.hidden = true; svg.classList.remove("dim"); };
    $$("g[data-i]", svg).forEach(g => { g.addEventListener("pointerenter", () => show(g)); g.addEventListener("pointerleave", hide);
      const h = $(".hit", g); h.addEventListener("focus", () => show(g)); h.addEventListener("blur", hide); });
  }
  function numsTable(head, rows) {
    return `<details class="nums"><summary>See the numbers</summary><div class="tablewrap"><table class="t"><thead><tr>${head.map((h, i) => `<th${i ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td${i ? ' class="n"' : ""}>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
  }
  // Horizontal bars (HTML): items [{ label, value, text, href }]
  function hbars(items, { color = "s1", max } = {}) {
    const m = max || Math.max(1, ...items.map(i => Number(i.value) || 0));
    return `<div class="hbars">${items.map(i => `<div class="hbar"><span class="lab">${i.href ? `<a class="go" href="#${i.href}">${esc(i.label)}</a>` : esc(i.label)}</span>
      <span class="track"><b class="${color}" style="width:${Math.max(0.5, (Number(i.value) || 0) / m * 100)}%"></b></span><span class="v">${esc(i.text != null ? i.text : num(i.value))}</span></div>`).join("")}</div>`;
  }
  const boardLegend = `<div class="legend"><span><i class="sw bed"></i>Filled</span><span><i class="sw bed a"></i>Free</span><span><i class="sw bed h"></i>On hold (someone is booking)</span><span><i class="sw bed x"></i>Blocked by the owner</span></div>`;
  const BEDWORD = { b: "Filled", a: "Free", h: "On hold", x: "Blocked" };
  function bedSquares(code) { return `<span class="beds" aria-hidden="true">${[...code].map(c => `<i class="bed ${c === "b" ? "" : c}" title="${BEDWORD[c]}"></i>`).join("")}</span>`; }

  // ---------------------------------------------------------------- Overview
  PAGES.overview = async (r, alive) => {
    const ov = await loadOverview(true); if (!alive()) return;
    const a = ov.attention, beds = ov.beds, m = ov.money;
    const needs = [
      [a.complaints_overdue, "bad", "Complaints past their fix time", "Residents are waiting. Call the owners to chase them.", "complaints?status=overdue"],
      [a.upi_to_check, a.upi_oldest && Date.now() - new Date(a.upi_oldest) > 6 * 3600e3 ? "bad" : "warn",
        "UPI payments owners haven't checked", a.upi_oldest ? `The oldest was paid ${ago(a.upi_oldest)}.` : "", "payments"],
      [a.disputes_open, "warn", "Deposit disputes to decide", "Look at both sides, then decide.", "disputes"],
      [a.waiting_listings, "warn", "Hostels waiting for your approval", "Owners listed them. Check the rooms and photos, then put them live.", "properties?status=waiting"],
      [a.refunds_owed, "bad", "Refunds owners still owe residents", inr(a.refunds_owed_amount) + " in all.", "payments?status=owed"],
      [a.visits_waiting_long, "warn", "Visit requests waiting over 12 hours", "The owner hasn't answered yet.", "visits?status=waiting"],
      [a.bookings_waiting, "warn", "Paid bookings waiting for the owner", "Owners have 12 hours to accept, then it's declined with a full refund.", "bookings?status=pending"],
      [a.fees_reported, "warn", "Owner fees to confirm", "Owners say they paid. Check your UPI app, then mark them received.", "fees"],
      [a.cashback_pending, "warn", "Cashback payments to send", inr(a.cashback_pending_amount) + " in all.", "cashback"],
      [a.live_without_upi, "warn", "Live hostels with no UPI ID", "Residents can't pay the token until the owner adds one.", "properties?status=no_upi"]
    ].filter(x => x[0] > 0);
    const filled = beds.total ? Math.round(100 * beds.booked / beds.total) : 0;
    const wkDiff = ov.bookings_week - ov.bookings_last_week;
    view.innerHTML = `<div class="ph"><div><h1>Overview</h1><p class="lede">${esc(today())}</p></div>
        <span class="muted">Updated ${clock(new Date())} <button class="btn sm" type="button" id="ovRe">Refresh</button></span></div>
      <section class="panel" aria-labelledby="needsH"><h2 id="needsH" class="pad" style="padding-bottom:0">Needs you now</h2>
        ${needs.length ? `<ul class="needs">${needs.map(([n, cls, t, s, href]) => `<li class="${cls}"><span class="n num">${num(n)}</span><p>${esc(t)}${s ? `<small>${esc(s)}</small>` : ""}</p><a class="btn sm" href="#${href}">Open</a></li>`).join("")}</ul>`
          : `<p class="allclear">Nothing needs you right now.</p>`}
      </section>
      <section class="panel sec" aria-label="Key numbers"><div class="figs">
        <div class="fig"><div class="l">Live hostels</div><div class="v">${num(ov.properties.live)}</div><div class="s">${plural(ov.properties.draft, "draft", "drafts")}, ${num(ov.properties.paused)} paused</div></div>
        <div class="fig"><div class="l">Beds filled</div><div class="v">${num(beds.booked)} <small>of ${num(beds.total)}</small></div><div class="s">${filled}% full, ${num(beds.free)} free</div></div>
        <div class="fig"><div class="l">Residents</div><div class="v">${num(ov.residents)}</div><div class="s">${num(ov.on_notice)} on notice</div></div>
        <div class="fig"><div class="l">Bookings this week</div><div class="v">${num(ov.bookings_week)}</div><div class="s">${num(ov.bookings_last_week)} last week${wkDiff ? ` (${wkDiff > 0 ? "+" : "−"}${Math.abs(wkDiff)})` : ""}</div></div>
        ${m ? `<div class="fig"><div class="l">Paid through Nivaz</div><div class="v">${inr(m.rent_month + m.tokens_month)}</div><div class="s">This month: rent ${inr(m.rent_month)}, tokens ${inr(m.tokens_month)}</div></div>
        <div class="fig"><div class="l">Nivaz fees</div><div class="v">${inr(m.fees_month)}</div><div class="s">This month, from owners</div></div>` : ""}
      </div></section>
      <div class="${m ? "grid2" : ""} sec">
        <section class="panel pad"><h2>Paid bookings per week</h2><p class="muted" style="margin:2px 0 8px">Bookings where the token was paid, by the week they were made (last 12 weeks).</p><div id="chWeeks"></div><div id="chWeeksNums"></div></section>
        ${m ? `<section class="panel pad"><h2>Paid through Nivaz per month</h2><p class="muted" style="margin:2px 0 6px">Rent and tokens residents paid owners (Nivaz never holds this money).</p>
          <div class="legend" style="margin-bottom:4px"><span><i class="sw" style="background:var(--s1)"></i>Rent</span><span><i class="sw" style="background:var(--s2)"></i>Tokens</span></div>
          <div id="chMonths"></div><div id="chMonthsNums"></div></section>` : ""}
      </div>
      <section class="panel sec"><div class="pad" style="padding-bottom:6px"><h2>Every bed on Nivaz</h2><p class="muted" style="margin:2px 0 10px">One square for each bed in the live hostels, floor by floor.</p>${boardLegend}</div>
        <div class="board">${ov.beds_by_property.length ? ov.beds_by_property.map(p => {
          const c = { b: 0, a: 0, h: 0, x: 0 }; [...p.beds].forEach(ch => c[ch]++);
          return `<div class="prow" aria-label="${esc(p.name)}: ${c.b} filled, ${c.a} free, ${c.h} on hold, ${c.x} blocked">
            <span>${propLink(p.id, p.name)}<span class="sub">${esc(p.area)}</span></span><span class="num muted">${c.b} of ${p.beds.length}</span>${bedSquares(p.beds)}</div>`;
        }).join("") : `<div class="empty">No live hostels yet.</div>`}</div></section>`;
    $("#ovRe").onclick = () => render();
    const weeks = ov.bookings_weekly;
    const drawCharts = () => {
      const wb = $("#chWeeks"); if (!wb) return;
      columns(wb, weeks.map(w => fmtDay(w.week)), [{ name: "paid bookings", color: "--s1", values: weeks.map(w => w.n) }],
        { tipHead: c => "Week of " + c, label: "Paid bookings per week for the last 12 weeks", whole: true });
      if (m) columns($("#chMonths"), m.monthly.map(x => fmtMonth(x.month).replace(/ \d{4}$/, "")), [{ name: "Rent", color: "--s1", values: m.monthly.map(x => x.rent) }, { name: "Tokens", color: "--s2", values: m.monthly.map(x => x.tokens) }],
        { fmt: inrShort, tipHead: c => c, label: "Rent and tokens paid through Nivaz per month for the last 12 months" });
    };
    drawCharts();
    $("#chWeeksNums").innerHTML = numsTable(["Week of", "Paid bookings"], weeks.map(w => [fmtDate(w.week), w.n]));
    if (m) $("#chMonthsNums").innerHTML = numsTable(["Month", "Rent", "Tokens", "Nivaz fees"], m.monthly.map(x => [fmtMonth(x.month), inr(x.rent), inr(x.tokens), inr(x.fees)]));
    onResize(drawCharts);
  };
  let resizeFn = null, resizeT;
  function onResize(fn) { resizeFn = fn; }
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (resizeFn && document.body.contains($(".chart"))) resizeFn(); }, 150); });

  // ---------------------------------------------------------------- Properties
  PAGES.properties = r => listPage(r, {
    name: "properties", title: "Properties", csv: "properties",
    lede: "Every hostel on Nivaz. Open one to see its rooms, team and history, or to approve, verify or pause it.",
    segs: [{ key: "status", def: "all", opts: [["all", "All"], ["live", "Live"], ["waiting", "Waiting for approval"], ["paused", "Paused"], ["draft", "Drafts"], ["no_upi", "Live, no UPI ID"], ["unverified", "Live, not verified"]] }],
    search: "Name, area, owner or phone", sorts: [["recent", "Newest first"], ["name", "Name"], ["free", "Most free beds"], ["fill", "Emptiest first"]],
    fetch: (s, limit, offset) => rpc("dash_properties", { p_search: s.q || null, p_status: s.status, p_area: null, p_sort: s.sort, p_limit: limit, p_offset: offset }),
    empty: () => "No properties match.",
    cols: () => [
      { h: "Property", wrap: true, cell: p => `${propLink(p.id, p.name)}<span class="sub">${esc(p.area)}, ${esc(TYPE[p.type] || p.type)}, ${esc(GENDER[p.gender] || p.gender)}</span>`, csv: p => p.name },
      { h: "Area", cell: () => "", csv: p => p.area, hide: true },
      { h: "Owner", cell: p => `${personLink(p.owner_id, p.owner_name)}<span class="sub">${phone(p.owner_phone)}</span>`, csv: p => p.owner_name },
      { h: "Owner phone", cell: () => "", csv: p => p.owner_phone, hide: true },
      { h: "Status", cell: p => propStatus(p.status, p.waiting) + (p.is_verified ? ` <span class="tag ok">Verified</span>` : ""), csv: p => p.waiting ? "waiting for approval" : p.status },
      { h: "Beds filled", cell: p => `<span class="fill"><span class="num">${p.booked} of ${p.beds}</span><span class="bar">${p.beds ? `<b style="width:${100 * p.booked / p.beds}%"></b>` : ""}</span></span>`, csv: p => p.booked },
      { h: "Beds", cell: () => "", csv: p => p.beds, hide: true },
      { h: "Free", n: true, cell: p => num(p.free), csv: p => p.free },
      { h: "Photos", n: true, cell: p => num(p.photos) + (p.panos ? `<span class="sub">${p.panos} in 360°</span>` : ""), csv: p => p.photos },
      { h: "UPI", cell: p => p.has_upi ? "Yes" : (p.status === "live" ? st("bad", "Missing") : `<span class="muted">No</span>`), csv: p => p.has_upi ? "yes" : "no" },
      { h: "Rating", n: true, cell: p => p.reviews ? `${p.rating}<span class="sub">${plural(p.reviews, "review", "reviews")}</span>` : `<span class="muted">—</span>`, csv: p => p.rating },
      { h: "Open complaints", n: true, cell: p => p.open_complaints ? `<a class="go" href="#complaints?q=${encodeURIComponent(p.name)}">${p.open_complaints}</a>` : "0", csv: p => p.open_complaints },
      { h: "Listed", cell: p => fmtDate(p.created_at), csv: p => p.created_at }
    ]
  });

  async function propertyAction(p, what) {
    const id = p.id;
    if (what === "live") {
      if (!p.floors.length) return toast("Add the rooms first (the owner does this in Nivaz Partner, or use the phone app's Admin).");
      if (!p.has_upi && !await ask({ title: "Put it live without a UPI ID?", text: "Residents won't be able to pay the token until the owner adds a UPI ID. Better: ask the owner to add it first.", ok: "Put live anyway", danger: true })) return;
      await ask({ title: `Put ${esc(p.name)} live?`, text: "Customers can find it and book beds straight away.", ok: "Put live", run: () => patch("properties", id, { status: "live" }) }) && toast(`${p.name} is live.`);
    } else if (what === "paused") {
      await ask({ title: `Pause ${esc(p.name)}?`, text: "Customers won't see it until it's put live again. Current residents and bookings aren't affected.", ok: "Pause listing", danger: true, run: () => patch("properties", id, { status: "paused" }) }) && toast("Listing paused.");
    } else if (what === "draft") {
      await ask({ title: "Move it back to draft?", text: "Only Nivaz and the owner will see it.", ok: "Back to draft", run: () => patch("properties", id, { status: "draft" }) }) && toast("Moved back to draft.");
    } else if (what === "verify" || what === "unverify") {
      const on = what === "verify";
      await ask({ title: on ? "Give the Verified badge?" : "Remove the Verified badge?", text: on ? "Only after someone from Nivaz has visited and checked the hostel." : "Customers will no longer see Verified by Nivaz.", ok: on ? "Give badge" : "Remove badge", danger: !on, run: () => patch("properties", id, { is_verified: on }) }) && toast(on ? "Verified badge added." : "Verified badge removed.");
    } else if (what === "plan") {
      await ask({ title: "Mark the room plan as checked?", text: "Do this after checking that the rooms and beds match the real building.", ok: "Mark checked", run: async () => patch("properties", id, { plan_verified_at: new Date().toISOString(), plan_verified_by: (await sb.auth.getUser()).data.user.id }) }) && toast("Room plan marked as checked.");
    }
    S.ovAt = 0; render();
  }
  PAGES.property = async (r, alive) => {
    const p = await rpc("dash_property", { p_id: r.id }); if (!alive()) return;
    const bedsAll = p.floors.flatMap(f => f.rooms.flatMap(rm => rm.beds)), filled = bedsAll.filter(b => b.status === "booked").length;
    const BEDST = { booked: ["", "Filled"], available: ["a", "Free"], held: ["h", "On hold"], blocked: ["x", "Blocked"] };
    view.innerHTML = `<div class="crumb"><a href="#properties">Properties</a></div>
      <div class="ph"><div><h1>${esc(p.name)}</h1><p class="lede">${esc(p.area)}, ${esc(TYPE[p.type] || p.type)}, ${esc(GENDER[p.gender] || p.gender)}. Listed ${fmtDate(p.created_at)}.</p>
        <div class="rowline" style="margin-top:8px">${propStatus(p.status, p.waiting)}${p.is_verified ? `<span class="tag ok">Verified by Nivaz</span>` : ""}${p.plan_verified_at ? `<span class="tag ok">Room plan checked ${fmtDate(p.plan_verified_at)}</span>` : `<span class="tag">Room plan not checked</span>`}${p.has_upi ? "" : `<span class="tag bad">No UPI ID</span>`}</div></div>
        ${isAdmin() ? `<div class="actions">
          ${p.status !== "live" ? `<button class="btn primary" data-pa="live">${p.waiting ? "Approve and put live" : "Put live"}</button>` : `<button class="btn danger" data-pa="paused">Pause listing</button>`}
          ${p.status === "paused" ? `<button class="btn" data-pa="draft">Back to draft</button>` : ""}
          <button class="btn" data-pa="${p.is_verified ? "unverify" : "verify"}">${p.is_verified ? "Remove Verified badge" : "Give Verified badge"}</button>
          ${!p.plan_verified_at && p.floors.length ? `<button class="btn" data-pa="plan">Mark room plan checked</button>` : ""}</div>` : ""}
      </div>
      <div class="grid2">
        <section class="panel pad"><h2 style="margin-bottom:12px">Details</h2><dl class="facts">
          <div><dt>Beds</dt><dd class="num">${filled} of ${bedsAll.length} filled</dd></div>
          <div><dt>Residents</dt><dd class="num">${num(p.residents)}</dd></div>
          <div><dt>Deposit</dt><dd>${inr(p.deposit)}</dd></div>
          <div><dt>Maintenance</dt><dd>${p.maintenance ? inr(p.maintenance) + " a month" : "None"}</dd></div>
          <div><dt>Notice period</dt><dd>${plural(p.notice_days, "day", "days")}</dd></div>
          <div><dt>Food</dt><dd>${esc({ none: "No meals", included: "Meals included", addon: "Meals as an add-on" }[p.food_plan] || p.food_plan)}</dd></div>
          <div><dt>Electricity</dt><dd>${esc(p.electricity === "metered" ? "By meter reading" : "Included in rent")}</dd></div>
          <div><dt>Owner's UPI ID</dt><dd>${isAdmin() ? (p.upi_id ? esc(p.upi_id) + (p.upi_name ? `<span class="muted"> (${esc(p.upi_name)})</span>` : "") : st("bad", "Not added")) : (p.has_upi ? "Added" : st("bad", "Not added"))}</dd></div>
          ${isAdmin() ? `<div style="grid-column:1/-1"><dt>Address</dt><dd>${esc(p.address || "Not added")}</dd></div>` : ""}
          ${p.nearby ? `<div style="grid-column:1/-1"><dt>Nearby</dt><dd>${esc(p.nearby)}</dd></div>` : ""}
          <div><dt>Reviews</dt><dd>${p.reviews.count ? `${p.reviews.avg} stars from ${plural(p.reviews.count, "review", "reviews")}` : "None yet"}</dd></div>
          <div><dt>Complaints</dt><dd>${num(p.complaints.open)} open${p.complaints.overdue ? `, <span class="st bad"><i></i>${num(p.complaints.overdue)} past fix time</span>` : ""}</dd></div>
        </dl></section>
        <section class="panel"><h2 class="pad" style="padding-bottom:4px">Owner and team</h2><div class="people">
          ${p.owner ? `<div class="p"><span>${personLink(p.owner.id, p.owner.name || "Owner")}<span class="muted"> owner</span><br><span class="muted">${phone(p.owner.phone)}</span></span>${contact(p.owner.phone, `Hi ${String(p.owner.name || "").split(" ")[0]}, this is Nivaz about ${p.name}.`)}</div>` : ""}
          ${p.team.map(m => `<div class="p"><span>${m.user_id ? personLink(m.user_id, m.name) : esc(m.name)}<span class="muted"> ${esc(m.role === "manager" ? "manager" : (m.title || "staff"))}${m.on_app ? "" : ", not on the app yet"}</span><br><span class="muted">${phone(m.phone)}</span></span>${contact(m.phone)}</div>`).join("")}
          ${p.team.length ? "" : `<div class="p muted">No managers or staff added.</div>`}
        </div></section>
      </div>
      <section class="panel sec"><div class="pad" style="padding-bottom:4px"><h2>Rooms and beds</h2><p class="muted" style="margin:2px 0 10px">${p.room_types.map(t => `${esc(t.name)}: ${inr(t.rent)}${t.window_premium ? ` (+${inr(t.window_premium)} window)` : ""}`).join(", ") || "No room types yet."}</p>${boardLegend}</div>
        ${p.floors.length ? p.floors.map(f => `<div class="floor"><h3>${esc(f.name)}</h3><div class="rooms">${f.rooms.map(rm => `<div class="room"><b>Room ${esc(rm.room_no)}</b> <span class="rtype">${esc(rm.type)}${rm.bath ? ", attached bath" : ""}${rm.ac ? ", AC" : ""}</span>
          <ul>${rm.beds.map(b => `<li><i class="bed ${BEDST[b.status][0]}" aria-hidden="true"></i><span>${esc(b.label)}</span><span class="who">${b.occupant ? (b.occupant_id ? personLink(b.occupant_id, b.occupant) : esc(b.occupant)) : esc(BEDST[b.status][1])}${b.window ? ", window" : ""}</span></li>`).join("")}</ul></div>`).join("")}</div></div>`).join("")
          : `<div class="empty">No rooms added yet.</div>`}
      </section>
      ${p.photos.length ? `<section class="panel pad sec"><h2 style="margin-bottom:10px">Photos <small class="muted">${p.photos.length}${p.panos ? `, plus ${p.panos} in 360°` : ""}</small></h2><div class="photos">${p.photos.map(ph => `<img loading="lazy" alt="${esc(ph.caption || "Photo of " + p.name)}" src="${esc(cfg.supabaseUrl + "/storage/v1/object/public/property-photos/" + (ph.thumb || ph.path))}">`).join("")}</div></section>` : ""}
      <div class="grid2 sec">
        <section class="panel"><h2 class="pad" style="padding-bottom:4px">Nivaz fees</h2>${p.fees.length ? `<div class="people">${p.fees.map(f => `<div class="p"><span>${fmtMonth(f.month)}<br><span class="muted">${inr(f.amount)}${f.utr ? `, UPI ${esc(f.utr)}` : ""}</span></span>${st(...(FEE[f.status] || ["", f.status]))}</div>`).join("")}</div>` : `<div class="empty">No fees yet.</div>`}</section>
        <section class="panel"><h2 class="pad" style="padding-bottom:4px">Recent activity <a class="btn link" href="#activity?property=${p.id}" style="font-size:13px;margin-left:6px">See all</a></h2>${p.activity.length ? `<ul class="feed">${p.activity.map(x => `<li><time>${fmtTime(x.at)}</time><span>${said(x)}<span class="by"> by ${esc(x.who || "someone")}${x.role ? ", " + esc(ROLE[x.role] || x.role) : ""}</span></span></li>`).join("")}</ul>` : `<div class="empty">Nothing yet.</div>`}</section>
      </div>`;
    $$("[data-pa]").forEach(b => b.onclick = async () => { b.disabled = true; try { await propertyAction(p, b.dataset.pa); } catch (e) { toast(friendly(e)); } b.disabled = false; });
  };

  // ---------------------------------------------------------------- Partners
  PAGES.partners = r => listPage(r, {
    name: "partners", title: "Partners", csv: "partners",
    lede: "Hostel owners on Nivaz: their properties, beds, residents and the Nivaz fee.",
    search: "Owner name, phone or property",
    fetch: (s, limit, offset) => rpc("dash_partners", { p_search: s.q || null, p_limit: limit, p_offset: offset }),
    empty: () => "No owners match.",
    cols: () => [
      { h: "Owner", cell: o => `${personLink(o.id, o.name || "Owner")}<span class="sub">${phone(o.phone)}</span>`, csv: o => o.name },
      { h: "Phone", cell: o => contact(o.phone, `Hi ${String(o.name || "").split(" ")[0]}, this is Nivaz.`), csv: o => o.phone },
      { h: "Properties", cell: o => `${num(o.properties)}<span class="sub">${[o.live && o.live + " live", o.draft && o.draft + " draft", o.paused && o.paused + " paused"].filter(Boolean).join(", ") || "none yet"}</span>`, csv: o => o.properties },
      { h: "Beds filled", n: true, cell: o => `${num(o.booked)} of ${num(o.beds)}`, csv: o => o.booked },
      { h: "Residents", n: true, cell: o => num(o.residents), csv: o => o.residents },
      { h: "Team", n: true, cell: o => num(o.team), csv: o => o.team },
      { h: "Fees open", n: true, cell: o => o.fees_open ? `${inr(o.fees_open_amount)}<span class="sub">${plural(o.fees_open, "month", "months")}</span>` : "None", csv: o => o.fees_open_amount },
      { h: "Fees paid", n: true, cell: o => num(o.fees_paid), csv: o => o.fees_paid },
      { h: "Joined", cell: o => fmtDate(o.joined), csv: o => o.joined },
      { h: "Brought by", cell: o => esc(o.brought_by || "—"), csv: o => o.brought_by }
    ]
  });

  // ---------------------------------------------------------------- Bookings and visits
  const bvTabs = cur => `<nav class="tabs" aria-label="Bookings and visits"><a href="#bookings"${cur === "bookings" ? ' aria-current="page"' : ""}>Bookings</a><a href="#visits"${cur === "visits" ? ' aria-current="page"' : ""}>Visits</a></nav>`;
  PAGES.bookings = r => listPage(r, {
    name: "bookings", title: "Bookings", csv: "bookings", tabs: bvTabs("bookings"),
    lede: "Every booking made on Nivaz. Search by phone, name or booking number.",
    segs: [{ key: "status", def: "all", opts: [["all", "All"], ["active", "In progress"], ["pending", "Owner to accept"], ["upi_to_check", "UPI to check"], ["confirmed", "Accepted"], ["moved_in", "Moved in"], ["refund_owed", "Refund owed"], ["declined", "Declined"], ["cancelled", "Cancelled"]] }],
    search: "Phone, name, booking number or hostel",
    fetch: (s, limit, offset) => rpc("dash_bookings", { p_search: s.q || null, p_status: s.status, p_limit: limit, p_offset: offset }),
    empty: () => "No bookings match.",
    cols: () => [
      { h: "Booking", cell: b => `<b class="num">${esc(b.booking_no)}</b><span class="sub">${fmtTime(b.created_at)}</span>`, csv: b => b.booking_no },
      { h: "Made", cell: () => "", csv: b => b.created_at, hide: true },
      { h: "Resident", cell: b => `${personLink(b.resident_id, b.resident_name)}<span class="sub">${phone(b.resident_phone)}</span>`, csv: b => b.resident_name },
      { h: "Resident phone", cell: () => "", csv: b => b.resident_phone, hide: true },
      { h: "Hostel and bed", cell: b => `${propLink(b.property_id, b.property)}<span class="sub">Room ${esc(b.room_no)}, bed ${esc(b.bed_label)}</span>`, csv: b => `${b.property}, room ${b.room_no}, bed ${b.bed_label}` },
      { h: "Rent", n: true, cell: b => inr(b.monthly_rent), csv: b => b.monthly_rent },
      { h: "Token", cell: b => `<span class="num">${inr(b.token_amount)}</span><span class="sub">${st(...(TOKEN[b.token_status] || ["", b.token_status]))}</span>`, csv: b => `${b.token_amount} ${b.token_status}` },
      { h: "UPI reference", cell: () => "", csv: b => b.utr, hide: true },
      { h: "Move-in", cell: b => fmtDate(b.move_in_date), csv: b => b.move_in_date },
      { h: "Status", cell: b => bookStatus(b.status) + (b.status === "pending" && b.respond_by ? `<span class="sub">Owner has until ${fmtTime(b.respond_by)}</span>` : ""), csv: b => b.status },
      { h: "Refund", cell: b => b.refund_status ? `${inr(b.refund_amount)}<span class="sub">${b.refund_status === "owed" ? st("bad", "Owed") : st("ok", "Sent")}</span>` : `<span class="muted">—</span>`, csv: b => b.refund_status ? `${b.refund_amount} ${b.refund_status}` : "" },
      ...(isAdmin() ? [{ h: "", acts: true, cell: b => b.status === "pending" ? `<button class="btn sm danger" data-decline="${b.id}">Decline with full refund</button>` : "" }] : [])
    ],
    bind: (box, rows, reload) => $$("[data-decline]", box).forEach(btn => btn.onclick = async () => {
      const b = rows.find(x => x.id === btn.dataset.decline);
      const done = await ask({ title: `Decline booking ${esc(b.booking_no)}?`, text: `Only if the owner can't take ${esc(b.resident_name || "the resident")}. The owner must refund the full ${inr(b.token_amount)} token, and the resident is told.`, ok: "Decline booking", danger: true, run: () => rpc("respond_booking", { p_booking: b.id, p_accept: false }) });
      if (done) { toast("Booking declined. The refund is now owed by the owner."); S.ovAt = 0; reload(); loadOverview(true).catch(() => {}); }
    })
  });
  PAGES.visits = r => listPage(r, {
    name: "visits", title: "Visits", csv: "visits", tabs: bvTabs("visits"),
    lede: "Visit requests, how fast owners answered, and whether the visitor went on to book.",
    segs: [{ key: "status", def: "all", opts: [["all", "All"], ["waiting", "Waiting for an answer"], ["confirmed", "Confirmed"], ["reschedule_asked", "Asked to reschedule"], ["done", "Visited"], ["cancelled", "Cancelled"]] }],
    search: "Phone, name or hostel",
    fetch: (s, limit, offset) => rpc("dash_visits", { p_search: s.q || null, p_status: s.status, p_limit: limit, p_offset: offset }),
    empty: () => "No visits match.",
    cols: () => [
      { h: "Visitor", cell: v => `${personLink(v.resident_id, v.resident_name)}<span class="sub">${phone(v.resident_phone)}</span>`, csv: v => v.resident_name },
      { h: "Visitor phone", cell: () => "", csv: v => v.resident_phone, hide: true },
      { h: "Hostel", cell: v => `${propLink(v.property_id, v.property)}<span class="sub">${esc(v.area)}</span>`, csv: v => v.property },
      { h: "Visit on", cell: v => `${fmtDate(v.visit_date)}<span class="sub">${esc(v.slot)}</span>`, csv: v => `${v.visit_date} ${v.slot}` },
      { h: "Status", cell: v => st(...(VISIT[v.status] || ["", v.status])), csv: v => v.status },
      { h: "Asked", cell: v => `${fmtTime(v.created_at)}<span class="sub">${ago(v.created_at)}</span>`, csv: v => v.created_at },
      { h: "Answered in", n: true, cell: v => v.answered_at ? hoursText((new Date(v.answered_at) - new Date(v.created_at)) / 3600e3) : (v.status === "requested" ? st("warn", "Not yet") : "—"), csv: v => v.answered_at ? Math.round((new Date(v.answered_at) - new Date(v.created_at)) / 36e3) / 100 : "" },
      { h: "Booked after?", cell: v => v.booked ? st("ok", "Yes") : `<span class="muted">No</span>`, csv: v => v.booked ? "yes" : "no" }
    ]
  });

  // ---------------------------------------------------------------- Payments
  PAGES.payments = r => listPage(r, {
    name: "payments", title: "Payments", csv: "payments",
    lede: "Tokens, rent and refunds. Residents pay owners straight to their UPI ID; owners confirm the money arrived.",
    segs: [{ key: "status", def: "to_check", opts: [["to_check", "To check"], ["owed", "Refunds owed"], ["success", "Paid"], ["failed", "Failed"], ["all", "All"]] },
           { key: "kind", def: "all", opts: [["all", "Everything"], ["token", "Tokens"], ["rent", "Rent"], ["refund", "Refunds"]] }],
    search: "Phone, name, hostel, booking number or UPI reference",
    fetch: (s, limit, offset) => rpc("dash_payments", { p_kind: s.kind, p_status: s.status, p_search: s.q || null, p_limit: limit, p_offset: offset }),
    empty: s => s.status === "to_check" ? "No UPI payments are waiting for an owner to check." : s.status === "owed" ? "No refunds are owed." : "No payments match.",
    cols: () => [
      { h: "When", cell: x => `${fmtTime(x.reported_at || x.paid_at || x.created_at)}<span class="sub">${ago(x.reported_at || x.paid_at || x.created_at)}</span>`, csv: x => x.reported_at || x.paid_at || x.created_at },
      { h: "Kind", cell: x => esc(KIND[x.kind] || x.kind) + `<span class="sub">${x.booking_no ? esc(x.booking_no) : x.invoice_month ? esc(fmtMonth(x.invoice_month)) : ""}</span>`, csv: x => x.kind },
      { h: "Booking or month", cell: () => "", csv: x => x.booking_no || x.invoice_month, hide: true },
      { h: "Amount", n: true, cell: x => `<b>${inr(x.amount)}</b>`, csv: x => x.amount },
      { h: "Status", cell: x => payStatus(x), csv: x => x.status },
      { h: "UPI reference", cell: x => x.utr ? `<span class="num">${esc(x.utr)}</span>` : `<span class="muted">${esc(x.method === "cash" ? "Cash" : "—")}</span>`, csv: x => x.utr || x.method },
      { h: "Resident", cell: x => `${personLink(x.resident_id, x.resident_name)}<span class="sub">${phone(x.resident_phone)}</span>`, csv: x => x.resident_name },
      { h: "Resident phone", cell: () => "", csv: x => x.resident_phone, hide: true },
      { h: "Hostel and owner", cell: x => `${propLink(x.property_id, x.property)}<span class="sub">${esc(x.owner_name || "")} ${x.owner_phone ? phone(x.owner_phone) : ""}</span>`, csv: x => x.property },
      { h: "Owner", cell: () => "", csv: x => x.owner_name, hide: true },
      { h: "Owner phone", cell: () => "", csv: x => x.owner_phone, hide: true },
      ...(isAdmin() ? [{ h: "", acts: true, cell: x => x.status === "created" && x.utr && x.kind !== "refund" ? `<button class="btn sm" data-pok="${x.id}">Owner got it</button><button class="btn sm danger" data-pno="${x.id}">Not received</button>`
        : x.status === "created" && x.kind === "refund" ? `<button class="btn sm" data-ref="${x.id}">Mark refund sent</button>` : "" }] : [])
    ],
    bind: (box, rows, reload) => {
      const after = msg => { toast(msg); S.ovAt = 0; reload(); loadOverview(true).catch(() => {}); };
      $$("[data-pok],[data-pno]", box).forEach(btn => btn.onclick = async () => {
        const got = !!btn.dataset.pok, x = rows.find(p => p.id === (btn.dataset.pok || btn.dataset.pno));
        const fn = x.kind === "rent" ? "confirm_rent_upi" : "confirm_upi_payment";
        const ok = await ask(got ? { title: `Mark ${inr(x.amount)} as received?`, text: `Only after <b>${esc(x.owner_name || "the owner")}</b> has told you the money reached their bank (UPI reference ${esc(x.utr)}). ${x.kind === "token" ? "The booking then goes to the owner to accept." : "The rent bill is then marked paid."}`, ok: "Mark received", run: () => rpc(fn, { p_payment: x.id, p_received: true }) }
          : { title: "Mark as not received?", text: `Only after the owner has checked their bank and the money isn't there. ${x.kind === "token" ? "The booking is cancelled and the bed is freed." : "The resident's bill goes back to unpaid."}`, ok: "Not received", danger: true, run: () => rpc(fn, { p_payment: x.id, p_received: false }) });
        if (ok) after(got ? "Marked received." : "Marked not received.");
      });
      $$("[data-ref]", box).forEach(btn => btn.onclick = async () => {
        const x = rows.find(p => p.id === btn.dataset.ref);
        const ok = await ask({ title: `Mark the ${inr(x.amount)} refund as sent?`, text: `Only after ${esc(x.owner_name || "the owner")} has sent it to ${esc(x.resident_name || "the resident")} by UPI.`,
          fields: [{ id: "utr", label: "UPI reference of the refund (optional)", hint: "12 digits, from the owner's UPI app", inputmode: "numeric" }], ok: "Mark sent",
          run: v => rpc("mark_refund_sent", { p_payment: x.id, p_utr: v.utr || null }) });
        if (ok) after("Refund marked as sent.");
      });
    }
  });

  // ---------------------------------------------------------------- Owner fees (part 14/15 functions)
  PAGES.fees = r => listPage(r, {
    name: "fees", title: "Owner fees", csv: "owner-fees", all: true,
    lede: "The monthly Nivaz fee for each live property. Owners pay Nivaz's UPI ID and type the reference; check your UPI app, then mark it received.",
    segs: [{ key: "status", def: "reported", opts: [["reported", "Paid, to confirm"], ["due", "Due"], ["paid", "Received"], ["waived", "Waived"]] }],
    search: "Hostel or owner",
    fetch: async s => { const rows = await rpc("admin_owner_fees", { p_status: s.status }); const q = (s.q || "").toLowerCase(); return q ? rows.filter(f => [f.property, f.owner_name, f.owner_phone, f.utr].some(v => String(v || "").toLowerCase().includes(q))) : rows; },
    empty: s => ({ reported: "No fees are waiting for you to confirm.", due: "No fees are due.", paid: "No fees received yet.", waived: "No fees waived." })[s.status],
    cols: () => [
      { h: "Hostel", cell: f => `<b>${esc(f.property)}</b>`, csv: f => f.property },
      { h: "Owner", cell: f => `${esc(f.owner_name)}<span class="sub">${phone(f.owner_phone)}</span>`, csv: f => f.owner_name },
      { h: "Owner phone", cell: () => "", csv: f => f.owner_phone, hide: true },
      { h: "Month", cell: f => fmtMonth(f.month), csv: f => f.month },
      { h: "Amount", n: true, cell: f => inr(f.amount), csv: f => f.amount },
      { h: "Status", cell: f => st(...(FEE[f.status] || ["", f.status])), csv: f => f.status },
      { h: "UPI reference", cell: f => f.utr ? `<span class="num">${esc(f.utr)}</span><span class="sub">${f.reported_at ? "told us " + ago(f.reported_at) : ""}</span>` : "—", csv: f => f.utr },
      { h: "Note", cell: f => esc(f.note || "—"), csv: f => f.note },
      { h: "Brought by", cell: f => esc(f.brought_by || "—"), csv: f => f.brought_by },
      { h: "", acts: true, cell: f => (f.status === "reported" ? `<button class="btn sm primary" data-fee="paid" data-id="${f.id}">Received</button><button class="btn sm" data-fee="not_received" data-id="${f.id}">Not received</button>` : "")
        + (["due", "reported"].includes(f.status) ? `<button class="btn sm" data-fee="waive" data-id="${f.id}">Waive</button>` : "") }
    ],
    bind: (box, rows, reload) => $$("[data-fee]", box).forEach(btn => btn.onclick = async () => {
      const f = rows.find(x => x.id === btn.dataset.id), act = btn.dataset.fee;
      const T = { paid: [`Mark ${inr(f.amount)} received?`, `Check that ${inr(f.amount)} with UPI reference ${esc(f.utr)} reached Nivaz's account.`, "Mark received", false],
        not_received: ["Mark as not received?", "The owner will be asked to pay again.", "Not received", true],
        waive: ["Waive this fee?", `${esc(f.property)} won't have to pay for ${esc(fmtMonth(f.month))}.`, "Waive fee", true] }[act];
      const ok = await ask({ title: T[0], text: T[1], ok: T[2], danger: T[3], fields: [{ id: "note", label: "Note (optional)", hint: "Only the Nivaz team sees it" }],
        run: v => rpc("admin_decide_owner_fee", { p_fee: f.id, p_action: act, p_note: v.note || null }) });
      if (ok) { toast({ paid: "Fee marked received.", not_received: "Fee marked not received.", waive: "Fee waived." }[act]); S.ovAt = 0; reload(); loadOverview(true).catch(() => {}); }
    })
  });

  // ---------------------------------------------------------------- Cashback (part 13/15 functions)
  PAGES.cashback = r => listPage(r, {
    name: "cashback", title: "Cashback", csv: "cashback", all: true,
    lede: "Cashback residents and owners earned (meal skips, friends who joined, owners they brought). Send it by UPI, then mark it paid.",
    segs: [{ key: "status", def: "pending", opts: [["pending", "To pay"], ["paid", "Paid"], ["cancelled", "Cancelled"]] }],
    search: "Name or phone",
    fetch: async s => { const rows = await rpc("admin_rewards", { p_status: s.status }); const q = (s.q || "").toLowerCase(); return q ? rows.filter(w => [w.user_name, w.phone, w.property].some(v => String(v || "").toLowerCase().includes(q))) : rows; },
    empty: s => ({ pending: "No cashback to pay.", paid: "No cashback paid yet.", cancelled: "Nothing cancelled." })[s.status],
    cols: () => [
      { h: "Person", cell: w => `<b>${esc(w.user_name)}</b><span class="sub">${phone(w.phone)}</span>`, csv: w => w.user_name },
      { h: "Phone", cell: () => "", csv: w => w.phone, hide: true },
      { h: "For", cell: w => esc({ meal_skips: "Skipping meals", referral: "Friends who joined", owner_referral: "Bringing a hostel owner" }[w.kind] || w.kind) + (w.note ? `<span class="sub">${esc(w.note)}</span>` : "")
        + (w.friends && w.friends.length ? `<span class="sub">${w.friends.map(f => esc(f.name) + (f.booking ? ` (${esc(f.booking.replace("_", " "))})` : "")).join(", ")}</span>` : ""), csv: w => w.kind },
      { h: "Amount", n: true, cell: w => `<b>${inr(w.amount)}</b>`, csv: w => w.amount },
      { h: "Send to UPI ID", cell: w => w.payout_upi ? `<span class="num">${esc(w.payout_upi)}</span>` : st("warn", "Not added yet"), csv: w => w.payout_upi },
      { h: "Hostel", cell: w => esc(w.property || "—"), csv: w => w.property },
      { h: "Earned", cell: w => fmtDate(w.created_at), csv: w => w.created_at },
      { h: "Status", cell: w => st(...(CASH[w.status] || ["", w.status])) + (w.status === "paid" ? `<span class="sub">${fmtDate(w.paid_at)}${w.utr ? ", UPI " + esc(w.utr) : ""}</span>` : w.cancel_reason ? `<span class="sub">${esc(w.cancel_reason)}</span>` : ""), csv: w => w.status },
      { h: "", acts: true, cell: w => w.status === "pending" ? `<button class="btn sm primary" data-cpay="${w.id}">Mark paid</button><button class="btn sm" data-ccan="${w.id}">Cancel</button>` : "" }
    ],
    bind: (box, rows, reload) => {
      $$("[data-cpay]", box).forEach(btn => btn.onclick = async () => {
        const w = rows.find(x => x.id === btn.dataset.cpay);
        const ok = await ask({ title: `Mark ${inr(w.amount)} as paid to ${esc(w.user_name)}?`, text: w.payout_upi ? `Send it to <b>${esc(w.payout_upi)}</b> from Nivaz's UPI app first.` : "They haven't added a UPI ID yet. Ask them first, then send it.",
          fields: [{ id: "utr", label: "UPI reference (optional)", hint: "12 digits, from your UPI app", inputmode: "numeric" }], ok: "Mark paid",
          run: v => rpc("admin_mark_reward_paid", { p_reward: w.id, p_utr: v.utr || null }) });
        if (ok) { toast("Cashback marked paid."); S.ovAt = 0; reload(); loadOverview(true).catch(() => {}); }
      });
      $$("[data-ccan]", box).forEach(btn => btn.onclick = async () => {
        const w = rows.find(x => x.id === btn.dataset.ccan);
        const ok = await ask({ title: "Cancel this cashback?", text: `${esc(w.user_name)} won't get ${inr(w.amount)}.`, danger: true, ok: "Cancel cashback",
          fields: [{ id: "reason", label: "Why?", required: true, placeholder: "For example: the friend's booking was cancelled" }],
          run: v => rpc("admin_cancel_reward", { p_reward: w.id, p_reason: v.reason }) });
        if (ok) { toast("Cashback cancelled."); S.ovAt = 0; reload(); loadOverview(true).catch(() => {}); }
      });
    }
  });

  // ---------------------------------------------------------------- Complaints and disputes
  const cdTabs = cur => `<nav class="tabs" aria-label="Complaints and disputes"><a href="#complaints"${cur === "complaints" ? ' aria-current="page"' : ""}>Complaints</a><a href="#disputes"${cur === "disputes" ? ' aria-current="page"' : ""}>Deposit disputes</a></nav>`;
  PAGES.complaints = r => listPage(r, {
    name: "complaints", title: "Complaints", csv: "complaints", tabs: cdTabs("complaints"),
    lede: "Complaints from every hostel, oldest first. Owners and wardens fix them in Nivaz Partner; call them when one is late.",
    segs: [{ key: "status", def: "open", opts: [["open", "Open"], ["overdue", "Past fix time"], ["resolved", "Fixed"], ["all", "All"]] }],
    search: "Ticket, hostel, problem or resident",
    fetch: (s, limit, offset) => rpc("dash_complaints", { p_status: s.status, p_search: s.q || null, p_limit: limit, p_offset: offset }),
    empty: s => s.status === "open" ? "No open complaints." : s.status === "overdue" ? "No complaints are past their fix time." : "No complaints match.",
    cols: () => [
      { h: "Ticket", cell: c => `<b class="num">${esc(c.ticket_no)}</b><span class="sub">${ago(c.created_at)}</span>`, csv: c => c.ticket_no },
      { h: "Raised", cell: () => "", csv: c => c.created_at, hide: true },
      { h: "Hostel", cell: c => `${propLink(c.property_id, c.property)}<span class="sub">${esc(c.area)}</span>`, csv: c => c.property },
      { h: "Problem", wrap: true, cell: c => `<b>${esc(CAT[c.category] || c.category)}</b>: ${esc(c.description)}${c.location_text ? `<span class="sub">${esc(c.location_text)}</span>` : ""}`, csv: c => `${c.category}: ${c.description}` },
      { h: "Resident", cell: c => `${personLink(c.resident_id, c.resident_name)}<span class="sub">${phone(c.resident_phone)}</span>`, csv: c => c.resident_name },
      { h: "Resident phone", cell: () => "", csv: c => c.resident_phone, hide: true },
      { h: "Status", cell: c => (c.overdue ? st("bad", "Past fix time") : st(...(COMPLAINT[c.status] || ["", c.status]))) + (c.assigned_to ? `<span class="sub">${esc(c.assigned_to)}</span>` : ""), csv: c => c.overdue ? "past fix time" : c.status },
      { h: "Fix by", cell: c => c.status === "resolved" ? `${fmtTime(c.resolved_at)}<span class="sub">${c.rating ? c.rating + " of 5 stars" : "not rated"}</span>` : fmtTime(c.due_by), csv: c => c.status === "resolved" ? c.resolved_at : c.due_by },
      { h: "Latest update", wrap: true, cell: c => c.last_update ? `${esc(c.last_update)}<span class="sub">${ago(c.last_update_at)}</span>` : `<span class="muted">None</span>`, csv: c => c.last_update }
    ]
  });
  PAGES.disputes = r => listPage(r, {
    name: "disputes", title: "Deposit disputes", csv: "deposit-disputes", tabs: cdTabs("disputes"),
    lede: "When a resident disagrees with what the owner kept back from the deposit. Look at both sides, then decide.",
    segs: [{ key: "status", def: "open", opts: [["open", "To decide"], ["decided", "Decided"], ["all", "All"]] }],
    fetch: (s, limit, offset) => rpc("dash_disputes", { p_status: s.status, p_limit: limit, p_offset: offset }),
    empty: s => s.status === "open" ? "No disputes to decide. When a resident at a hostel with deposit protection disagrees about their deposit, it appears here. (Needs database part 20.)" : "No disputes.",
    cols: () => [
      { h: "Opened", cell: d => `${fmtDate(d.opened_at)}<span class="sub">${ago(d.opened_at)}</span>`, csv: d => d.opened_at },
      { h: "Hostel", cell: d => propLink(d.property_id, d.property), csv: d => d.property },
      { h: "Resident", cell: d => `${personLink(d.resident_id, d.resident_name)}<span class="sub">${phone(d.resident_phone)}</span>`, csv: d => d.resident_name },
      { h: "Owner", cell: d => `${esc(d.owner_name || "—")}<span class="sub">${phone(d.owner_phone)}</span>`, csv: d => d.owner_name },
      { h: "Deposit", n: true, cell: d => inr(d.deposit), csv: d => d.deposit },
      { h: "Kept back", n: true, cell: d => inr(d.deducted), csv: d => d.deducted },
      { h: "Status", cell: d => st(d.status === "open" ? "warn" : "ok", d.status === "open" ? "To decide" : d.status), csv: d => d.status },
      { h: "Decide by", cell: d => fmtDate(d.due_by), csv: d => d.due_by },
      { h: "", wrap: true, cell: d => `${esc(d.summary || "")} <a class="btn sm" href="#dispute/${d.id}">Open</a>`, csv: d => d.summary }
    ]
  });
  // One dispute: drawn from whatever dash_dispute() returns (part 20). See the handbook for the shape.
  PAGES.dispute = async (r, alive) => {
    let d;
    try { d = await rpc("dash_dispute", { p_id: r.id }); }
    catch (e) { if (e.message === MESSAGES.not_found) { view.innerHTML = `<div class="crumb"><a href="#disputes">Deposit disputes</a></div><div class="panel empty">This dispute doesn't exist (or deposit protection isn't switched on yet).</div>`; return; } throw e; }
    if (!alive()) return;
    // part 20 sends private photos as storage paths: sign each one for 10 minutes (the database checks the team can see them)
    d.photos = (await Promise.all((d.photos || []).map(async ph => {
      if (ph.url || !ph.path) return ph.url ? ph : null;
      const x = await sb.storage.from(ph.bucket || "deposit").createSignedUrl(ph.path, 600);
      return x.error ? null : Object.assign({}, ph, { url: x.data.signedUrl });
    }))).filter(Boolean);
    if (!alive()) return;
    view.innerHTML = `<div class="crumb"><a href="#disputes">Deposit disputes</a></div>
      <div class="ph"><div><h1>Deposit dispute: ${esc(d.property || "")}</h1><p class="lede">Opened ${fmtTime(d.opened_at)}${d.due_by ? `. Decide by ${fmtDate(d.due_by)}` : ""}.</p>
        <div class="rowline" style="margin-top:8px">${st(d.status === "open" ? "warn" : "ok", d.status === "open" ? "To decide" : String(d.status || ""))}</div></div></div>
      <div class="grid2">
        <section class="panel pad"><h2 style="margin-bottom:12px">Money</h2><dl class="facts"><div><dt>Deposit</dt><dd>${inr(d.deposit)}</dd></div><div><dt>Kept back by the owner</dt><dd>${inr(d.deducted)}</dd></div><div><dt>Refunded so far</dt><dd>${inr(d.refunded)}</dd></div></dl>${d.summary ? `<p class="muted" style="margin:12px 0 0">${esc(d.summary)}</p>` : ""}</section>
        <section class="panel"><h2 class="pad" style="padding-bottom:4px">People</h2><div class="people">
          ${d.resident ? `<div class="p"><span>${personLink(d.resident.id, d.resident.name)}<span class="muted"> resident</span><br><span class="muted">${phone(d.resident.phone)}</span></span>${contact(d.resident.phone)}</div>` : ""}
          ${d.owner ? `<div class="p"><span>${esc(d.owner.name || "Owner")}<span class="muted"> owner</span><br><span class="muted">${phone(d.owner.phone)}</span></span>${contact(d.owner.phone)}</div>` : ""}</div></section>
      </div>
      ${(d.sections || []).map(sc => `<section class="panel pad sec"><h2 style="margin-bottom:10px">${esc(sc.title)}</h2><dl class="facts">${(sc.rows || []).map(x => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join("")}</dl></section>`).join("")}
      ${(d.photos || []).length ? `<section class="panel pad sec"><h2 style="margin-bottom:10px">Photos</h2><div class="photos">${d.photos.map(ph => `<a href="${esc(ph.url)}" target="_blank" rel="noopener"><img alt="${esc(ph.caption || "Photo")}" src="${esc(ph.url)}"></a>`).join("")}</div></section>` : ""}
      ${(d.timeline || []).length ? `<section class="panel sec"><h2 class="pad" style="padding-bottom:4px">What happened</h2><ul class="feed">${d.timeline.map(t => `<li><time>${fmtTime(t.at)}</time><span>${esc(t.text)}<span class="by"> ${esc(t.who || "")}</span></span></li>`).join("")}</ul></section>` : ""}
      ${d.can_decide ? `<section class="panel pad sec"><h2>Decide</h2><p class="muted">Nivaz doesn't pay the money itself: the decision tells the owner what to refund, and both sides are told.</p>
        <div class="actions" style="margin-top:10px"><button class="btn primary" data-dd="owner_refunds">The owner refunds more</button><button class="btn" data-dd="deductions_fair">What the owner kept back is fair</button></div></section>` : ""}`;
    $$("[data-dd]").forEach(btn => btn.onclick = async () => {
      const more = btn.dataset.dd === "owner_refunds";
      const ok = await ask({ title: more ? "The owner refunds more" : "The deductions are fair", text: more ? "How much more should the owner refund?" : "The resident is told that what the owner kept back stands.",
        fields: (more ? [{ id: "amount", label: "Amount to refund, in rupees", inputmode: "numeric", required: true }] : []).concat([{ id: "note", label: "Reason (both sides see it)", type: "textarea", required: true }]),
        ok: "Send decision", run: v => rpc("decide_deposit_dispute", { p_dispute: d.id, p_outcome: btn.dataset.dd, p_amount: more ? Number(digits(v.amount)) : 0, p_note: v.note })
          .catch(e => { if (e.missing) throw new DashError("Part 20 isn't run yet, so disputes can't be decided here."); throw e; }) });
      if (ok) { toast("Decision sent."); render(); }
    });
  };

  // ---------------------------------------------------------------- Reviews
  PAGES.reviews = r => listPage(r, {
    name: "reviews", title: "Reviews", csv: "reviews",
    lede: "What residents wrote about their stay. The Super admin can hide a review that breaks the rules (abuse, phone numbers, not about the stay).",
    segs: [{ key: "filter", def: "all", opts: [["all", "All"], ["low", "1 or 2 stars"], ["no_reply", "No reply from the owner"], ["hidden", "Hidden"]] }],
    search: "Hostel, words in the review or resident",
    fetch: (s, limit, offset) => rpc("dash_reviews", { p_filter: s.filter, p_search: s.q || null, p_limit: limit, p_offset: offset }),
    empty: () => "No reviews match.",
    cols: () => [
      { h: "Date", cell: v => fmtDate(v.created_at), csv: v => v.created_at },
      { h: "Hostel", cell: v => `${propLink(v.property_id, v.property)}<span class="sub">${esc(v.area)}</span>`, csv: v => v.property },
      { h: "Stars", n: true, cell: v => `<b>${v.rating} of 5</b>${v.food || v.cleanliness || v.wifi ? `<span class="sub">Food ${v.food || "—"}, clean ${v.cleanliness || "—"}, Wi-Fi ${v.wifi || "—"}</span>` : ""}`, csv: v => v.rating },
      { h: "Review", wrap: true, cell: v => (v.comment ? esc(v.comment) : `<span class="muted">No words, stars only</span>`) + (v.reply ? `<span class="sub">Owner: ${esc(v.reply)}</span>` : ""), csv: v => v.comment },
      { h: "Owner reply", cell: () => "", csv: v => v.reply, hide: true },
      { h: "Resident", cell: v => personLink(v.resident_id, v.resident_name), csv: v => v.resident_name },
      { h: "Shown?", cell: v => v.hidden_at ? st("", "Hidden") : st("ok", "Shown"), csv: v => v.hidden_at ? "hidden" : "shown" },
      ...(isAdmin() ? [{ h: "", acts: true, cell: v => `<button class="btn sm${v.hidden_at ? "" : " danger"}" data-hide="${v.id}" data-on="${v.hidden_at ? 0 : 1}">${v.hidden_at ? "Show again" : "Hide"}</button>` }] : [])
    ],
    bind: (box, rows, reload) => $$("[data-hide]", box).forEach(btn => btn.onclick = async () => {
      const hide = btn.dataset.on === "1";
      const ok = await ask({ title: hide ? "Hide this review?" : "Show this review again?", text: hide ? "Customers won't see it, and it won't count in the stars." : "Customers will see it again.", ok: hide ? "Hide review" : "Show review", danger: hide,
        run: () => rpc("hide_review", { p_review: btn.dataset.hide, p_hide: hide }) });
      if (ok) { toast(hide ? "Review hidden." : "Review shown again."); reload(); }
    })
  });

  // ---------------------------------------------------------------- Activity log
  function said(a) {
    const p = a.params || {}, e = v => esc(v == null ? "" : v);
    const where = p.room ? (p.bed && p.bed !== "Unit" ? `room ${e(p.room)}, bed ${e(p.bed)}` : `unit ${e(p.room)}`) : "";
    const M = {
      listing_created: () => `Listed ${e(p.name)} (waiting for approval)`, listing_approved: () => `Approved and put ${e(p.name || "the listing")} live`,
      listing_paused: () => "Paused the listing", listing_resumed: () => "Put the listing live again", listing_changed: () => "Changed the listing details",
      booking_accepted: () => `Accepted ${e(p.name)}'s booking${where ? " for " + where : ""}`, booking_declined: () => `Declined ${e(p.name)}'s booking${where ? " for " + where : ""}`,
      moved_in: () => `Marked ${e(p.name)} as moved in${where ? " (" + where + ")" : ""}`, moved_out: () => `Marked ${e(p.name)} as moved out`,
      token_received: () => `Confirmed ${e(p.name)}'s token of ${inr(p.amount)}`, payment_not_received: () => `Marked ${e(p.name)}'s payment of ${inr(p.amount)} as not received`,
      refund_sent: () => `Sent ${e(p.name)} a refund of ${inr(p.amount)}`, rent_paid: () => `${e(p.name)}'s rent is paid: ${inr(p.amount)}${p.method ? " (" + e(p.method) + ")" : ""}`,
      rent_reminded: () => `Reminded ${e(p.name)} about the rent`, bill_changed: () => `Changed ${e(p.name)}'s bill: now ${inr(p.amount)}`,
      visit_answered: () => p.status === "confirmed" ? `Confirmed ${e(p.name)}'s visit` : p.status === "reschedule_asked" ? `Asked ${e(p.name)} to pick another visit time` : `Cancelled ${e(p.name)}'s visit`,
      complaint_update: () => `Ticket ${e(p.ticket)}: ${e(p.message)}`, request_decided: () => `${p.status === "approved" ? "Approved" : "Declined"} ${e(p.name)}'s request`,
      notice_posted: () => `Posted a notice: ${e(p.title)}`, notice_deleted: () => `Deleted the notice: ${e(p.title)}`, menu_changed: () => "Changed the menu",
      bed_blocked: () => `Blocked ${where || "a bed"}`, bed_unblocked: () => `Listed ${where || "a bed"} again`,
      team_added: () => `Added ${e(p.name)} to the team`, team_removed: () => `Removed ${e(p.name)} from the team`, team_role: () => `Changed ${e(p.name)}'s role`,
      resident_added: () => `Added ${e(p.name)} as a resident${where ? " (" + where + ")" : ""}`, police_verified: () => `Marked ${e(p.name)} as police verified`,
      rooms_changed: () => `Changed the rooms and beds${p.beds ? `: now ${e(p.rooms)} rooms, ${e(p.beds)} beds` : ""}`, rent_changed: () => "Changed the rent",
      room_type_added: () => `Added the room type ${e(p.name)}`, room_type_removed: () => `Removed the room type ${e(p.name)}`, room_type_changed: () => `Changed the room type ${e(p.name)}`,
      photo_added: () => "Added photos", photo_deleted: () => "Deleted a photo", pano_added: () => "Added a 360° photo", pano_deleted: () => "Deleted a 360° photo",
      expense_added: () => `Added an expense of ${inr(p.amount)}`, expense_deleted: () => "Deleted an expense", expense_stopped: () => "Stopped a monthly expense",
      review_replied: () => "Replied to a review", fee_reported: () => `Paid the Nivaz fee (${inr(p.amount)})`, resident_rated: () => `Rated ${e(p.name)}'s stay`,
      meter_reading: () => `Added a meter reading (${e(p.reading)})`, meter_reading_deleted: () => "Removed a meter reading"
    };
    return M[a.action] ? M[a.action]() : esc(String(a.action || "").replace(/_/g, " ")) + (p.name ? ": " + e(p.name) : "");
  }
  PAGES.activity = r => listPage(r, {
    name: "activity", title: "Activity log", csv: "activity", keep: ["property"],
    lede: "Who did what at each hostel: owners, managers, staff and the Nivaz team. Residents' own actions have their own pages.",
    search: "Hostel, person or what they did",
    extra: s => { s.property = r.params.get("property") || ""; return s.property ? `<span class="tag">One hostel only <a class="btn link" href="#activity" style="font-size:12px">show all</a></span>` : ""; },
    fetch: (s, limit, offset) => rpc("dash_activity", { p_property: s.property || null, p_search: s.q || null, p_limit: limit, p_offset: offset }),
    empty: () => "Nothing in the log matches.", limit: 100,
    cols: () => [
      { h: "When", cell: a => `<span class="nowrap">${fmtTime(a.created_at)}</span>`, csv: a => a.created_at },
      { h: "Hostel", cell: a => propLink(a.property_id, a.property), csv: a => a.property },
      { h: "Who", cell: a => `${a.actor_id ? personLink(a.actor_id, a.actor_name) : esc(a.actor_name || "—")}<span class="sub">${esc(ROLE[a.actor_role] || a.actor_role || "")}</span>`, csv: a => a.actor_name },
      { h: "Role", cell: () => "", csv: a => a.actor_role, hide: true },
      { h: "What", wrap: true, cell: a => said(a), csv: a => said(a).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">") }
    ]
  });

  // ---------------------------------------------------------------- Analytics
  PAGES.analytics = async (r, alive) => {
    const days = [30, 90, 180, 365].includes(+r.params.get("days")) ? +r.params.get("days") : 90;
    const an = await rpc("dash_analytics", { p_days: days }); if (!alive()) return;
    const b = an.bookings, v = an.visits, rs = an.response;
    view.innerHTML = `<div class="ph"><div><h1>Analytics</h1><p class="lede">From what's already in Nivaz; nothing extra is tracked in the apps.</p></div></div>
      <div class="ranges"><span class="muted">Period</span>${segHtml("days", [[30, "Last 30 days"], [90, "90 days"], [180, "180 days"], [365, "1 year"]], days)}</div>
      <div class="grid2">
        <section class="panel pad"><h2>From booking to moving in</h2><p class="muted" style="margin:2px 0 14px">Bookings started in the period. ${num(b.declined)} declined by owners, ${num(b.cancelled)} cancelled after paying.</p>
          ${hbars([{ label: "Started a booking", value: b.started }, { label: "Paid the token", value: b.paid }, { label: "Owner accepted", value: b.accepted }, { label: "Moved in", value: b.moved_in }])}</section>
        <section class="panel pad"><h2>Visits that became bookings</h2><p class="muted" style="margin:2px 0 14px">Visit requests made in the period, and what happened next.</p>
          ${hbars([{ label: "Asked to visit", value: v.requested }, { label: "Owner answered", value: v.answered }, { label: "Visit confirmed", value: v.confirmed }, { label: "Then booked", value: v.booked }, { label: "Then moved in", value: v.moved_in }])}</section>
      </div>
      <section class="panel pad sec"><h2>How fast owners answer visit requests</h2>
        <div class="grid2" style="margin-top:12px;align-items:start">
          <div><div class="big">${rs.median_hours != null ? esc(hoursText(rs.median_hours)) : "—"}</div><p class="muted" style="margin:2px 0 14px">Middle answer time${rs.answered ? `, from ${plural(rs.answered, "answered request", "answered requests")}. ${num(rs.within_12h)} answered within 12 hours.` : ". No answered requests in this period."}</p>
            ${hbars(rs.buckets.map(x => ({ label: x.label, value: x.n })))}</div>
          <div>${rs.by_property.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Hostel</th><th class="n">Requests</th><th class="n">Answered</th><th class="n">Middle time</th></tr></thead><tbody>
            ${rs.by_property.map(x => `<tr><td>${propLink(x.property_id, x.property)}</td><td class="n">${num(x.requests)}</td><td class="n">${num(x.answered)}</td><td class="n">${esc(hoursText(x.median_hours))}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No visit requests in this period.</div>`}</div>
        </div></section>
      <div class="grid2 sec">
        <section class="panel pad"><h2>Bookings by area</h2><p class="muted" style="margin:2px 0 14px">Paid bookings in the period. Visits in brackets.</p>
          ${an.by_area.length ? hbars(an.by_area.slice(0, 15).map(x => ({ label: x.area, value: x.bookings, text: `${num(x.bookings)} (${num(x.visits)})` }))) : `<div class="empty">No bookings or visits in this period.</div>`}
          ${an.by_area.length ? numsTable(["Area", "Paid bookings", "Moved in", "Visits"], an.by_area.map(x => [x.area, x.bookings, x.moved_in, x.visits])) : ""}</section>
        <section class="panel pad"><h2>How full each hostel is</h2><p class="muted" style="margin:2px 0 14px">Live hostels today, emptiest first.</p>
          ${an.occupancy.length ? hbars(an.occupancy.map(x => ({ label: x.property, href: "property/" + x.property_id, value: x.pct, text: x.pct + "%" })), { max: 100 }) : `<div class="empty">No live hostels.</div>`}
          ${an.occupancy.length ? numsTable(["Hostel", "Beds", "Filled", "Full"], an.occupancy.map(x => [x.property, x.beds, x.booked, x.pct + "%"])) : ""}</section>
      </div>`;
    $("[data-seg=days]").addEventListener("click", e => { const btn = e.target.closest("button"); if (btn) location.hash = "analytics?days=" + btn.dataset.v; });
  };

  // ---------------------------------------------------------------- Team and roles
  PAGES.team = async (r, alive) => {
    const team = await rpc("dash_team"); if (!alive()) return;
    view.innerHTML = `<div class="ph"><div><h1>Team and roles</h1><p class="lede">The Nivaz team: the <b>Super admin</b> can do everything, including fees, roles and approving hostels.
        <b>Nivaz Support</b> can see everything here and mark owner fees and cashback, but can't change settings, roles or hostels.</p></div></div>
      ${isAdmin() ? `<section class="panel pad"><h2>Give someone a role</h2><p class="muted" style="margin:2px 0 12px">They must have logged in to a Nivaz app once with their number.</p>
        <form id="tmF" class="rowline" novalidate><div class="phonefield" style="width:260px"><span class="cc">+91</span><input id="tmPhone" type="tel" inputmode="numeric" placeholder="10-digit number" aria-label="Mobile number"></div>
        <button class="btn" type="submit">Find</button></form><div id="tmFound" style="margin-top:12px"></div></section>` : ""}
      <section class="panel sec"><h2 class="pad" style="padding-bottom:4px">The Nivaz team</h2><div class="people">
        ${team.map(m => `<div class="p"><span>${personLink(m.id, m.name || "No name yet")}${m.is_me ? `<span class="muted"> (you)</span>` : ""}<br><span class="muted">${phone(m.phone)}</span></span>
          <span class="rowline">${st(m.role === "admin" ? "ok" : "", ROLE[m.role])}${isAdmin() && !m.is_me ? `<button class="btn sm danger" data-rm="${m.id}" data-own="${m.owns_properties ? 1 : 0}" data-name="${esc(m.name || phone(m.phone))}">Remove from team</button>` : ""}</span></div>`).join("")}
      </div></section>`;
    if (!isAdmin()) return;
    const setRole = async (id, role, name) => { await patch("users", id, { role }); toast(`${name} is now ${ROLE[role]}.`); render(); };
    $("#tmF").onsubmit = async e => {
      e.preventDefault(); const out = $("#tmFound");
      try {
        const p = await rpc("dash_find_person", { p_phone: $("#tmPhone").value });
        if (!p) { out.innerHTML = `<p class="muted">No one has logged in with that number yet. Ask them to open a Nivaz app and log in once, then try again.</p>`; return; }
        out.innerHTML = `<div class="rowline"><span><b>${esc(p.name || "No name yet")}</b> <span class="muted">${phone(p.phone)}, now ${esc(ROLE[p.role] || p.role)}</span></span>
          ${p.role !== "support" ? `<button class="btn sm primary" data-give="support">Make Nivaz Support</button>` : ""}${p.role !== "admin" ? `<button class="btn sm" data-give="admin">Make Super admin</button>` : ""}</div>`;
        $$("[data-give]", out).forEach(b => b.onclick = async () => {
          const role = b.dataset.give;
          await ask({ title: `Make ${esc(p.name || phone(p.phone))} ${ROLE[role]}?`, text: role === "admin" ? "A Super admin can do everything: fees, roles, approving and pausing hostels. Only give this to someone you fully trust." : "They'll be able to see bookings, payments and phone numbers across Nivaz, and mark owner fees and cashback.",
            ok: `Make ${ROLE[role]}`, danger: role === "admin", run: () => setRole(p.id, role, p.name || phone(p.phone)) });
        });
      } catch (ex) { out.innerHTML = `<p class="st bad">${esc(friendly(ex))}</p>`; }
    };
    $$("[data-rm]").forEach(b => b.onclick = () => ask({ title: `Remove ${b.dataset.name} from the Nivaz team?`, text: "They'll no longer be able to log in here or see Nivaz's lists.", ok: "Remove", danger: true,
      run: () => setRole(b.dataset.rm, b.dataset.own === "1" ? "owner" : "resident", b.dataset.name) }));
  };

  // ---------------------------------------------------------------- Settings (Super admin)
  PAGES.settings = async (r, alive) => {
    if (!isAdmin()) { view.innerHTML = `<div class="panel empty">Only the Super admin can change settings.</div>`; return; }
    const { data: s, error } = await sb.from("nivaz_settings").select("*").maybeSingle();
    if (error) throw mkErr(error, "nivaz_settings"); if (!alive()) return;
    view.innerHTML = `<div class="ph"><div><h1>Settings</h1><p class="lede">The Nivaz fee that owners pay each month for each live hostel, and where they pay it.</p></div></div>
      <section class="panel pad" style="max-width:640px"><form id="stF" class="form" novalidate style="display:grid;gap:14px">
        <label class="fld">Nivaz fee per hostel, per month (₹)<span>0 means no fee. Bills for this month are made as soon as you save.</span><input id="stFee" type="number" min="0" max="100000" step="1" value="${esc(s ? s.owner_fee : 0)}"></label>
        <label class="fld">Nivaz's UPI ID<span>Where owners pay the fee, for example nivaz@okicici</span><input id="stUpi" type="text" value="${esc((s && s.upi_id) || "")}" autocomplete="off"></label>
        <label class="fld">Name on that UPI ID<input id="stName" type="text" value="${esc((s && s.upi_name) || "")}" autocomplete="off"></label>
        <div class="err" id="stErr" role="alert" style="color:var(--bad)"></div>
        <div><button class="btn primary" type="submit">Save</button></div></form></section>
      <section class="panel pad sec" style="max-width:640px"><h2>Phone alerts</h2><p class="muted" style="margin:4px 0 0">${s && s.push_enabled ? "On: the apps send phone alerts." : "Off."} This is changed in Supabase, not here.</p></section>`;
    $("#stF").onsubmit = async e => {
      e.preventDefault(); $("#stErr").textContent = "";
      const fee = Number($("#stFee").value); if (!Number.isInteger(fee) || fee < 0 || fee > 100000) return $("#stErr").textContent = MESSAGES.amount_invalid;
      try { const n = await rpc("admin_set_owner_fee", { p_fee: fee, p_upi: $("#stUpi").value.trim() || null, p_name: $("#stName").value.trim() || null });
        toast(`Saved.${n ? ` ${plural(n, "new fee bill", "new fee bills")} made for this month.` : ""}`); S.ovAt = 0; }
      catch (ex) { $("#stErr").textContent = friendly(ex); }
    };
  };

  // ---------------------------------------------------------------- One person
  PAGES.person = async (r, alive) => {
    const p = await rpc("dash_person", { p_user: r.id }); if (!alive()) return;
    const sec = (title, rows, cols, empty) => `<section class="sec"><h2>${esc(title)} <small>${rows.length || ""}</small></h2>${rows.length ? table(cols, rows, title) : `<div class="panel empty">${esc(empty)}</div>`}</section>`;
    view.innerHTML = `<div class="crumb"><a href="javascript:history.back()">Back</a></div>
      <div class="ph"><div><h1>${esc(p.name || "No name yet")}</h1><p class="lede">${esc(ROLE[p.role] || p.role)}${p.occupation ? ", " + esc(p.occupation) : ""}. On Nivaz since ${fmtDate(p.joined)}.${p.deleted_at ? ` <span class="st bad"><i></i>Account deleted ${fmtDate(p.deleted_at)}</span>` : ""}</p>
        <div class="rowline" style="margin-top:8px"><b class="num">${phone(p.phone)}</b>${contact(p.phone)}${p.email ? `<span class="muted">${esc(p.email)}</span>` : ""}${p.emergency_phone ? `<span class="muted">Emergency contact ${phone(p.emergency_phone)}</span>` : ""}</div></div></div>
      ${p.properties.length ? sec("Hostels they own", p.properties, [{ h: "Hostel", cell: x => propLink(x.id, x.name) }, { h: "Area", cell: x => esc(x.area) }, { h: "Status", cell: x => propStatus(x.status) }], "") : ""}
      ${p.teams.length ? sec("Teams they work in", p.teams, [{ h: "Hostel", cell: x => propLink(x.property_id, x.property) }, { h: "Role", cell: x => esc(x.role === "manager" ? "Manager" : (x.title || "Staff")) }], "") : ""}
      ${sec("Stays", p.stays, [{ h: "Hostel", cell: x => `${propLink(x.property_id, x.property)}<span class="sub">Room ${esc(x.room_no)}, bed ${esc(x.bed)}</span>` }, { h: "From", cell: x => fmtDate(x.start) }, { h: "To", cell: x => x.end ? fmtDate(x.end) : "Now" },
        { h: "Rent", n: true, cell: x => inr(x.rent) }, { h: "Deposit held", n: true, cell: x => inr(x.deposit) }, { h: "Status", cell: x => st(x.status === "ended" ? "" : x.status === "on_notice" ? "warn" : "ok", { active: "Living there", on_notice: "On notice", ended: "Ended" }[x.status] || x.status) }], "No stays.")}
      ${sec("Bookings", p.bookings, [{ h: "Booking", cell: x => `<b class="num">${esc(x.booking_no)}</b><span class="sub">${fmtDate(x.created_at)}</span>` }, { h: "Hostel", cell: x => `${propLink(x.property_id, x.property)}<span class="sub">Room ${esc(x.room_no)}, bed ${esc(x.bed)}</span>` },
        { h: "Rent", n: true, cell: x => inr(x.rent) }, { h: "Token", n: true, cell: x => inr(x.token) }, { h: "Move-in", cell: x => fmtDate(x.move_in) }, { h: "Status", cell: x => bookStatus(x.status) }], "No bookings.")}
      ${sec("Payments", p.payments, [{ h: "When", cell: x => fmtTime(x.at) }, { h: "Kind", cell: x => esc(KIND[x.kind] || x.kind) }, { h: "Amount", n: true, cell: x => inr(x.amount) }, { h: "Status", cell: x => payStatus(x) }, { h: "UPI reference", cell: x => esc(x.utr || "—") }], "No payments.")}
      ${sec("Visits", p.visits, [{ h: "Hostel", cell: x => esc(x.property) }, { h: "Visit on", cell: x => `${fmtDate(x.date)}<span class="sub">${esc(x.slot)}</span>` }, { h: "Status", cell: x => st(...(VISIT[x.status] || ["", x.status])) }], "No visits.")}
      ${sec("Complaints", p.complaints, [{ h: "Ticket", cell: x => `<b class="num">${esc(x.ticket_no)}</b>` }, { h: "Hostel", cell: x => esc(x.property) }, { h: "Problem", cell: x => esc(CAT[x.category] || x.category) }, { h: "Raised", cell: x => fmtDate(x.created_at) }, { h: "Status", cell: x => st(...(COMPLAINT[x.status] || ["", x.status])) }], "No complaints.")}
      ${p.cashback.length ? sec("Cashback", p.cashback, [{ h: "Earned", cell: x => fmtDate(x.at) }, { h: "For", cell: x => esc({ meal_skips: "Skipping meals", referral: "Friends who joined", owner_referral: "Bringing an owner" }[x.kind] || x.kind) }, { h: "Amount", n: true, cell: x => inr(x.amount) }, { h: "Status", cell: x => st(...(CASH[x.status] || ["", x.status])) }], "") : ""}`;
  };

  // ---------------------------------------------------------------- search everything
  const q = $("#q"), qList = $("#qList"); let qT, qSeq = 0, qItems = [], qSel = -1;
  function closeSearch() { qList.hidden = true; q.setAttribute("aria-expanded", "false"); qSel = -1; }
  function drawSearch(res) {
    const groups = [["Hostels", res.properties.map(x => [`property/${x.id}`, x.name, `${x.area}, ${x.status}`])],
      ["People", res.people.map(x => [`person/${x.id}`, x.name || "No name yet", `${phone(x.phone).replace(/<[^>]+>/g, "")}, ${ROLE[x.role] || x.role}`])],
      ["Bookings", res.bookings.map(x => [`bookings?q=${encodeURIComponent(x.booking_no)}&status=all`, x.booking_no, `${x.resident || ""}, ${x.property}`])],
      ["Complaints", res.complaints.map(x => [`complaints?q=${encodeURIComponent(x.ticket_no)}&status=all`, x.ticket_no, `${CAT[x.category] || x.category}, ${x.property}`])]].filter(g => g[1].length);
    qItems = groups.flatMap(g => g[1]); qSel = qItems.length ? 0 : -1;
    let i = 0;
    qList.innerHTML = groups.length ? groups.map(([h, items]) => `<h3>${h}</h3>${items.map(([href, a, b]) => `<a href="#${href}" role="option" id="qo${i}" aria-selected="${i++ === 0}"><span>${esc(a)}</span><span>${esc(b)}</span></a>`).join("")}`).join("")
      : `<div class="none">Nothing found. Try a phone number, a booking number like B261102…, or a ticket like T10001.</div>`;
    qList.hidden = false; q.setAttribute("aria-expanded", "true");
  }
  q.addEventListener("input", () => {
    clearTimeout(qT); const text = q.value.trim();
    if (text.length < 2) return closeSearch();
    qT = setTimeout(async () => { const my = ++qSeq; try { const res = await rpc("dash_search", { p_q: text }); if (my === qSeq) drawSearch(res); } catch (e) { if (my === qSeq) { qList.innerHTML = `<div class="none">${esc(friendly(e))}</div>`; qList.hidden = false; } } }, 250);
  });
  q.addEventListener("keydown", e => {
    if (qList.hidden || !qItems.length) { if (e.key === "Escape") closeSearch(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); qSel = (qSel + (e.key === "ArrowDown" ? 1 : -1) + qItems.length) % qItems.length;
      $$("a", qList).forEach((a, i) => a.setAttribute("aria-selected", i === qSel)); q.setAttribute("aria-activedescendant", "qo" + qSel); }
    else if (e.key === "Enter") { e.preventDefault(); if (qSel >= 0) { location.hash = qItems[qSel][0]; q.value = ""; closeSearch(); } }
    else if (e.key === "Escape") closeSearch();
  });
  qList.addEventListener("click", e => { if (e.target.closest("a")) { q.value = ""; closeSearch(); } });
  document.addEventListener("click", e => { if (!e.target.closest(".search")) closeSearch(); });

  // ---------------------------------------------------------------- start
  sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT" && !app.hidden) showLogin("You were logged out."); });
  (async () => {
    const { data } = await sb.auth.getSession();
    if (!data.session) return showLogin();
    afterLogin();
  })();
})();
