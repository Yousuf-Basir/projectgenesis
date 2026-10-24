# Resource-aware reproduction — 24 October 2026

## Purpose and scope

Fast circulation made some structures productive enough to grow rapidly, but the strongest seed subsequently suffered many starvation deaths. This experiment asks whether a small local birth-affordability forecast can reduce that overshoot without suppressing member replacement. It changes permission to reproduce, not energy production or the energy split.

The preceding circulation + closure version is the control. Reliable pantry reserves and contact harvesting remain enabled in every comparison. No development subsidy, forced shape, privileged gate, extra food or new mutation rule was added.

## Rules

1. Keep the existing parent/child endowment, attached upkeep and connection-seeding affordability checks.
2. Inspect the parent and physically adjacent, actively bonded one-hop neighbours only. Distant members, food, stored inventories and component wallets are not credited as spendable forecast income.
3. Use the existing smoothed operating-cost and earned-food/field-income traces. Credit only 80% of recently measured income and assume at least 25% of operating cost remains a deficit. These are authored conservative heuristics, not evolved predictions.
4. The parent and prospective child must each retain the forecast horizon's operating budget. The child is provisionally charged the parent's measured cost, without assuming it already earns income.
5. A neighbour below two operating payments prevents expansion. The local balance must also cover estimated net operating demand, the new child's demand and local bond upkeep over the horizon.
6. Include newborns already planned this tick, without counting their energy as new income or counting a materialized child twice. Failed opportunities reserve nothing. No new random draws are introduced.
7. Ordinary births, autonomous facet budding and topology-proactive births all use the same check. Existing renewal eligibility remains; it is not an exemption from affordability.

The 60-tick horizon is one bounded experimental setting, not a physical constant or proof of minimal rules. The generic/default startup flag remains off unless explicitly selected. Ageing, ordinary starvation, food decay and bond costs remain active.

## Measured results: 2,000 ticks, three matched seeds

| Seed | Policy | Final bonds | Starvation deaths | Births | Bond-ticks | Longest observed motif |
|---|---|---:|---:|---:|---:|---:|
|160104|Control|230|124|369|220,982|571|
|160104|60 ticks|243|124|376|217,715|433|
|160121|Control|32|20|81|86,630|571|
|160121|60 ticks|32|21|78|88,109|571|
|160138|Control|8|17|122|62,656|583|
|160138|60 ticks|21|9|73|66,611|583|

The middle horizon helped the weak seed, but did **not** fix high-population overshoot. Its total starvation was 154 versus 161 and total bond-time 372,435 versus 370,268: small aggregate differences, not a robust breakthrough. The first seed had more births and a shorter longest motif despite more final bonds. Final populations were 189/26/34 versus 184/30/82; lower population alone is not a win.

The 24-tick setting had no physical effect in these runs. The 120-tick setting ended with 171/10/4 bonds, 105/19/12 starvation deaths and 271/31/34 births: it suppressed replacement too much. Nine new 2,000-tick candidates were measured (18,000 ticks), using the three previous full-circulation controls. All raw outcomes, including failures, are retained.

Decision: retain a switchable 60-tick candidate for local observation, with the generic startup default off. This is the best of the three tested horizons by this limited comparison, so it is selected on development data—not validated on unseen seeds. Next, compare cost/runway-weighted circulation against equal body-energy sharing; reproduction control alone did not solve energy distribution or old-age collapse.

## Reproduce the comparisons

```bash
npm test
node test/aligned-budgets.mjs
node test/pantry-routing.mjs
node test/morphology-speed-parity.mjs
node scripts/compare-loop-circulation.mjs 160104 closure 2000 runway 60
# Repeat with seeds 160121 and 160138; also try horizons 24 and 120.
```

Raw candidate reports: `research-results/reproduction-runway-<horizon>-<seed>-closure-2000.json`.
Control reports: `research-results/loop-circulation-<seed>-closure-2000.json`.

Each comparison includes the 1,000-tick carry-over boundary. Food conservation and circulation-loss assertions are checked during the runs. The 24-tick candidates matched the preceding control's physical summary metrics exactly on all three seeds. Controls are the preceding measured runs, not fresh repeats silently counted as new experiments.

Candidate reports were generated while forecast rejection was counted before the older affordability check. Final runtime diagnostics count only additional rejections after that check. This changes the diagnostic counter, not physical trajectories; candidate `runwayDenied` values should not be interpreted as births certainly prevented.

## Limitations

Recent income can disappear; smoothed costs lag change. The child's actual genome, movements, future connections and extra transfers can differ from the parent's estimate. The forecast does not model every later maintenance/transport outflow or promise future access to food. A local check cannot detect every distant component shortage. Fewer starvation deaths with fewer births is not sufficient evidence of improvement: bond-time, surviving bonds, age deaths and motif lifetime must also be considered. Three selected development seeds are not an independent validation set or evidence of intelligence.

## Controls and publication

Set `GENESIS_REPRODUCTION_RUNWAY=1` before starting the local server to enable the 60-tick candidate; `0` restores the preceding reproduction checks. Keep the other circulation/pantry/harvesting settings identical when comparing. The snapshot exposes `bonding.reproductionRunway` and its rejection counter. A restart begins a new in-memory world.

This work is packaged on `codex/adaptive-morphology-world` in release tag `genesis-demo-2026-10-24`. It is absent from the older `b1bab422` deployment SHA. Do not deploy that old checkout expecting this flag to exist. The stable/control env file leaves it off; the experimental env file enables it.
