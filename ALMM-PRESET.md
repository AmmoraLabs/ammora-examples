# Low-fee ALMM presets — public SDK 0.3.9

[Complete stablecoin flow](https://docs.ammora.org/guides/stablecoin-partner) · [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)

Use the existing `createPoolFromPreset` path for **reviewed, exact-transfer ERC20s issued on GIWA**. This does not reissue tokens, use Launch Config/curve/graduation, or change existing fee sharing and LP locks. It uses public **0.3.9** without republishing the SDK.

## Approval and review boundaries

Using an **already enabled, ready preset** for supported assets does not need per-LP or per-partner Ammora approval. Creating/changing/re-enabling a preset is a separate Factory-owner action; SDK readiness cannot grant that role or create a missing low-fee preset.

Token policies, LP/fee ownership and issuer controls still apply. A new address is not itself an approval requirement, while a restricted asset or new implementation may require review. See [partner permissions](PERMISSIONS.md) and the deployment-specific support table below; isolated or disabled test presets are not live issuer targets.

## Support status

| Path | Verified status |
|---|---|
| Default GIWA ALMM catalog | Default fee is 30bp. The controlled wallet is not factory owner; inspected indexed logs did not provide a reviewable low-fee preset. **Creating a 1bp pool on the default factory is BLOCKED** |
| Isolated synthetic test | An immutable 1bp preset in an opt-in manifest was tested for creation, LP supply, swaps in both directions, claims, and withdrawal. New creation with that test preset was disabled during cleanup. These are not official FDUSD/cUSD assets or the default catalog |
| Public SDK | 0.3.9 provides `getALMMPresetReadiness`, `getALMMPositionReadiness`, and `hashALMMPreset` |
| Examples | The [existing import path](https://docs.ammora.org/examples/source/src/stablecoin/almm-readiness-compat.ts.txt) re-exports the public SDK; readiness and authority checks use the installed SDK |
| ARL 25bp floor / final 1 raw liquidity | Existing limits remain; ALMM 1bp success does not resolve ARL limits |
| Real issuer pilot | Requires issuer approval, asset addresses, code/authority review, reference prices, liquidity, and a reviewed canonical preset; separate from test success |

1bp is 0.01%. The test preset's 1,000bp protocol share is **10% of fees**, not an additional 10% of trade principal. These are synthetic validation inputs, not recommended issuer economics.

## Preparation

```bash
npm ci
export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
export AMMORA_READ_RECEIPT=''
export AMMORA_SEND=0
```

Reads require no key. Sends require the reviewed LP wallet's GIWA gas ETH, small balances of both tokens, and a [manifest](https://docs.ammora.org/examples/source/src/stablecoin/manifests/native-issuer.template.json.txt) with current asset controls/policy, reference price, and budgets. Unconfirmed issuer templates remain BLOCKED. Gas ETH and WETH/ERC20 liquidity are separate balances. ALMM base must be the lower token address; review decimals, raw budgets, and price when reordering assets.

## One operation per call

1. Review the preset ID already registered by factory owner and every preset field: binStep, base fee, maximum dynamic fee, protocol share, function/collection mode, and enabled state. Do not automatically trust live values or change factory settings from examples.
2. Pin `hashALMMPreset(reviewedPreset)` for the complete preset; import directly from `@ammora-protocol/sdk` in 0.3.9. The [sample request](https://docs.ammora.org/examples/source/src/stablecoin/fixtures/almm-lowfee-preset-request.json.txt) contains an **ID/hash for the synthetic test deployment only**.
3. Read actual readiness and blockers with `stablecoin:check-almm-preset`.
4. Plan empty-pool creation with `stablecoin:create-almm-preset` and use reviewed execution. The example supports only PermissionlessV2 with an empty lifecycle; review other lifecycle/activation requirements separately.
5. Before seeding, reconcile the creation receipt's expected address, factory membership, actual fee/dynamic settings, and modes with the reviewed inputs.
6. Continue with seed/add/quote/swap/claim/remove/close examples. Verify payment through LP fee events, actual Transfers, and receipt-block balance increases; a successful receipt or zero-fee no-op is not payout evidence.

```bash
npm run stablecoin:check-almm-preset -- reviewed-manifest.json reviewed-preset.json
npm run stablecoin:create-almm-preset -- reviewed-manifest.json reviewed-preset.json NEW-create-plan.json
# Review plan reviewHash, calldata and budget, then use the existing executor
AMMORA_SEND=1 npm run stablecoin:execute -- reviewed-manifest.json NEW-create-plan.json REVIEW_HASH
# After verifying actual pool/tokenId, read rights and withdrawal limits
npm run stablecoin:check-almm-position -- reviewed-manifest.json POOL TOKEN_ID
```

Reuse the [per-operation commands](https://docs.ammora.org/guides/src-stablecoin-readme) for seed, add, swap, claim-lp-fees, remove, and close-almm. Each operation uses a fresh request/plan/reviewHash. Reconcile nonce, receipt, canonical block, and exact-block state before retrying any success/unknown hash. Restore allowances to baseline.

## What readiness checks establish

`getALMMPresetReadiness` verifies the RPC chain, reviewed runtime/registry roles, one pinned block, existence/enabled state, existing pool key, token admission, and full preset hash. It compares base fee plus maximum enabled variable fee against the cap and distinguishes default factory economics from preset economics. It does not certify issuer authenticity, redemption, peg, funds, allowance, or success at mining time. Recheck state, price, minOut, and simulation just before planning.

`getALMMPositionReadiness` shows owner/feeOwner/operator/delegate/lock state and recipient-specific withdrawal caps in **bin-share units**. Fee receipt authority does not grant principal rights. Claim authority without positive accrued fees produces no payment. Use the paged path for more than 64 bins. Do not apply ARL's retained 1-raw rule to ALMM. This rights check does not block legitimate claims/exits merely because a peg reference is stale or a preset is disabled.

## Reproducing the synthetic test

Select the pinned [reviewed deployment](https://docs.ammora.org/examples/source/src/stablecoin/fixtures/almm-lowfee-giwa-v1.json.txt) only through the [isolated manifest's](https://docs.ammora.org/examples/source/src/stablecoin/manifests/almm-lowfee.synthetic.json.txt) `deployment` field. It is not selectable for native issuer assets, different owners/tokens/IDs, or arbitrary factories. Omitting this field uses the existing canonical catalog.

Historical manifests use `observedAt: 0` to prevent automatic new exposure. To resume an experiment, confirm the synthetic assets and explicitly review current reference data, budgets, and ownership in a new copy. Creating an existing canonical preset key returns `already exists`. Validation NFTs were withdrawn and cleaned up; do not assume a historical tokenId still has live rights. See the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) for hashes, claims, withdrawals, allowance cleanup, and evidence reuse scope.

## Integrating one ALMM model

See the [ALMM unified guide](https://docs.ammora.org/guides/almm-unified) for low fees, fee-only delegation, separate payout, full LP withdrawal, and re-entry. It uses public SDK 0.3.9 with official fee-routing functions while preserving existing deployments and evidence.
