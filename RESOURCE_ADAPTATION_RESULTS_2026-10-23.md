# Adaptive foraging: results and handoff

Branch: `codex/adaptive-morphology-world`. Starting implementation: `8fc912d`. Autonomous window: 23 October 2026, 16:23–17:03 UTC / 22:23–23:03 Dhaka. No remote deployment or push is part of this pass.

## Selected outcome

The default is now **adaptive-foraging**, seed **160104**. It keeps the previous renewing-colonies physical costs, paid formation, renewal and conservative edge flow. The change is the resource ecology and its sensing, not another survival subsidy.

Two productive patches gradually lose capacity through actual harvesting. A patch relocates after 90% of its productive capacity is consumed. New sites use a separate seeded environmental RNG, independent of the organism RNG. There is no fixed tick-400 danger event or tick-600 recovery in this mode. Activity determines when the landscape changes.

The field retains the same global budget of at most four external energy units per tick, capacity 12 per field cell and maximum uptake 0.8 per member/tick. Relocation creates no organism energy, bond reserve or free stock. Existing stock remains available when productivity moves; its local consumption contributes to pressure on the currently active patches. Patch capacity (240) is a **productivity-pressure budget**, not an additional energy store. Harvest is attributed proportionally to the nearby active patch kernels, not tracked as provenance-labelled individual food particles.

Organisms/components sample local reward differences using bilinear interpolation rather than coarse stepwise intensity. Navigation bias remains **3**, and the local reshaping minimum gain is **0.003**. Movement still respects walls, occupancy, existing adjacencies, normal neural movement eligibility and paid movement. No new patch coordinates are supplied to an organism. The cyan center rings are viewer diagnostics only.

## Main matched results at 1,000 ticks

Both arms use the same starting seed, costs, reproduction rules and maximum energy budget. The blind arm consumes resources but cannot use the added field cue for local shaping or collective navigation. Its landscape changes according to its own harvesting.

| Seed | Sensing population / bonds | Blind population / bonds | Sensing / blind field energy harvested |
|---|---:|---:|---:|
|160104|166 / 201|59 / 80|3,878 / 3,110|
|160118|47 / 53|65 / 71|3,258 / 3,244|
|160119, fresh validation|40 / 30|44 / 61|3,544 / 2,698|
|160121, fresh validation|51 / 66|41 / 38|3,148 / 2,964|
|Total|304 / 350|209 / 250|13,828 / 12,016|

Aggregate harvesting improved about **15%**, and final bond count about **40%**. However, sensing lost the bond-count comparison on **two of four seeds**. The large structural gain is strongly influenced by seed 160104. On the two fresh validation seeds alone, sensing retained 96 bonds versus 99 blind: **no replicated fresh-seed bond-retention advantage**. Their harvesting was about 18% higher. These are promising resource-use results with uneven structural outcomes, not a universal survival improvement or a statistically established intelligence result.

### Stricter exact-map controls

Because consumption affects relocation timing, a second blind arm replays the exact reward maps experienced by its sensing counterpart, tick for tick. This separates environmental feedback from behavioral use of the cue.

| Seed | Sensing / exact-map blind bonds | Sensing / exact-map blind harvested energy |
|---|---:|---:|
|160104|201 / 41|3,878 / 3,431|
|160118|53 / 92|3,258 / 3,301|
|160119|30 / 68|3,544 / 3,034|
|160121|66 / 35|3,148 / 2,992|
|Total|350 / 236|13,828 / 12,758|

Aggregate harvesting improved about **8%** under exact-map replay; three of four seeds harvested more. The two fresh seeds together improved harvesting about 11%, but retained 96 versus 103 exact-map blind bonds. This confirms the remaining gap: using energy better does not yet reliably preserve more topology.

