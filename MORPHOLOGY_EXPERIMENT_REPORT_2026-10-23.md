# Renewing colonies: autonomous experiment report

Branch: `codex/adaptive-morphology-world`. Starting commit: `c9d0012`. Experiment window began 2026-10-23 13:50 UTC / 19:50 Dhaka; the verified candidate was selected before the 14:50 UTC deadline. The previous reincarnation branch remains available. No changes were pushed remotely during this pass.

## What to watch

Start with `npm start`, then open http://localhost:3000/ and refresh an existing tab. Default seed: **160104**, profile: **renewing-colonies**, speed: 1. The small line above the canvas reports phase, colonies, largest component, shape moves and local renewal births. Energy-transfer markers visualize actual paid flow, not a reward animation unrelated to the simulation.

Each 1,000-tick world has three explicitly scheduled environmental phases:

- Ticks 0–399: two resource patches (forage).
- Ticks 400–599: reward toward the left, graded danger toward the right (danger-shift).
- Ticks 600–999: resource patches return and danger disappears (recovery).

The schedule is designed, not discovered by evolution. The organisms' resulting morphology is not scripted. Surviving eligible components retain their member objects, positions and existing bonds at the reincarnation boundary; newcomers join them. Age continues, so preservation is not immortality. Later world recipes and offspring still use existing mutation/selection mechanisms.

Upload an image to supply your own environment: brightness supplies reward, excess red supplies danger. Uploaded/API fields override the automatic schedule, including across world resets; restarting the process restores the defaults. This is spatial sensing, not image recognition.

## Selected combination

Compared with the starting adaptive profile:

| Parameter | Starting adaptive | Renewing colonies |
|---|---:|---:|
| Stationary bonded operating multiplier | 0.25 | 0.18 |
| Maximum flow per awake edge/tick | 0.75 | 0.10 |
| Flow efficiency | 98% | 98% |
| Collective movement interval | 5 ticks | 5 ticks |
| Local environmental navigation bias | 0 | 3 |
| Navigation bias while exposed to danger | 0 | 48 |
| Learned directional preference | on | off |
| Budgeted local generational renewal | off | on |
| Paid initial bond reserve | off | on |
| New-bond endpoint degree limit | none in this layer | 4 |

Renewal becomes eligible for an actively bonded parent at 55% of maximum age, with at least 1.2 times its reproduction energy floor. It still needs a legal reproduction opportunity and birth site and pays normal reproduction energy. Up to four additional parent energy units seed links to the parent and at most one adjacent parent neighbor. This is an explicit life-history rule, not evolved foresight. Seeded links still need valid endpoints, adjacency and eligibility.

Food, gate energy and the finite environmental field remain the energy sources. Field replenishment is capped at four external units globally per tick, cell capacity 12, uptake at most 0.8/member/tick. New stock starts empty. New bonds in this profile pay the configured initial reserve from their endpoints; flow loses 2%; movement and danger remain charged. These checks cover the added mechanisms, not a claim that every legacy source is a physically closed system.

## Matched 1,000-tick verification

Same seeds, initial worlds and four-unit field budget. The comparison changes several mechanisms together, so it does not isolate a single causal improvement. The final stronger danger bias is tested separately below; this steady-field comparison uses navigation bias 3.

| Seed | Starting population / bonds | Renewing population / bonds | Starting / renewing largest component | Renewal births |
|---|---:|---:|---:|---:|
|160103|20 / 41|41 / 49|15 / 8|18|
|160104|25 / 15|55 / 70|7 / 25|34|
|160117, not a screening seed|7 / 5|54 / 66|4 / 21|29|
|Total|52 / 61|150 / 185|—|81|

Surviving bonds in renewing colonies had mean ages of 114, 144 and 116 ticks; the oldest surviving bonds were 241, 481 and 558 ticks respectively. Aggregate final bonds are about three times the starting adaptive profile. This does not mean every bond survives longer or that the whole morphology remains unchanged.

Absolute starvation deaths were lower in one seed and higher in the other two: starting 17/21/20 versus renewing 40/17/43. Larger births/populations expose more organisms to death. Do not describe this as uniformly lower starvation. Gate completions were similar in aggregate: 144 versus 143. Enabling the optional learned compass on the renewing setup produced 123 final members and 148 bonds, worse than 150/185 without it. It is therefore off by default, rather than presented as demonstrated intelligence.

Raw data: `research-results/morphology-verification.json`. Reproduce: `node scripts/verify-morphology-world.mjs`.

## Exact continuity, not just replacement formations

Three steady-field, two-world runs tracked original member object identity and original endpoint-pair edges 80 ticks after reincarnation:

| Seed | Members / edges carried | Original members / edges still present after 80 ticks | World-two final population / bonds |
|---|---:|---:|---:|
|160103|34 / 49|34 / 48|251 / 313|
|160104|51 / 70|47 / 46|181 / 209|
|160118, held out|21 / 24|17 / 7|210 / 243|

