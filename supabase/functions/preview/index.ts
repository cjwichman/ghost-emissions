// Server-side preview so the model never ships to the browser.
// POST { roundId, kind:'firm'|'borough', q, a, payload }
import { boroughOutcome, firmOutcome, etherFromConcentration, DEFAULT_PARAMS } from "../_shared/model.js";
import { adminClient, callerId, cors, json, loadRound, assemble } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const uid = await callerId(req);
    if (!uid) return json({ error: "not signed in" }, 401);
    const body = await req.json();
    const db = adminClient();
    const ctx = await loadRound(db, body.roundId);
    const me = ctx.students.find((s: any) => s.id === uid);
    if (!me) return json({ error: "not in this class" }, 403);
    const P = { ...DEFAULT_PARAMS, ...(ctx.cls.params ?? {}) };
    const teams = assemble(ctx);
    const team = teams.find((t: any) => t.id === me.team_id);
    if (!team) return json({ error: "no team yet" }, 400);
    const ts = ctx.state.teams?.[team.id] ?? {};
    const ether = etherFromConcentration(ctx.state.concentration ?? 0, P);

    if (body.kind === "firm") {
      // policy in effect this round = the borough's decision from LAST round (lag rule)
      const lastPolicy = ctx.prevBorough.find((b: any) => b.team_id === team.id)?.payload?.policy ?? { kind: "none" };
      const idx = team.firms.findIndex((f: any) => f.studentId === uid);
      const decisions = team.decisions.map((d: any, i: number) => i === idx ? { q: body.q, a: body.a } : d);
      const out = boroughOutcome({ params: team.params, ...ts }, team.firms, decisions, { policy: lastPolicy, budget: team.bDecision.budget }, ether, P);
      const mine = out.firms[idx];
      return json({ ok: true, policy: out.policy, firm: { q: mine.q, a: mine.a, ghosts: mine.ghosts, profit: mine.profit, taxBill: mine.taxBill, permitBill: mine.permitBill, contCost: mine.contCost, subsidyIn: mine.subsidyIn }, ether });
    }
    if (body.kind === "borough") {
      // borough preview assumes firms repeat their last-known choices and respond
      // to the proposed policy only under cap/standard (tax response is shown as expected best response)
      const payload = body.payload ?? {};
      const kind = payload.policy?.kind ?? "none";
      const decisions = team.decisions.map((d: any, i: number) => {
        if (kind === "tax") {
          const slope = P.firm.macSlope * team.firms[i].type * (ts.techMult ?? team.params.techMult ?? 1);
          return { q: d.q, a: Math.min(1, Number(payload.policy.tau ?? 0) / slope) };
        }
        return d;
      });
      const out = boroughOutcome({ params: team.params, ...ts }, team.firms, decisions, payload, ether, P);
      return json({ ok: true, ghosts: out.ghosts, contained: out.contained, taxRevenue: out.taxRevenue, profits: out.profits, hauntings: out.hauntings, welfare: out.welfare, permitPrice: out.permitPrice, protection: out.protection, subsidyPerTon: out.subsidyPerTon, ether });
    }
    return json({ error: "unknown kind" }, 400);
  } catch (e) { return json({ error: String(e) }, 500); }
});
