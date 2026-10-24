# Loop circulation and useful closure — 24 October 2026

## What was requested and implemented

The user proposed small closed structures as fast energy-sharing compartments. This implementation covers all four planned steps: one-tick equalization, safe overlapping compartments, matched headless comparisons, and a bounded preference for useful loop closure.

The control is the current local adaptive-foraging world, **including** reliable food reserves and contact harvesting from passing organisms. It is not the older published GitHub release. All work remains on `codex/adaptive-morphology-world`; no remote push is implied.

## 1. Simultaneous energy sharing

At the start of a tick, the engine selects eligible physical loops with 3–8 members. Candidate loops must fund their upcoming bond upkeep using actual member/pantry resources. Advance funding is restricted to candidate-loop edges; it does not grant special treatment to unrelated open chains. Ordinary maintenance is still burned once by the existing lifecycle.

After all organism actions/harvesting and contact harvesting, but **before reproduction**, one immutable balance plan redistributes living members' body energy. All balances in a compartment are updated simultaneously. With no transport loss, `[90,30,15]` becomes `[45,45,45]`; at the configured 98% efficiency it becomes approximately `[44.698,44.698,44.698]`, with 0.906 energy explicitly lost. A square receives the same mechanism without needing a diagonal.

The solver finds a common final level subject to recipient capacities. Members with smaller capacities can remain below that level rather than overflow. Existing above-capacity holdings are not silently destroyed: opening energy is retained as an effective lower bound on that member's capacity for this calculation. The normal organism lifecycle still applies its own capacity rules.

Colored pantry food, component reserves, bond reserves and legacy facet capital are **not** emptied into this body pool. There is no artificial birth refund or reset of age. Reproduction checks the resulting balances under existing paid-birth rules. Subsequent movement, upkeep funding or births can make bodies unequal again; this is one sharing pass per tick, not a promise that every rendered end-of-tick balance is always identical.

For selected loop members, an energy-exhaustion verdict waits until the sharing pass. A surviving compartment can therefore support a member that exhausted its body during this tick. This does not revive age/fire deaths, operate through broken/dormant edges or keep an all-empty compartment alive. A deterministic full-step fixture verifies this ordering. The live `starvationAvoided` counter records this narrow same-tick rescue event, not all differences in starvation between treatments.

## 2. Overlap safety and locality

Each member participates in **at most one** circulation compartment per tick. A rotating priority over canonical loop keys chooses disjoint compartments without consuming the organism RNG. Shared junctions cannot repeatedly funnel newly received energy through neighboring loops in the same pass. Other overlapping loops get later opportunities as priority rotates. There is also a same-tick execution guard.

Detection reuses bounded, chordless physical loops: squares with a diagonal can become overlapping triangular compartments rather than an unlimited unified bus. Seam-crossing, zero-area and self-intersecting flat-canvas polygons are excluded by the existing loop detector. This is not an exhaustive detector for every possible large enclosed geometry.

Inside a selected small compartment, transfer is intentionally fast enough to cross more than one boundary edge within one tick. Between compartments the new mechanism does not perform an instantaneous global equalization. **Existing legacy sharing/component-reserve mechanisms still exist**; this change does not claim to have rewritten every older channel into a strictly one-hop model.

Donor/receiver differences are routed along shortest paths on the selected loop for work attribution. The 2% loss is a compartment-transfer loss, not a separately charged 2% at every hop. `edgeEnergyHops` counts actual path traversals and can exceed unique delivered energy. The existing bounded useful-work commitment rule reinforces only traversed adjacent edges, not every bond in the component. Reinforcement creates no new energy/reserve and does not waive maintenance.

## 3. A hint to close useful circuits

The adaptive reshaper receives a score bias of at most **0.15** for a nearby paid closure that could reduce actual energy deficits. It uses a bounded existing-bond path, current member energy/capacity, protected funding floors, prospective formation investment, upkeep, transport loss and movement cost. Balanced members receive no geometry reward. Prospective loops must have a real non-crossing local interior.

