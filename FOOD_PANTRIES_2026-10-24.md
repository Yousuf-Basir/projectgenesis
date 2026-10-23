# Living food pantries — 24 October 2026

Branch: `codex/adaptive-morphology-world`. Starting reference: `2371e5b` (aligned energy budgets). The two unrelated existing worktree items, `research-results/guided-image-memory-task.json` and `REINCARNATION_DEPLOYMENT_HANDOFF.md`, are not part of this change.

## Latest update — visible routing and proactive reuse

This supersedes the original `516bfed` behavior described below. A live cycle-12 check found five empty chambers while all saved food was held by three members outside closed loops; tiny 1.7-pixel markers compounded the problem. Food was later consumed, but the display did not meet the intended visual experience.

Changes:

- Food chips are now about **3.9 pixels** on the normal 13-pixel grid, with dark borders and brighter loose-owner markers. A denser placement grid fits a real marker inside even a minimal cell triangle. Chips stay inside their actual polygon; an empty pantry remains empty. Different colors are interleaved when space is limited rather than hiding all blue/red behind green.
- Existing stores move through **intact adjacent bonds**, at most **one hop per tick**, toward reachable closed chambers. Sending budgets are snapshotted so new arrivals cannot be forwarded twice in the same tick. Per-sender transport is capped at 0.5 energy/tick, receiver capacity remains unchanged, and each crossing uses the existing 98% efficiency. Routes use graph-distance advertisements from actual chambers; this is an authored graph-routing rule, not learned navigation or image recognition. No world coordinates or remote energy wallet are used.
- Connected scouts can capture otherwise-overflowing food when they have a real bond path to a chamber, rather than only while sitting on its boundary. Isolated organisms cannot use an imaginary distant pantry. A full destination can block delivery; disconnected or opened components keep their owner-held food but cannot teleport it inward.
- Each member tracks its energy change against the preceding post-pantry balance, smoothed with a bounded exponential average (0.8 previous / 0.2 change). When it is losing energy, edible reserves can restore the existing **24-unit survival floor**, instead of waiting until only two operating payments remain. This never tops the body up to its reproduction trigger. Owners eat first; nearby donors retain food needed for their own current operating target.
- Red still pays actual upkeep first. If body surplus cannot fund the minimal upkeep buffer, blue and then green can pay the remaining real bill, without spending food needed for immediate member support. Already-severed bonds are not recreated; normal death, adjacency and reserve depletion can still break them.
- Colored traces show routing and maintenance funding; a brief half-ring shows a member using its own pouch. Marker counts are capped, and rendering/headless/display speed do not alter the physics. The status line adds `routed`. This sums **energy delivered over hops**, not newly created energy or unique food items.

### Fresh matched 2,000-tick comparisons

Both legacy controls were rerun under the current code with adaptive reuse disabled, and **exactly reproduced both recorded world endpoints**. The same pantry overflow-only policy, food production, field ceiling, seeds and first two recipes are retained.

| Initial seed | Policy | World-2 members | World-2 bonds | World-2 starvation deaths |
|---|---|---:|---:|---:|
|160104|Previous pantry|234|274|94|
|160104|Routing + proactive reuse|123|161|16|
|160121|Previous pantry|33|49|14|
|160121|Routing + proactive reuse|211|283|37|

Aggregate final bonds are **444 versus 323**, but this hides a large regression on the first seed and a large gain on the second. Do not call this a universal survival improvement. Counts of starvation deaths are not normalized survival rates, particularly when populations differ so much.

On seed 160104's second world, 136.85 energy-hop units were routed, 68.20 units fed members and 15.96 units funded bonds. There were **292 individual green/blue maintenance payments**. On seed 160121, the corresponding values were 29.75, 34.41 and 7.71, with 66 green/blue payments. The payments are not counterfactual proof that 292 or 66 distinct bonds were rescued. Both runs assert the full pantry mass/energy ledger, including shipping loss, spoilage, inherited opening inventory and deaths.

Selected reports: [160104](research-results/aligned-budgets-160104-pantry-routed.json), [160121](research-results/aligned-budgets-160121-pantry-routed.json). Fresh controls: [160104](research-results/aligned-budgets-160104-pantry-legacy-control.json), [160121](research-results/aligned-budgets-160121-pantry-legacy-control.json).

