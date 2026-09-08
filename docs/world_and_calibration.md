# Ghost Emissions — world sheet and calibration note

Two parts. Part A is the one-page world sheet students read in week 1. Part B is the calibration note for the class 6 board example and the game model. Every number in Part B comes from `model/model.js`. Run `npm run calibrate` to regenerate the paths.

---

## Part A. World sheet (student-facing)

### The world

One city, nine boroughs, one atmosphere above all of them. Businesses make things. Making things releases ghost emissions, which accumulate in the air as ghost concentration. No borough owns the concentration and no borough can clear it. As concentration rises the Ether rises, and slime damage costs every borough money. Some boroughs are hit harder than others.

Containing ghosts costs the business that contains them. The damage avoided lands on all nine boroughs. That gap is the problem the game is about.

### Vocabulary

This table is the canonical glossary. `web/js/ui.js` repeats it as `KEY_ROWS`, so change both together.

| In the game | In the course |
|---|---|
| Ghost emissions | Greenhouse gas emissions |
| Ghost concentration | The stock of GHGs in the atmosphere |
| The Ether | Global temperature |
| Slime damage | Climate damages |
| Containment | Abatement |
| Trap technology | Abatement technology. Better traps mean cheaper containment |
| The Institute | The weekly briefing you get every Monday |
| The Inspector | A regulator with authority but not much information |
| The Breach | A tipping point |
| The Dimmer | Geoengineering |
| The Accord | A treaty across boroughs |
| The Council | The in-class vote on the Accord, a COP |

### How a week works

Monday: the Institute posts results and a briefing. During the week: every student runs their business, which takes about five minutes on a phone, and the mayor on duty sets the borough's decision after seeing what teammates' businesses did last week. Sunday night: everything closes. A policy set this week binds businesses next week.

### Roles

Each team is a borough. Each student runs one business in that borough. Businesses differ in how much containment costs them. The mayor rotates each week and submits the borough's decision. Mayors are named on the leaderboard.

### Scores

Boroughs are ranked by discounted borough welfare: income plus business profits plus tax revenue, minus slime damage and minus what the borough spends. Each borough discounts at the rate it chose in round 3. Rank is for glory and is never graded. Credit comes from submitting.

### Boroughs

| Borough | Archetype |
|---|---|
| Harborline | Rich waterfront, high exposure |
| The Stacks | Heavy industry, most ghosts, cheapest containment |
| Northgate | Cold, resource-rich, low exposure |
| Lumen Heights | Small rich tech district, best trap technology |
| Old Exchange | Rich downtown finance, low exposure |
| Fenwick Island | Small island, tiny emissions, badly exposed |
| Coalbrook | Fast-growing, high emissions, high exposure |
| Marsh End | Poor outer borough, worst slime damage |
| Midtown Common | Average on everything, the median borough |

Borough cards show every parameter, so nothing about a borough's situation is hidden. What the other boroughs chose this week is hidden until Monday.

---

## Part B. Calibration note (instructor)

### Design goals

- Linear MAC per business, so every result on the board is a triangle.
- An optimal price on ghosts of $200 per ton, matching Rennert et al. (2022) and the 2023 EPA SCC.
- Five business types, identical across boroughs. Borough heterogeneity only in income, exposure, baseline emissions, and trap technology.
- The same numbers on the board and in the game.
- No corner solutions at the optimal price. Every business faces an interior choice on both margins.

### Businesses

Type `c` runs from 1 to 5. Output `q` is a slider from 0 to 100.

- Revenue is `150q - 0.75q^2`. Marginal revenue is `150 - 1.5q`, which reaches zero at `q = 100`. With no price on ghosts a business makes as much as it can, earns $7,500, and releases 20 tons in a borough with a ghost multiplier of 1.
- Emissions before containment are `0.2q` tons per round, scaled by the borough's ghost multiplier.
- Marginal cost of containment is `MAC = 200 * c * m * a` dollars per ton, where `m` is the borough's trap multiplier and `a` is the containment share. Total containment cost is the area under that line.
- Facing a price `p` per ton, a business contains until `MAC = p`, so `a* = p / (200cm)`, capped at 1. It then cuts output until marginal revenue equals marginal cost, so `q* = (150 - u) / 1.5`, where `u` is the per-unit containment cost plus the price paid on what is still released.

