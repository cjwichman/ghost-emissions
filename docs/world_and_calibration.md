# Ghost Emissions — world sheet and calibration note (draft v1)

Two parts. Part A is the one-page world sheet students read in week 1. Part B is the calibration note for the class 6 example and the game model.

---

## Part A. World sheet (student-facing)

### The world

One city, nine boroughs, one sky. Businesses make things people want. Making things releases ghost emissions. Ghosts accumulate in the air as ghost concentration, which nobody owns and nobody can clean up. As concentration rises, the Ether rises, and hauntings get worse everywhere. Hauntings cost money. Some boroughs are hit harder than others.

Nobody wants to stop making things. Everyone would like fewer hauntings. That is the whole problem.

### Vocabulary

| In the game | In the course |
|---|---|
| Ghost emissions | Greenhouse gas emissions |
| Ghost concentration | Atmospheric CO2 (cumulative stock) |
| The Ether | Global temperature |
| Hauntings | Climate damages |
| Containment unit | One unit of abatement (one ton of ghosts kept out of the air) |
| Trap technology | Abatement technology. Better traps mean cheaper containment |
| The Institute | The weekly briefing you get every Monday |
| The Inspector | A regulator with authority but not much information |
| The Breach | A tipping point |
| The Accord | A binding agreement across boroughs (a treaty) |
| The Council | The city-wide vote on the Accord (a COP) |

### How a week works

Monday: the Institute posts results and a briefing. During the week: every CEO runs their business (five minutes on your phone), and the borough mayor on duty sets your borough's policy after looking at what teammates' businesses did last week. Sunday night: everything closes. Policy set this week hits businesses next week.

### Roles

Each team is a borough. Each student is CEO of one business in that borough. Businesses differ in how much containment costs them. The mayor rotates each week and submits the borough's policy. Mayors are named on the leaderboard.

### Scores

Boroughs: discounted borough welfare (business profits plus government revenue minus hauntings and spending). Businesses: cumulative profit. Everyone: forecast accuracy. Participation credit for submitting. Rank is for glory.

### Boroughs (draft names, archetype in parentheses)

1. Harborline (rich waterfront, high exposure)
2. The Stacks (industrial borough, high emissions, cheapest containment)
3. Northgate (cold, resource-rich, low exposure, mild early gains)
4. Lumen Heights (small rich tech district, best trap R&D)
5. Old Exchange (rich downtown, low exposure, big financial businesses)
6. Fenwick Island (small island borough, tiny emissions, high exposure)
7. Coalbrook (fast-growing, high emissions, high exposure)
8. Marsh End (poor outer borough, worst hauntings)
9. Midtown Common (mid-income, average on everything)

Names are placeholders. Borough cards show every parameter. Nothing is hidden about a borough. Only other teams' current-week choices are hidden.

---

## Part B. Calibration note (instructor)

### Design goals

- Linear MAC per business, linear aggregate MD in the class 6 board version, so every result is a triangle.
- Optimal carbon tax = $200 per ton, matching Rennert et al. (2022) and the 2023 EPA SCC.
- Five business types, identical across boroughs. Borough heterogeneity only in income, exposure, and baseline emissions.
- Same numbers on the board and in the game.

### Businesses

- Five types, `c = 1, 2, 3, 4, 5`. Each business has baseline emissions of 20 tons per round.
- Marginal cost of containment for type `c` at abatement share `a`: `MAC = 200 * c * a` dollars per ton. Full containment costs `2000c` per round.
- Under a tax `tau`, business abates until `MAC = tau`: `a = tau / (200c)`, capped at 1.

At `tau = 200`: type 1 abates 100%, type 2 50%, type 3 33%, type 4 25%, type 5 20%. Aggregate abatement across five types = 45.7%. Reads well: cheap businesses go clean, expensive businesses mostly pay.

- Business profit per round: `p*q - k*q - containment cost - policy cost - R&D`. Output `q` is a slider (0 to 100), `e = 0.2` tons per unit so `q = 100` gives 20 tons. Set `p - k = 30` so unabated profit is 3000 per round and paying a $200 tax on 20 tons (4000) is not survivable, forcing real decisions.

### Boroughs

- Nine boroughs, 5 businesses each in the base configuration, so 45 businesses and 900 tons per round unabated. If team sizes differ, borough emissions are scaled per business so a 4-person borough is not automatically low-emitting.
- Borough card: income `Y`, exposure `d`, baseline emissions per business (default 20, higher for The Stacks and Coalbrook, lower for Fenwick Island and Marsh End), R&D bonus (Lumen Heights).

### Damages, board version (class 6)

- Flow model for the board: marginal damage per ton `MD = delta * E`, where `E` is global emissions this round.
- Choose `delta` so that at the cooperative optimum `MD = 200`. Optimal global emissions with the tax at 200 are `900 * (1 - 0.457) = 489` tons, so `delta = 200 / 489 = 0.409`. Rounding for the board: `delta = 0.4`, optimum tax 196, close enough, or keep 0.409 and quote 200.
- Board example 1 (aggregation): two businesses, `MAC_1 = 200a`, `MAC_2 = 400a`. Horizontal sum, then a tax of 200. Show who abates how much and the total cost.
- Board example 2 (optimum): aggregate MAC for the 45 businesses against `MD = 0.4E`. Optimum, optimal tax, and the deadweight loss triangle if everyone free-rides at zero abatement.

### Damages, game version

- Stock model. Ghost concentration `S_t = S_{t-1} + E_t`. Ether `T_t = T_0 + k*S_t`.
- Borough hauntings `D_it = d_i * T_t^2 * Y_i`.
- Calibrate `k`, `d_i`, `Y_i`, and the horizon so that (a) the marginal damage of one ton along the cooperative path is about $200, (b) universal free-riding ends with the Ether at 3.0, (c) the cooperative path ends at 2.0. Done numerically in the model module. Students see the Ether on a 0 to 4 gauge with a marker at 2, and concentration as a secondary number.

### Events (parameters to fix later)

- Damage revision (round 4): `d` doubles for two named boroughs.
- Cost shock (round 7): all `c` multiplied by a draw in {0.7, 1.3}.
- The Breach (round 10): probability of a permanent jump in `d` for all, rising with the Ether above 2.
- Inspector (a mid-semester event): a randomly chosen borough's containment subsidy is voided for one round.

### Checks before code

- Conbusiness the flow-vs-stock split is acceptable for teaching: board uses flow MD for tractability, game uses stock, both give a $200 optimum.
- Conbusiness profit numbers make the business mission non-trivial for types 3–5.
- Conbusiness the names.
