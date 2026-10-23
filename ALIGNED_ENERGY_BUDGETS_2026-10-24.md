# Aligned energy budgets — 24 October 2026

Branch: `codex/adaptive-morphology-world`. Reference commit before these changes: `656eaf7`.

## Why this change

The exact ten-world replay in [the late-cycle diagnosis](LATE_CYCLE_PERSISTENCE_DIAGNOSIS_2026-10-23.md) confirmed that inherited bonds were really breaking. Cycle 9 inherited 220 bonds, formed 552, and lost all 772: 494 reserve-depletion breaks, 234 starvation-related breaks and 44 age-related breaks. The renderer was not concealing them.

There were incompatible budget rules: new links could be paid above the 24-unit survival floor, while maintenance deposits protected the 105-unit reproduction trigger. Reproduction split 105 into two balances of 52.5, neither eligible for those deposits. Cycle transitions also clipped carried member energy to 75 and removed 10% of carried bond/component reserves.

## Implemented rules

1. Preserve **member energy, bond reserves and component reserves** at the cycle boundary. No energy refill, age reset or revival is added. Existing topology/positions and ID remapping remain unchanged. Fresh newcomer energy and the newly generated environment remain separate, existing external inputs.
2. Reserve one offspring's endowment before structural spending: `max(survival floor, reproduction trigger × reproduction split)`, normally `max(24, 105 × 0.5) = 52.5`. Creation, maintenance and local seed investment use this same floor. This protects renewal without freezing the entire 105-unit birth trigger. Offspring with a different genome-derived reproduction trigger use their own derived floor.
3. Support an endangered adjacent member's next two operating payments, estimated from its last actual operating expense and capped at the existing survival threshold. This paid edge transfer uses the existing 98% efficiency; the loss is recorded. Ordinary discretionary edge flow still protects the full reproduction trigger.
4. Pay existing, live, adjacent, non-dormant connections before reproduction. Actual endpoint energy funds a minimal rolling buffer: two maintenance payments, currently `2 × 0.04 = 0.08` per edge. The bill is then charged by the existing maintenance code. Donors never cross the protected endowment. If one endpoint cannot pay half, the other may cover the remainder from its real surplus.
5. Do **not** force every edge back to a full three-unit creation reserve. Initial formation still costs three units, and larger food-funded reserve deposits still protect the reproduction balance. This distinguishes mandatory upkeep from discretionary saving.
6. Before any of the three reproduction paths spends parent energy, check that the configured split leaves the child's endowment and a parent able to cover its own endowment, outstanding half-share of upkeep, and possible local seed investment. Ordinary reproduction eligibility and the age-triggered renewal rule remain in force. A bonded parent at exactly 105 normally waits until seed costs are affordable rather than dividing and immediately spending protected savings.
7. Keep discretionary member sharing, component saving and edge flow above their existing reproduction reserve. Lowering all those thresholds was tested and rejected. No movement discount, food-generation increase, pulse bonus, shape whitelist or immortal-edge rule was added.
8. Record the new internal transfer as `allocations.bondFunding`; it is not income or an additional expense. Actual reserve maintenance remains the expense. Existing legacy facet-harvest capital is unchanged; this change is not a claim that every historical mechanism conserves energy.

The new guard uses existing survival, reproduction, seed and maintenance settings. The only new configuration is the comparison switch, `bond.adaptiveMorphology.alignedBudgetsEnabled`.

## Comparisons and limits

Two initial seeds are compared for two complete 1,000-tick worlds. The disabled mode reproduces the committed first-world endpoints exactly: seed 160104 has 166 members / 201 bonds; seed 160121 has 51 members / 66 bonds. Both modes retain the same environmental budgets and first two recipe schedules. Their trajectories, descendants and subsequent selections can diverge through normal dynamics.

Raw files are in `research-results/aligned-budgets-<seed>-<variant>.json`:

