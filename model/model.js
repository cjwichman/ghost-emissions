// Ghost Emissions — core model.
// Pure functions, no I/O. Used by the Supabase edge functions (Deno) and by
// node tests. Every number students see comes from here.
//
// Units: ghosts in tons, money in dollars, the Ether on a 0-4 scale.
// One round is one week of class and represents one "period" for discounting.

export const DEFAULT_PARAMS = {
  // Firms
  firm: {
    ghostsPerUnit: 0.2,      // tons per unit of output
    maxOutput: 100,          // slider max
    margin: 30,              // dollars per unit before ghosts
    macSlope: 200,           // MAC = macSlope * type * a * techMult, dollars per ton
    types: [1, 2, 3, 4, 5],  // firm types, cycled through team members
  },
  // Global
  world: {
    etherBase: 0.5,          // Ether at zero concentration
    etherPerTon: 0.000231,   // Ether rise per ton of concentration
    dangerLine: 2.0,
    periodsPerRound: 1,      // discounting: beta = 1/(1+r)^periodsPerRound
  },
  // Borough policy levers
  policy: {
    taxMax: 300,
    budgetShare: 0.2,        // budget = budgetShare * income, per round
    rdLearning: 0.6,         // techMult_next = techMult * (1 - rdLearning * rdSpend / income)
    techFloor: 0.4,
    defenseRate: 2.0,        // protection g = min(defenseMax, defenseRate * spend / income)
    defenseMax: 0.6,
    subsidyPerTonCap: 200,
  },
  // Events
  events: {
    breachThreshold: 2.0,
    breachSlope: 0.4,        // P(breach) = min(0.8, breachSlope * (T - threshold))
    breachDamageMult: 1.5,
  },
};

// Nine boroughs. Archetype in the description. income is dollars per round.
// exposure d: hauntings = d * T^2 * income * (1 - g). Sum(d*income) ~ 41,000
// gives a marginal damage near $200 per ton along the cooperative path.
export const DEFAULT_BOROUGHS = [
  { key: 'harborline',  name: 'Harborline',     income: 55000, exposure: 0.16, ghostMult: 0.9, techMult: 1.0, blurb: 'Rich waterfront. Ghosts pour in off the harbor and flood basements. High exposure.' },
  { key: 'stacks',      name: 'The Stacks',     income: 40000, exposure: 0.08, ghostMult: 1.3, techMult: 0.85, blurb: 'Heavy industry. Releases the most ghosts. Containment is cheapest here.' },
  { key: 'northgate',   name: 'Northgate',      income: 45000, exposure: 0.05, ghostMult: 1.1, techMult: 1.0, blurb: 'Cold, resource-rich, low exposure. The Ether barely reaches this far north, for now.' },
  { key: 'lumen',       name: 'Lumen Heights',  income: 60000, exposure: 0.09, ghostMult: 0.7, techMult: 0.8, blurb: 'Small, rich, tech-heavy. Builds the best ghost traps in the city.' },
  { key: 'exchange',    name: 'Old Exchange',   income: 70000, exposure: 0.07, ghostMult: 0.8, techMult: 1.0, blurb: 'Downtown finance. Rich, low exposure, moderate ghosts.' },
  { key: 'fenwick',     name: 'Fenwick Island', income: 25000, exposure: 0.22, ghostMult: 0.5, techMult: 1.0, blurb: 'Small island borough. Releases almost nothing, and drowns in hauntings when the Ether rises.' },
  { key: 'coalbrook',   name: 'Coalbrook',      income: 40000, exposure: 0.15, ghostMult: 1.2, techMult: 1.0, blurb: 'Fast-growing and smoky. High emissions, high exposure.' },
  { key: 'marshend',    name: 'Marsh End',      income: 22000, exposure: 0.25, ghostMult: 0.8, techMult: 1.1, blurb: 'Poor outer borough on the marsh. Hauntings hit hardest here.' },
  { key: 'midtown',     name: 'Midtown Common', income: 42000, exposure: 0.10, ghostMult: 1.0, techMult: 1.0, blurb: 'Average on everything. The median borough.' },
];

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function etherFromConcentration(S, P = DEFAULT_PARAMS, offset = 0) {
  return P.world.etherBase + P.world.etherPerTon * S + offset;
}

// Marginal cost of containment for a firm at share a, dollars per ton.
export function firmMAC(type, a, techMult, P = DEFAULT_PARAMS) {
  return P.firm.macSlope * type * techMult * a;
}

// Cost-minimizing containment share for a firm facing a price per ton.
export function firmBestA(type, price, techMult, P = DEFAULT_PARAMS) {
  const slope = P.firm.macSlope * type * techMult;
  return slope > 0 ? clamp(price / slope, 0, 1) : 0;
}

/**
 * One firm, one round.
 * decision: { q, a }             a ignored under a cap (market sets it)
 * firm:     { type, techMult, ghostMult }
 * policy:   { kind: 'none'|'tax'|'cap'|'standard', tau, aMin, permitPrice, allocation, subsidy }
 */