```powershell
$env:GENESIS_FOOD_PANTRIES='1'
$env:GENESIS_PANTRY_REUSE='1' # '0' keeps previous physics, but clearer graphics
npm start
node test/pantry-routing.mjs
node test/food-pantries.mjs
node test/morphology-speed-parity.mjs
node scripts/compare-aligned-budgets.mjs 160104 on pantry-routed pantry
node scripts/compare-aligned-budgets.mjs 160121 on pantry-routed pantry
node scripts/compare-aligned-budgets.mjs 160104 on pantry-legacy-control pantry 0 legacy
node scripts/compare-aligned-budgets.mjs 160121 on pantry-legacy-control pantry 0 legacy
```

Routing does not guarantee constantly full chambers, delivery through a broken path, or timely feeding across arbitrarily many hops. Immediate eating is limited to owner/adjacent stores, and shipping toward chambers takes real ticks. Local outward demand propagation to serve distant hungry tails is a possible later step, not something this version pretends to implement.

## Original implementation record — `516bfed`

## What is visible

Small green, blue and red grains appear **inside actual closed bond loops** after their boundary members collect surplus harvest. Counts and partial-grain brightness fall as inventory is consumed or spoils. A quiet legend below the canvas explains the colors; the existing small status line shows current pantry energy and cumulative energy used. These are coarse quantity indicators, not one sprite per original world-food tile.

Triangles are not privileged. The first version detects short, chordless closed cycles with 3–8 members, including squares. Diagonals divide chambers. Flat-canvas seam-crossing loops, zero-area polygons and self-intersections are excluded. This is a bounded cycle detector, not a complete planar-face decomposition or support for every possible large polygon.

Each food store belongs to a **living boundary node**. Shared corners are displayed in only one chamber, so overlapping loops cannot duplicate inventory. If a loop breaks, remaining stores stay with their owners and appear as little colored marks beneath those members. Surviving owners keep the actual stores through reincarnation. Children do not receive free copies of parent food.

## Resource roles

Existing genotype-dependent green/blue/red harvest yields are unchanged. Stored quantities are the **energy value of the actual harvested resource**, tagged with its color—not raw physical food units whose value can be multiplied again on withdrawal.

- **Green — nourishment:** consumed first when a member needs its next operating payments. Spoilage is 0.2% per tick.
- **Blue — longer-keeping reserve:** consumed after green, with 0.05% spoilage per tick. This makes preservation a useful difference, not a free energy multiplier.
- **Red — maintenance fuel:** its existing modest calorific yield can pay actual maintenance deficits on attached bonds. Spoilage is 0.1% per tick. No bonus commitment, free repairs, or amplified catalytic energy is awarded. Existing red catalyst chemistry is otherwise unchanged.

These are deliberately authored ecological rules, not evolved food preferences or evidence of intelligence. There are no predefined stomach shapes, privileged members or food spawned inside structures.

## Conservative default

Only harvest that would otherwise exceed the member's energy capacity is stored by default. Body survival, reproduction energy and actual food availability are not taxed just to make the pantry look full. A node can hold at most half a base meal of energy (`foodEnergy × 0.5`; the value follows the generated world's food settings). Originally, storage required a real closed loop at collection time; the latest update also permits an intact path to one.

`harvestFraction` also supports saving a fraction of paid surplus above the reproduction trigger; it was tested at 20% but defaults to **zero**. That variant delivered substantial stored energy but worsened both final bond-count comparisons. It is retained as an explicit parameter, not the live policy.

Before normal actions, an owner can use its green/blue stock for its next two estimated operating payments, capped at the existing survival threshold. An adjacent member can also receive stock through one intact bond, using the existing 98% efficiency. There is no global component wallet, remote withdrawal, or same-tick stock relay. Red pays only a minimal two-payment bond-maintenance buffer, not an unlimited reserve refill.

On deposition, overflow is removed from both the pending overflow result and the member's already-recorded overflow loss. Downstream overflow capture/plumes see only the remainder. Thus the same food is never counted as both lost and stored, or routed into two reserves. Withdrawals are internal transfers, not new food income. Spoilage, transfer loss and stores lost with dead owners are explicitly recorded. Existing detritus/decomposition still operates, but this is **not yet a closed nutrient-recycling ecosystem**.

