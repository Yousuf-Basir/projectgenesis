# Harvesting energy from passing organisms — 24 October 2026

## Intent and rollback

The user wanted structures to **consume energy from passing organisms**, not recruit them. Recruitment's movement cue, joining support, extra sharing, parameters and code were removed. The published `b1bab422e0c2fc988c65b0def23307e0a4b19fe2` pantry/aligned-budget morphology remains the control. Recruitment documents/raw results are historical, explicitly withdrawn records.

## Contact-feeding mechanism

- A living component needs at least three members connected through actual adjacent, non-dormant edges. No triangle or other specific shape is required.
- A member can feed only when it lacks its protected body endowment or one of its own adjacent edges lacks the existing two-payment upkeep buffer. Healthy structures do not endlessly consume prey for growth.
- A passing organism must be alive, unbonded (including no dormant/separated bond) and within one grid cell in Chebyshev distance. Existing world wrapping applies. There is no remote drain, attraction cue, pursuit, forced movement, forced joining or automatic deletion.
- At most one feeding contact per component per tick; at most four energy units withdrawn per component, and a prey organism cannot be harvested by two components in the same tick. Actor order rotates with tick to reduce first-member bias. Contact availability is not a world-wide resource oracle.
- The collector pays **0.1 body energy** per successful feeding action. Conversion efficiency is **80%**. Prey's actual energy is debited; only the recovered amount enters the structure. Capture cost and conversion losses are separately recorded. No new environmental income is created.
- Initial ecological safeguard: the prey retains the existing support threshold (normally 24 energy). This is **non-lethal energy extraction**, not whole-organism devouring. Prey can continue moving, feeding and reproducing under ordinary rules; it may still later die naturally. This refuge is a deliberate authored rule, not something the organisms learned.
- Recovered energy first covers the collector's immediate operating buffer, then its attached bond upkeep deficits, then its protected endowment. It cannot magically refill distant edges or a global component wallet. Ordinary existing bond sharing can move body energy later.
- No prey pantry, genome, node trace or topology is copied. No member is rejuvenated or given free reproduction credit. Age limits and ordinary bond separation/depletion remain.

This first experiment therefore tests bounded contact parasitism/feeding. It does not claim evolved predation, learned restraint or improved intelligence. The withdrawal cap, efficiency and capture cost are explicit engineering choices under `bond.organismHarvest`. The contact rule does not add a separately paid perception/search operation; it checks physical neighboring cells, not the whole world for prey.

## Running and observing

`GENESIS_ORGANISM_HARVEST=1` enables the layer in the adaptive server preset. Generic default is off; both packaged demo presets enable it. `0` restores the no-harvesting control without changing food production, movement policies or recruitment. Restart is required; live state remains in memory. This change is included in `genesis-demo-2026-10-24`, but absent from the older `b1bab422` release.

The status line shows harvested energy and feeding-contact count. A short pink connection flash marks a real transfer from the passing organism to the collecting member; it is **not a bond**. Seam-crossing feeding is physically valid but may omit a long cross-canvas flash under existing renderer seam guards.

`/api/state` → `bonding.organismHarvest` exposes `enabled`, `captureCostPerContact` (the fixed price), and per-world cumulative counters `contacts`, `withdrawn`, `delivered`, `conversionLoss`, `captureCost`, `bondFunding` and `bodyDelivered`. Counters reset at the cycle boundary, while carried energy remains ordinary earned energy. `delivered = bodyDelivered + bondFunding`; `withdrawn = delivered + conversionLoss`. Net owned-energy change from feeding is negative by conversion loss plus capture cost.

Tests: `node test/organism-harvest.mjs` (also in `npm test`). Matched two-cycle runs:

```bash
node scripts/compare-organism-harvest.mjs 160104 on
node scripts/compare-organism-harvest.mjs 160104 off
node scripts/compare-organism-harvest.mjs 160121 on
node scripts/compare-organism-harvest.mjs 160121 off
```

Raw results: `research-results/organism-harvest-<seed>-<on|off>.json`. Each executes two 1,000-tick worlds with the same seed, recipe sequence, pantry and aligned-budget profile, varying only this feature. It records population, endpoint bond count, integrated bond-ticks, deaths, breaks, actual harvested energy and continuous inherited endpoint-pair presence. These are distinct persistence measures; more harvest or more organisms alone does not prove improvement. Headless experiment results and visual markers do not establish learned intelligence.

## Results: two seeds, 2,000 ticks each

Values compare **off → on** after the second 1,000-tick world:

| Seed | Final population | Final bonds | Second-world bond-ticks | Second-world starvation deaths |
| --- | --- | --- | --- | --- |
| 160104 | 123 → 244 | 161 → 275 | 69,292 → 171,717 | 16 → 154 |
| 160121 | 211 → 32 | 283 → 45 | 91,774 → 50,911 | 37 → 26 |

For 160104, second-world feeding delivered **1,932.33 energy**, including **41.47 directly into attached bond reserves**, over 828 contacts. Withdrawn energy was 2,415.41, conversion loss 483.08, and capture expenditure 82.80. For 160121 it delivered **339.89**, including **7.33 directly into reserves**, over 143 contacts; withdrawal 424.86, loss 84.97 and capture expenditure 14.30.

The first world's endpoint counts were 49 → 24 bonds for 160104 and 34 → 23 for 160121. Thus even the ultimately larger 160104 run initially did worse; reporting only its final count would hide that. No original carried edge lasted continuously through the full second world in either setting. Age limits are unchanged.

**Finding:** the requested interaction is implemented: actual passing-organism energy funds bodies and maintenance without recruitment or extra external energy. It is not yet a reliable persistence improvement. The current seed has substantially more bonded activity but much higher starvation/turnover; the other seed regresses substantially in population and bonds. We cannot attribute all deaths to feeding from these aggregate counters or equate higher final counts with preserved structural identity.

The off controls exactly reproduce the published pre-recruitment pantry/budget endpoints (39 members/49 bonds and 123/161 for 160104; 39/34 and 211/283 for 160121). This verifies the physical recruitment rollback. Energy-conservation checks and deterministic local-mechanism tests pass. Display-only marker code never changes topology; the pink-flash fixture also passes.

The local viewing process is started with the experiment **on** at seed 160104; the default startup remains **off** unless its environment flag is supplied. Do not deploy it as a proven improvement. A useful next investigation is longer bond/lineage lifetimes and where starvation occurs (harvested solo organisms versus connected members), rather than increasing capture range or energy yield to inflate final population.