Raw data: `research-results/resource-adaptation-verification.json` (initial 160104/160118 comparison) and `resource-adaptation-fresh-gentle.json` (fresh 160119/160121). The initial file's exact-map arm used a frozen final map after the cycle transition; do not use that arm's post-transition retention as an equal-environment causal comparison. The fresh verification protocol replays the next-world maps for all 80 continuation ticks too. First-world endpoint comparisons above are unaffected.

## Existing topology really continues

The selected sensing runs tracked original member object identity and original endpoint-pair connections, not just replacement formations:

| Seed | Members / bonds carried | Original members / bonds present 80 ticks later |
|---|---:|---:|
|160104|134 / 200|125 / 161|
|160118|34 / 51|32 / 37|
|160119|25 / 29|23 / 13|
|160121|46 / 66|44 / 45|

Not every final bond belongs to an eligible carried component. Old age, energy shortages and topology changes still operate. This table does not establish that the same founders live for another whole world. `scripts/verify-selected-foraging.mjs` additionally checks the named production profile against the measured 160104 and 160121 endpoints, unique occupancy through 1,200 ticks, the next-world profile and the field energy bound; output is `selected-foraging-verification.json`.

The named-profile check passed: seed 160104 reached 166 members / 201 bonds at tick 1,000 and 126 / 122 after 200 ticks in its next world; seed 160121 reached 51 / 66 and then 75 / 100. Both retained the selected profile and the bounded field budget. All nine focused regression checks and the cycle-variation audit passed.

## What was tried and rejected as the default

- Navigation strengths 12 and 36, and a longer collective movement interval: no consistent improvement over gentle bias 3.
- Minimum shaping gains 0.008, 0.015 and 0.02: reduced movement, but did not establish a better fresh-seed outcome.
- Patch capacity 120 or 480: faster/slower resource turnover did not establish a better default.
- Stored-stock sensing weights 0.5, 1 and 2: sometimes improved a seed, but no reliable structural advantage. Weight 2 also received fresh-seed exact-map checks.
- Metabolic feedback: a bounded recent intake/cost trace reduced exploration when income covered operating expenses. Some runs improved, others worsened. `scarcitySensingEnabled` stays off.
- Direct field-harvest routing: protect source survival/reproduction, help weak actual neighbors, then pay existing bond reserves from earned surplus. A useful integration experiment, but its measured endpoints were worse overall. `fieldHarvestRoutingEnabled` stays off. It creates no energy and does not apply the legacy facet harvest-capital bonus. Thus the selected default still relies on passive edge sharing and existing food-based funding, not a claim that field income automatically funds every bond.

Unused options are explicit and off in the selected profile. Directional preference learning also remains off. The selected approach demonstrates designed local sensing in a responsive ecology, not an evolved movement policy or semantic memory of shapes.

Experiment archives: `resource-adaptation-search.json` (900-tick screen), `resource-adaptation-refinement.json`, `resource-stock-sensing.json`, `resource-adaptation-fresh-conservative.json`, `resource-adaptation-final-stock.json`, `metabolic-foraging-search.json`, and `field-harvest-routing-search.json`. Corresponding search/refine scripts are in `scripts/`; raw unsuccessful runs are retained rather than omitted.

## Mutation and cycle variation audit

`node scripts/audit-cycle-variation.mjs` performs a controlled seven-transition audit with a fixture component. This is a transition/RNG test, **not seven completed survival worlds**. It verifies:

- Seven distinct world seeds: 160104, 170178, 180252, 190326, 200400, 210474, 220548.
- Seven different terrain hashes and seven different initial patch-layout hashes.
- Ordinary offspring mutation is enabled by the generated world at **2% per birth**; this pass did not artificially raise it.
- Half the fresh population can be replaced by inherited descendants, with the existing 25% mutation attempt rate. The audited inherited mutation counts were 3, 4, 3, 1, 2 and 3.
- The first four environmental recipes are deliberately sampled once. From generation four onward, selection and bounded recipe mutation alter food growth, food attempts or movement cost multiplier. All three later audited recipes had a real parameter change.