## Matched two-world measurements

Both initial seeds run for 2,000 ticks with the same aligned-budget adaptive-foraging profile, finite field ceiling (4 units/tick), first two recipe schedules and existing mutation rules. Controls are the recorded pantry-disabled endowment runs from the preceding pass.

| Initial seed | Policy | World-1 final bonds | World-2 final members | World-2 final bonds | World-2 starvation deaths |
|---|---|---:|---:|---:|---:|
|160104|Pantry off|55|176|176|134|
|160104|Overflow pantry|42|234|274|94|
|160121|Pantry off|53|88|69|36|
|160121|Overflow pantry|36|33|49|14|

Final bonds total **323 versus 245**, but the effect is seed-dependent: the second seed loses bonds and members, and both first worlds end with fewer bonds. Lower starvation counts in a smaller population are not automatically improved survival rates. This is a functioning resource-buffer mechanism with an encouraging aggregate endpoint, **not a universal persistence or intelligence result**.

Actual reused pantry energy in the selected runs:

- Seed 160104: world 1 saved 108.20 overflow units, delivered 8.36 to members and 0.72 to bond upkeep; world 2 saved 70.50 and delivered 25.65 to members. The pantry was empty at the final endpoint.
- Seed 160121: world 1 saved 39.23 and delivered 19.85 to members; world 2 saved 16.75 and delivered 4.41. Final inventory was 3.20. No red maintenance withdrawal occurred on this seed; red's mechanism is also covered by a controlled test rather than forced into the live ecology.

At every recorded comparison checkpoint the ledger assertion is:

`opening inventory + deposits = final inventory + member deliveries + bond deliveries + transfer loss + spoilage + dead-owner losses`.

Raw selected runs: [160104](research-results/aligned-budgets-160104-pantry-overflow.json), [160121](research-results/aligned-budgets-160121-pantry-overflow.json). Rejected 20%-surplus runs: [160104](research-results/aligned-budgets-160104-pantry.json), [160121](research-results/aligned-budgets-160121-pantry.json). Controls: [160104](research-results/aligned-budgets-160104-endowment.json), [160121](research-results/aligned-budgets-160121-endowment.json).

## Run and verify

The normal local server enables pantries in adaptive mode. To compare from a fresh restart:

```powershell
$env:GENESIS_FOOD_PANTRIES='1'  # '0' disables pantries
$env:GENESIS_MORPHOLOGY_PROFILE='adaptive-foraging'
$env:GENESIS_ALIGNED_BUDGETS='1'
$env:GENESIS_SEED='160104'
npm start
```

Pure Simulation fixtures default off unless explicitly enabled, keeping historical headless runs reproducible. Live state exposes `bonding.foodPantries` (inventory, chambers, usage, losses) and each organism's `foodPantry`.

```powershell
node test/food-pantries.mjs
node test/aligned-budgets.mjs
node test/morphology-speed-parity.mjs
node test/renderer-heatmap.mjs
npm test
node scripts/compare-aligned-budgets.mjs 160104 on pantry-overflow pantry 0 legacy
node scripts/compare-aligned-budgets.mjs 160121 on pantry-overflow pantry 0 legacy
# Reproduce the more intrusive, rejected deposit policy:
node scripts/compare-aligned-budgets.mjs 160104 on pantry pantry 0.2 legacy
```

Tests cover generic square/triangle geometry, shared-corner non-duplication, paid deposits and withdrawals, differentiated spoilage, red maintenance, overflow correction, opened enclosures, inheritance without copying, dead-owner accounting, grain containment, three colors, empty/near-empty rendering, disabled mode, and display-speed parity. Browser screenshot verification was unavailable because the browser-control runtime failed to initialize; rendering was verified through deterministic canvas-command fixtures, not claimed as an observed screenshot.

Next useful ecological work would be local scavenging/recycling with a fully conserved material ledger and broader seed validation. It should not be introduced as a hidden energy subsidy or tuned merely to preserve one attractive screenshot.