export function firmOutcome(decision, firm, policy, P = DEFAULT_PARAMS) {
  const q = clamp(Number(decision.q ?? P.firm.maxOutput), 0, P.firm.maxOutput);
  const baseTons = P.firm.ghostsPerUnit * q * (firm.ghostMult ?? 1);
  const slope = P.firm.macSlope * firm.type * (firm.techMult ?? 1);
  let a = clamp(Number(decision.a ?? 0), 0, 1);
  const kind = policy?.kind ?? 'none';
  const subsidy = policy?.subsidy ?? 0;

  if (kind === 'cap') {
    a = firmBestA(firm.type, (policy.permitPrice ?? 0) + subsidy, firm.techMult ?? 1, P);
  } else if (kind === 'standard') {
    a = Math.max(a, clamp(policy.aMin ?? 0, 0, 1));
  }

  const ghosts = baseTons * (1 - a);
  const contained = baseTons * a;
  const contCost = 0.5 * slope * a * a * baseTons;      // integral of MAC over tons contained
  const revenue = P.firm.margin * q;
  let taxBill = 0, permitBill = 0, subsidyIn = subsidy * contained;
  if (kind === 'tax') taxBill = (policy.tau ?? 0) * ghosts;
  if (kind === 'cap') permitBill = (policy.permitPrice ?? 0) * (ghosts - (policy.allocation ?? 0));
  const profit = revenue - contCost - taxBill - permitBill + subsidyIn;
  return { q, a, baseTons, ghosts, contained, contCost, revenue, taxBill, permitBill, subsidyIn, profit, mac: slope * a };
}

// Uniform-price permit market within a borough. Firms have linear MACs, so
// aggregate abatement is linear in price. Returns price and per-firm allocation.
export function clearCap(firms, decisions, capTons, subsidy, P = DEFAULT_PARAMS) {
  const base = firms.map((f, i) => P.firm.ghostsPerUnit * clamp(Number(decisions[i]?.q ?? P.firm.maxOutput), 0, P.firm.maxOutput) * (f.ghostMult ?? 1));
  const totalBase = base.reduce((s, x) => s + x, 0);
  const need = totalBase - capTons;               // tons that must be contained
  if (need <= 0) return { price: 0, allocation: base.map(b => b), totalBase };
  // abatement(p) = sum_i base_i * min(1, (p+subsidy)/slope_i)
  const abate = p => firms.reduce((s, f, i) => s + base[i] * clamp((p + subsidy) / (P.firm.macSlope * f.type * (f.techMult ?? 1)), 0, 1), 0);
  let lo = 0, hi = P.firm.macSlope * 5 * 2;
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (abate(mid) < need) lo = mid; else hi = mid; }
  const price = (lo + hi) / 2;
  const alloc = base.map(b => capTons * b / totalBase);   // grandfathered by baseline share
  return { price, allocation: alloc, totalBase };
}

/**
 * Resolve one borough for one round.
 * team:      { params: borough card, techMult, exposureMult, discountRate }
 * firms:     [{ studentId, type }]
 * decisions: firm decisions aligned to firms
 * bDecision: { policy:{kind,tau,capTons,aMin}, budget:{subsidy,rd,defense,reserve} shares (sum 1) }
 * ether:     Ether reading used for hauntings this round
 */
export function boroughOutcome(team, firms, decisions, bDecision, ether, P = DEFAULT_PARAMS) {
  const card = team.params;
  const techMult = team.techMult ?? card.techMult ?? 1;
  const income = card.income;
  const budget = P.policy.budgetShare * income;
  const b = bDecision?.budget ?? { subsidy: 0, rd: 0, defense: 0, reserve: 1 };
  const spend = k => budget * clamp(Number(b[k] ?? 0), 0, 1);
  const baseTonsAll = firms.length * P.firm.ghostsPerUnit * P.firm.maxOutput * (card.ghostMult ?? 1);
  const subsidyPerTon = team.subsidyVoided ? 0 : clamp(spend('subsidy') / Math.max(1, baseTonsAll * 0.5), 0, P.policy.subsidyPerTonCap);
  const firmObjs = firms.map(f => ({ type: f.type, techMult, ghostMult: card.ghostMult ?? 1 }));

  const pol = bDecision?.policy ?? { kind: 'none' };
  let policy = { kind: pol.kind ?? 'none', tau: Number(pol.tau ?? 0), aMin: Number(pol.aMin ?? 0), subsidy: subsidyPerTon };
  let market = null;
  if (policy.kind === 'cap') {
    market = clearCap(firmObjs, decisions, Number(pol.capTons ?? baseTonsAll), subsidyPerTon, P);
    policy.permitPrice = market.price;
  }
  const firmResults = firmObjs.map((f, i) => {
    const p = { ...policy };
    if (market) p.allocation = market.allocation[i];
    return { studentId: firms[i].studentId, type: f.type, ...firmOutcome(decisions[i] ?? {}, f, p, P) };
  });
  const ghosts = firmResults.reduce((s, r) => s + r.ghosts, 0);
  const contained = firmResults.reduce((s, r) => s + r.contained, 0);
  const profits = firmResults.reduce((s, r) => s + r.profit, 0);
  const taxRevenue = firmResults.reduce((s, r) => s + r.taxBill, 0);
  const subsidyOut = firmResults.reduce((s, r) => s + r.subsidyIn, 0);
  const g = clamp(P.policy.defenseRate * spend('defense') / income, 0, P.policy.defenseMax);
  const exposure = card.exposure * (team.exposureMult ?? 1);
  const hauntings = exposure * ether * ether * income * (1 - g);
  const rd = spend('rd');
  const techMultNext = Math.max(P.policy.techFloor, techMult * (1 - P.policy.rdLearning * rd / income));
  const welfare = income + profits + taxRevenue - subsidyOut - rd - spend('defense') - hauntings;
  return {
    firms: firmResults, ghosts, contained, baseTons: firmResults.reduce((s, r) => s + r.baseTons, 0),
    profits, taxRevenue, subsidyOut, subsidyPerTon, rdSpend: rd, defenseSpend: spend('defense'), protection: g,
    hauntings, welfare, permitPrice: market?.price ?? null, techMultNext, policy,
  };
}