The hint competes with existing resource/danger scores; it does not force movement or create an edge. Binding intention, adjacency, contact duration, degree limits, normal formation funding and lifecycle rules remain required. A successful useful closure is observed, not exempted from costs. No triangle/square/pentagon label receives a privileged bonus.

`closureGuidedMoves` counts chosen reshapes with an improved closure score, not counterfactual proof that the hint alone caused the move. `usefulClosures` also includes beneficial closures that ordinary behavior would have formed; it is not a learned-intelligence score. The hint and shared-compartment physics are authored ecological mechanisms, not evolved reasoning. Existing genome mutation, inherited variation and changing cycle recipes remain in place.

## 4. Matched comparisons and measurement

The runner tests `off`, `circulation` (sharing without closure hints), and `closure` (both), on seeds **160104, 160121, 160138**. Every run uses the same underlying profile, pantry reserve fix, contact harvesting, normal 1,000-tick cycle transition and seed-specific world changes. Only the new mode varies. Pantry balance, finite energies and circulation-loss identities are asserted.

Physical edge observations carry identifiers across endpoint-ID remapping at a cycle boundary. Closed motifs are tracked by their constituent physical edge observation IDs. Lifetime summaries distinguish completed lifetimes from the longest still-observed lifetime; surviving observations are censored by the experiment's endpoint. A motif is a detected physical loop, not a persistent intelligent species identity. No confidence interval or population-wide robustness claim follows from three deterministic seeds.

### 1,500-tick three-way ablation

| Seed | Final bonds: off / circulation / full | Starvation deaths: off / circulation / full | Mean completed edge lifetime: off / full |
| --- | --- | --- | --- |
| 160104 | 74 / 225 / 242 | 17 / 10 / 17 | 290.1 / 311.8 ticks |
| 160121 | 65 / 81 / 68 | 34 / 20 / 11 | 325.4 / 367.1 ticks |
| 160138 | 33 / 70 / 70 | 15 / 5 / 5 | 348.6 / 440.7 ticks |

Total final bonds: 172 / 376 / 380. Integrated bond-ticks: 194,811 / 224,243 / 232,248. Starvation counts: 66 / 35 / 33. These are unnormalized counts: different population sizes and birth rates change exposure. The full version's longest observed motif lifetime was 571 versus 517 ticks, 412 versus 413, and 583 versus 495. Thus even this favorable endpoint does not improve every metric on every seed. The third seed's hint caused no improving-score reshapes during this window: its full result equals circulation alone, rather than being a separate demonstrated hint win.

Longer control/full validation is recorded separately below; do not treat a mid-cycle growth peak as proof of indefinite persistence.

### 2,000-tick validation — all three modes, all three seeds

| Seed | Final bonds: off / circulation / full | Starvation deaths: off / circulation / full | Longest observed motif: off / circulation / full |
| --- | --- | --- | --- |
| 160104 | 23 / 241 / 230 | 27 / 90 / 124 | 536 / 462 / 571 ticks |
| 160121 | 31 / 33 / 32 | 42 / 33 / 20 | 521 / 353 / 571 ticks |
| 160138 | 32 / 1 / 8 | 17 / 17 / 17 | 544 / 583 / 583 ticks |

Integrated bond-ticks were 254,859 / 369,152 / 370,268 in aggregate, but this hides a strong first-seed win and regressions in activity on the other two. The full version's final population was 184 / 30 / 82 versus control 20 / 30 / 25. The third full result therefore contains many **unbonded** organisms; population is not a substitute for persistent structure.

Mean completed physical-edge lifetimes were 294.9 / 260.4 / 274.5, 306.5 / 285.7 / 313.9, and 333.5 / 372.3 / 362.0 ticks. Thus the longest motif improved with the full version in all three seeds, but not every edge-lifetime measure improved. Censoring, birth cohorts and component discard at world boundaries affect these measures.

The full version's first seed produced 369 offspring versus 74 in the control across two worlds and suffered much higher late starvation. This is consistent with resource/renewal overshoot, but aggregate counts alone do not prove its cause. The second seed had fewer starvation deaths; the third still lost most bonded organization late. Finite food, movement, upkeep and normal age limits remain binding constraints.

