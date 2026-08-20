// Shared helpers for edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "ghost" } });
}
export async function callerId(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data } = await anon.auth.getUser();
  return data.user?.id ?? null;
}

// Load everything needed to run the model for one round of one class.
export async function loadRound(db: any, roundId: string) {
  const { data: round } = await db.from("rounds").select("*").eq("id", roundId).single();
  if (!round) throw new Error("round not found");
  const { data: cls } = await db.from("classes").select("*").eq("id", round.class_id).single();
  const { data: teams } = await db.from("teams").select("*").eq("class_id", round.class_id).order("name");
  const { data: students } = await db.from("students").select("*").eq("class_id", round.class_id).eq("active", true);
  const { data: fds } = await db.from("firm_decisions").select("*").eq("round_id", roundId);
  const { data: bds } = await db.from("borough_decisions").select("*").eq("round_id", roundId).eq("is_draft", false);
  // previous resolved round gives the carried state
  const { data: prev } = await db.from("rounds").select("id, number").eq("class_id", round.class_id).lt("number", round.number).eq("status", "resolved").order("number", { ascending: false }).limit(1);
  let state = { concentration: 0, teams: {} };
  let prevFirm: any[] = [], prevBorough: any[] = [];
  if (prev && prev.length) {
    const { data: ro } = await db.from("round_outcomes").select("state_after").eq("round_id", prev[0].id).single();
    if (ro) state = ro.state_after;
    ({ data: prevFirm } = await db.from("firm_decisions").select("*").eq("round_id", prev[0].id));
    ({ data: prevBorough } = await db.from("borough_decisions").select("*").eq("round_id", prev[0].id).eq("is_draft", false));
  }
  return { round, cls, teams, students, fds: fds ?? [], bds: bds ?? [], state, prevFirm: prevFirm ?? [], prevBorough: prevBorough ?? [] };
}

// Assemble model inputs. Missing firm decisions default to last round's, then to {q:100,a:0}.
// Missing borough decisions default to last round's, then to no policy and full reserve.
export function assemble(ctx: any) {
  const { teams, students, fds, bds, prevFirm, prevBorough } = ctx;
  const fdBy = Object.fromEntries(fds.filter((d: any) => !(d.extra?.suggestion_only)).map((d: any) => [d.student_id, d]));
  const pfBy = Object.fromEntries(prevFirm.map((d: any) => [d.student_id, d]));
  const bdBy = Object.fromEntries(bds.map((d: any) => [d.team_id, d]));
  const pbBy = Object.fromEntries(prevBorough.map((d: any) => [d.team_id, d]));
  return teams.map((t: any) => {
    const firms = students.filter((s: any) => s.team_id === t.id).sort((a: any, b: any) => (a.minister_order ?? 0) - (b.minister_order ?? 0));
    const decisions = firms.map((s: any) => {
      const d = fdBy[s.id] ?? pfBy[s.id];
      return d ? { q: Number(d.q), a: Number(d.a), ...(d.extra ?? {}), defaulted: !fdBy[s.id] } : { q: 100, a: 0, defaulted: true };
    });
    const bd = bdBy[t.id]?.payload ?? pbBy[t.id]?.payload ?? { policy: { kind: "none" }, budget: { reserve: 1 } };
    return { id: t.id, name: t.name, params: t.params, discountRate: t.discount_rate, firms: firms.map((s: any) => ({ studentId: s.id, type: s.firm_type ?? 3, name: s.firm_name ?? s.display_name })), decisions, bDecision: bd, bDefaulted: !bdBy[t.id] };
  });
}
