# Adaptive morphology world

## Latest result — 23 October 2026

The later resource-adaptation pass now defaults to **adaptive-foraging**, replacing the timed demonstration with consumption-driven patch succession and gentle smooth sensing. See [the resource-adaptation handoff](RESOURCE_ADAPTATION_RESULTS_2026-10-23.md), which supersedes the live defaults described below. Renewing-colonies remains a selectable reference profile.

Earlier in the day, the live default became the **renewing-colonies** profile, seed **160104**, with a repeating forage → danger-shift → recovery demonstration. It remains a selectable reference. See [that experiment report](MORPHOLOGY_EXPERIMENT_REPORT_2026-10-23.md) for matched results, exact carry-over measurements, limitations and startup switches. The historical description and results below describe the earlier adaptive profile, not the current default. Its optional directional-learning bias did not improve the measured retention comparison and is off in the chosen profile; local sensing, topology traces and existing evolutionary inheritance remain.

Experimental branch: `codex/adaptive-morphology-world`. The previous reincarnation branch remains available as the reference. Run `npm start` from this branch. Set `GENESIS_ADAPTIVE_MORPHOLOGY=0` before startup to run the old mode. The individual shrinking, conservation, emergency relay and harvest-support experiments remain disabled.

## Why the previous additions were insufficient

The review covered organism action/cost accounting, harvest allocation, reserve routing, bond eligibility/decay, rigid collective transport, reproduction/genome inheritance, gate interaction, image sampling, reincarnation transitions and UI polling/rendering. It was a review of these connected paths, not an exhaustive verification of every source file.

Three coupled constraints matter: the movement-labelled charge is paid even when a member stays still; normal collective transport translates the whole component; and an existing funded bond can decay because neural bind output falls. Adding rescue transfers alone leaves these constraints in place. Earlier experiments also competed with reproduction and maintenance reserves.

## New physical and behavioral rules

- A stationary bonded member pays 25% of the base movement-labelled operating charge, while perception, persistence, coupling, signalling and normal lifecycle costs remain. Actual local shape changes pay the full configured movement cost separately.
- Alive adjacent members exchange at most 0.75 energy per awake edge per tick, with 98% efficiency, when a donor has surplus above its reproduction/support floor. Flow follows the energy difference. This is an explicit transport law, not free shared energy or global pooling.
- An existing adjacent bond remains stable while its reserve pays upkeep, even if neural bind output temporarily falls. Initial bond formation still uses existing rules. Empty reserves, separation and death still break bonds.
- One rotating member per component evaluates adjacent free positions each tick, retaining all existing connections and respecting walls/occupancy. Scores use immediate food, local reward/danger and a small outcome-dependent preference. Components may also translate through the existing collective movement system every fifth tick, preserving travel opportunities.
- Local directional preferences update from food/field energy received minus danger cost after a shape move. They are bounded in [-1,1] and damped on reinforcement; 10% is inherited by the selected reincarnation descendants. This is a small designed learning rule, not evolved general intelligence. Ordinary reproduction still uses the original generated-brain/genome system.

No diamond, star, founder identity or particular gate is privileged. Ageing continues. This is a designed experimental ecology with explicit incentives; survival advantages can arise from cheaper operating costs or extra environmental income and must not be presented as proof of learning.

## Image-driven reward and danger

The default environment contains two procedural resource patches. Each field cell has finite stock, capacity 12. The entire field replenishes from at most four declared external energy units per simulation tick, divided by reward intensity. A member can take at most 0.8 units per tick, subject to its capacity and local field stock. Stock starts empty at world transitions. Field generation and income are separately reported; unused stock is not counted as organism income. Danger costs up to two energy units per tick, debited from the member.

Use the existing image upload control. In this mode, image brightness maps to reward, while red intensity exceeding both green and blue maps to danger. White/grayscale pixels supply reward without danger; saturated red supplies danger plus its luminance reward, with danger penalized more strongly in movement decisions. This mapping is a declared experimental choice, not image recognition. The preview shows reward, the canvas adds faint green reward/red danger overlays, and the footer names the active field.

For independent explicit channels:

