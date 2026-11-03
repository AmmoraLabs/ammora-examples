# SDK 0.3.0 venue integration


```bash
npm run venues:quote-math
npm run routing:policy -- 1036800 2 venue:demo
```


Both commands are offline and load no wallet. The math fixture is synthetic; it has no
chain or pool address. It demonstrates the new required `tickSpacing` input and returns
`liquidityAfter`. Do not infer spacing from fee tier: live Uniswap V3/V4 providers must
read and authenticate actual pool spacing, all required ticks and state at one block.
The quote crosses bitmap word boundaries with integer rounding; missing tick-window
coverage remains an error. A returned math result is not an executable swap plan.

SDK 0.3.0 also opens `AmmoraRouteModel` to `venue:<slug>`. Narrow strings with
`isAmmoraBuiltInRouteModel` or `isAmmoraExternalVenueRouteModel` before handling them in a
UI. A `VenueQuoteProvider<MyState>` declares its `model` and `binding` (`pool` plus every
`stateReaders` contract). These declarations are checked against a reviewed venue
descriptor and on-chain registry/runtime/wiring; naming a model does not admit a venue.
Venue discovery is supplied by the partner and verified against the on-chain binding.

Use `venues`/`venuesDisabled`, `resolveAmmoraVenueObservation` and `atomicMultiHop`.
`uniswapV4Venue`, `uniswapV4VenueDisabled` and `atomicTwoHop` are deprecated compatibility
mirrors. `routing:auto-route-status` prints the new observation API, block and observation
time. A disabled or unverified venue is different from a valid venue with no liquidity.
Availability is a snapshot: recreate/reverify a live client before trading; it does not
refresh itself. An empty venue map means none are declared in the selected catalog.

Risk policies now use `newPoolWindowSeconds`, converted with the route deployment's
`blockTimeSeconds`. The offline policy example uses two seconds only as a CLI illustration;
supply the reviewed chain's actual assumption in a live integration. Pass **partial**
overrides to `AmmoraRouteClient.create({ ..., riskPolicy: overrides })`; omitted fields
retain SDK defaults. Read `client.riskPolicy` to show what is actually enforced. The SDK
rejects unknown keys, wrong units/types and invalid bounds. The deprecated
`newPoolBlockWindow` overrides duration entirely, so omit it in new code.

External venue execution requires reviewed contracts, descriptors, provider bindings,
registry admission, oracle/valuation inputs and actual runtime checks. This repository
does not ship invented GIWA venue pins or an admission transaction. Launchpad teams can
create tokens and trade their reviewed DBC/Graduation pools without hosting an external
venue. See [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) and
[route examples](https://docs.ammora.org/guides/src-routing-readme).