The audit output is `research-results/cycle-variation-audit.json`. Re-running the same initial seed intentionally reproduces the same experiment. Consecutive cycles have different seeds and variation; similar triangles or rings can recur because adjacency and facet mechanics are shared. Preserving an existing structure is deliberate inheritance, not evidence that the RNG failed. No novelty score or forced destruction is used to make screenshots look different.

## Canvas and controls

`npm start` runs adaptive-foraging automatically. Refresh an existing browser tab. Watch the faint cyan resource rings: the inner arc decreases with productivity and a depleted center eventually relocates. The small line above the canvas shows patch shifts and genome-type counts, alongside colony count, largest component, shaping and renewal. Food, organisms and bonds retain their distinct colors. Background work history is soft cyan, without bright gold squares. Danger remains red when supplied by an image.

An uploaded image or explicit `/api/environment-field` map remains authoritative: it disables automatic patch replacement rather than being silently overwritten. Manual fields survive in-process world resets. This is still spatial brightness/reward and excess-red/danger mapping, not image recognition. Restarting the server restores the automatic default.

PowerShell alternatives, set before startup:

```powershell
$env:GENESIS_MORPHOLOGY_PROFILE='renewing-colonies' # previous timed forage/danger/recovery demonstration
$env:GENESIS_MORPHOLOGY_PROFILE='original-adaptive' # earlier adaptive reference
$env:GENESIS_RESOURCE_PATCHES='0' # disable succession within the selected profile
$env:GENESIS_ADAPTIVE_MORPHOLOGY='0' # original reincarnation mode on this branch
$env:GENESIS_SEED='160121' # alternate reproducible seed
```

These are alternatives, not a command sequence to run all at once. Remove the relevant environment variables to restore defaults. The original reincarnation branch and earlier commits remain available; no history was reset.

## Regression and reproduction commands

```text
node test/adaptive-morphology.mjs
node test/morphology-occupancy.mjs
node test/morphology-renewal.mjs
node test/morphology-speed-parity.mjs
node test/morphology-demonstration.mjs
node test/resource-patches.mjs
node test/resource-navigation.mjs
node test/field-harvest-routing.mjs
node test/renderer-heatmap.mjs
node scripts/audit-cycle-variation.mjs
node scripts/verify-selected-foraging.mjs
```

Tests cover conservation, protected floors, finite field income, depletion driven by consumption rather than elapsed time, independent/reproducible environmental RNG, local cue reversal, preserved adjacency, unique occupancy, image precedence, rendering immutability and low-opacity cyan heatmaps. Cue-reversal testing uses a controlled fixture, not evidence of spontaneous learning. Syntax and served API/assets are checked; no screenshot-based visual QA or 24-hour soak is claimed.

To reproduce the selected fresh-seed control comparison:

```powershell
$env:GENESIS_VERIFY_SEEDS='160119,160121'
$env:GENESIS_VERIFY_GAIN='.003'
$env:GENESIS_VERIFY_STOCK='0'
$env:GENESIS_VERIFY_OUTPUT='research-results/resource-adaptation-fresh-gentle.json'
node scripts/verify-resource-adaptation.mjs
```

Unset `GENESIS_VERIFY_SCARCITY` and `GENESIS_VERIFY_ROUTING`, or leave them other than `1`, for the selected configuration. These verification variables do not change the live server.

## Next research boundary

This pass chose a measured compromise within the requested window, not a finished intelligence algorithm. The defensible advance is **activity-driven ecological change and improved resource use**, with continuing structures and real variation across cycles. Reliable bond preservation across unfamiliar fields remains unresolved. Next: isolate why extra harvesting fails to maintain topology, using per-component paid reserve inflow/outflow and lifetime distributions, before adding another reward or stronger attraction. Evaluate evolved allocation/sensing against this fixed controller on unseen images at equal energy budgets.