At `p = 200`: type 1 contains 100%, type 2 50%, type 3 33%, type 4 25%, type 5 20%. Weighted across the city, containment is about 48% of ghosts. Output falls a further 15 to 25 percent depending on type. Cheap businesses go clean, expensive businesses mostly pay and shrink a little.

The concave revenue term is what keeps the game honest. Under linear revenue a $200 price exceeds the gross margin on a ton, so types 2 through 5 earn negative profit at full output and shut down entirely. With `150q - 0.75q^2` every business stays profitable at the optimum and both margins stay interior, which is the point of the exercise.

### Boroughs

Nine boroughs, five businesses each in the base configuration, so 45 businesses and 830 tons per round when nobody contains. Borough cards carry income `Y`, exposure `d`, a ghost multiplier, and a trap multiplier. A borough's budget each round is 20% of income.

### Damages, board version (class 6)

- Flow model for the board: marginal damage per ton is `MD = delta * E`, where `E` is city emissions this round.
- Choose `delta` so that `MD = 200` at the cooperative optimum. Cooperative emissions are 346 tons per round, so `delta = 200 / 346 = 0.578`. Round to `0.58` for the board.
- Board example 1 (aggregation): two businesses, `MAC_1 = 200a` and `MAC_2 = 400a`. Horizontal sum, then a price of $200. Show who contains how much and what it costs.
- Board example 2 (optimum): aggregate MAC for the 45 businesses against `MD = 0.58E`. Find the optimum, the optimal price, and the deadweight loss triangle if everyone free-rides.

### Damages, game version

- Stock model. Ghost concentration is `S_t = S_{t-1} + E_t`. The Ether is `T_t = 0.5 + 0.000231 * S_t`.
- Borough slime damage is `D_it = d_i * T_t^2 * Y_i * (1 - g_it)`, where `g` is the protection bought with slime defense.
- Borough welfare is `Y + profits + tax revenue - subsidies paid - R&D - defense - slime damage`. Score is discounted cumulative welfare at the borough's own rate.
- The sum of `d_i * Y_i` across boroughs is 51,015. The marginal damage of one ton emitted in round 6, summed undiscounted over the rest of the semester along the cooperative path, is $201. The price and the damage are a fixed point at $200, which is what makes $200 the right answer rather than an assumption.

### The two paths

| | Emissions per round | Ether at round 12 | Cumulative welfare |
|---|---|---|---|
| Everyone free-rides | 830 t | 2.80 | $6.70m |
| Everyone prices ghosts at $200 | 346 t | 1.46 | $7.62m |

Cooperation is worth about $0.92m over twelve rounds. The gap between the two Ether paths is the headline chart on the Monday dashboard.

### Levers and events

| Lever | Parameter | Effect |
|---|---|---|
| Trap R&D | `rdLearning` 0.6, floor 0.4 | The whole budget cuts containment cost 12% from next round on, permanently. Half the budget cuts it 6%. |
| Slime defense | `defenseRate` 2.0, cap 0.4 | Half the budget cuts this round's slime damage 20%. The whole budget cuts it 40%, the maximum. |
| Containment subsidy | cap $200 per ton | Paid per ton contained, funded from the budget. |
| Damage revision (round 4) | `mult` 2 | Exposure doubles for two named boroughs, permanently. Set the two team ids in the round config. |
| Cost shock (round 7) | `mult` 1.3 | All MACs rise 30% after decisions close. A tax lets ghosts rise, a cap lets the permit price rise. |
| The Breach (round 10) | `P = min(0.8, 0.4(T - 2))` | If drawn, exposure rises 50% everywhere, permanently. |
| The Dimmer (round 11) | offset -0.3 if four or more boroughs fund it | Lowers the Ether next round, then decays by half each round after. |
| The Accord (round 12) | tax $200 | Members adopt a common price. Decided out loud in the Council. |
| The Inspector | voids one borough's subsidy for one round | Implemented but not scheduled. Add `events.inspector.teamId` to any round config to fire it. |

### Known limits

- Output sits at the corner of 100 in rounds 0 through 5, because nothing prices ghosts yet. That is intended. Round 6 is the first week output moves.
- `techFloor` of 0.4 binds only after sustained R&D, which no borough is likely to reach in twelve rounds.
- Cap and tax are exactly equivalent in round 6 because costs are known. Round 7 is what separates them.