Across three seeds, pantry energy paid directly to bonds was 1,239.44 in the full version versus 312.83 in controls; pantry energy delivered to bodies was 1,038.86 versus 1,514.91. The new circulation channel changes which resource buffer is used; it does not generate food. All pantry and circulation accounting assertions passed. The narrow same-tick `starvationAvoided` event counter was zero in these ecological runs, despite passing its dedicated fixture; comparative death-count differences must not be mislabeled as observed direct rescues.

Nine independent 2,000-tick runs and nine 1,500-tick runs are retained (31,500 final-comparison ticks in total). The 1,500-tick prefixes reproduce exactly when run independently as part of the longer tests. Earlier exploratory code was not used for these final tables.

**Decision:** retain both mechanisms as switchable experiments and show the full version locally on the original seed, prioritizing longer-lived closed motifs and visible circulation—not claiming universal survival superiority. Circulation alone is a valid comparison and is better on some metrics. Do not replace a production deployment on these results alone. No parameter sweep or cherry-picked new seed was used to conceal the third-seed failure. All three raw modes are available for independent assessment.

## Controls, UI and reproduction

The generic/startup default is **off** unless explicitly enabled. Both packaged demo presets enable all four steps. To configure this release manually:

```dotenv
GENESIS_ADAPTIVE_MORPHOLOGY=1
GENESIS_MORPHOLOGY_PROFILE=adaptive-foraging
GENESIS_SEED=160104
GENESIS_RESOURCE_PATCHES=1
GENESIS_FIELD_DEMO=0
GENESIS_ALIGNED_BUDGETS=1
GENESIS_FOOD_PANTRIES=1
GENESIS_PANTRY_REUSE=1
GENESIS_PANTRY_RESERVES=1
GENESIS_ORGANISM_HARVEST=1
GENESIS_LOOP_CIRCULATION=1
GENESIS_LOOP_CLOSURE=1
GENESIS_VISUAL_RELAY=0
```

Set `GENESIS_LOOP_CLOSURE=0` for circulation without the hint, or `GENESIS_LOOP_CIRCULATION=0` for the previous local behavior. Restart is required and loses the in-memory run. Old published releases do not implement these new flags. Do not deploy them merely by adding environment variables to old code.

The small status line shows `fast loops` and cumulative `circulated` energy. Cyan transfer flashes show actual path work; the existing food-colored `+` still represents stored food, not circulation. `/api/state` → `bonding.loopCirculation` exposes configuration, cumulative per-world counters and the last completed sharing compartments. These counters reset each world. Compartments describe the sharing pass, not an assertion that later births/payments left every body equal.

```bash
npm test
node test/morphology-speed-parity.mjs
node scripts/compare-loop-circulation.mjs 160104 off 1500
node scripts/compare-loop-circulation.mjs 160104 circulation 1500
node scripts/compare-loop-circulation.mjs 160104 closure 1500
# Repeat the three modes with seeds 160121 and 160138.
# Longer validation uses off/closure and 2000 as the final argument.
```

Raw files: `research-results/loop-circulation-<seed>-<mode>-<ticks>.json`.

## Limitations and next questions

Equal energy need not mean equal survival runway when genomes have different costs. Overlapping compartments trade throughput for locality. Fast mixing can support more births and later exceed resource supply; energy conservation does not prevent ecological overshoot. Older triangle-specific capital bonuses remain a separate legacy authored incentive and are not evidence of shape-independent learned behavior.

A next experiment should connect reproduction affordability to measured compartment operating runway and compare equal-energy with need-weighted sharing. Do not add a new energy subsidy or reward geometric labels to hide a shortage. Longer matched seeds and repeated environmental challenges are needed before calling this intelligence or durable species survival.

Follow-up: the switchable [local reproduction-runway experiment](REPRODUCTION_RUNWAY_2026-10-24.md) is implemented and measured. A 60-tick forecast helped one weak seed but did not eliminate large-population overshoot; a 120-tick forecast suppressed renewal too strongly. These original circulation results remain the untouched control.
