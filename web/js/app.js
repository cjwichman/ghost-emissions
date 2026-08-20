// Ghost Emissions — front end. Hash routes: #firm #borough #board #instructor.
// The model never runs here. Previews come from the `preview` edge function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_URL } from "./config.js";
import { GHOST_SVG, KEY_ROWS, TRADES, drawMAC, drawEther, drawMap, drawLeaderboard } from "./ui.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "ghost" } });
const $ = s => document.querySelector(s);
const fmt = n => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

let me = null, cls = null, team = null, teammates = [], round = null, isInstructor = false;

async function callFn(name, body) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${FUNCTIONS_URL}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}` }, body: JSON.stringify(body) });
  return r.json();
}

// ---------- boot ----------
let recovering = false, booted = false;
async function boot() {
  sb.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY") { recovering = true; if (booted) viewRecovery(); } });
  const url = new URL(location.href);
  if (url.searchParams.get("code")) { await sb.auth.exchangeCodeForSession(url.searchParams.get("code")).catch(() => {}); history.replaceState(null, "", url.pathname + "#firm"); recovering = true; }
  const { data: { session } } = await sb.auth.getSession();
  if (session) await loadMe();
  booted = true;
  if (recovering && session) return viewRecovery();
  route();
  window.addEventListener("hashchange", route);
  sb.auth.onAuthStateChange(async (e, sess) => { if (e === "PASSWORD_RECOVERY") return; if (!booted) return; if (sess && !me) { await loadMe(); route(); } else if (!sess && me) { me = null; cls = null; team = null; isInstructor = false; route(); } });
}
async function loadMe() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { data: st } = await sb.from("students").select("*").eq("id", user.id).maybeSingle();
  me = st;
  if (!me) { const { data: c } = await sb.from("classes").select("*").eq("instructor_id", user.id).maybeSingle(); if (c) { cls = c; isInstructor = true; me = { id: user.id, display_name: "Instructor", class_id: c.id }; } return; }
  ({ data: cls } = await sb.from("classes").select("*").eq("id", me.class_id).single());
  isInstructor = cls?.instructor_id === user.id;
  if (me.team_id) {
    ({ data: team } = await sb.from("teams").select("*").eq("id", me.team_id).single());
    ({ data: teammates } = await sb.from("students").select("*").eq("team_id", me.team_id).eq("active", true).order("minister_order"));
  }
}
async function currentRound() {
  const { data } = await sb.from("rounds").select("*").eq("class_id", cls.id).in("status", ["open", "closed"]).order("number", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}
async function lastResolved(n = 1) {
  const { data } = await sb.from("rounds").select("*").eq("class_id", cls?.id ?? (await publicClassId())).eq("status", "resolved").order("number", { ascending: false }).limit(n);
  return data ?? [];
}
async function publicClassId() {
  const p = new URLSearchParams(location.search).get("class");
  if (p) { const { data } = await sb.from("classes").select("id").eq("code", p).maybeSingle(); if (data) return data.id; }
  const { data } = await sb.from("teams").select("class_id").limit(1); return data?.[0]?.class_id;
}

// ---------- shell ----------
function shell(active, inner) {
  const nav = me && !isInstructor ? [["firm", "My business"], ["borough", "My borough"], ["board", "The city"]] : isInstructor ? [["board", "The city"], ["instructor", "Instructor"]] : [["board", "The city"]];
  $("#app").innerHTML = `
  <div class="appbar"><a class="brand" href="#board">${GHOST_SVG(18)} Ghost Emissions</a>
    <nav>${nav.map(([k, l]) => `<a href="#${k}" class="${active === k ? "on" : ""}">${l}</a>`).join("")}</nav>
    <span class="who">${me ? `${esc(me.display_name)}${team ? " · " + esc(team.name) : ""} <a href="#" id="signout">Sign out</a>` : `<a href="#signin">Sign in</a>`}</span></div>
  <div class="wrap">${inner}</div>`;
  $("#signout")?.addEventListener("click", async e => { e.preventDefault(); await sb.auth.signOut(); location.hash = "#signin"; });
}
function drawer(title, body, open = false) { return `<details ${open ? "open" : ""}><summary>${title}</summary><div class="body">${body}</div></details>`; }
function keyDrawer(extra = []) { return drawer("Key", `<div class="glos">${[...KEY_ROWS, ...extra].map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join("")}</div>`); }
function closesText(r) { return r?.closes_at ? "closes " + new Date(r.closes_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""; }

// ---------- routes ----------
async function route() {
  if (!booted) return;
  if (recovering) return viewRecovery();
  const h = (location.hash || "#firm").slice(1);
  const { data: { session } } = await sb.auth.getSession();
  if (session && !me && h !== "board") return viewJoin();
  if (!me && h !== "board") return viewAuth();
  if (h === "signin") return viewAuth();
  if (h === "board") return viewBoard();
  if (h === "instructor" && isInstructor) return viewInstructor();
  if (!me.team_id) return shell(h, `<div class="card"><h2>Welcome, ${esc(me.display_name)}</h2><p>You are in ${esc(cls?.name ?? "the class")} but not on a team yet. Your instructor assigns boroughs after the first week. Check back after class.</p></div>`);
  round = await currentRound();
  if (h === "borough") return viewBorough();
  return viewFirm();
}

// ---------- auth ----------
function viewAuth() {
  shell("signin", `<div class="auth card">
    <h2 style="display:flex;align-items:center;gap:8px">${GHOST_SVG(26)} Ghost Emissions</h2>
    <p class="small">One city. Nine boroughs. Everyone shares the sky.</p>
    <div class="seg"><button class="on" data-m="in">Sign in</button><button data-m="up">Create account</button></div>
    <div id="up" style="display:none"><label class="lab">Class code</label><input class="field" id="code" placeholder="from your syllabus"><label class="lab">Your name (as on the roster)</label><input class="field" id="name"></div>
    <label class="lab">Email</label><input class="field" id="email" type="email">
    <label class="lab">Password</label><input class="field" id="pw" type="password">
    <button class="btn" id="go">Sign in</button>
    <button class="btn ghost" id="reset">Forgot password</button>
    <div id="msg"></div></div>`);
  let mode = "in";
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { mode = b.dataset.m; document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("on", x === b)); $("#up").style.display = mode === "up" ? "block" : "none"; $("#go").textContent = mode === "up" ? "Create account" : "Sign in"; });
  $("#go").onclick = async () => {
    const email = $("#email").value.trim(), password = $("#pw").value;
    let err;
    if (mode === "up") {
      const code = $("#code").value.trim(), name = $("#name").value.trim();
      if (!code || !name) return $("#msg").innerHTML = `<div class="msg">Enter the class code and your name.</div>`;
      const { data: okCode, error: e0 } = await sb.rpc("class_exists", { p_code: code });
      if (e0 || !okCode) return $("#msg").innerHTML = `<div class="msg">That class code did not match. Check the code on Canvas.</div>`;
      const { data: su, error } = await sb.auth.signUp({ email, password });
      err = error?.message;
      if (!err && !su.session) return $("#msg").innerHTML = `<div class="msg ok">Check your email to confirm your account, then sign in and enter the class code again.</div>`;
      if (!err) { const { error: e2 } = await sb.rpc("join_class", { p_code: code, p_name: name }); err = e2?.message; }
    } else { const { error } = await sb.auth.signInWithPassword({ email, password }); err = error?.message; }
    if (err) $("#msg").innerHTML = `<div class="msg">${esc(err)}</div>`; else { await loadMe(); location.hash = isInstructor ? "#instructor" : "#firm"; }
  };
  $("#reset").onclick = async () => { const { error } = await sb.auth.resetPasswordForEmail($("#email").value.trim(), { redirectTo: location.href.split("#")[0] }); $("#msg").innerHTML = `<div class="msg ${error ? "" : "ok"}">${error ? esc(error.message) : "Check your email for a reset link."}</div>`; };
}

function viewJoin() {
  shell("signin", `<div class="auth card"><h2>Join your class</h2><p class="small">You are signed in but not in a class yet.</p><label class="lab">Class code</label><input class="field" id="code"><label class="lab">Your name (as on the roster)</label><input class="field" id="name"><button class="btn" id="go">Join</button><div id="msg"></div></div>`);
  $("#go").onclick = async () => {
    const { error } = await sb.rpc("join_class", { p_code: $("#code").value.trim(), p_name: $("#name").value.trim() });
    if (error) return $("#msg").innerHTML = `<div class="msg">${/Unknown/.test(error.message) ? "That class code did not match." : esc(error.message)}</div>`;
    await loadMe(); location.hash = "#firm"; route();
  };
}
function viewRecovery() {
  recovering = true;
  shell("signin", `<div class="auth card"><h2>Set a new password</h2><label class="lab">New password</label><input class="field" id="pw1" type="password"><label class="lab">Again</label><input class="field" id="pw2" type="password"><button class="btn" id="go">Save password</button><div id="msg"></div></div>`);
  $("#go").onclick = async () => {
    if ($("#pw1").value.length < 8) return $("#msg").innerHTML = `<div class="msg">Use at least 8 characters.</div>`;
    if ($("#pw1").value !== $("#pw2").value) return $("#msg").innerHTML = `<div class="msg">Passwords do not match.</div>`;
    const { error } = await sb.auth.updateUser({ password: $("#pw1").value });
    if (error) return $("#msg").innerHTML = `<div class="msg">${esc(error.message)}</div>`;
    recovering = false; await loadMe(); history.replaceState(null, "", location.pathname + location.search); location.hash = isInstructor ? "#instructor" : "#firm"; route();
  };
}

// ---------- firm ----------
async function viewFirm() {
  if (!round) return shell("firm", `<div class="card"><h2>No round open</h2><p>The next round opens after Monday's class.</p></div>`);
  const cfg = round.config ?? {};
  const fcfg = cfg.firm ?? { sliders: ["q", "a"], chart: false };
  const { data: mine } = await sb.from("firm_decisions").select("*").eq("round_id", round.id).eq("student_id", me.id).maybeSingle();
  const closed = round.status !== "open";
  const q0 = mine?.q ?? 100, a0 = mine ? Number(mine.a) * 100 : 0;
  const prev = (await lastResolved(1))[0];
  const T = TRADES[me.firm_type ?? 3] ?? TRADES[3];
  let policyLine = "No borough policy applies to you this round.";
  let policy = { kind: "none" };
  if (prev) {
    const { data: bd } = await sb.from("borough_decisions").select("payload").eq("round_id", prev.id).eq("team_id", team.id).maybeSingle();
    policy = bd?.payload?.policy ?? { kind: "none" };
    if (policy.kind === "tax") policyLine = `${esc(team.name)} set a ghost tax of <b>${fmt(policy.tau)} per ton</b> last week. It applies to you this round.`;
    if (policy.kind === "cap") policyLine = `${esc(team.name)} capped ghosts at <b>${Math.round(policy.capTons)} t</b> for the borough. You get a permit allocation. The market sets your containment. You choose output.`;
    if (policy.kind === "standard") policyLine = `${esc(team.name)} requires every business to contain at least <b>${Math.round(policy.aMin * 100)}%</b> of its ghosts.`;
  }
  const showA = policy.kind !== "cap" && fcfg.sliders?.includes("a");
  const pill = policy.kind === "none" ? `<span class="pill grey">No policy yet</span>` : policy.kind === "tax" ? `<span class="pill ember">Tax: ${fmt(policy.tau)}/t</span>` : policy.kind === "cap" ? `<span class="pill ember">Cap in effect</span>` : `<span class="pill ember">Containment rule</span>`;
  const bizName = me.firm_name ?? `${team.name} ${T.trade}`;
  const etherReading = prev ? Number((await etherNow()) ?? 0).toFixed(2) : null;

  shell("firm", `
    ${cfg.howto?.firm ? `<div class="howto-strip"><b>How to play this week.</b> ${cfg.howto.firm.split("\n").map(x => `<p>${esc(x)}</p>`).join("")}<p class="small">Your business details are further down the page.</p></div>` : ""}
    <div class="two"><div>
    <div class="hdr"><div><div class="eyebrow">Round ${round.number} · ${closesText(round)}</div><h2>${esc(bizName)}</h2><div class="small">${esc(T.trade)} · ${esc(team.name)}</div></div>${pill}</div>
    <div class="decision"><div class="eyebrow">This week's decision</div>
      <h3>${esc(fcfg.title ?? "How much to make, and how many ghosts to contain")}</h3>
      <p>${policyLine}</p>${fcfg.text ? `<p>${esc(fcfg.text)}</p>` : ""}
      <div class="prehdr">This week, as chosen below</div>
      <div class="preview"><div class="stat pos"><div class="eyebrow">Profit</div><div class="num" id="pv">…</div></div><div class="stat ecto"><div class="eyebrow">Ghosts released</div><div class="num" id="ev">…</div></div><div class="stat neg"><div class="eyebrow" id="cl">Total containment cost</div><div class="num" id="cv">…</div></div></div>
      <div class="slider"><div class="lab"><span>Output</span><span class="num" id="qv"></span></div><input type="range" id="q" min="0" max="100" value="${q0}" ${closed ? "disabled" : ""}></div>
      ${showA ? `<div class="slider"><div class="lab"><span>Containment</span><span class="num" id="av"></span></div><input type="range" id="a" min="0" max="100" value="${a0}" ${closed ? "disabled" : ""}></div>` : ""}
      ${closed ? `<p class="small">This round is closed. Results Monday.</p>` : `<button class="btn" id="submit">${mine ? "Update" : "Submit"} for round ${round.number}</button><div class="small" style="text-align:center;margin-top:6px">Submit by Sunday night. You can change it until then.</div>`}
      <div id="msg"></div></div>
    <label class="lab">Send a one-line note to your mayor for next week (optional)</label><input class="field" id="note" maxlength="140" value="${esc(mine?.note ?? "")}" ${closed ? "disabled" : ""}>
  </div><div>
    ${fcfg.chart ? `<div class="chart"><div id="mac"></div><div class="cap">Your marginal cost of containment. ${policy.kind === "tax" ? "Where it crosses the tax line, one more ton contained costs the same as one more ton taxed." : ""}</div></div>` : ""}
    ${cfg.briefing?.firm ? drawer("From the Institute", `<div class="brief">${cfg.briefing.firm.split("\n").map(p => `<p>${esc(p)}</p>`).join("")}</div>`, true) : ""}
    ${drawer("Forecast for next round", `<p>What will the Ether read next Monday?${etherReading ? ` The current reading is ${etherReading}.` : ""}</p><input class="field" id="fc" type="number" step="0.01" min="0" max="4" value="${mine?.forecast ?? ""}" ${closed ? "disabled" : ""} placeholder="e.g. 0.75">`)}
    ${drawer("Your business", `<dl class="kv"><dt>Trade</dt><dd>${esc(T.blurb)}</dd><dt>Ghosts</dt><dd>Your business releases 0.2 t of ghosts per ${esc(T.unit.replace(/s$/, ""))} before containment.</dd><dt>Margin</dt><dd>$30 per ${esc(T.unit.replace(/s$/, ""))} before ghosts.</dd><dt>Containment</dt><dd>Cheap for the first few ghosts, expensive for the last few.</dd></dl>`, round.number <= 1)}
    ${keyDrawer(policy.kind === "tax" ? [["Ghost tax", "carbon tax"]] : policy.kind === "cap" ? [["Cap", "cap and trade"]] : [])}
  </div></div>`);

  const ghostMult = team.params.ghostMult ?? 1;
  const slope = 200 * (me.firm_type ?? 3) * (team.params.techMult ?? 1);
  const local = () => {
    const q = +$("#q").value, a = showA ? +$("#a").value / 100 : 0;
    $("#qv").textContent = q + " " + T.unit; if (showA) $("#av").textContent = Math.round(a * 100) + "% of ghosts";
    if (policy.kind === "cap") return { q, a };
    const base = 0.2 * q * ghostMult, ghosts = base * (1 - a), cont = 0.5 * slope * a * a * base;
    const tax = policy.kind === "tax" ? (policy.tau ?? 0) * ghosts : 0;
    const profit = 30 * q - cont - tax;
    $("#ev").textContent = ghosts.toFixed(1) + " t";
    if (policy.kind === "tax") { $("#cl").textContent = "Tax bill"; $("#cv").textContent = fmt(tax); } else { $("#cl").textContent = "Total containment cost"; $("#cv").textContent = fmt(cont); }
    $("#pv").textContent = fmt(profit); $("#pv").parentElement.className = "stat " + (profit < 0 ? "neg" : "pos");
    if (fcfg.chart) $("#mac").innerHTML = drawMAC({ type: me.firm_type ?? 3, a, price: policy.kind === "tax" ? policy.tau : null, slope, label: "tax" });
    return { q, a };
  };
  const serverConfirm = debounce(async () => {
    if (policy.kind !== "cap") return;
    const q = +$("#q").value;
    const r = await callFn("preview", { roundId: round.id, kind: "firm", q, a: 0 });
    if (!r.ok) return;
    $("#pv").textContent = fmt(r.firm.profit); $("#pv").parentElement.className = "stat " + (r.firm.profit < 0 ? "neg" : "pos");
    $("#ev").textContent = r.firm.ghosts.toFixed(1) + " t";
    $("#cl").textContent = r.firm.permitBill >= 0 ? "Permits bought" : "Permits sold"; $("#cv").textContent = fmt(Math.abs(r.firm.permitBill));
    if (fcfg.chart) $("#mac").innerHTML = drawMAC({ type: me.firm_type ?? 3, a: r.firm.a, price: r.policy.permitPrice, slope, label: "permit price" });
  }, 150);
  const upd = () => { local(); serverConfirm(); };
  $("#q").oninput = upd; if (showA) $("#a").oninput = upd; upd();
  $("#submit")?.addEventListener("click", async () => {
    const row = { round_id: round.id, student_id: me.id, q: +$("#q").value, a: showA ? +$("#a").value / 100 : 0, note: $("#note").value || null, forecast: $("#fc").value === "" ? null : +$("#fc").value, extra: { ...(mine?.extra ?? {}), suggestion_only: false }, submitted_at: new Date().toISOString() };
    const { error } = await sb.from("firm_decisions").upsert(row);
    $("#msg").innerHTML = `<div class="msg ${error ? "" : "ok"}">${error ? esc(error.message) : "Submitted. You can change it until Sunday night."}</div>`;
    if (!error) $("#submit").textContent = `Update for round ${round.number}`;
  });
}
async function etherNow() { const r = (await lastResolved(1))[0]; if (!r) return null; const { data } = await sb.from("round_outcomes").select("totals").eq("round_id", r.id).maybeSingle(); return data?.totals?.ether; }