- `off`: committed behavior, including the old carry cap and transition tax.
- `on`: rejected broad policy, lowering all funding/sharing floors and topping existing reserves up to three units. It ended with 239 bonds on seed 160104 but only 3 on 160121; first-world formation was substantially weaker on both.
- `upkeep`: rejected narrower variant, retaining the reproduction reserve for sharing but lowering meal-funded bond deposits and restoring the full creation-sized maintenance reserve. Seed 160121 ended with 19 bonds. Seed 160104 was stopped after the recorded first-world tick-500 checkpoint; its file is partial, not a 2,000-tick result.
- `rolling`: rejected two-payment upkeep buffer with the 24-unit donor floor and no emergency member support. It ended with 2 bonds on seed 160104 and 20 on 160121: fixing upkeep alone did not solve member starvation.
- `survival`: adds bounded emergency support to that 24-unit-floor policy. It ended with 178 and 55 bonds on seeds 160104 and 160121 respectively. Not selected: it left formation, maintenance and reproductive reserves on different floors and regressed the held-out seed's final bond count.
- `endowment`: selected implementation described above, with consistent creation/maintenance/endowment budgets.

### Complete selected-policy endpoints

| Initial seed | Policy | Bonds after world 1 | Members after world 2 | Bonds after world 2 | World-2 starvation deaths | World-2 reserve-depletion breaks |
|---|---|---:|---:|---:|---:|---:|
|160104|Legacy/off|201|202|0|483|351|
|160104|Protected endowment|55|176|176|134|356|
|160121|Legacy/off|66|61|68|52|315|
|160121|Protected endowment|53|88|69|36|106|

The selected policy ends with **245 versus 68 bonds** across these two runs, and **170 versus 535 world-2 starvation deaths**. However, initial growth is substantially smaller (108 versus 267 world-1 bonds), and seed 160104's absolute reserve-depletion break count does not improve. These are counts from diverging populations, not normalized failure rates or proof that the same individual edges lived longer. The held-out seed's 69 versus 68 bonds is effectively a tie, not a strong win.

The selected second worlds record 39 and 15 local-renewal births, respectively. Emergency support transfers 767.48 and 172.60 actual energy units, with the existing transfer loss charged. These internal transfers are not extra field income. The field-generation ceiling was asserted throughout every comparison: at most four units per tick, unchanged between treatments.

Raw selected runs: [160104](research-results/aligned-budgets-160104-endowment.json), [160121](research-results/aligned-budgets-160121-endowment.json). Matched controls: [160104](research-results/aligned-budgets-160104-off.json), [160121](research-results/aligned-budgets-160121-off.json).

The `inheritedEdgesRemaining` counter counts inherited edge keys still present at each checkpoint; it is not proof that they never broke and re-formed between observations. Maximum age remains 750, so unchanged old endpoints cannot survive a whole additional 1,000-tick world: collective persistence requires actual member replacement, not eternal original edges. Do not equate total bond count with intelligent behavior or uninterrupted collective identity.

This pass tests two worlds, **not** all ten worlds of the failing historical run. Seed dependence and late age/starvation failures remain open. A stronger next test would measure continuous component ancestry and energy solvency across the later scarcity recipes, without tuning toward a single visually successful seed.

## Run and compare

PowerShell, from this project directory:

```powershell
$env:GENESIS_ADAPTIVE_MORPHOLOGY='1'
$env:GENESIS_MORPHOLOGY_PROFILE='adaptive-foraging'
$env:GENESIS_RESOURCE_PATCHES='1'
$env:GENESIS_FIELD_DEMO='0'
$env:GENESIS_SEED='160104'
$env:GENESIS_ALIGNED_BUDGETS='1'
npm start
```

The adaptive-foraging profile enables aligned budgets by default. Set `GENESIS_ALIGNED_BUDGETS='0'` before restarting for the old budget behavior; do not change unrelated options during the comparison. Reset after a process restart begins a new run; it does not import the old process's living organisms or an uploaded image.

```powershell
node test/aligned-budgets.mjs
node test/morphology-renewal.mjs
node test/morphology-occupancy.mjs
node test/morphology-speed-parity.mjs
node test/adaptive-morphology.mjs
node test/resource-patches.mjs
node test/resource-navigation.mjs
node test/field-harvest-routing.mjs
node test/renderer-heatmap.mjs
node scripts/compare-aligned-budgets.mjs 160104 off
node scripts/compare-aligned-budgets.mjs 160104 on endowment
node scripts/compare-aligned-budgets.mjs 160121 off
node scripts/compare-aligned-budgets.mjs 160121 on endowment
```

The comparison script writes reports and never contacts the live server. Historical verification/replay scripts explicitly disable the new policy so their reference results stay reproducible. Earlier experimental variants are described above, not implemented as additional permanent production switches.

Validation also fixes a pre-existing test cleanup problem: `test/guided-support.mjs` now stops its simulation timer after its assertions, allowing `npm test` to terminate. No support behavior was changed by that cleanup.
