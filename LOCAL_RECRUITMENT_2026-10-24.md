# Local recruitment and surplus support — 24 October 2026

**WITHDRAWN:** recruitment misunderstood the user's intent. Its runtime module, movement cue, sharing changes, configuration and test runner were removed on 24 October 2026. This file and raw results are retained as historical experiment records, not deployment instructions. The replacement is `ORGANISM_HARVEST_2026-10-24.md`; `GENESIS_LOCAL_RECRUITMENT` is no longer a supported flag in this working tree.

## Purpose

A live sample contained 13 completely unbonded organisms, 10 holding at least 90 energy. Those balances cannot automatically fund distant bonds. This layer improves local encounters and usable energy exchange rather than adding a subsidy or consuming live organisms.

## Rules

- A living, currently unbonded organism must express binding, have the coupling capability, and retain its protected endowment plus a normal connection creation budget.
- It senses only binding-active members of components of at least three. A receiving member needs a funded, intact, non-dormant adjacent edge and room under the existing degree limit. It must also have a real need: body energy below its protected endowment or an edge below the existing two-payment upkeep buffer. Healthy colonies do not advertise endlessly.
- The nearest qualifying member within six cells supplies a bounded direction-score bias of 0.35. Once within bond range, the bias favors remaining in contact. It does not teleport, stop the whole world, override legal movement, or force a connection. Ordinary food/image/brain direction scores still compete.
- Contact must still pass the existing three-tick budding rule, binding eligibility, degree/connection caps, adjacency and paid formation. There is no shape whitelist, birth bonus or privileged member.
- Successfully recruited members can supply hungry neighbors below the existing support threshold through real adjacent non-dormant edges: up to 0.5 energy per edge per tick as early support, at the existing 98% efficiency. Existing critical two-operating-payment rescue remains available without that new preventive cap. The recruit flag is attached to the actual member, not copied as a privileged child caste.
- Donors cannot cross their aligned protected endowment. Opening surplus bounds their exports: newly received energy is not re-exportable through this new channel in the same preparation pass. Normal edge equalization remains available. This does not add an instantaneous component-wide wallet.
- The received energy belongs to a real member. The existing maintenance payer, paid reproduction and pantry rules decide how it is subsequently used; recruitment does not grant immortal bonds.

The cue itself has no separately metered signal expense: it is an explicitly authored local interaction rule. It currently uses nearby coordinates without an additional wall-occlusion/pathfinding test, although actual movement and bonding still obey existing rules. This is not evidence of learned negotiation. Radius, bias and preventive rate are engineering choices exposed under `bond.adaptiveMorphology` rather than a large new policy tree.

## Observability and comparison

Default: enabled in `adaptive-foraging`. Environment off switch: `GENESIS_LOCAL_RECRUITMENT=0` before server startup. Restarting loses the current in-memory world; this is not a hot toggle.

`/api/state` → `bonding.adaptiveMorphology` includes configuration and:

- `recruitedMembers`: counted successful target attachments, not necessarily unique lifetime organisms or permanent memberships.
- `recruitmentSupport`: delivered hunger-support energy from members that successfully attached through this layer. It includes their normal critical rescue payments, so it is not a counterfactual measure of additional survival.
- Existing `shared`, `transferLoss`, field and bond-maintenance ledgers remain available.

The existing canvas bodies, bonds and transfer flashes show the physical result; the small status line includes a recruit counter. No new large overlay or special predation animation is added.

Run deterministic guards with `node test/local-recruitment.mjs`. Matched comparisons: `node scripts/compare-local-recruitment.mjs 160104 on` and the same command with `off`; repeat with seed `160121`. Each runs two 1,000-tick worlds, matching seed/profile/pantry settings and changing only this layer. Final candidate results use `research-results/local-recruitment-<seed>-on-need-targeted.json`; the initial, broader implementation used `...-on.json` and controls used `...-off.json`. The earlier candidate attracted newcomers to healthy colonies and changed sharing on all edges; it was rejected after mixed or negative outcomes. Do not confuse those files with the final need-targeted rule.

Metrics include final population/bonds, integrated bond-ticks, starvation/age deaths and carried endpoint-pair presence. Endpoint-pair presence is not a proof that a specific physical bond stayed continuously unbroken or that a species is intelligent. Population or attractive formations alone are insufficient.

No external predation, donor sacrifice, global attraction, extra food or free reserve is implemented.

## Measured result: works as an interaction, not a general survival fix

Matched 2,000-tick runs, with normal carry-over at tick 1,000:

| Seed | Final bonds, off → need-targeted on | Second-world bond-ticks, off → on | Target attachments in second world | Second-world starvation deaths, off → on |
| --- | --- | --- | --- | --- |
| 160104 | 161 → 214 | 69,292 → 150,335 | 62 | 16 → 152 |
| 160121 | 283 → 27 | 91,774 → 42,176 | 9 | 37 → 24 |

First-world final bonds were 49 → 54 for 160104 and 34 → 21 for 160121. Second-world delivered support from recruits was 927.37 and 152.99 energy units respectively. In both seeds, no opening second-world endpoint-pair remained at its end; recruitment has not solved literal long-term bond continuity. Age limits still apply.

The original seed shows more bonded activity and a higher endpoint count, but sharply higher starvation/turnover. The second seed regresses substantially in final population and bonds despite fewer starvation deaths. These are small, deterministic, matched examples—not a robust performance claim. More attachments, surviving endpoint counts and reduced starvation are different objectives; none alone establishes improved ecological persistence.

The local demo enables this **experimental** layer for observation on the existing seed 160104. Use the off switch to return to the previous behavior. Do not advertise it as a validated improvement or silently deploy it as a proven survival fix. The next question is whether a component can afford the added member's ongoing energy demand, rather than just the initial connection price.

Validation passed: local recruitment guards (including preserving critical rescue, paid formation, finite locality, binding consent, no same-pass social re-export, dormant/off controls), aligned budgets, pantry routing, spatial/guided regressions, occupancy/carry and pantry marker rendering. Existing historical budget/pantry comparisons explicitly pin recruitment off, keeping their old reference measurements comparable.
