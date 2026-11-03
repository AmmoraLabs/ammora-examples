# GIWA-native stablecoin partner integration guide

**Recommended starting point: [stablecoin partner quickstart](https://docs.ammora.org/guides/stablecoin-quickstart).** It connects wallets, funding, selected-Registry registration, low fees, fee-only delegation, separate payouts and withdrawal through one new ALMM profile. The model comparison and default-catalog paths below describe their existing deployments; do not mix their Registry/CLI with the new profile.

Partners **issue and operate their own stablecoins on GIWA**, then provide trading and liquidity through Ammora. Use public `@ammora-protocol/sdk@0.3.8`. Existing issuer ERC-20s connect to independent ARL or ALMM pools; they are not minted again through Ammora Launch and do not pass through a bonding curve or graduation.

These examples target **GIWA Sepolia testnet (91342)**. Mainnet requires separate deployment, support and asset review. SDK `createProductionPool` is an interface name; it does not make this example a production-network deployment.

Read the [issuer selection guide](https://docs.ammora.org/guides/stablecoin-choices) for models, low-fee presets, delegation and withdrawal conditions. The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) did not resend earlier successful transactions.

## Choose a supported path before execution

| Requirement | Current path and validation scope |
|---|---|
| Basic pool, new LP, both trade directions, claims, full exit and empty-NFT closure | Default-catalog ALMM path; observed default **30 bp (0.30%)**, reread at execution. New LP can enter an existing empty pool |
| Fee-only delegation and separate payout | **Managed ARL NFT** path; actual delegated payouts, balance increases and authority rejection reuse existing evidence. Last raw liquidity unit and minimum-only-pool restart have limitations |
| 1 bp preset | [ALMM preset guide](https://docs.ammora.org/guides/almm-preset); synthetic-only deployment verified. Does not automatically replace the default catalog with an official low-fee preset |
| Official FDUSD/cUSD assets and issuance/redemption | Issuer approval, GIWA addresses, actual controls and operations review required; unresolved templates are **BLOCKED** |

**No single model in this default-catalog comparison supplies all of these features.** Do not interpret ALMM feeOwner payouts as ARL-style fee-only delegation or arbitrary payouts. The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) distinguishes new execution, reused evidence and unsupported conditions.

## 1. Issuer and Ammora responsibilities

| Party | Responsibilities |
|---|---|
| Issuer | Deploy native GIWA ERC-20, publish official chain/address/decimals, operate mint/burn, reserves, issuance/redemption, proxy/upgrade/pause/blacklist controls and emergency contacts |
| LP / market maker | Supply counterasset and both inventories; define LP owner, price/range/bins/fee, budgets, withdrawal conditions and stop criteria |
| Ammora integration team | Use reviewed SDK catalog/Factory/Registry, verify assets and authority, provide pool/trade/LP/fee examples and receipt reconciliation |
| Joint decisions | Test/official support scope, liquidity budget/responsibility, public claims/branding, actual exits and pilot success metrics |

Issuance/redemption uses issuer contracts and operations. Pool creation grants neither issuer mint authority nor fiat redemption services. Issuers do not transfer admin/mint control to Ammora. Pool creator, LP owner, fee beneficiary, fee delegate and payout are distinct roles. Creating a pool for ordinary exact-transfer ERC-20s does not require making the issuer an Ammora registrar. Manifest issuer review records native-asset provenance and collaboration scope; permissionless technical verification, official partnership announcements and support agreements remain separate.

## 2. Installation, wallets and funding

```bash
curl -fL https://docs.ammora.org/examples/setup.mjs -o ammora-examples-setup.mjs
# Review the setup source, then prepare a new directory
node ammora-examples-setup.mjs ./ammora-examples
cd ammora-examples
npm ci
mkdir -p .validation/stablecoin
export AMMORA_CHAIN_ID=91342 AMMORA_GIWA_GENERATION=auto-route
export AMMORA_SEND=0 AMMORA_READ_RECEIPT=''
export AMMORA_ACCOUNT=YOUR_REVIEWED_CALLER_ADDRESS
```

- LP owner needs **native ETH** for gas and **both ERC-20 balances**. ETH and WETH balances are distinct.
- A fee delegate is optional and needs native gas when executing claims.
- Sign with a reviewed operating wallet. The example signer reads process `AMMORA_PRIVATE_KEY` at execution. Never place keys in source, command arguments, JSON or logs. Managed wallets require a separately reviewed signer integration.
- Use your own wallets and recipients; do not copy Ammora test wallets, tokens or NFTs from reports.
- `AMMORA_READ_RECEIPT` pins reads to a historical transaction block; explicitly clear it for new plans.

## 3. Review issued assets in a manifest

Copy the [native issuer template](https://docs.ammora.org/examples/source/src/stablecoin/manifests/native-issuer.template.json.txt). The FDUSD/cUSD [examples](https://github.com/AmmoraLabs/ammora-examples/blob/main/src/stablecoin/manifests) have **unconfirmed approvals, addresses, decimals and proxy details** and cannot execute. Never label another-chain address or same-symbol mock as an official GIWA asset.

```bash
cp src/stablecoin/manifests/native-issuer.template.json .validation/stablecoin/partner.json
npm run stablecoin:inspect -- .validation/stablecoin/partner.json
```

Unresolved templates output `classification: BLOCKED`, `rpc:false`, `signing:false`. Setting `reviewed` does not automatically issue approval or an audit. Review and record the following evidence first:

- `origin.kind=native-issuer`, issuer identity and public approval for the GIWA test-support scope. Select an actual officially deployed GIWA asset.
- Both assets' addresses, 0–18 decimals and reviewed runtime code hashes, compared with reviewed source/deployment artifacts.
- `immutable` status or reviewed `eip1967` implementation/code hash/admin. Do not bypass `unreviewed`, beacon/custom or unsupported proxy forms.
- `review.controls` for mint/burn, upgrade, pause, freeze, blacklist and responsible parties. In `review.authorities`, use ABI-compatible `{kind:"owner",account:"0x..."}` or `{kind:"role",role:"0x32_BYTE_ROLE",account:"0x...",allowed:true}` and compare current `owner()`/`hasRole()` state each time. A renounced owner uses `account:null`. Empty arrays do not prove absence of authority; unlisted roles and other control interfaces require source/event/operational review. Enable `pausedGetter`/`blacklistGetter` only after reviewing actual `paused()`/`isBlacklisted(address)` interfaces. `false` does not prove absence of those controls; different ABIs require review and example extensions.
- `liquidityOwner`, `payout` and optional `feeDelegate`. Receiving fees does not make payout the LP principal owner.
- Per-token raw input caps, fee/slippage/price-deviation/net-execution-cost limits and gas limits.
- Independent price/exit evidence, observation timestamp and validity period. A pool cannot certify its own peg. `reference.quotePerBase` means **quote units per one base**, not automatically a dollar price.

Share tokens such as stcUSD are distinct from cUSD. Review share conversion and redemption restrictions before using a 1:1 stable preset. This P0 supports ordinary exact-transfer ERC-20s, not fee-on-transfer, rebasing or unreviewed callback behavior.

## 4. Factory-specific token policies and probes

```bash
npm run stablecoin:policy -- .validation/stablecoin/partner.json
```

Examples compare SDK catalog Factory/Manager/Registry runtimes with fixed reviewed hashes and read Factory→Registry bindings. ARL, ALMM and DFS may use different registries. Admission in one Registry does not establish another Registry's admission or aggregation support.

Only unclassified (`kind=0`) exact-transfer assets without an owner policy can use a permissionless round-trip registration plan. Review `asset` and small `probeRaw` in the [probe request](https://docs.ammora.org/examples/source/src/stablecoin/requests/probe.template.json.txt).

```bash
npm run stablecoin:probe -- .validation/stablecoin/partner.json ./probe.json .validation/stablecoin/probe-plan.json
```

This command does not change classified assets or owner policies. It does not call `setPolicy`, registrar grants or aggregation admission. A probe verifies round-trip transfers at a particular block, not official status, reserves, redemption or future upgrade safety. Review quote assets independently at each required Registry; do not register already-supported assets again.

Use the Registry **actually read from the selected model's Factory**. Do not assume auto-route Launch/ARL and shared ALMM use the same Registry, or reuse one Registry's probe as another's admission. A pilot follows the one selected model. The verified legacy shared-ALMM Registry has no separate `aggregationRouterAllowed` getter; reads report **unsupported/null**, rather than hiding arbitrary reverts as false or treating them as approval. The newer ARL Registry exposes separate admission state. Both paths in this P0 use direct pools only.

## 5. Plan pools and liquidity

Choose **one pair and one model** first. There is no need to split initial liquidity across ARL and ALMM.

| Model | Creation and initial LP | Price/fee boundaries |
|---|---|---|
| ARL Concentrated | Pool plus initial seed in one transaction; first NFT uses that pool's unlocked **RAW_POOL** ID | Pool-wide min/max range and explicit static fee; do not copy `arl:create-pool`'s 100 bps/permanent-lock defaults |
| ALMM | Empty-pool creation, then separate seed creates a Manager NFT | Per-bin distribution; requested fee must match the **current Factory default**. No arbitrary fee changes or preset governance registration |

**Low-fee limitation recorded in the P0:** public SDK 0.3.7's ARL production fee schedule had a **25 bp (0.25%) floor**. A 1 bp request is rejected as `BLOCKED_ARL_FEE_FLOOR`; requests and caps are never silently increased. The 25 bp example demonstrates the interface and is not a stable-pair fee recommendation. If 1 bp or less is mandatory, defer launch until separate SDK/fee-controller/deployment qualification is complete. ALMM requires its own default/preset/dynamic-fee checks; do not apply the ARL floor to it.

Raw amounts in the [liquidity-policy example](https://docs.ammora.org/examples/source/src/stablecoin/requests/liquidity-policy.template.json.txt) assume **ARL base 6 / quote 18 decimals and 25 bp**. Replace them with actual manifest decimals and approve the budget first. With ALMM, explicitly agree its actual default/preset fee, requested `feeBps` and manifest `policy.maxFeeBps` separately. The historical 30 bp validation is not a recommendation. Changing the 25 bp template's model to ALMM does not automatically change it to 30 bp.

```bash
# --silent saves JSON without npm banners.
npm run --silent stablecoin:plan-liquidity -- .validation/stablecoin/partner.json ./liquidity-policy.json > .validation/stablecoin/liquidity.json
# Save/review ARL request, or ALMM createRequest and seedRequest, as separate JSON files.
# Example: selected model is ALMM
node --input-type=module -e 'import fs from "node:fs"; const x=JSON.parse(fs.readFileSync(".validation/stablecoin/liquidity.json")); for(const [k,f] of [["createRequest","create-almm.json"],["seedRequest","seed-almm.json"]]) fs.writeFileSync(".validation/stablecoin/"+f,JSON.stringify(x[k],null,2)+"\n",{flag:"wx"});'
# Save/review ARL output request in a separate file
npm run stablecoin:arl:create -- .validation/stablecoin/partner.json ./create-arl.json .validation/stablecoin/create-plan.json
# Default ALMM: read Factory key, policy and actual existing-pool fees/authority first.
npm run --silent stablecoin:almm:discover -- .validation/stablecoin/partner.json .validation/stablecoin/create-almm.json > .validation/stablecoin/market.json
# Plan creation only for route=new-pool and canCreate=true.
npm run stablecoin:almm:create -- .validation/stablecoin/partner.json .validation/stablecoin/create-almm.json .validation/stablecoin/create-plan.json
```

For `route=existing-pool`, **do not rerun creation**. `canCreate:false` is expected. Confirm `readyToReviewExistingLiquidity:true` and `blockers:[]`; review `existingPool`, `state.activeId` and `economics` base/current/dynamic fee, protocolFeeShare, owner and feeRecipient. Preserve existing LP rights and create **only your own LP with a new seed plan**. Balances, price, distribution, amounts and slippage require separate review. If activeId differs from the creation request, review a new seedRequest against actual pool price/bins. Discovery of `new-pool` is not creation approval; re-review if another sender's creation/configuration causes an execution gate failure.

ALMM manifests use the **lower token address as base**; reverse order is rejected before RPC/signing. Reordering assets also requires swapping decimals and raw budgets and reviewing the reciprocal quote-per-base reference. `activeId=0` does not mean human 1:1 for unequal decimals; the planner converts raw prices. ARL `activationPoint` is a positive UNIX timestamp; even immediate activation uses the planner's timestamp, not zero.

A desired fee that differs from Factory default yields `BLOCKED_ALMM_FEE_CONFIG`. Separately choose a reviewed preset or ARL path. This example does not change governance to lower default fees. See the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) for SDK/contract needs and existing Launch impact. Default ALMM creation uses the default at mining time; inspect actual empty-pool receipt/configuration before seeding. Existing preset code alone does not prove current GIWA low-fee-preset qualification.

## 6. Execute a reviewed plan once

All action commands **save plans only** and never read keys, even when `AMMORA_SEND=1` is inherited. Only `stablecoin:execute` signs separately. Review printed `reviewHash`, calldata, recipients, approval amounts and summary.

```bash
AMMORA_SEND=1 npm run stablecoin:execute -- .validation/stablecoin/partner.json .validation/stablecoin/create-plan.json REVIEW_HASH_FROM_PLAN
```

Immediately before execution, recheck manifest, runtimes, issuer state, current SDK plan, prices/limits and nonce. Changed plans need fresh review. Bound allowances to required amounts and restore increases from this operation to their original levels. Limit native ETH gas separately from ERC-20 budgets.

Execution records are mode-0600 files under `.validation/stablecoin-journal/`. Every process for one account must use the **same directory**, including when relocated with `AMMORA_STABLECOIN_STATE_DIR`. Account locks and operation journals are created exclusively; signed hashes are fsynced **before** RPC submission. Never rerun a successful operation or choose a new nonce while pending/unknown. Multi-host operation requires shared CAS storage and a reviewed sender; this local example alone is insufficient.

Save `results[].minted` **collection+tokenId**, created pool address and receipt block. A raw NFT and Manager NFT with the same numeric ID are different assets.

## 7. Seed, add liquidity and inspect positions

For ALMM, complete the [seed request](https://docs.ammora.org/examples/source/src/stablecoin/requests/seed-almm.template.json.txt) with the pool from the creation receipt or reviewed discovery `existingPool`.

```bash
npm run stablecoin:almm:seed -- .validation/stablecoin/partner.json ./seed-almm.json .validation/stablecoin/seed-plan.json
# Execute this plan with the same procedure above
npm run stablecoin:position -- .validation/stablecoin/partner.json YOUR_POOL YOUR_NFT_ID almm
```

For ARL [add requests](https://docs.ammora.org/examples/source/src/stablecoin/requests/add.template.json.txt), `tokenId:null` creates a **new managed NFT**; an existing Manager ID adds to that position. ALMM uses an existing Manager ID and adds evenly across that position's bins.

```bash
npm run stablecoin:lp:add -- .validation/stablecoin/partner.json ./add.json .validation/stablecoin/add-plan.json
# managed ARL NFT:
npm run stablecoin:position -- .validation/stablecoin/partner.json YOUR_POOL YOUR_MANAGER_ID managed
# ALMM Manager NFT:
npm run stablecoin:position -- .validation/stablecoin/partner.json YOUR_POOL YOUR_MANAGER_ID almm
```

| Model / ID origin | position / claim / remove namespace |
|---|---|
| Raw NFT issued by the pool during ARL creation | `raw` |
| NFT issued by ARL PositionManager | `managed` |
| NFT issued by ALMM PositionManager | `almm` |

`managed` is not a generic name for every Manager NFT; using it for ALMM yields `Model/NFT namespace mismatch`. New principal/authority operations require the reviewed liquidity owner. These examples do not change permanent locks, vesting or another team's LP. Review the [existing LP guide](https://docs.ammora.org/guides/src-arl-readme) before separate arrangements.

## 8. Quotes and swaps in both directions

Put actual pool, tokenIn and raw amount in the [swap request](https://docs.ammora.org/examples/source/src/stablecoin/requests/swap.template.json.txt). Quote small, target and maximum orders both ways; compare fee-inclusive net receipts and depth.

```bash
npm run stablecoin:quote -- .validation/stablecoin/partner.json ./swap.json
npm run stablecoin:swap -- .validation/stablecoin/partner.json ./swap.json .validation/stablecoin/swap-plan.json
# Review then execute; opposite direction needs separate tokenIn/amount/fresh plan
npm run stablecoin:risk -- .validation/stablecoin/partner.json YOUR_POOL
```

Partial fills are not used. Reconcile minOut, deadline, total cost cap and actual receipt output. Direct pool success does not prove aggregation admission or issuer redemption. Depegging, expired reference or excessive costs block new exposure. Legitimate withdrawal/claims do not require fresh peg references, but issuer pause/blacklist, contract authority and transfer restrictions still apply.

## 9. LP fees, delegation and partner revenue

Use [claim request](https://docs.ammora.org/examples/source/src/stablecoin/requests/claim-lp-fees.template.json.txt) `namespace` to distinguish initial raw ARL LP from managed NFTs. Review payout in the manifest.

```bash
npm run stablecoin:claim-lp-fees -- .validation/stablecoin/partner.json ./claim.json .validation/stablecoin/claim-plan.json
```

Managed ARL NFTs can grant only `claim-fee-to-owner` or `claim-fee` through the [fee-delegate request](https://docs.ammora.org/examples/source/src/stablecoin/requests/fee-delegate.template.json.txt). Owner plans/executes the grant; delegate plans/executes the claim as its own `AMMORA_ACCOUNT`. `claim-fee-to-owner` restricts payout to owner. `claim-fee` allowing another payout is broader fee authority. An occupied delegate slot is not automatically replaced; revoke with `mode:revoke` afterward.

```bash
npm run stablecoin:fee-delegate -- .validation/stablecoin/partner.json ./delegate.json .validation/stablecoin/delegate-plan.json
```

Default-catalog ALMM pays the existing **feeOwner**. Do not substitute principal delegation for ARL's fee-only mask. This P0 path does not claim support for ALMM separate payouts or fee delegation.

Pool creators, issuers and LP owners do not automatically receive all Protocol/Partner revenue. Connect the [fee configuration, FeeVault and DFS guide](https://docs.ammora.org/guides/fee-sharing) and [revenue examples](https://docs.ammora.org/examples/source/src/revenue/arl-revenue.ts.txt) only for actual rights. An aggregated FeeVault claim across sources is not one stablecoin pool's revenue. Positive payment requires matching fee events, actual transfers and receipt-block balance increases; a zero-fee no-op is not payment.

## 10. Withdraw liquidity and close

For ARL [remove requests](https://docs.ammora.org/examples/source/src/stablecoin/requests/remove.template.json.txt), specify `namespace:raw|managed`, actual `liquidityRaw` and `shareBps:null`. For ALMM, use `namespace:almm`, `liquidityRaw:null`, `shareBps:1..10000`. ARL enforces token minimum outputs; ALMM uses **withdrawal-only rebalance minimum refunds and active-bin bounds**. Never silently fall back to a legacy ALMM remove call without token floors.

The current ARL revision must leave **one raw unit of pool-wide liquidity**. Full last-LP withdrawal/closure is `BLOCKED`; do not bypass the SDK gate. Read `stablecoin:position`'s `withdrawal.maximumWithdrawalLiquidityRaw` and explicitly request no more than that. One raw liquidity unit is not one token. Reliable reseeding of minimum-only pools is not promised. Full zero-liquidity exit/restart requires separate contract/SDK revision qualification.

```bash
npm run stablecoin:lp:remove -- .validation/stablecoin/partner.json ./remove.json .validation/stablecoin/remove-plan.json
# Plan close separately after fully emptying ALMM
npm run stablecoin:almm:close -- .validation/stablecoin/partner.json ./close-almm.json .validation/stablecoin/close-plan.json
```

Check remaining fees, rewards, rounding dust, allowances, delegates and NFT ownership/burn state. Withdrawing assets from a pool and redeeming fiat through the issuer are different exits requiring separate verification.

## 11. Reconcile failures/unknowns and define pilot completion

```bash
npm run stablecoin:reconcile -- .validation/stablecoin/swap-plan.json .validation/stablecoin-journal/PLAN_HASH.json
```

This command neither signs, resends, unlocks nor automatically resumes. With a hash, inspect nonce, receipt, canonical block and exact balances. Unknown-without-hash or partial success remains BLOCKED while the operator reconciles account nonce and existing transactions. Do not delete locks/journals to resend, or fail over without persistent records.

Completion requires official asset/authority confirmation, actual funding of both sides, both-direction minOut/net receipts, LP ownership/withdrawal, positive fee payment/authority rejections, allowance/delegation cleanup and no unresolved nonces. It also needs the actual partner's issuance/redemption and operational approval, plus LP/MM budgets and stop/recovery responsibilities. Synthetic results cannot replace those approvals.

Before checks/execution, record an evidence key: objective, commit/tree, command/gate, inputs, environment/architecture, SDK/artifact digest and target state. Integrity-check identical valid evidence as `REUSED`, new checks as `PASSED_THIS_RUN`, unresolved prerequisites as `BLOCKED`. SDK publication, GitHub CI, mainnet and production changes are outside this P0 scope.

See the [stablecoin example index](https://docs.ammora.org/guides/src-stablecoin-readme) and existing [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

## 12. Pilot agreement and later extensions

| Agreement | Required result / next condition |
|---|---|
| Official support | Issuer/GIWA approval scope and exact addresses, decimals and admin controls; FDUSD/cUSD templates remain BLOCKED pending approvals/addresses |
| Liquidity and execution | Providers, budgets and withdrawal responsibilities for actual inventories; both-direction minOut, fee-inclusive costs and balance increases at target sizes; jointly agreed numerical targets |
| Operations | Contacts, stop-new-exposure, exits and recovery for upgrades, pause/blacklist, expired price evidence or depegging; verify with RPC snapshots and actual receipts |
| Settlement | LP feeOwner/delegate/payout, actual Partner revenue rights and payout schedule; pool creator is not automatically a beneficiary |
| Future Launch quote asset | Separately review the Launch generation's quote support, Config, authority and amount units; P0 does not change existing Config/graduation/quote policy |
| stcUSD, redemption, bridges, institutional connections | Separately verify assets, share conversion/redemption, networks/routes and issuer/onboarding prerequisites; cUSD pool success does not establish these features |

Joint announcements describe only completed scope. Agree separately on synthetic testnet results, partner approval and mainnet support.

Also see the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md). The public SDK 0.3.7 P0 [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) records 40 transactions, positive LP payouts, authority rejections, allowance cleanup and remaining limitations. Official FDUSD/cUSD pilots, low-fee presets and full ARL closure require separately resolving that report's `BLOCKED` conditions.

## ALMM low-fee preset path

The [separate execution guide](https://docs.ammora.org/guides/almm-preset) connects preset preflight → empty pool → LP/trades/claims/withdrawal. The default-catalog 30 bp path remains; 1 bp validation uses an explicit synthetic-test deployment. Real-asset pilots require official issuer assets and a reviewed canonical-owner preset. Consult the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

SDK 0.3.8 provides readiness directly. Regenerate and review earlier 0.3.7 transaction plans. Historical P0 transaction evidence retains its original SDK/source scope.

## Integrate through one ALMM model

For low fees, fee-only delegation, separate payouts, full LP exit and re-entry, use the [ALMM integration guide](https://docs.ammora.org/guides/almm-unified). It uses public SDK 0.3.8 with a source-pinned compatibility module while preserving existing deployments and evidence.
