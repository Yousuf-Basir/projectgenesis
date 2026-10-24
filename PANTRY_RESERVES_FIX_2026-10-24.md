# Food storage and threatened-bond reuse — 24 October 2026

## Observed problem

The user seldom saw a food-colored `+`. A live cycle-2 sample at tick 922 showed 20 closed chambers, zero stocked chambers and zero stored energy. Only 34.27 energy had entered pantries that world: 18.35 fed members, 0.69 paid bonds, 2.50 spoiled, 0.62 was lost in transfer and 12.11 was lost with dying owners. The ledger balanced. The empty display was real, not merely a hidden marker.

The previous default saved only harvest that would otherwise overflow body capacity (`harvestFraction=0`). A healthy organism below capacity therefore did not build a reserve at all. Also, food transport led toward chambers rather than outward to needy tails. The early maintenance pass could rely on body surplus that was not yet debited, leaving no final pantry check after other actions.

## Changes

1. Save otherwise-overflowing food as before, plus **15% of actual credited food harvest**, capped by room and body surplus above the member's existing reproduction threshold. A hungry member is not taxed. No body-to-food conversion without a real meal, invented stock, added field energy, or fictional food color for organism-harvest energy is introduced.
2. A real need on the bond graph can draw inventory outward from a chamber. Requests use current energy, upkeep and the previous operating expense; food still moves at most one bond-hop per tick, with 0.5 sender bandwidth, finite capacity and 98% efficiency. Newly arriving stock cannot be forwarded twice in that pass. These are authored graph requests, not learned planning; request-distance calculation itself has no multi-tick communication latency.
3. Immediately before `updateBonds` charges maintenance, settle available component/body funding and then draw real endpoint pantry stock for any remaining two-payment buffer. No earlier promise of body surplus substitutes for actual payment. Red is used first, then blue, then green; edible food needed for the member's own immediate operating target remains protected. This does not resurrect severed edges or make distant inventory instantly available.
4. Keep the existing top-layer colored `+` for genuinely stocked chambers. Add `stocked N/M` to the small status line, matching the renderer's per-color 0.01 display threshold. Show member feeding and `bond fuel` separately as energy spent this cycle. Shared-node stores are assigned to one chamber only: neighboring triangles cannot duplicate the same food or each earn a decorative plus. Existing loose-owner squares remain.

Safety test `test/pantry-reserves.mjs` constructs a case where early body funding appears possible, then body energy drops before maintenance. With food available, all three otherwise-unfunded bonds survive, store balances fall by the actual payment, and only maintenance is lost. It also verifies outward two-hop delivery takes two passes and that the received food really funds the threatened edge. Off, legacy, hunger, capacity and full-accounting controls are covered.

## Runtime controls and diagnostics

The updated local server enables the fix by default when adaptive pantries/reuse are active. Set **`GENESIS_PANTRY_RESERVES=0`** before startup to compare the preceding policy. `GENESIS_PANTRY_REUSE=0` or disabling pantries also disables the new savings/routing/settlement behavior. Generic simulation configs default the new layer off so historical experiment controls remain comparable. Restarting loses the in-memory run; no hot toggle or durable checkpoint is added.

`bonding.foodPantries` now includes `reliableReservesEnabled`, `savingsFraction`, `stockedChambers`, `surplusSaved`, `demandRouted` and `lateBondDelivered`. `bondDelivered` includes both early and final payments. Payment counters do not prove a number of distinct bonds saved; `demandRouted` sums energy over hops and may count a food unit again on a later hop.

The full inventory identity remains:

`opening carried stock + deposits = remaining stock + food delivered to members + food delivered to bonds + spoilage + transport losses + dead-owner losses`.

## Matched 1,200-tick checks

Two seeds, each fix on/off, with the same adaptive-foraging profile, pantry reuse, normal cycle transition at tick 1,000, and organism harvesting **on** to match the current local demo. Only the reserve fix varies. All sampled pantry ledger assertions pass, including carry-over.

| Initial seed | Tick-500 stocked chambers, off → on | First-world food paid to bonds, off → on | First-world final bonds, off → on | Tick-1,200 final bonds, off → on |
| --- | --- | --- | --- | --- |
| 160104 | 6/23 → 12/18 | 5.29 → 47.81 | 24 → 20 | 58 → 54 |
| 160121 | 3/33 → 9/22 | 3.06 → 34.04 | 23 → 53 | 68 → 79 |

First-world final stored energy rose from 17.20 to 39.76 and from 11.32 to 199.53 respectively. Late maintenance settlements alone paid 8.48 and 12.43 energy in those first worlds. First-world starvation deaths were 15 → 13 and 23 → 14. Those are counts, not normalized survival rates.

**Conclusion:** the requested storage and reuse behavior is measurably stronger and physically accounted. This does not prove universal survival improvement: endpoint bond counts regress modestly on the original seed and improve on the other. No promise is made that every shape will stay stocked or every bond will survive. Broken routes, finite food, unavoidable member death and competing immediate needs still matter.

Run:

```bash
node test/pantry-reserves.mjs
node test/food-pantries.mjs
node test/pantry-routing.mjs
node test/renderer-pantry-markers.mjs
node scripts/compare-pantry-reserves.mjs 160104 on
node scripts/compare-pantry-reserves.mjs 160104 off
node scripts/compare-pantry-reserves.mjs 160121 on
node scripts/compare-pantry-reserves.mjs 160121 off
```

Raw results: `research-results/pantry-reserves-<seed>-<on|off>.json`. No previous reports are overwritten. These changes are packaged in `genesis-demo-2026-10-24`; the deployment handoff distinguishes that release from the older published pantry baseline and provides exact presets.