/**
 * Resolve a whole round.
 * state:  { concentration, teams: { [teamId]: {techMult, exposureMult, discountRate, subsidyVoided} } }
 * teams:  [{ id, params, firms:[{studentId,type}], decisions:[...], bDecision }]
 * events: { damageRevision:{teamIds,mult}, costShock:{mult}, breach:{roll}, inspector:{teamId} }
 * Ether used for hauntings is the reading AFTER this round's emissions.
 */
export function resolveRound(state, teams, events = {}, P = DEFAULT_PARAMS) {
  const stTeams = { ...(state.teams ?? {}) };
  // apply pre-round events
  if (events.damageRevision) for (const id of events.damageRevision.teamIds ?? []) {
    stTeams[id] = { ...(stTeams[id] ?? {}), exposureMult: (stTeams[id]?.exposureMult ?? 1) * (events.damageRevision.mult ?? 2) };
  }
  const shockMult = events.costShock?.mult ?? 1;
  const Pround = shockMult === 1 ? P : { ...P, firm: { ...P.firm, macSlope: P.firm.macSlope * shockMult } };

  // first pass: emissions (do not depend on Ether)
  const pre = teams.map(t => {
    const ts = { ...(stTeams[t.id] ?? {}), subsidyVoided: events.inspector?.teamId === t.id };
    return { t, ts, out: boroughOutcome({ params: t.params, ...ts }, t.firms, t.decisions, t.bDecision, 0, Pround) };
  });
  const emitted = pre.reduce((s, x) => s + x.out.ghosts, 0);
  const concentration = (state.concentration ?? 0) + emitted;
  // etherOffset: a temporary reduction (the Dimmer) that decays each round
  const etherOffset = (state.etherOffset ?? 0) + (events.dimmer?.offset ?? 0);
  const ether = etherFromConcentration(concentration, P, etherOffset);

  // breach draw
  let breach = false;
  if (events.breach) {
    const p = clamp(P.events.breachSlope * (ether - P.events.breachThreshold), 0, 0.8);
    breach = (events.breach.roll ?? 1) < p;
  }
  if (breach) for (const x of pre) x.ts.exposureMult = (x.ts.exposureMult ?? 1) * P.events.breachDamageMult;

  // second pass: hauntings and welfare at this round's Ether
  const results = pre.map(({ t, ts }) => {
    const out = boroughOutcome({ params: t.params, ...ts }, t.firms, t.decisions, t.bDecision, ether, Pround);
    stTeams[t.id] = { ...ts, techMult: out.techMultNext, subsidyVoided: false };
    return { teamId: t.id, ...out };
  });
  const totals = {
    emitted, concentration, ether, breach,
    hauntings: results.reduce((s, r) => s + r.hauntings, 0),
    contained: results.reduce((s, r) => s + r.contained, 0),
    baseTons: results.reduce((s, r) => s + r.baseTons, 0),
    welfare: results.reduce((s, r) => s + r.welfare, 0),
  };
  return { results, totals, nextState: { concentration, teams: stTeams, etherOffset: etherOffset * 0.5 } };
}

// Discounted cumulative welfare given per-round welfare and an annual rate.
export function discountedScore(welfares, r, P = DEFAULT_PARAMS) {
  const beta = 1 / Math.pow(1 + r, P.world.periodsPerRound);
  return welfares.reduce((s, w, t) => s + w * Math.pow(beta, t), 0);
}

// Cooperative benchmark: the city-wide price that equates aggregate MAC to a
// target price, used for the dashed reference path. Returns per-round emissions
// when every firm faces `price`.
export function cooperativeEmissions(teams, price, P = DEFAULT_PARAMS) {
  return teams.reduce((s, t) => s + t.firms.reduce((ss, f) => {
    const base = P.firm.ghostsPerUnit * P.firm.maxOutput * (t.params.ghostMult ?? 1);
    return ss + base * (1 - firmBestA(f.type, price, t.params.techMult ?? 1, P));
  }, 0), 0);
}
