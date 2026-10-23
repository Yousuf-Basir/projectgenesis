# Late-cycle persistence diagnosis

Read-only investigation of the live `adaptive-foraging` run on 23 October 2026. Production code, runtime settings and the live world were not reset or changed. The world continued cycling naturally during inspection.

## What the live capture established

At **cycle 9, tick 940**, the backend reported **232 organisms and zero bonds**. There had been **545 deaths: 437 energy exhaustion and 108 maximum age**. Movement accounted for 185,776 of 265,265 recorded operating expenses (about 70%). Field income was 3,752 of 271,573 total recorded income (about 1.4%).

Cycle 8 ended with 222 bonds; **220 were carried into cycle 9** with 163 surviving members. Cycle 9 subsequently formed another 552 bonds and broke 772, ending with **242 organisms, zero bonds and zero facets**, after 578 member deaths. Thus the carry algorithm did not erase the structure at the boundary: its connections were lost during the next world. The screenshot is consistent with genuine loss of topology, not a renderer hiding bonds.

In the following **cycle 10, tick 706**, the live break counter recorded **103 reserve-depletion breaks and 17 breaks through member starvation**. At that capture, 66 organisms, 61 bonds and 601 food units remained. Reserve exhaustion therefore also occurs while the ecosystem still has members and food; it is not solely old-age loss or an empty world.

## Concrete implementation conflicts

### Reincarnation discards earned member energy

`server/simulation/reincarnation.js` caps each carried member at `startingEnergy * 1.25`. With the generated starting energy of 60, that is **75**. Bond and component reserves additionally retain only 90% of their prior values. Positions, ages, objects and edges continue, but energetic state is not carried intact.

The ordinary founder reproduction/funding floor is **105** (genotype strength can change it). Consequently, carried members are capped below the normal surplus threshold exactly when their environment changes. The code can discard a previously earned buffer. This is an implementation policy, not a physical requirement of finite energy. Its isolated contribution has not yet been measured in a counterfactual experiment.

### Reproduction creates a maintenance-funding blackout

Ordinary reproduction splits the parent's energy 50/50. A normal member reproducing at 105 falls to **52.5**, as does its child. Surplus sharing and food-to-bond funding generally protect the reproduction floor, while bond reserves continue paying **0.04 per awake edge per tick**. A healthy, living member can therefore be unable to replenish an existing connection after reproducing.

The local-renewal intervention retains this same split. Its eligibility needs age at least 55% of maximum lifespan, energy at least 1.2 times the reproduction floor, and an active bond. It cannot replace a connected member once connectivity has already disappeared, and starvation can prevent the eligibility conditions from being reached. Newborn links still require valid coupling, proximity and paid formation.

The funding-floor/split mismatch is a concrete mechanism consistent with measured reserve failures; changing it alone has not been proven sufficient for persistence.

There is an additional asymmetry: **new paid bond formation protects a floor of 24**, whereas food-based replenishment generally protects the reproduction floor of 105. A member at 60 energy may therefore contribute to a new connection's initial reserve of 3, yet be unable to refill an existing connection that pays 0.04 per tick. The system permits creation under a budget where it restricts ongoing maintenance. This is an allocation policy in our implementation, not evidence that all remaining organism energy is physically unavailable.

### Bond loss increases the operating burden

Stationary bonded members receive the 0.18 operating multiplier. After losing coupling, that discount disappears: the base movement-labelled charge can become about **5.6 times** larger. This creates a feedback path from bond failure to greater energy stress, further member deaths and additional bond loss. In the replicated cycle-1 collapse, recorded 100-tick movement expense divided by endpoint population rose from roughly 24 to 102.5; this is a rough exposure proxy, not a controlled causal estimate.

### Selection does not measure persistent collective identity

The recipe fitness combines population growth, final bonds divided by new bonds formed, gate completions per organism and facets per organism. It does not directly reward original-edge survival, collective lifetime or a paid maintenance runway. Individual/population success can therefore differ from survival of a particular structure. Mutations and different seeds are active; lack of randomness is not the explanation for this collapse.

Field income in the late-cycle capture was a small part of the total energy economy. Better field harvesting alone cannot be treated as proof that the main organism/maintenance/reproduction allocation has become sustainable. The optional direct field-to-reserve routing experiment remains off because it had not established an advantage in the earlier comparisons.

## Deterministic replay

`node scripts/audit-late-cycle-collapse.mjs` independently replays the same initial seed, selected profile, evolving recipes and carry-over, without contacting the live server. It saves completed cycles and target-cycle checkpoints incrementally in `research-results/late-cycle-collapse-audit.json`. Completed endpoints are compared with the live history; matching counts are evidence that the replay follows the captured trajectory, not a different standalone seed experiment.

The replay completed all ten worlds (cycles 0–9). Every cycle's final population and bond count matches the captured live history. At cycle 9 tick 940 it exactly reproduced **232 members, zero bonds, 437 starvation deaths and 108 age deaths**.

The exact cycle-9 bond-break totals were:

| Recorded cause | Breaks | Share |
|---|---:|---:|
| Bond energy reserve depleted | 494 | 64.0% |
| Member died of energy exhaustion | 234 | 30.3% |
| Member died of maximum age | 44 | 5.7% |
| Total | 772 | 100% |

No separation or binding-lapse category was recorded in this cycle. The 772 breaks account for all 220 inherited plus 552 newly formed connections. Thus starvation dominated member deaths, but **reserve depletion dominated bond breaks**; these are different measurements.

| Cycle-9 tick | Bonds remaining |
|---|---:|
|Start, carried|220|
|100|193|
|300|126|
|400|80|
|500|26|
|600|16|
|700|7|
|800|5|
|900–1,000|0|

The specific local-renewal counter reached three by tick 200 and remained three through the failure. This does not mean only three ordinary births occurred; it means the special age/energy-triggered renewal intervention activated only three times.

The earlier cycle-1 failure reproduced exactly: **202 organisms, zero bonds**, with **351 reserve-depletion breaks, 269 starvation-related breaks and 41 age-related breaks**. This demonstrates that the successful 1,200-tick verification stopped before a later failure within the second world. Early formation and 80/200-tick carry-over are not evidence of whole-world or indefinite structural persistence.

## Interpretation and next narrow test

We have demonstrated formation, improved resource use and early continuity—not solved long-term collective persistence. The live longer run invalidates any stronger reading of the earlier results.

The next useful experiment is not stronger attraction or another pulse bonus. First compare preserving legitimately earned member energy across reincarnation against the current cap, with identical seeds and budgets. Then audit whether reproduction is affordable after accounting for existing member survival and connection upkeep. Track original-member/edge lifetimes and collective reserve solvency, not only population or final shape counts. These are proposed diagnostic interventions; none was applied to the live world in this investigation.
