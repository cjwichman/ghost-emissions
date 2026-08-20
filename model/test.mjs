import assert from 'node:assert/strict';
import { DEFAULT_PARAMS as P, DEFAULT_BOROUGHS, firmOutcome, firmBestA, clearCap, boroughOutcome, resolveRound, discountedScore } from './model.js';

// firm: no policy, profit max at a=0
const f0 = firmOutcome({ q: 100, a: 0 }, { type: 3, techMult: 1, ghostMult: 1 }, { kind: 'none' });
assert.equal(Math.round(f0.profit), 3000); assert.equal(f0.ghosts, 20);
const f5 = firmOutcome({ q: 100, a: 0.5 }, { type: 3, techMult: 1, ghostMult: 1 }, { kind: 'none' });
assert.equal(Math.round(f5.profit), 3000 - 0.5 * 600 * 0.25 * 20); // 2250

// tax: best response a = tau/slope
assert.equal(firmBestA(3, 120, 1), 0.2);
const ft = firmOutcome({ q: 100, a: 0.2 }, { type: 3, techMult: 1, ghostMult: 1 }, { kind: 'tax', tau: 120 });
assert.equal(Math.round(ft.taxBill), 1920); assert.equal(Math.round(ft.profit), 3000 - 1920 - 0.5 * 600 * 0.04 * 20);
// tax: 20% beats 10% and 30% for type 3 at $120
const pr = a => firmOutcome({ q: 100, a }, { type: 3, techMult: 1, ghostMult: 1 }, { kind: 'tax', tau: 120 }).profit;
assert.ok(pr(0.2) > pr(0.1) && pr(0.2) > pr(0.3));

// cap clears: 5 firms, cap 60 of 100 t -> price where aggregate abatement = 40 t
const firms = [1, 2, 3, 4, 5].map(t => ({ type: t, techMult: 1, ghostMult: 1 }));
const m = clearCap(firms, firms.map(() => ({ q: 100 })), 60, 0);
const abated = firms.reduce((s, f) => s + 20 * Math.min(1, m.price / (200 * f.type)), 0);
assert.ok(Math.abs(abated - 40) < 0.01);
assert.ok(Math.abs(m.allocation.reduce((s, x) => s + x, 0) - 60) < 1e-6);

// borough under cap: total ghosts equals cap, permit bills net to zero
const team = { params: DEFAULT_BOROUGHS[8] };
const fs = firms.map((f, i) => ({ studentId: 's' + i, type: f.type }));
const bo = boroughOutcome(team, fs, fs.map(() => ({ q: 100 })), { policy: { kind: 'cap', capTons: 60 }, budget: { reserve: 1 } }, 1.0);
assert.ok(Math.abs(bo.ghosts - 60) < 0.01);
assert.ok(Math.abs(bo.firms.reduce((s, f) => s + f.permitBill, 0)) < 1e-6);

// standard: a floors at aMin
const bs = boroughOutcome(team, fs, fs.map(() => ({ q: 100, a: 0 })), { policy: { kind: 'standard', aMin: 0.3 }, budget: { reserve: 1 } }, 1.0);
assert.ok(bs.firms.every(f => f.a >= 0.3));

// budget: subsidy raises containment under a tax? (subsidy adds to price under cap only) ; R&D lowers techMult; defense lowers hauntings
const b1 = boroughOutcome(team, fs, fs.map(() => ({ q: 100, a: 0 })), { policy: { kind: 'none' }, budget: { rd: 0.5, reserve: 0.5 } }, 1.0);
assert.ok(b1.techMultNext < 1);
const b2 = boroughOutcome(team, fs, fs.map(() => ({ q: 100, a: 0 })), { policy: { kind: 'none' }, budget: { defense: 0.5, reserve: 0.5 } }, 1.0);
const b3 = boroughOutcome(team, fs, fs.map(() => ({ q: 100, a: 0 })), { policy: { kind: 'none' }, budget: { reserve: 1 } }, 1.0);
assert.ok(b2.hauntings < b3.hauntings);

// resolve: 9 teams free-riding, ether rises; events apply
const teams = DEFAULT_BOROUGHS.map(b => ({ id: b.key, params: b, firms: fs, decisions: fs.map(() => ({ q: 100, a: 0 })), bDecision: { policy: { kind: 'none' }, budget: { reserve: 1 } } }));
const r1 = resolveRound({ concentration: 0, teams: {} }, teams);
assert.ok(r1.totals.ether > 0.5 && r1.totals.emitted > 800);
const r2 = resolveRound(r1.nextState, teams, { damageRevision: { teamIds: ['marshend'], mult: 2 } });
assert.ok(r2.nextState.teams.marshend.exposureMult === 2);
const r3 = resolveRound(r2.nextState, teams, { costShock: { mult: 1.3 } });
assert.ok(r3.totals.emitted > 0);
const rB = resolveRound({ concentration: 12000, teams: {} }, teams, { breach: { roll: 0 } });
assert.ok(rB.totals.breach === true);
const rD = resolveRound(r1.nextState, teams, { dimmer: { offset: -0.3 } });
assert.ok(rD.totals.ether < resolveRound(r1.nextState, teams).totals.ether);

// discounting
assert.ok(discountedScore([100, 100], 0.07) < discountedScore([100, 100], 0.02));
console.log('all model tests passed');
