// Instructor-only. Resolves a round: applies defaults, runs the model, writes
// outcomes and a deterministic summary, opens the next round.
// POST { roundId, events?: {damageRevision, costShock, breach:{roll?}, inspector} }
import { resolveRound, discountedScore, cooperativeEmissions, etherFromConcentration, DEFAULT_PARAMS } from "../_shared/model.js";
import { adminClient, callerId, cors, json, loadRound, assemble } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const uid = await callerId(req);
    if (!uid) return json({ error: "not signed in" }, 401);
    const { roundId, events: bodyEvents } = await req.json();
    const db = adminClient();
    const ctx = await loadRound(db, roundId);
    if (ctx.cls.instructor_id !== uid) return json({ error: "instructor only" }, 403);
    const P = { ...DEFAULT_PARAMS, ...(ctx.cls.params ?? {}) };
    const teams = assemble(ctx);

    // events: from the round config unless overridden in the request
    const events = { ...(ctx.round.config?.events ?? {}), ...(bodyEvents ?? {}) };
    if (events.breach && events.breach.roll == null) events.breach = { roll: Math.random() };

    // discount rate decision, if this round asks for one
    for (const t of teams) if (t.bDecision?.discountRate != null) {
      await db.from("teams").update({ discount_rate: Number(t.bDecision.discountRate) }).eq("id", t.id);
      t.discountRate = Number(t.bDecision.discountRate);
    }

    // round mechanics driven by yes/no decisions
    const mech = ctx.round.config?.mechanic;
    if (mech === "dimmer") {
      const yes = teams.filter((t: any) => t.bDecision?.choice === "yes").length;
      if (yes >= (ctx.round.config?.dimmerMin ?? 4)) events.dimmer = { offset: -(ctx.round.config?.dimmerOffset ?? 0.3), funders: yes };
    }
    if (mech === "accord") {
      const tau = ctx.round.config?.accordTau ?? 200;
      for (const t of teams) if (t.bDecision?.choice === "yes") t.bDecision = { ...t.bDecision, policy: { kind: "tax", tau } };
    }
    const out = resolveRound(ctx.state, teams, events, P);

    // write outcomes
    await db.from("round_outcomes").upsert({ round_id: roundId, totals: { ...out.totals, events, roundNumber: ctx.round.number }, state_after: out.nextState });
    for (const r of out.results) {
      const { firms, ...b } = r;
      const t = teams.find((x: any) => x.id === r.teamId);
      await db.from("borough_outcomes").upsert({ round_id: roundId, team_id: r.teamId, data: { ...b, name: t.name, defaulted: t.bDefaulted, decision: t.bDecision } });
      for (let i = 0; i < firms.length; i++) {
        await db.from("firm_outcomes").upsert({ round_id: roundId, student_id: firms[i].studentId, data: { ...firms[i], defaulted: !!t.decisions[i]?.defaulted } });
      }
    }

    // scores across all resolved rounds
    const { data: rounds } = await db.from("rounds").select("id, number").eq("class_id", ctx.round.class_id).eq("status", "resolved").order("number");
    const allIds = [...(rounds ?? []).map((r: any) => r.id), roundId];
    const { data: allB } = await db.from("borough_outcomes").select("round_id, team_id, data").in("round_id", allIds);
    const scores: any = {};
    for (const t of teams) {
      const ws = allIds.map(id => allB?.find((b: any) => b.round_id === id && b.team_id === t.id)?.data?.welfare ?? 0);
      const contained = allB?.filter((b: any) => b.team_id === t.id).reduce((s: number, b: any) => s + (b.data.contained ?? 0), 0) ?? 0;
      const base = allB?.filter((b: any) => b.team_id === t.id).reduce((s: number, b: any) => s + (b.data.baseTons ?? 0), 0) ?? 1;
      scores[t.id] = { score: discountedScore(ws, t.discountRate ?? 0.03, P), containShare: contained / base, welfareUndiscounted: ws.reduce((s: number, x: number) => s + x, 0) };
    }
    // deterministic summary
    const ranked = teams.map((t: any) => ({ t, s: scores[t.id] })).sort((a: any, b: any) => b.s.score - a.s.score);
    const r0 = out.results;
    const lines = [
      `Ether ${out.totals.ether.toFixed(2)}. Concentration ${Math.round(out.totals.concentration)} t (+${Math.round(out.totals.emitted)} t). City hauntings $${Math.round(out.totals.hauntings).toLocaleString()}. Containment ${(100 * out.totals.contained / out.totals.baseTons).toFixed(0)}% of ghosts.`,
      `Leader: ${ranked[0].t.name}. Last: ${ranked[ranked.length - 1].t.name}. Most ghosts: ${[...r0].sort((a, b) => b.ghosts - a.ghosts)[0] && teams.find((t: any) => t.id === [...r0].sort((a, b) => b.ghosts - a.ghosts)[0].teamId).name}. Highest containment share: ${[...r0].sort((a, b) => (b.contained / b.baseTons) - (a.contained / a.baseTons))[0] && teams.find((t: any) => t.id === [...r0].sort((a, b) => (b.contained / b.baseTons) - (a.contained / a.baseTons))[0].teamId).name}.`,
      `Firms: ${r0.reduce((s, r) => s + r.firms.filter(f => f.a === 0).length, 0)} of ${r0.reduce((s, r) => s + r.firms.length, 0)} chose zero containment. ${r0.reduce((s, r) => s + r.firms.filter(f => (f as any).defaulted).length, 0)} firm decisions defaulted. ${teams.filter((t: any) => t.bDefaulted).length} borough decisions defaulted.`,
      out.totals.breach ? `The Breach happened this round. Exposure up ${((P.events.breachDamageMult - 1) * 100).toFixed(0)}% everywhere.` : "",
      events.costShock ? `Cost shock applied: containment costs x${events.costShock.mult}.` : "",
      events.damageRevision ? `Damage revision applied to ${events.damageRevision.teamIds?.length ?? 0} boroughs.` : "",
    ].filter(Boolean);
    const coopE = cooperativeEmissions(teams, 200, P);
    await db.from("round_outcomes").update({ summary_md: lines.join("\n\n"), totals: { ...out.totals, events, roundNumber: ctx.round.number, scores, coopEmissionsPerRound: coopE } }).eq("round_id", roundId);
    await db.from("rounds").update({ status: "resolved" }).eq("id", roundId);
    // open next round if it exists and is not draft-locked
    const { data: next } = await db.from("rounds").select("id,status").eq("class_id", ctx.round.class_id).eq("number", ctx.round.number + 1).maybeSingle();
    if (next && next.status === "draft") await db.from("rounds").update({ status: "open" }).eq("id", next.id);
    return json({ ok: true, totals: out.totals, summary: lines });
  } catch (e) { return json({ error: String(e) }, 500); }
});