// ---------- borough ----------
async function viewBorough() {
  if (!round) return shell("borough", `<div class="card"><h2>No round open</h2></div>`);
  const cfg = round.config ?? {}; const bcfg = cfg.borough ?? { type: "target" };
  const closed = round.status !== "open";
  const { data: minId } = await sb.rpc("minister_for", { p_team: team.id, p_round: round.id });
  const minister = teammates.find(s => s.id === minId); const iAmMinister = minId === me.id;
  const nextMin = teammates.length ? teammates[(teammates.findIndex(s => s.id === minId) + 1) % teammates.length] : null;
  const { data: bd } = await sb.from("borough_decisions").select("*").eq("round_id", round.id).eq("team_id", team.id).maybeSingle();
  const payload = bd?.payload ?? { policy: { kind: "none" }, budget: { subsidy: 0, rd: 0, defense: 0, reserve: 1 } };
  const prev = (await lastResolved(1))[0];
  let lastFirms = [], lastB = null, rank = null;
  if (prev) {
    const { data: fo } = await sb.from("firm_outcomes").select("student_id,data").eq("round_id", prev.id).in("student_id", teammates.map(s => s.id));
    const { data: fd } = await sb.from("firm_decisions").select("student_id,note").eq("round_id", prev.id).in("student_id", teammates.map(s => s.id));
    lastFirms = (fo ?? []).map(o => ({ ...o, note: fd?.find(x => x.student_id === o.student_id)?.note, s: teammates.find(s => s.id === o.student_id) }));
    ({ data: lastB } = await sb.from("borough_outcomes").select("data").eq("round_id", prev.id).eq("team_id", team.id).maybeSingle());
    const { data: ro } = await sb.from("round_outcomes").select("totals").eq("round_id", prev.id).maybeSingle();
    const sc = ro?.totals?.scores; if (sc) { const order = Object.entries(sc).sort((a, b) => b[1].score - a[1].score).map(x => x[0]); rank = order.indexOf(team.id) + 1; }
  }
  // teammates' suggestions for this round
  const { data: sugRows } = await sb.from("firm_decisions").select("student_id, extra").eq("round_id", round.id).in("student_id", teammates.map(t => t.id));
  const suggestions = (sugRows ?? []).filter(r => r.extra?.suggestion != null && r.student_id !== minId).map(r => ({ name: teammates.find(t => t.id === r.student_id)?.display_name ?? "?", v: r.extra.suggestion }));
  const p = team.params;
  const exposureWord = p.exposure >= 0.2 ? "High" : p.exposure >= 0.12 ? "Above average" : p.exposure >= 0.08 ? "Average" : "Low";
  const trapWord = (p.techMult ?? 1) < 1 ? "Ghost traps cost less than the city average here." : (p.techMult ?? 1) > 1 ? "Ghost traps cost more than the city average here." : "Ghost traps cost about the city average here.";

  const decisionUI = {
    target: () => `<div class="slider"><div class="lab"><span>Borough containment target</span><span class="num" id="tv"></span></div><input type="range" id="target" min="0" max="100" value="${Math.round((payload.target ?? 0) * 100)}"></div><p class="small">The share of your borough's ghosts you are aiming to contain. A goal, not a rule: nothing forces your businesses to hit it. Policy tools with teeth arrive later in the semester.</p>`,
    rate: () => `<div class="slider"><div class="lab"><span>Discount rate</span><span class="num" id="rv"></span></div><input type="range" id="rate" min="2" max="7" step="0.5" value="${payload.discountRate != null ? payload.discountRate * 100 : 3}"></div><p class="small">Locked for the rest of the semester once the round closes. A low rate values future hauntings almost as much as today's. A high rate discounts them.</p>`,
    instrument: () => `<div class="seg" id="kind"><button data-k="tax" class="${payload.policy?.kind === "tax" ? "on" : ""}">Ghost tax</button><button data-k="cap" class="${payload.policy?.kind === "cap" ? "on" : ""}">Cap on ghosts</button><button data-k="standard" class="${payload.policy?.kind === "standard" ? "on" : ""}">Containment rule</button></div>
      <div id="tax" style="display:none"><div class="slider"><div class="lab"><span>Tax per ton</span><span class="num" id="tauv"></span></div><input type="range" id="tau" min="0" max="300" step="10" value="${payload.policy?.tau ?? 100}"></div></div>
      <div id="cap" style="display:none"><div class="slider"><div class="lab"><span>Cap, tons for the borough</span><span class="num" id="capv"></span></div><input type="range" id="capTons" min="0" max="${Math.round(teammates.length * 20 * (p.ghostMult ?? 1))}" step="1" value="${payload.policy?.capTons ?? Math.round(teammates.length * 20 * (p.ghostMult ?? 1) * 0.6)}"></div></div>
      <div id="standard" style="display:none"><div class="slider"><div class="lab"><span>Minimum containment, every business</span><span class="num" id="aminv"></span></div><input type="range" id="aMin" min="0" max="100" value="${Math.round((payload.policy?.aMin ?? 0.3) * 100)}"></div></div>`,
    budget: () => budgetUI(),
    vote: () => `<div class="slider"><div class="lab"><span>${esc(bcfg.voteLabel ?? "Your vote")}</span><span class="num" id="votev"></span></div><input type="range" id="vote" min="${bcfg.voteMin ?? 0}" max="${bcfg.voteMax ?? 300}" step="${bcfg.voteStep ?? 10}" value="${payload.vote ?? bcfg.voteMin ?? 0}"></div><p class="small">${esc(bcfg.voteText ?? "")}</p>`,
    yesno: () => `<div class="seg" id="yn"><button data-k="yes" class="${payload.choice === "yes" ? "on" : ""}">${esc(bcfg.yesLabel ?? "Yes")}</button><button data-k="no" class="${payload.choice === "no" ? "on" : ""}">${esc(bcfg.noLabel ?? "No")}</button></div><p class="small">${esc(bcfg.choiceText ?? "")}</p>`,
  };
  function budgetUI() {
    const b = payload.budget ?? {}; const rows = [["subsidy", "Trap subsidy", "Pays businesses per ton contained."], ["rd", "Trap R&D", "Lowers containment cost next round."], ["defense", "Haunting defense", "Reduces hauntings this round."], ["reserve", "Reserve", "Unspent."]];
    return `<div class="eyebrow">Borough budget · ${fmt(0.2 * p.income)} this round</div>` + rows.map(([k, l, t]) => `<div class="slider"><div class="lab"><span>${l} <span class="small">${t}</span></span><span class="num" id="${k}v">${Math.round((b[k] ?? (k === "reserve" ? 1 : 0)) * 100)}%</span></div><input type="range" class="bud" id="${k}" min="0" max="100" value="${Math.round((b[k] ?? (k === "reserve" ? 1 : 0)) * 100)}"></div>`).join("") + `<div class="small" id="budsum"></div>`;
  }
  const types = (bcfg.type ?? "target").split("+");
  shell("borough", `
    ${cfg.howto?.borough ? `<div class="howto-strip"><b>How to play this week.</b> ${cfg.howto.borough.split("\n").map(x => `<p>${esc(x)}</p>`).join("")}</div>` : ""}
    <div class="two"><div>
    <div class="hdr"><div><div class="eyebrow">Round ${round.number} · ${closesText(round)}</div><h2>${esc(team.name)}</h2><div class="small">Mayor this week: <b>${esc(minister?.display_name ?? "—")}</b>${nextMin ? ` · next: ${esc(nextMin.display_name)}` : ""}</div></div>${rank ? `<span class="pill haunt">${rank}${["th", "st", "nd", "rd"][rank % 10 > 3 || [11, 12, 13].includes(rank) ? 0 : rank % 10]} of 9</span>` : ""}</div>
    <div class="decision"><div class="eyebrow">This week's decision · ${iAmMinister ? "you are the mayor" : `${esc(minister?.display_name ?? "the mayor")} submits`}</div><h3>${esc(bcfg.title ?? "Set a containment target")}</h3>${bcfg.text ? `<p>${esc(bcfg.text)}</p>` : ""}
      <div class="prehdr">Expectations for next week</div>
      <div class="preview"><div class="stat ecto"><div class="eyebrow">Ghosts released</div><div class="num" id="bev">…</div></div><div class="stat pos"><div class="eyebrow" id="bl2">Revenue</div><div class="num" id="brv">…</div></div><div class="stat haunt"><div class="eyebrow">Haunting damages</div><div class="num" id="bhv">…</div></div></div>
      ${types.map(t => decisionUI[t]?.() ?? "").join("<div style='height:8px'></div>")}
      ${suggestions.length && iAmMinister ? `<div class="tally"><b>Suggestions from your team:</b> ${suggestions.map(x => `${esc(x.name)}: ${esc(String(x.v))}`).join(" · ")}</div>` : ""}
      ${closed ? `<p class="small">Round closed.</p>` : iAmMinister ? `<button class="btn" id="submit">Submit as mayor</button>` : `<button class="btn" disabled>Only ${esc(minister?.display_name ?? "the mayor")} can submit this week</button><button class="btn ghost" id="suggest">Send this to the mayor as your suggestion</button>`}
      ${!closed ? `<button class="btn ghost" id="draft">Save a draft for the team</button>` : ""}
      <div id="msg"></div>${bd ? `<p class="small">${bd.is_draft ? "Draft" : "Submitted"} ${new Date(bd.submitted_at).toLocaleString()}</p>` : ""}</div>
  </div><div>
    ${bcfg.chart ? `<div class="chart"><div id="bmac"></div><div class="cap">${esc(team.name)}'s marginal cost of containment against what one more ghost costs the whole city.</div></div>` : ""}
    ${drawer("Your businesses last week", lastFirms.length ? `<table><tr><th>Business</th><th>Contained</th><th>Profit</th><th>Note</th></tr>${lastFirms.map(f => `<tr><td>${esc(f.s?.firm_name ?? ((TRADES[f.data.type] ?? {}).trade ?? f.s?.display_name))}<div class="small">${esc(f.s?.display_name ?? "")}</div></td><td class="num">${Math.round(f.data.a * 100)}%</td><td class="num">${fmt(f.data.profit)}</td><td class="noteq">${esc(f.note ?? "—")}</td></tr>`).join("")}</table>` : `<p class="small">No results yet.</p>`, true)}
    ${cfg.briefing?.student ? drawer("From the Institute", `<div class="brief">${cfg.briefing.student.split("\n").map(x => `<p>${esc(x)}</p>`).join("")}</div>`, true) : ""}
    ${lastB ? drawer("Last week's results", `<dl class="kv"><dt>Ghosts</dt><dd>${Math.round(lastB.data.ghosts)} t</dd><dt>Hauntings</dt><dd>${fmt(lastB.data.hauntings)}</dd><dt>Welfare</dt><dd>${fmt(lastB.data.welfare)}</dd>${lastB.data.permitPrice != null ? `<dt>Permit price</dt><dd>${fmt(lastB.data.permitPrice)}/t</dd>` : ""}</dl>`) : ""}
    ${drawer(`${esc(team.name)}'s stats`, `<p class="small">${esc(p.blurb ?? "")}</p><dl class="kv"><dt>Income</dt><dd>${fmt(p.income)} a week.</dd><dt>Exposure</dt><dd>${exposureWord}. Hauntings cost ${esc(team.name)} about ${(p.exposure / 0.13).toFixed(1)}x the city average per point of Ether, relative to income.</dd><dt>Ghosts</dt><dd>${Math.round(20 * (p.ghostMult ?? 1))} t per business at full output (city average 20 t).</dd><dt>Traps</dt><dd>${trapWord}</dd></dl>`)}
    ${keyDrawer([["Ghost tax", "carbon tax"], ["Cap on ghosts", "cap and trade"], ["Containment rule", "performance standard"], ["Exposure", "damage sensitivity"]])}
  </div></div>`);

  let kind = payload.policy?.kind && payload.policy.kind !== "none" ? payload.policy.kind : "tax";
  const showKind = () => ["tax", "cap", "standard"].forEach(k => { const el = $("#" + k); if (el) el.style.display = k === kind ? "block" : "none"; });
  document.querySelectorAll("#kind button").forEach(b => b.onclick = () => { kind = b.dataset.k; document.querySelectorAll("#kind button").forEach(x => x.classList.toggle("on", x === b)); showKind(); upd(); });
  document.querySelectorAll("#yn button").forEach(b => b.onclick = () => { document.querySelectorAll("#yn button").forEach(x => x.classList.toggle("on", x === b)); upd(); });
  showKind();
  function collect() {
    const out = { ...payload };
    if (types.includes("instrument")) out.policy = kind === "tax" ? { kind, tau: +$("#tau").value } : kind === "cap" ? { kind, capTons: +$("#capTons").value } : { kind, aMin: +$("#aMin").value / 100 };
    if (types.includes("target")) out.target = +$("#target").value / 100;
    if (types.includes("rate")) out.discountRate = +$("#rate").value / 100;
    if (types.includes("vote")) out.vote = +$("#vote").value;
    if (types.includes("yesno")) out.choice = document.querySelector("#yn button.on")?.dataset.k ?? null;
    if (types.includes("budget")) { const b = {}; document.querySelectorAll(".bud").forEach(el => b[el.id] = +el.value / 100); out.budget = b; }
    return out;
  }
  function suggestionValue(pl) {
    if (types.includes("instrument")) return pl.policy.kind === "tax" ? `tax $${pl.policy.tau}` : pl.policy.kind === "cap" ? `cap ${pl.policy.capTons} t` : `rule ${Math.round(pl.policy.aMin * 100)}%`;
    if (types.includes("yesno")) return pl.choice ?? "—";
    if (types.includes("vote")) return `$${pl.vote}`;
    if (types.includes("rate")) return `${(pl.discountRate * 100).toFixed(1)}%`;
    if (types.includes("target")) return `${Math.round(pl.target * 100)}%`;
    return "see draft";
  }
  const upd = debounce(async () => {
    const pl = collect();
    if ($("#tv")) $("#tv").textContent = Math.round(pl.target * 100) + "%";
    if ($("#rv")) $("#rv").textContent = (pl.discountRate * 100).toFixed(1) + "% per year";
    if ($("#tauv")) $("#tauv").textContent = "$" + $("#tau").value;
    if ($("#capv")) $("#capv").textContent = $("#capTons").value + " t";
    if ($("#aminv")) $("#aminv").textContent = $("#aMin").value + "%";
    if ($("#votev")) $("#votev").textContent = (bcfg.votePrefix ?? "$") + $("#vote").value;
    document.querySelectorAll(".bud").forEach(el => $("#" + el.id + "v").textContent = el.value + "%");
    if ($("#budsum")) { const t = [...document.querySelectorAll(".bud")].reduce((t2, el) => t2 + +el.value, 0); $("#budsum").textContent = t === 100 ? "Adds to 100." : `Adds to ${t}. Must be 100.`; $("#budsum").style.color = t === 100 ? "var(--ok)" : "var(--ember)"; }
    // preview: a target projects "if your businesses hit this"
    if (types.includes("target") && !types.includes("instrument")) {
      const base = teammates.length * 20 * (p.ghostMult ?? 1);
      $("#bev").textContent = Math.round(base * (1 - pl.target)) + " t";
      $("#bl2").textContent = "Business profits";
    }
    const r = await callFn("preview", { roundId: round.id, kind: "borough", payload: pl });
    if (!r.ok) return;
    if (!(types.includes("target") && !types.includes("instrument"))) { $("#bev").textContent = Math.round(r.ghosts) + " t"; }
    $("#bhv").textContent = fmt(r.hauntings);
    if (r.permitPrice != null && pl.policy?.kind === "cap") { $("#bl2").textContent = "Permit price"; $("#brv").textContent = fmt(r.permitPrice) + "/t"; }
    else if (pl.policy?.kind === "tax") { $("#bl2").textContent = "Tax revenue"; $("#brv").textContent = fmt(r.taxRevenue); }
    else { $("#bl2").textContent = "Business profits"; $("#brv").textContent = fmt(r.profits); }
    if (bcfg.chart) $("#bmac").innerHTML = drawMAC({ borough: true, price: pl.policy?.kind === "tax" ? pl.policy.tau : null, md: 200, label: "your tax", techMult: p.techMult ?? 1, contained: r.contained / Math.max(1, r.contained + r.ghosts) });
  }, 120);
  document.querySelectorAll("input[type=range]").forEach(el => el.oninput = upd); upd();
  const save = async isDraft => {
    const pl = collect();
    if (types.includes("budget") && Math.round(Object.values(pl.budget).reduce((a, b) => a + b, 0) * 100) !== 100 && !isDraft) return $("#msg").innerHTML = `<div class="msg">Budget must add to 100.</div>`;
    const { error } = await sb.from("borough_decisions").upsert({ round_id: round.id, team_id: team.id, payload: pl, is_draft: isDraft, submitted_by: me.id, submitted_at: new Date().toISOString() });
    $("#msg").innerHTML = `<div class="msg ${error ? "" : "ok"}">${error ? esc(error.message) : isDraft ? "Draft saved for the team." : "Submitted for the borough."}</div>`;
  };
  $("#submit")?.addEventListener("click", () => save(false));
  $("#draft")?.addEventListener("click", () => save(true));
  $("#suggest")?.addEventListener("click", async () => {
    const v = suggestionValue(collect());
    const { data: mine2 } = await sb.from("firm_decisions").select("*").eq("round_id", round.id).eq("student_id", me.id).maybeSingle();
    const row = mine2 ? { ...mine2, extra: { ...(mine2.extra ?? {}), suggestion: v } } : { round_id: round.id, student_id: me.id, q: 100, a: 0, extra: { suggestion: v, suggestion_only: true } };
    const { error } = await sb.from("firm_decisions").upsert(row);
    $("#msg").innerHTML = `<div class="msg ${error ? "" : "ok"}">${error ? esc(error.message) : `Suggestion sent to the mayor: ${esc(v)}.`}</div>`;
  });
}

// ---------- public dashboard ----------
async function viewBoard() {
  const classId = cls?.id ?? await publicClassId();
  if (!classId) return shell("board", `<div class="card"><h2>No class found</h2></div>`);
  const { data: rounds } = await sb.from("rounds").select("*").eq("class_id", classId).eq("status", "resolved").order("number");
  const { data: teamsAll } = await sb.from("teams").select("*").eq("class_id", classId).order("name");
  if (!rounds?.length) return shell("board", `<div class="card"><h2>The city</h2><p>No rounds resolved yet. Come back after the first Monday.</p></div>`);
  const last = rounds[rounds.length - 1];
  const { data: ros } = await sb.from("round_outcomes").select("*").in("round_id", rounds.map(r => r.id));
  const { data: bos } = await sb.from("borough_outcomes").select("*").eq("round_id", last.id);
  const { data: bosPrev } = rounds.length > 1 ? await sb.from("borough_outcomes").select("*").eq("round_id", rounds[rounds.length - 2].id) : { data: [] };
  const roBy = Object.fromEntries((ros ?? []).map(r => [r.round_id, r]));
  const T = roBy[last.id].totals;
  const series = rounds.map(r => ({ n: r.number, ether: roBy[r.id].totals.ether }));
  const scores = T.scores ?? {};
  const prevScores = rounds.length > 1 ? roBy[rounds[rounds.length - 2].id].totals.scores ?? {} : {};
  const rankOf = sc => Object.entries(sc).sort((a, b) => b[1].score - a[1].score).map(x => x[0]);
  const order = rankOf(scores), prevOrder = rankOf(prevScores);
  const lb = order.map((id, i) => { const t = teamsAll.find(x => x.id === id); const pi = prevOrder.indexOf(id); return { name: t?.name ?? "?", score: scores[id].score, share: scores[id].containShare, delta: pi < 0 ? 0 : pi - i }; });
  const mapData = teamsAll.map(t => { const b = bos?.find(x => x.team_id === t.id)?.data; return { key: t.borough_key, name: t.name, haunt: b?.hauntings ?? 0, ghosts: b?.ghosts ?? 0, tax: b?.policy?.kind === "tax" ? b.policy.tau : b?.permitPrice ?? 0, contain: b ? b.contained / Math.max(1, b.baseTons) : 0 }; });
  const brief = last.config?.briefing?.student;
  shell("board", `<div class="hdr" style="align-items:center"><div><div class="eyebrow">The Institute · weekly reading</div><h2>Round ${last.number} results</h2></div></div>
    <div class="strip"><div class="kpi"><div class="eyebrow">The Ether</div><div class="num" style="color:var(--ecto-deep)">${T.ether.toFixed(2)}</div><div class="small">of 4.0 · danger line 2.0</div></div>
      <div class="kpi"><div class="eyebrow">Ghost concentration</div><div class="num">${Math.round(T.concentration).toLocaleString()} t</div><div class="small">+ ${Math.round(T.emitted).toLocaleString()} t this round</div></div>
      <div class="kpi"><div class="eyebrow">City hauntings</div><div class="num" style="color:var(--haunt)">${fmt(T.hauntings)}</div><div class="small">this round</div></div>
      <div class="kpi"><div class="eyebrow">Containment</div><div class="num">${Math.round(100 * T.contained / T.baseTons)}%</div><div class="small">of ghosts, city-wide</div></div></div>
    <div class="grid"><div class="panel"><h3>The Ether, round by round</h3><div class="sub">Green: what you all did. Dashed: if every borough contained at the city optimum.</div>${drawEther(series, T.coopEmissionsPerRound, T.emitted, 12)}<div class="legend"><span><i style="background:#6CC24A"></i>Actual</span><span><i style="background:#1B2233"></i>Cooperative path</span><span><i style="background:#E0713C"></i>Danger line</span></div></div>
      <div class="panel"><h3>The city</h3><div class="mapctl" id="mapctl"><button class="on" data-m="haunt">Hauntings</button><button data-m="tax">Price on ghosts</button><button data-m="ghosts">Ghosts</button><button data-m="contain">Containment</button></div><div id="map"></div><div class="legend" id="maplegend"></div></div></div>
    <div class="grid" style="margin-top:20px"><div class="panel lb"><h3>Boroughs</h3><div class="sub">Thick bar: discounted welfare. Thin green bar: share of your ghosts contained so far.</div>${drawLeaderboard(lb)}</div>
      <div class="panel"><h3>From the Institute</h3><div class="sub">Round ${last.number}</div><div class="brief">${(brief ?? roBy[last.id].summary_md ?? "").split("\n").filter(Boolean).map(x => `<p>${esc(x)}</p>`).join("")}</div>${T.breach ? `<p class="msg">The Breach happened this round.</p>` : ""}${keyDrawer()}</div></div>`);
  const paint = m => { const { svg, legend } = drawMap(mapData, m); $("#map").innerHTML = svg; $("#maplegend").innerHTML = legend; };
  document.querySelectorAll("#mapctl button").forEach(b => b.onclick = () => { document.querySelectorAll("#mapctl button").forEach(x => x.classList.toggle("on", x === b)); paint(b.dataset.m); });
  paint("haunt");
}

// ---------- instructor ----------
async function viewInstructor() {
  const { data: rounds } = await sb.from("rounds").select("*").eq("class_id", cls.id).order("number");
  const { data: students } = await sb.from("students").select("*").eq("class_id", cls.id).order("display_name");
  const { data: teams } = await sb.from("teams").select("*").eq("class_id", cls.id).order("name");
  const cur = rounds.find(r => r.status === "open") ?? rounds.find(r => r.status === "closed");
  const lastRes = [...rounds].reverse().find(r => r.status === "resolved");
  let lastRO = null; if (lastRes) ({ data: lastRO } = await sb.from("round_outcomes").select("*").eq("round_id", lastRes.id).maybeSingle());
  let subs = { firms: 0, boroughs: 0 };
  if (cur) { const { count: c1 } = await sb.from("firm_decisions").select("*", { count: "exact", head: true }).eq("round_id", cur.id); const { count: c2 } = await sb.from("borough_decisions").select("*", { count: "exact", head: true }).eq("round_id", cur.id).eq("is_draft", false); subs = { firms: c1 ?? 0, boroughs: c2 ?? 0 }; }
  const cfg = cur?.config ?? {};
  shell("instructor", `<div class="two"><div>
    <div class="hdr"><div><div class="eyebrow">${esc(cls.name)} · class code <b>${esc(cls.code)}</b></div><h2>This week</h2></div>${cur ? `<span class="pill ecto">Round ${cur.number} ${cur.status}</span>` : ""}</div>
    <div class="decision checklist"><div class="eyebrow">Monday checklist</div>
      ${cur ? `<div>Round ${cur.number} · ${cur.status} · ${closesText(cur)}</div><div>${subs.firms} of ${students.filter(s => s.team_id && s.active).length} businesses submitted · ${subs.boroughs} of ${teams.length} mayors</div>` : `<div>No round open.</div>`}
      ${lastRes ? `<div>Round ${lastRes.number} resolved ${new Date(lastRO?.resolved_at ?? Date.now()).toLocaleDateString()}</div>` : ""}
      ${cur && cur.status === "open" ? `<button class="btn sm ghost" id="close">Close round ${cur.number} now</button>` : ""}
      ${cur && cur.status === "closed" ? `<button class="btn sm" id="resolve">Resolve round ${cur.number}</button><button class="btn sm ghost" id="reopen">Re-open</button>` : ""}
      ${lastRes ? `<button class="btn sm ghost" id="undo">Undo resolve of round ${lastRes.number}</button>` : ""}
      <a class="btn sm ghost" href="#board" style="text-decoration:none">Open the dashboard</a>
      ${cur ? `<button class="btn sm ghost" id="resetround">Reset round ${cur.number}</button>` : ""}${lastRes && !cur ? `<button class="btn sm ghost" id="resetlast">Reset round ${lastRes.number}</button>` : ""}
      <button class="btn sm ghost" id="csv">Export participation (CSV)</button>
      <button class="btn sm ghost" id="csvall">Export all outcomes (CSV)</button>
      <div id="msg"></div></div>
    ${lastRO ? drawer(`Round ${lastRes.number} summary (generated)`, `<div class="brief">${(lastRO.summary_md ?? "").split("\n").filter(Boolean).map(x => `<p>${esc(x)}</p>`).join("")}</div>`, true) : ""}
    ${cfg.tips ? drawer("Teaching tips for this week", cfg.tips.split("\n").map(x => `<p>${esc(x)}</p>`).join(""), true) : ""}
    ${cfg.example ? drawer("Worked example to project", cfg.example.split("\n").map(x => `<p>${esc(x)}</p>`).join("")) : ""}
  </div><div>
    ${drawer("Rounds", `<table><tr><th>#</th><th>Title</th><th>Status</th><th>Closes</th><th></th></tr>${rounds.map(r => `<tr><td class="num">${r.number}</td><td>${esc(r.title)}</td><td>${r.status}</td><td class="small">${r.closes_at ? new Date(r.closes_at).toLocaleDateString() : ""}</td><td><button class="btn sm ghost edit" data-id="${r.id}">Edit</button></td></tr>`).join("")}</table><button class="btn sm ghost" id="newround">Add round</button>`, !cur)}
    ${drawer("Teams and students", `<p class="small">Assign a borough and business type per student. Mayor order rotates in the order shown. Unassigned students cannot play.</p><table><tr><th>Student</th><th>Borough</th><th>Type</th><th>Order</th><th>Active</th></tr>${students.map(s => `<tr data-id="${s.id}"><td>${esc(s.display_name)}</td><td><select class="field st" data-f="team_id" style="padding:4px 6px"><option value="">—</option>${teams.map(t => `<option value="${t.id}" ${s.team_id === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></td><td><input class="field st" data-f="firm_type" type="number" min="1" max="5" value="${s.firm_type ?? ""}" style="width:52px;padding:4px 6px"></td><td><input class="field st" data-f="minister_order" type="number" min="1" value="${s.minister_order ?? ""}" style="width:52px;padding:4px 6px"></td><td><input type="checkbox" class="st" data-f="active" ${s.active ? "checked" : ""}></td></tr>`).join("")}</table><button class="btn sm ghost" id="autoassign">Auto-assign types and order within teams</button>`)}
    ${drawer("Setup", `<p class="small">Boroughs and rounds are seeded once from <code>content/</code>. See SETUP.md. Class code: <b>${esc(cls.code)}</b>. Public dashboard: <code>${location.origin}${location.pathname}?class=${esc(cls.code)}#board</code></p>`)}
    ${drawer("Danger zone", `<p class="small">Reset the whole class: deletes every decision and outcome, puts round 0 back to open and all other rounds to draft. Students and teams stay. Use this after testing, before the term starts. There is no undo.</p><label class="lab">Type the class code to confirm</label><input class="field" id="rc_code"><label class="lab" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="rc_teams"> Also clear team assignments</label><button class="btn sm ghost" id="resetclass" style="border-color:var(--ember);color:var(--ember)">Reset whole class</button><div id="rcmsg"></div>`)}
  </div></div>`);
  $("#close")?.addEventListener("click", async () => { await sb.from("rounds").update({ status: "closed" }).eq("id", cur.id); route(); });
  const resetRound = async r => {
    if (!confirm(`Reset round ${r.number}? This deletes its decisions and outcomes and any later rounds' data, and reopens it. No undo.`)) return;
    if (prompt(`Type the round number to confirm`) !== String(r.number)) return;
    const { error } = await sb.rpc("reset_round", { p_round: r.id });
    $("#msg").innerHTML = `<div class="msg ${error ? "" : "ok"}">${error ? esc(error.message) : `Round ${r.number} reset and reopened.`}</div>`; if (!error) setTimeout(route, 600);
  };
  $("#resetround")?.addEventListener("click", () => resetRound(cur));
  $("#undo")?.addEventListener("click", () => resetRound(lastRes));
  $("#resetlast")?.addEventListener("click", () => resetRound(lastRes));
  $("#resetclass")?.addEventListener("click", async () => {
    if ($("#rc_code").value.trim() !== cls.code) return $("#rcmsg").innerHTML = `<div class="msg">Class code does not match.</div>`;
    if (!confirm("Reset the whole class? Every decision and outcome will be deleted. There is no undo.")) return;
    if (!confirm("Last chance. Reset everything?")) return;
    const { error } = await sb.rpc("reset_class", { p_class: cls.id, p_code: cls.code, p_clear_teams: $("#rc_teams").checked });
    $("#rcmsg").innerHTML = `<div class="msg ${error ? "" : "ok"}">${error ? esc(error.message) : "Class reset. Round 0 is open."}</div>`; if (!error) setTimeout(route, 800);
  });
  $("#reopen")?.addEventListener("click", async () => { await sb.from("rounds").update({ status: "open" }).eq("id", cur.id); route(); });
  $("#resolve")?.addEventListener("click", async () => { $("#msg").innerHTML = `<div class="msg ok">Resolving…</div>`; const r = await callFn("resolve_round", { roundId: cur.id }); $("#msg").innerHTML = `<div class="msg ${r.ok ? "ok" : ""}">${r.ok ? "Resolved. Next round opened if one exists." : esc(r.error)}</div>`; if (r.ok) setTimeout(route, 800); });
  $("#csv")?.addEventListener("click", async () => { const { data } = await sb.from("participation").select("*").eq("class_id", cls.id); dl("participation.csv", toCSV(data ?? [])); });
  $("#csvall")?.addEventListener("click", async () => {
    const { data: fo } = await sb.from("firm_outcomes").select("round_id,student_id,data"); const { data: bo } = await sb.from("borough_outcomes").select("round_id,team_id,data");
    const rn = Object.fromEntries(rounds.map(r => [r.id, r.number])); const sn = Object.fromEntries(students.map(s => [s.id, s.display_name])); const tn = Object.fromEntries(teams.map(t => [t.id, t.name]));
    dl("firm_outcomes.csv", toCSV((fo ?? []).map(x => ({ round: rn[x.round_id], student: sn[x.student_id], ...flat(x.data) }))));
    dl("borough_outcomes.csv", toCSV((bo ?? []).map(x => ({ round: rn[x.round_id], borough: tn[x.team_id], ...flat(x.data) }))));
  });
  document.querySelectorAll(".st").forEach(el => el.onchange = async () => { const id = el.closest("tr").dataset.id; const f = el.dataset.f; const v = el.type === "checkbox" ? el.checked : (el.value === "" ? null : (f === "team_id" ? el.value : +el.value)); await sb.from("students").update({ [f]: v }).eq("id", id); });
  $("#autoassign")?.addEventListener("click", async () => { for (const t of teams) { const members = students.filter(s => s.team_id === t.id && s.active); for (let i = 0; i < members.length; i++) await sb.from("students").update({ firm_type: (i % 5) + 1, minister_order: i + 1 }).eq("id", members[i].id); } route(); });
  document.querySelectorAll(".edit").forEach(b => b.onclick = () => editRound(rounds.find(r => r.id === b.dataset.id)));
  $("#newround")?.addEventListener("click", () => editRound({ class_id: cls.id, number: (rounds.at(-1)?.number ?? -1) + 1, title: "", status: "draft", config: {} }));
}
function editRound(r) {
  const c = r.config ?? {};
  shell("instructor", `<div class="card"><h2>${r.id ? "Edit" : "New"} round ${r.number}</h2>
    <label class="lab">Number</label><input class="field" id="rn" type="number" value="${r.number}">
    <label class="lab">Title</label><input class="field" id="rt" value="${esc(r.title)}">
    <label class="lab">Status</label><select class="field" id="rs">${["draft", "open", "closed", "resolved"].map(s => `<option ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
    <label class="lab">Opens</label><input class="field" id="ro" type="datetime-local" value="${r.opens_at ? toLocal(r.opens_at) : ""}">
    <label class="lab">Closes</label><input class="field" id="rc" type="datetime-local" value="${r.closes_at ? toLocal(r.closes_at) : ""}">
    <label class="lab">Config (JSON: firm, borough, briefing, howto, tips, example, events)</label><textarea class="field" id="rj" style="min-height:260px;font-family:var(--mono);font-size:12px">${esc(JSON.stringify(c, null, 2))}</textarea>
    <button class="btn" id="save">Save round</button><a class="btn ghost" href="#instructor" style="text-decoration:none;text-align:center">Back</a><div id="msg"></div></div>`);
  $("#save").onclick = async () => {
    let config; try { config = JSON.parse($("#rj").value); } catch (e) { return $("#msg").innerHTML = `<div class="msg">Config is not valid JSON.</div>`; }
    const row = { class_id: r.class_id ?? cls.id, number: +$("#rn").value, title: $("#rt").value, status: $("#rs").value, opens_at: $("#ro").value ? new Date($("#ro").value).toISOString() : null, closes_at: $("#rc").value ? new Date($("#rc").value).toISOString() : null, config };
    const { error } = r.id ? await sb.from("rounds").update(row).eq("id", r.id) : await sb.from("rounds").insert(row);
    if (error) $("#msg").innerHTML = `<div class="msg">${esc(error.message)}</div>`; else location.hash = "#instructor", route();
  };
}
const toLocal = iso => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const flat = o => Object.fromEntries(Object.entries(o).filter(([k, v]) => typeof v !== "object" || v === null));
const toCSV = rows => { if (!rows.length) return ""; const k = Object.keys(rows[0]); return [k.join(","), ...rows.map(r => k.map(x => JSON.stringify(r[x] ?? "")).join(","))].join("\n"); };
const dl = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); };

boot();