Original founders are not expected to survive another full 1,000 ticks: ageing remains active. Seed 160118 also shows that carry-over does not guarantee topology retention. Raw data: `research-results/renewing-continuity.json`; runner: `node scripts/verify-renewing-continuity.mjs`.

## Changed-field response

After 400 ticks, impose reward-left/danger-right for 200 ticks. Compare the same pre-change cohort with environmental movement sensing off versus the selected danger bias of 48. Mean danger exposure among living cohort members fell from 0.1244 to 0.0986 for seed 160103, and 0.0912 to 0.0836 for seed 160104 (about 21% and 8%). Cohort survivors were 20→25 and 19→16: mixed individual survival. Aggregate final population/bonds were 91/97 blind versus 98/115 with sensing.

This supports useful designed environmental responsiveness; it is **not** proof that a learned policy discovered avoidance. Motion remains constrained by walls, occupancy and maintaining existing adjacencies, so not every component escapes. Raw data: `research-results/renewing-field-final.json`; runner: `node scripts/challenge-renewing-field.mjs`. Earlier exploratory challenge files are retained separately and are not substituted for this final control.

## Complete live-demo verification

Both runs use the final profile and the automatic three-phase schedule, including final danger navigation. World two includes the live carried components.

| Seed | World | Population / bonds at tick 400 | At tick 600 after danger | At tick 1,000 after recovery |
|---|---:|---:|---:|---:|
|160104|1|45 / 47|46 / 43|49 / 65|
|160104|2|78 / 83|50 / 50|234 / 157|
|160118|1|53 / 58|52 / 48|42 / 49|
|160118|2|211 / 255|195 / 228|232 / 280|

At 80 ticks into world two, original carried-member/edge retention was **37/45** of the original 40/65 for seed 160104, and **28/33** of 30/49 for seed 160118. There were 429 local shape moves in seed 160104's first world and 1,240 in seed 160118's second. There is movement, partial breakup, renewal and recovery—not guaranteed rigid survival. Raw data: `research-results/colony-demonstration.json`; runner: `node scripts/verify-colony-demonstration.mjs`.

## Correctness fixes and checks

- Rebuild occupied cells after local shape changes, before ordinary movement. Previously another actor could enter a newly occupied cell.
- At carry-over, clear new walls underneath carried members and relocate only colliding newcomers. Do not teleport or overwrite the survivor topology.
- Food-growth attempts no longer multiply by playback speed. Speed changes elapsed simulation ticks per frame, not the ecology within a tick. Old high-speed results may therefore not be comparable with corrected runs.
- Regression checks cover paid formation/renewal conservation, unique occupancy, wall/newcomer-safe carry, visible/headless and speed parity, finite field stock, phase timing and manual image precedence.

Run:

```text
node test/adaptive-morphology.mjs
node test/morphology-occupancy.mjs
node test/morphology-renewal.mjs
node test/morphology-speed-parity.mjs
node test/morphology-demonstration.mjs
```

Exploratory screens are in `morphology-search.json` and `morphology-validation.json`; these preceded the occupancy correction and are not final validation evidence. The checked-in runners save raw results incrementally. Served markup, scripts and API mode are checked; no screenshot-based visual QA is claimed in this pass.

## Startup controls (PowerShell)

Normal selected demonstration: `npm start` with the variables below unset. To choose alternatives, set the relevant variable before starting; restart the server after changes.

```powershell
$env:GENESIS_FIELD_DEMO='0' # steady patches; image uploads also override demo automatically
$env:GENESIS_SEED='160103' # optional alternate seed
$env:GENESIS_MORPHOLOGY_PROFILE='original-adaptive' # previous adaptive parameters
$env:GENESIS_ADAPTIVE_MORPHOLOGY='0' # original reincarnation mode on this branch
```

Use `Remove-Item Env:GENESIS_FIELD_DEMO` (and likewise for other variables) to restore a default. Do not set all alternatives simultaneously unless that is intentional. `GENESIS_ADAPTIVE_MORPHOLOGY=0` retains this branch's correctness fixes; it is not a checkout of a historical commit.

## Research direction and limits

We now have a better experimental substrate: finite spatial energy, paid connections, generational replacement, exact structural continuity and observable response to changing fields. This is not yet evidence of spontaneous intelligence or semantic shape memory. Operating costs and field income are explicit designed incentives. Shapes are emergent within designed rules; no pentagon/diamond whitelist is used.

Next, compare evolved sensing/allocation policies against this fixed controller on unfamiliar reward/danger images and reversed fields, with equal budgets and original-lineage tracking. Select for useful adjustment and transfer, not only population or pretty geometry. Multi-member shape edits, long-run CPU/population stability and persistence across a server restart remain unproven. This pass ran two worlds per final demonstration seed, not a 24-hour deployment soak.
