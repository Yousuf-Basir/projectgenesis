# Harvest-first member support — 2026-10-23

Fresh harvested energy can now support hungry direct bonded neighbours before ordinary bond funding and reserve deposits. This includes all meals, including gate-field harvest. The eater must retain the larger of its reproduction floor and ordinary support threshold. The pool is at most 25% of the current meal. Recipients must be alive, adjacent, joined by an awake existing bond, and below the support threshold. Lowest-energy recipients are served first. Delivery efficiency is 98%; losses are recorded. Delivered energy rewards the participating edge through the existing useful-work commitment mechanism. The remaining meal budget is used by later sharing and funding steps, so the allocation is not counted twice.

This experiment remains OFF by default. Enable it across reincarnation cycles using `ReincarnationController({harvestMemberSupportEnabled:true})`; snapshot exposes this flag and `bonding.harvestMemberSupport` transfer/delivery/loss diagnostics. The existing baseline, evolution and useful-work rewards continue to be the reference. Shrinking, conservation and emergency reserve relay remain off.

Matched seed screen, 1,000 ticks each:

| Seed | Support | Population | Bonds | Facets | Starvation deaths | Gate completions |
|---|---|---:|---:|---:|---:|---:|
| 160103 | off | 27 | 61 | 98 | 46 | 35 |
| 160103 | on | 25 | 35 | 21 | 43 | 33 |
| 160104 | off | 45 | 32 | 9 | 67 | 51 |
| 160104 | on | 28 | 20 | 10 | 69 | 60 |

Combined starvation deaths declined only 113→112, whereas final population fell 72→53 and final bonds 93→55. The treatment delivered 221.49 energy with 4.52 lost, across 89 transfers. This largely removes relay losses but does not establish a persistence benefit. These are only two seed endpoints; they do not measure individual bond lifetime or isolate causal effects of specific individual transfers.

Validation: `node test/harvest-member-support.mjs` checks meal cap, donor floor, conservation with explicit loss, connected recipient eligibility, dormant-edge exclusion and disabling. `node scripts/run-harvest-support-screen.mjs` repeats the paired simulations; raw results are in `research-results/harvest-support-screen.json`.

Next evidence needed: record the trajectories of supported recipients and donor descendants, member-level income versus compulsory upkeep, and which reserve/facet investments were displaced. More transfers alone are not a suitable objective. Evaluate support timing and target using these trajectories before changing defaults or adding further mechanisms.
