# Energy conservation audit and experiment — 2026-10-23

The audited seed-160103 baseline at 1,000 ticks spent 24,821.6 energy in the movement category, 3,708.12 on perception, 2,472.08 on maintenance, 2,079.1 on member coupling, 1,413.01 on bond reserve maintenance and 26.5 on signalling. The movement category is charged every organism tick, including when a coupled organism remains stationary. It functions partly as an operating cost; this accounting/design distinction should be considered before changing global movement rules.

Implemented an experimental conservation policy. Bonded groups of at least three enter after eight declining average-member-energy observations below twice support threshold, and exit above three times that threshold. Members retain brain execution, perception, internal state, local food intake, gate discovery and ordinary reserve support. Quiet periods suppress external signal emission and discount the per-member operating charge to 35%. Collective movement remains available. Every ten ticks, two full-activity ticks allow probing. Food within one cell or an unexhausted gate with stock within three cells immediately wakes the component. Forecast history resets at world transitions. No nodes are removed and no energy is generated.

The first trial also suppressed collective movement; at tick 1,000 it had population 22, bonds 12, facets 4, deaths 81, gate completions 43. That version was revised to retain collective movement.

Final matched screen (`research-results/conservation-screen.json`):

| Metric | Off | On |
|---|---:|---:|
| Population | 27 | 26 |
| Bonds | 61 | 15 |
| Facets | 98 | 4 |
| Starvation deaths | 46 | 67 |
| Gate completions | 35 | 54 |
| Total movement-category spend | 24821.6 | 28056.5 |

The final policy produced only 104 conserving member-ticks. Neighbouring food/gates frequently wake members and short declines reset the entry counter, so most starvation remains outside the intervention. Total spend also depends on cumulative population and activity; raw total is not a cost-per-member comparison. This seed does not demonstrate a survival improvement. The policy remains OFF by default (`ReincarnationController({energyConservationEnabled: true})` enables comparison). It is inappropriate to advertise improved survival based on the increased gate completions.

Checks: `node test/energy-conservation.mjs` verifies declining-energy entry, periodic probes, food/gate wake, recovery exit and disabling. `node scripts/run-conservation-screen.mjs` repeats the full matched 1,000-tick screen with shrinking off and existing evolution/work rewards unchanged.

Next diagnostic: count starvation deaths by cause at member resolution (isolated, bonded, reserve-positive, below support floor) and compare actual movement versus stationary operating charges. A group-average alarm misses a hungry member surrounded by well-fed members; survival support should be targeted using that measured imbalance before another broad dormancy policy is promoted.