```text
POST /api/environment-field
{ "reward": [[...]], "danger": [[...]], "source": "my-experiment" }
```

Both grids must be square, matching size 2–64, with finite values in [0,1]. Values map across the world. Updating a field resets its external stock to zero. The field persists across reincarnation environments within the current process; process restart starts the default patches. `/api/state` exposes `morphologyEnvironment` and `bonding.adaptiveMorphology` counters for shape moves, energy shared/lost, field generated/harvested and danger costs.

## Verification and next research boundary

`node test/adaptive-morphology.mjs` verifies conservative edge flow, paid motion, bond adjacency, bounded external energy, danger debits, paid connection retention and eventual failure without reserve. `node scripts/run-adaptive-morphology-screen.mjs` runs paired seeds 160103/160104 for two 1,000-tick worlds per treatment, including a reincarnation transition. The refined mode is run with `GENESIS_REFINE=1`; original trial and refined data are retained separately in `research-results/adaptive-morphology-screen.json` and `research-results/adaptive-morphology-refined.json`.

The first trial traded survival for reproduction: seed 160103 had 10 starvation deaths but only 12 final members and five bonds. Its diffusion protected only a support floor and collective translation was disabled. The refinement protects reproduction energy and allows periodic translation. See accompanying measured results for final endpoints.

### Refined paired results

Each entry is the end of a 1,000-tick world. World 2 follows the carry/newcomer transition from world 1.

| Seed | World | Mode | Population | Bonds | Facets | Starvation deaths | Gate completions |
|---|---:|---|---:|---:|---:|---:|---:|
|160103|1|reference|27|61|98|46|35|
|160103|1|adaptive|20|41|55|17|55|
|160103|2|reference|217|279|110|461|24|
|160103|2|adaptive|266|98|24|189|43|
|160104|1|reference|45|32|9|67|51|
|160104|1|adaptive|25|15|6|21|41|
|160104|2|reference|194|304|177|326|73|
|160104|2|adaptive|130|201|151|93|83|

The refined mode ends with eligible carried topology in all four observations: 15/41, 76/95, 10/13 and 110/201 members/bonds respectively. This means topology is present and transferable; these counts do not establish retention of the exact original members or original edges through the entire next world. Final world-2 population is 396 across the two seeds versus 411 reference; final bonds are 299 versus 583. Starvation counts are lower but age deaths are higher and reproduction/population trajectories differ. This mode shows a useful survival tradeoff and local reshaping, not uniformly better structural persistence.

To isolate the designed learning rule from energy subsidies and operating-cost changes, run `node scripts/run-morphology-ablation.mjs`. Both controls use the same adaptive physical costs and field budget but disable learned preferences or local reshaping, respectively. Results are stored in `research-results/morphology-ablation.json`.

Seed 160103, world 1, matched physical rules:

| Variant | Population | Bonds | Facets | Starvation deaths | Gate completions |
|---|---:|---:|---:|---:|---:|
|Full adaptive mode|20|41|55|17|55|
|Without learned directional bias|24|58|95|14|37|
|Without local reshaping|17|30|28|15|93|

Learning did not improve survival or bond count in this control seed; it increased gate completions relative to the no-learning control. Local reshaping retained more population and bonds than the no-reshaping control but did not maximize gate completions. These results separate an implemented feedback mechanism from a demonstrated intelligence advantage. Both flags (`learningEnabled`, `reshapingEnabled`) are explicit in `bond.adaptiveMorphology`. The branch keeps the feedback-enabled mode as an experimental live demonstration, not a validated superior controller.

The paired comparison changes several mechanisms and adds explicit external energy. It establishes behavior under a new ecology, not an isolated benefit of memory. Next comparisons: expand the learning/reshaping controls across seeds; field relocation/danger reversal; original-member and lineage retention across transitions; multi-seed lifetime distributions. Learning should be judged by successful adjustment after a field changes, rather than by a large static formation. The current one-member connectivity-preserving search can become geometrically trapped and does not yet learn coordinated multi-member shape edits. Preference scores are updated only on shape moves; unused preferences do not yet decay continuously.
