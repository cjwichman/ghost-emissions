# ECON 4210 Fall 2026 — Climate Manager game (draft spec, v4: option C)

Status: draft for instructor review, Aug 17 2026. No code yet. Round-to-class mapping is loose. Course schedule is still moving.

## One paragraph

Nine teams of five. Each team runs a country. Each student runs one business inside their team's country. Every week each team submits one policy decision through a rotating mayor, and each student completes a short business mission. Policies set this week hit businesses next week. Business emissions add up to national emissions, national emissions add up to global temperature, and temperature drives damages for every country. Two leaderboards, one for countries and one for businesses, plus an individual forecast board. Everything due Sunday night. Results and a briefing every Monday in class.

## Roles and cadence

- Teams of 5, 9 countries. Country parameters public.
- Mayor rotates each round in a fixed order. The mayor submits the country decision. Named on the leaderboard for that round.
- Every student is a CEO of one business all semester. Businesses differ in abatement cost within a country.
- Weekly cycle: Monday class shows last round's results and the new briefing. Round opens Monday afternoon, closes Sunday 11:59 PM. Businesses and mayors act independently within the week, any order.
- Lag rule: policy chosen in round `t` applies to businesses in round `t+1`. This removes any within-week sequencing.
- Missing country submission: repeat last round. Missing business submission: business follows a default rule (last round's choices), no participation credit.

## Model

Country `i`, business `j` in `i`, round `t`.

Business side
- Business output `q_jt`, chosen. Revenue `p * q_jt`, price `p` fixed and common.
- Baseline emissions `e_j * q_jt`, `e_j` differs by business.
- Abatement share `a_jt` chosen. Business emissions `E_jt = e_j * q_jt * (1 - a_jt)`.
- Abatement cost `(c_j / 2) * a_jt^2 * e_j * q_jt`, `c_j` differs by business. This is the heterogeneous MAC.
- Policy costs from country `i`'s previous-round policy: tax `tau_i * E_jt`, or permits (allocation `Q_ij`, buy or sell at market price `pi`), or standard (`a_jt >= a_min`).
- Optional levers, added over the semester: R&D `R_jt` lowering `c_j` next round, relocation (move to another country and take that country's policy), lobbying (a small payment that shifts the team's treaty vote weight, or a note to the mayor).
- Business profit `pi_jt = p * q_jt - production cost - abatement cost - policy cost - R_jt`. Individual score is cumulative profit.

Country side
- National emissions `E_it = sum_j E_jt`.
- Global stock `S_t = S_{t-1} + sum_i E_it`. Temperature `T_t = T_0 + k * S_t`.
- Damages `D_it = d_i * T_t^2 * Y_i * (1 - g_it)`, `g` adaptation protection.
- Adaptation cost `(h / 2) * g_it^2 * Y_i`.
- Public budget `B_i` each round, allocated by the mayor across abatement subsidy, R&D grants, adaptation, and (later) treaty contributions or geoengineering. Sliders that sum to 100.
- National welfare `W_it = sum_j pi_jt + tax revenue + permit revenue - D_it - A_it - budget spend`. Team score is discounted cumulative `W` at the team's chosen `r`.
- Events: damage revision, abatement cost shock, tipping-point draw, geoengineering side effect.

Calibrate to the class 6 example economy: same demand and cost numbers so lecture graphs and game graphs match. Full free-riding path lands near 3 degrees, cooperative path near 2.

## What each screen shows

Business mission page (individual, phone-first)
- Header: business name, country, this week's policy in one line ("Your country has a carbon tax of $40/ton").
- Two or three sliders: output, abatement, plus this week's third lever if any.
- Live preview: this round's profit, emissions, and a MAC chart with the tax line or permit price and your chosen point.
- Optional one-line note to the mayor.
- Submit.

Country page (team, mayor submits)
- Header: country, current mayor, deadline, round title.
- Team table: each teammate's business, last round's abatement, emissions, profit, and note.
- One policy control (tax level, cap, standard, or a vote) and the budget sliders.
- Live preview: national emissions, cost, expected damages, MC/MD chart with your position marked.
- Submit as mayor.

Public dashboard (shown Monday, also live on the site)
1. Global temperature path with the cooperative-optimum path dashed.
2. Country leaderboard: horizontal bars by discounted welfare, thin second bar for contribution to global welfare, rank-change arrows.
3. This week's decisions: small-multiples grid, one tile per country, chosen policy vs. their optimum.
Second tab: business leaderboard (top 10 and by country), forecast leaderboard.
Header strip: temperature, cumulative emissions, round number.

Weekly briefing (posted Monday)
- Two paragraphs of news (what happened last round, one event or twist).
- One paragraph on what this round is testing, written for the students, no answers.
- Separate short version for businesses.

## Round outline (12 scored rounds, order adjustable)

| Round | Course content | Country decision | Business mission | Learning target |
|---|---|---|---|---|
| 0 | Externalities I | Practice: budget sliders | Practice: output and abatement, no policy | Interface |
| 1 | Commons, bargaining | Set a national abatement target | Choose output and abatement, no policy | Private vs social optimum |
| 2 | Toolkit, benefit-cost | Revise target with MD overlaid | Same, MAC chart introduced | Deadweight loss of free-riding |
| 3 | Discounting | Choose `r`, locked | Light mission: none or forecast only | `r` and the SCC |
| 4 | Damage functions | Event: damage revision for two regions. Budget reallocation | Output response to news | Damage uncertainty, exposure |
| 5 | SCC, equity | Report implied SCC, vote on global SCC | Forecast next round's tax given the SCC vote | Aggregation, whose SCC |
| 6 | Instruments I | Choose tax or cap | First mission under policy: abate or pay | Tax and cap equivalence |
| 7 | Instruments II, uncertainty | Keep instrument, cost shock drawn after | Respond to shock, permits tradable | Prices vs quantities |
| 8 | Incidence, rebound | Revenue recycling choice | Rebound: efficiency investment raises output | Distribution, rebound |
| 9 | Innovation | R&D grants, share or hoard | Business R&D, spillovers | Learning curves, spillovers |
| 10 | Adaptation, tipping points | Adaptation spend, tipping draw after | Relocation option opens | Adaptation vs mitigation, fat tails |
| 11 | Geoengineering | Fund geoengineering or not | Lobby the mayor | Free-riding, moral hazard |
| 12 | Cooperation | In-class COP: treaty vote, climate club with border adjustment | Final round, leakage visible | Enforcement, what the path added up to |

Adjust the order to the final schedule. Rounds 3 and 5 are deliberately light. Rounds 4, 7, 10 contain events. Round 12 is in class.

## Grading (if used)

- 1 participation point per submitted business mission, capped at 10 of the 20 participation points.
- Mayors get the same point for submitting when it's their turn.
- Rank not graded. Small prizes for top country, top business, top forecaster.

## Technical

- Front end: `game/` folder in the `econ4210` GitHub Pages repo. Vanilla JS, one charting library, one shared model module used by both preview and resolver.
- Backend: Supabase. Tables: `teams`, `students` (id, team_id, business params, minister_order), `rounds`, `country_decisions`, `business_decisions`, `outcomes`, `forecasts`, `notes`, `treaties`. Row-level security by student code and team code.
- Auth: personal code per student, stored locally. Team page visible to all team members, submit button only for the current mayor.
- Resolver: one Edge Function `resolve_round(round_id)` called from an instructor page. Applies defaults for missing submissions, computes businesses then countries then global, writes outcomes, closes the round, opens the next.
- Instructor page: round open/close, event triggers, briefing text, export to CSV.
- Permit market (round 7 on): simplest version is a uniform-price call market cleared at resolution. No live trading.

## Build order

1. Model module and calibration to the class 6 economy. Check with you before writing round text.
2. Static mockups of the three screens with fake data.
3. Supabase schema and resolver.
4. Front end wired up. Practice round test with a few colleagues.
5. Twelve briefings written before Sep 1.

## Open missionions

1. Business heterogeneity: two types (low and high `c`) or a continuous draw?
2. Relocation and lobbying: keep both, or drop one to stay simple?
3. Permit market across countries or within only?
4. Should the mayor see teammates' current-round business submissions, or only last round's? (Last round's is simpler and consistent with the lag rule.)
5. Any of the twelve rounds you already want to cut or merge?
