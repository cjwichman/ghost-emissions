// Calibration report: free-riding vs cooperative paths, marginal damage of a ton.
import { DEFAULT_PARAMS as P, DEFAULT_BOROUGHS, resolveRound, cooperativeEmissions, firmBestA, etherFromConcentration } from './model.js';

const teams = DEFAULT_BOROUGHS.map((b, i) => ({
  id: b.key, params: b,
  firms: P.firm.types.map((t, j) => ({ studentId: `${b.key}-${j}`, type: t })),
}));
function run(label, mkDecisions) {
  let state = { concentration: 0, teams: {} };
  const rows = [];
  for (let r = 1; r <= 12; r++) {
    const ts = teams.map(t => ({ ...t, ...mkDecisions(t) }));
    const out = resolveRound(state, ts);
    state = out.nextState;
    rows.push({ r, ether: out.totals.ether.toFixed(2), emitted: Math.round(out.totals.emitted), haunt: Math.round(out.totals.hauntings), welfare: Math.round(out.totals.welfare) });
  }
  console.log(label); console.table(rows);
  return rows;
}
const free = run('Free-riding (a=0 everywhere)', t => ({ decisions: t.firms.map(() => ({ q: 100, a: 0 })), bDecision: { policy: { kind: 'none' }, budget: { reserve: 1 } } }));
const coop = run('Cooperative ($200 tax everywhere)', t => ({ decisions: t.firms.map(f => ({ q: 100, a: firmBestA(f.type, 200, t.params.techMult) })), bDecision: { policy: { kind: 'tax', tau: 200 }, budget: { reserve: 1 } } }));
// marginal damage of one ton emitted at round 6 along cooperative path (undiscounted remaining rounds)
const A = DEFAULT_BOROUGHS.reduce((s, b) => s + b.exposure * b.income, 0);
const coopE = cooperativeEmissions(teams, 200);
let S = 0, md = 0;
for (let r = 1; r <= 12; r++) { S += coopE; if (r >= 6) md += 2 * etherFromConcentration(S) * P.world.etherPerTon * A; }
console.log('sum d*Y =', Math.round(A), ' coop emissions/round =', Math.round(coopE), ' MD of a ton at round 6 (undiscounted) = $', md.toFixed(0));
