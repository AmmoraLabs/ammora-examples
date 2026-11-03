# Portable contract examples with SDK 0.3.8

SDK **0.3.8** supports both shared native/ERC-20 balances and independent ETH/WETH
balances. Use the public npm package; no local SDK archive or protocol source
checkout/build is needed. Math remains 0.3.0.


```sh
# This repository: use the committed public registry lockfile.
npm ci --ignore-scripts
# A new project: default latest, or an exact pin for reproducibility.
npm install @ammora-protocol/sdk viem dotenv
# Or pin the version explicitly:
# npm install --save-exact @ammora-protocol/sdk@0.3.8 viem dotenv
```


Published 0.3.1, 0.3.2 and 0.3.3 remain immutable and do not include wrapped Portable
planning. Upgrade existing pins/lockfiles explicitly. The installed SDK feature
probe refuses unsupported models without relabelling WETH or fabricating context.

Set `AMMORA_CHAIN_ID=91342`, `AMMORA_GIWA_GENERATION=auto-route` and the GIWA RPC
as described in the root README. Clear stale `AMMORA_READ_RECEIPT` when choosing a
fresh confirmed block. No key is needed for these read-only examples:


```sh
npm run portable:discover-pool -- /absolute/path/to/reviewed-deployment.json /absolute/path/to/lifecycle-targets.json CURVE_ADDRESS
npm run portable:gas-budget -- /absolute/path/to/reviewed-deployment.json ACCOUNT_ADDRESS ESTIMATED_GAS_COST_WEI
```


The current [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
and [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) are
preserved with their checksums in the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).
Use these independent pins rather than a live self-generated code hash. They must declare WETH and native
router addresses, exact decimals and independent runtime pins for the core,
wrapper/router and discovered curve/token/pool/vault. Only the actual SDK verifier
creates the planning context at the explicit block.

ETH funds gas and native transaction value. Actual same-block WETH is the full
quote spending ceiling. WETH cannot pay ETH gas and ETH does not imply WETH.
Neither planner wraps automatically. Shared-balance chains retain their conservative
unit conversion. First-buy/exact-output helpers may be omitted
for discovery/claims; operations that need them fail closed. Concentrated and
compounding factories stay explicit.

A source-specific own-beneficiary quote-token FeeVault claim:


```sh
npm run portable:claim-source -- /absolute/path/to/reviewed-deployment.json /absolute/path/to/lifecycle-targets.json CURVE_ADDRESS LAUNCH MAX_FEE_PER_GAS_WEI
```


Select an actually discovered `LAUNCH`, `GRADUATED_CONCENTRATED` or
`GRADUATED_COMPOUNDING` source. The default is an unsigned positive-claim preview.
Follow the root README's explicit send/signing instructions only after reviewing
fresh nonce, permission and balance state. Zero claimable amounts are refused.
A receipt is not payout proof: reconcile canonical block, ClaimedFor, Transfer and
receipt-block recipient/source balance deltas. Shared FeeVault WETH can aggregate
launches; do not label that total per-launch revenue. Delegation and alternate
payout examples retain their historical qualified payment evidence.

## Curve exact-output


```sh
AMMORA_SEND=0 npm run portable:curve-exact-output -- REVIEWED_DEPLOYMENT.json REVIEWED_TARGETS.json CURVE buy OUTPUT_RAW MAXIMUM_INPUT_RAW MAX_FEE_PER_GAS_WEI
```


`buy` means quote → base; `sell` means base → quote. The CLI uses the actual SDK context verifier and `planCurveExactOutput`. `APPROVAL_REQUIRED` plans only one exact ERC20 approval. After approval, run again with a new block/context; there is no automatic follow-up swap. Even in READY, input caps, gas ETH, and WETH balances are separate.

The original sdk034 manifest remains unchanged. To use the additional GIWA helper, supply the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) and [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md). This exact-output CLI uses an explicit manifest and verifies Factory binding, independent runtime pins, and callback admission. Do not apply these manifests to other deployment addresses.

Atomic creation plus first buy is **supported by the GIWA default helper and convenience function introduced in SDK 0.3.7**. Follow [section 4-A](https://docs.ammora.org/guides/launchpad#atomic-first-buy) for configuration, wallets, and APPROVAL_REQUIRED/READY ordering. The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) predates helper deployment. [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) is reused within its original SDK/block scope. The older 0.3.6 default catalog lacked the helper; the convenience function introduced in 0.3.7 includes reviewed helper addresses and runtime pins.

## Atomic token creation and first buy

To specify your own Partner recipients, use `launch:create-config-and-pool-with-first-buy` from the complete guide. Its [source](https://docs.ammora.org/examples/source/src/launch/team/create-config-and-pool-with-first-buy.ts.txt) reads `team-recipients.json` and calls public SDK `createConfigAndPoolWithFirstBuy`. This GIWA convenience path needs no separate deployment/targets JSON. Config owner, Creator, payer, and initial recipient are the same caller. The legacy template CLI below inherits recipients, so use only a template with your own reviewed policy.

```sh
# Register Config, issue token and buy in one transaction
npm run portable:atomic-first-buy -- DEPLOYMENT.json TARGETS.json TEMPLATE_ID SALE_RAW THRESHOLD_RAW NAME SYMBOL URI QUOTE_RAW MIN_BASE_RAW MAX_FEE_WEI
# Pin a reviewed existing Config by ID/hash for issuance and first buy
npm run portable:existing-config-first-buy -- DEPLOYMENT.json TARGETS.json CONFIG_ID EXPECTED_CONFIG_HASH NAME SYMBOL URI DECIMALS QUOTE_RAW MIN_BASE_RAW MAX_FEE_WEI
```

Both commands default to unsigned preview. Review the template's Creator/Partner/LP policy and recipients, and use each token's raw units for SALE, THRESHOLD, QUOTE, and MIN_BASE. The first command preserves template recipients; do not blindly reuse another team's template. The second rejects decimals or hash mismatches with the Config. APPROVAL_REQUIRED sends only the exact token approval; run again at a fresh block and reach READY before creation/purchase. The optional final `deadlineUnix` makes expiry explicit; omission uses a short default deadline.

See [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).
