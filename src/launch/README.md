# Build a launchpad with SDK 0.3.9

See [partner permissions and review boundaries](../../PERMISSIONS.md). Wallet signatures, token approvals and local request review are your own authorization; asset policies, actual fee rights and administrator actions retain their contract checks.

Start with the **[single end-to-end launchpad guide](https://docs.ammora.org/guides/launchpad)** for the
complete Config → issuance/ALC → trading → Graduation → ARL → fee/LP claim flow,
platform roles and the prioritized feature review. This page is the source-level reference.

These examples cover the user flow from an immutable Config to a trading token and its
Graduation pool. Use the published `@ammora-protocol/sdk@0.3.9` (the version pinned by this repository). Examples use an RPC endpoint and the selected chain. Standalone creation/trading
files read the adjacent reviewed `runtime-pins.giwa.json` (or `AMMORA_RUNTIME_PINS_FILE`)
and verify actual bytecode against it. Use Node 22 or 24;
the commands below run after `npm ci --ignore-scripts`.

## Find one action

The integrated guide uses **team Config → separate launch** as its default. Choose an
alternative only when your product needs it; do not execute every creation row below.
All commands run as `npm run <command> -- <arguments>` from the repository root.

| Action | Command / source | Entry mode |
| --- | --- | --- |
| Config policy for your team | `launch:team-config` / [config.ts](https://docs.ammora.org/examples/source/src/launch/team/config.ts.txt) | `preview` read-only; `create` requires send + review hash |
| Author full economic policy | `launch:author-config` / [author-config.ts](https://docs.ammora.org/examples/source/src/launch/author-config.ts.txt) | read-only; public `AMMORA_ACCOUNT`; inherited recipients must be edited |
| Register reviewed JSON | `launch:config-json` / [config-json.ts](https://docs.ammora.org/examples/source/src/launch/config-json.ts.txt) | `preview` unsigned; `create` requires send + review hash |
| Fee recipient/ratio setup and before/after preview | `launch:fee-config` / [fee-config.ts](https://docs.ammora.org/examples/source/src/launch/team/fee-config.ts.txt) | preview/document read-only; link reviewed output to Config creation |
| Config + token + first buy | `launch:create-config-and-pool-with-first-buy` / [convenience example](https://docs.ammora.org/examples/source/src/launch/team/create-config-and-pool-with-first-buy.ts.txt) | preview; explicit reviewed execute; [approval/receipt steps](https://docs.ammora.org/guides/launchpad#atomic-first-buy) |
| Existing Config → token + curve | `launch:create-launch` / [create-launch.ts](https://docs.ammora.org/examples/source/src/launch/create-launch.ts.txt) | send-only; Creator signs |
| Config + token together | `launch:quick-create` / [quick-create.ts](https://docs.ammora.org/examples/source/src/launch/quick-create.ts.txt) | send-only; inherits template recipients; **no first buy** |
| Inspect curve / quote | `launch:quote` / [quote-curve.ts](https://docs.ammora.org/examples/source/src/launch/quote-curve.ts.txt) | read-only; raw quote amounts |
| Prepare funding | `launch:funding` / [funding.ts](https://docs.ammora.org/examples/source/src/launch/funding.ts.txt) | read-only; wrap preview only |
| Terminal buy + migration | `launch:graduate` / [final-fill-and-graduate.ts](https://docs.ammora.org/examples/source/src/launch/final-fill-and-graduate.ts.txt) | send-only + explicit Graduation confirmation |
| Resume migration only | `launch:migrate` / [migrate.ts](https://docs.ammora.org/examples/source/src/launch/migrate.ts.txt) | unsigned by default; public caller required |
| Find minted LP positions | `launch:migration-positions` / [migration-positions.ts](https://docs.ammora.org/examples/source/src/launch/migration-positions.ts.txt) | read-only; migration receipt + curve |
| Inspect / claim launch fees | `launch:fee-sharing` / [fee-sharing.ts](https://docs.ammora.org/examples/source/src/launch/fee-sharing.ts.txt); `launch:claim-fees` / [claim-fees.ts](https://docs.ammora.org/examples/source/src/launch/claim-fees.ts.txt) | read-only / send-only beneficiary |
| Partner creation fee / surplus / leftover | [claim-partner-creation-fee.ts](https://docs.ammora.org/examples/source/src/launch/claim-partner-creation-fee.ts.txt), [claim-surplus.ts](https://docs.ammora.org/examples/source/src/launch/claim-surplus.ts.txt), [withdraw-leftover.ts](https://docs.ammora.org/examples/source/src/launch/withdraw-leftover.ts.txt) | unsigned by default; role/state/positive balance prerequisites |
| Enable/disable new launches | `launch:config-enabled` / [config-enabled.ts](https://docs.ammora.org/examples/source/src/launch/config-enabled.ts.txt) | unsigned by default; Config owner |
| Transfer Creator role | `launch:transfer-creator` / [transfer-creator.ts](https://docs.ammora.org/examples/source/src/launch/transfer-creator.ts.txt) | unsigned by default; current Creator; [handover guide](https://docs.ammora.org/guides/src-launch-creator-transfer) |
| FeeVault beneficiary delegate / batches | [FeeVault action guide](https://docs.ammora.org/guides/src-fees-readme) | unsigned by default; explicit per-beneficiary permissions |
| Creator metadata | `launch:creator-metadata` / [creator-metadata.ts](https://docs.ammora.org/examples/source/src/launch/creator-metadata.ts.txt) | unsigned by default; current Creator |

For ALC and graduated swaps, use [safe-swap.ts](https://docs.ammora.org/examples/source/src/quickstart/safe-swap.ts.txt) as in the guide.
Creator transfer uses [transfer-creator.ts](https://docs.ammora.org/examples/source/src/launch/transfer-creator.ts.txt) and its [guide](https://docs.ammora.org/guides/src-launch-creator-transfer).
Atomic Config + launch + first buy uses [the convenience example introduced in SDK 0.3.7](https://docs.ammora.org/examples/source/src/launch/team/create-config-and-pool-with-first-buy.ts.txt)
and [the integrated first-buy instructions](https://docs.ammora.org/guides/launchpad#atomic-first-buy). Quick Create itself has no first buy.
For beneficiary delegation and sequential batch claims, see [FeeVault examples](https://docs.ammora.org/guides/src-fees-readme).

## 1. Select the deployment and inspect Configs


```bash
cp .env.example .env
export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
export AMMORA_SEND=0
export AMMORA_READ_RECEIPT=''
npm run quickstart:verify
npm run quickstart:configs -- 10
npm run launch:get-config -- 6
```


The default `legacy` V4 examples explicitly use the SDK's `giwaSepoliaPermissionless` catalog;
`AMMORA_GIWA_GENERATION=auto-route` selects the complete separately reviewed new generation.
`getAmmoraDeployment(91342)` alone selects a historical V3 default in SDK 0.3.0/0.3.1; preserve
the explicit catalog/source when copying code. All read and wallet providers must use the
same chain. `src/quickstart` files contain their own configuration and can be copied alone.
Other folders use helpers under `src/shared`. Config lists read one Config per second
at the same block to respect public RPC limits; an RPC failure remains an error.
Read-only Config/curve previews select the SDK's reviewed GIWA 12-confirmation snapshot
before reading state, avoiding replica lag at the announced latest head. This is a
confirmation-depth policy, not a guarantee of L1 finality or execution at that old price.

Choose an **enabled Config with `migrationMode: 0`** for the template authoring helper
below. Mode `0` is concentrated; mode `1` is compounding and requires its own complete
economic policy. Choosing the first listed Config is not a model-selection rule.

For a launch form, show the selected Config's enabled state, quote token, token decimals,
fees, recipients, vesting and LP distribution. Configs are immutable. A disabled Config
cannot create a new launch. `quickstart:configs` lists registry IDs and
`launch:get-config` reads the full tuple directly from that registry.

## 2. Preview and author a launchpad Config


```bash
npm run launch:preview-config -- <templateId> <saleSupplyRaw> <quoteThresholdRaw> <configOwner>
```


[preview-config.ts](https://docs.ammora.org/examples/source/src/launch/preview-config.ts.txt) reads a reviewed template at one block, derives the
coupled curve/migration parameters, validates the result with the public SDK builder and
prints the complete Config, curve and creation calldata. It loads no key, simulates no
transaction and sends nothing. Inputs are raw integers: sale supply uses the template's token
decimals; the threshold uses its quote token's decimals. Total issuance is the sale allocation
plus the reconciled Graduation base reserve and inherited locked-token vesting allocation.
The helper sizes destination liquidity from post-fee quote, derives its exact required base
reserve and validates the full Config. The preview includes an economics reconciliation,
including any quote rounding surplus paid to the protocol. Preserve bigint strings in JSON.

This beginner helper supports **concentrated Graduation** only. It inherits template
recipients, fee rules, vesting and LP distribution. The Config owner argument does not
replace `partnerRecipient`. Inspect every inherited value before reusing a template;
production teams must author and review their own complete economic/recipient policy.
`portable:curve` is an optional offline economics tool; its synthetic compounding fixture
is neither a production preset nor a Config ready to send to this helper.

For your own team, use [the team recipient example](https://docs.ammora.org/guides/src-launch-team-readme) and
`launch:team-config`. It explicitly assigns Config owner, fee recipient, LP recipient
and leftover receiver with a review hash required before creation. The original
template helpers above continue to inherit recipients.

After reviewing the preview, choose one creation path:

| Flow | Command | Source |
| --- | --- | --- |
| Reusable Config, then a separate token launch | `launch:create-config -- <templateId> <saleSupplyRaw> <quoteThresholdRaw>`, then `launch:create-launch -- <confirmedConfigId> <name> <symbol> <uri>` | [create-config.ts](https://docs.ammora.org/examples/source/src/launch/create-config.ts.txt), [create-launch.ts](https://docs.ammora.org/examples/source/src/launch/create-launch.ts.txt) |
| Config and token created atomically | `launch:quick-create -- <templateId> <saleSupplyRaw> <quoteThresholdRaw> <name> <symbol> <uri>` | [quick-create.ts](https://docs.ammora.org/examples/source/src/launch/quick-create.ts.txt) |
| Token using an existing enabled Config | `quickstart:create-launch -- <configId> <name> <symbol> <uri>` | [standalone create-launch.ts](https://docs.ammora.org/examples/source/src/quickstart/create-launch.ts.txt) |

Prefix transaction commands with `AMMORA_SEND=1 npm run`. The CLI signer reads a testnet
key from `.env`. In a web app use the user's connected wallet client; never put a private
key in browser code, ask users for one, or ship the CLI signing helper to the browser.
The SDK transactions/plans can be handed to that wallet client.

Store the **confirmed** `configId`, `configHash`, token, curve, transaction hash and receipt
block from the decoded receipt. Quick Create's predicted next Config ID is not canonical;
another author can create a Config before inclusion. Preserve the examples' receipt-block
registry reconciliation before saving identities or opening the trading screen.

## 3. Continue from the creation receipt

The read-only commands normally use a 12-confirmation snapshot. Immediately after a
Config/token is created, that snapshot can predate the new contract. Do not interpret
that result as a failed launch or send creation again. Keep the confirmed creation hash
and select its receipt block explicitly for a dependent read:


```bash
AMMORA_READ_RECEIPT=<configCreationHash> npm run launch:get-config -- <confirmedConfigId>
AMMORA_READ_RECEIPT=<tokenCreationHash> npm run launch:quote -- <curve> buy <quoteAmountRaw>
```


This requires a successful receipt and verifies its block hash against the canonical
block. Quote/preview JSON labels this as a receipt snapshot, without claiming 12 confirmations or L1
finality. The same receipt may have later become noncanonical; reconcile that condition
before continuing. Omit the variable to return to the reviewed confirmation-depth window.
Keep this a per-command value; a creation receipt is not a fresh market quote after later
trades. The swap client refreshes/simulates independently before signing.

## 4. Display the curve and quote a trade


```bash
npm run launch:quote -- <curve>
npm run launch:quote -- <curve> buy <quoteAmountRaw>
npm run launch:quote -- <curve> sell <baseAmountRaw>
```


[quote-curve.ts](https://docs.ammora.org/examples/source/src/launch/quote-curve.ts.txt) binds the curve to the reviewed factory and fee policy,
then displays state and any requested exact-input quote from the same explicit block.
It includes tokens, reserves, fee rates, thresholds and `canonicalPool`. No quote is
requested for an inactive curve. The output is a snapshot, not a promise of execution or
finality; refresh and simulate before requesting a signature.

For a quoted trade, use the SDK's `fill` classification in your UI:

| Result | UI and execution behavior |
| --- | --- |
| `full` | Show expected output and a slippage floor. Ordinary orders remain strict. |
| `graduation-boundary` on a buy | Show requested input, consumed input and refundable remainder separately. Use the dedicated terminal-fill flow below. |
| `partial` on a sell | Keep partial execution disabled; ask for a smaller sell or refresh. This is not Graduation. |
| Dust/invalid quote or RPC failure | Show the error and prevent signing. A missing/failed quote is not a zero-price trade. |

The SDK quote method rejects zero-output dust; the classifier also exposes `terminal-dust`
for callers classifying raw contract results. This example does not mask that rejection.

## 5. Prepare funding and execute an ordinary buy or sell

The signing wallet needs native ETH for gas **and the actual quote ERC-20** for the default
buy and final-fill examples. A native ETH balance is not a WETH balance. Read `quoteToken`
from the Config/curve and check its decimals and wallet balance. If it is the deployment's
reviewed `contracts.tokens.wrappedNative`, wrap a chosen amount with the user's connected
wallet before using the ERC-20 path. The following is the same standard deposit call
used to fund the isolated end-to-end fixture:


```ts
import { parseAbi, parseEther } from "viem";
const hash = await wallet.writeContract({
  account,
  address: deployment.contracts.tokens.wrappedNative,
  abi: parseAbi(["function deposit() payable"]),
  functionName: "deposit",
  value: parseEther(nativeAmount),
});
const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("Wrapping failed");
```


For a runnable read-only balance check and SDK wrap preview, use:


```bash
npm run launch:funding -- <configId> <wallet> [humanNativeToWrap]
```


It reads native and quote balances at one confirmed block, builds no wrap for another
quote asset, and leaves submission to the connected wallet. A positive native remainder
does not prove that estimated gas is affordable.

Only use this deposit when the selected quote token is that wrapped native asset. Other
quote tokens must be obtained as those ERC-20s. Keep native ETH for gas and enough quote
balance for the reviewed maximum, including input trading fees. The final-fill example
uses ERC-20 quote even if earlier trading used a native route.



```bash
AMMORA_SEND=1 npm run quickstart:swap -- dbc <curve> <tokenIn> <humanAmount>
```


Use the curve's quote token for a buy and base token for a sell. Unlike `launch:quote`,
this command takes a decimal **human amount**, read in the input token's on-chain decimals.
The standalone [safe-swap.ts](https://docs.ammora.org/examples/source/src/quickstart/safe-swap.ts.txt) demonstrates
`AmmoraSwapClient.prepareExactIn()` and `prepared.execute(wallet, { onStatus })` with exact
approvals, quote freshness and receipt-bound output reconciliation. Handle SDK 0.3.0's
`approval-submitted` and `swap-submitted` as pending states; only confirmation events carry
confirmation data. See [shared/status.ts](https://docs.ammora.org/examples/source/src/shared/status.ts.txt) for exhaustive handling.

For the reviewed GIWA permissionless V4 generation, an ordinary buy can instead use native
ETH when `tokenIn` is the curve's wrapped-native quote token:


```bash
AMMORA_SEND=1 npm run quickstart:swap -- dbc <curve> <wrappedNativeQuoteToken> <humanETHAmount> native
```


The integration verification exercised this route from an independent wallet holding only
native ETH: it required no ERC-20 approval. The SDK authenticates the native route; this is
not an override for an unsupported model, generation or quote asset. The terminal-fill
script below still requires ERC-20 quote funding.

## 6. Handle the terminal fill and separate Graduation


```bash
AMMORA_SEND=1 AMMORA_GRADUATION_CONFIRM=1 npm run launch:graduate -- <curve> <maximumQuoteRaw>
```


[final-fill-and-graduate.ts](https://docs.ammora.org/examples/source/src/launch/final-fill-and-graduate.ts.txt) demonstrates the SDK 0.3.0 lifecycle:

1. Classify a fresh quote and plan as a terminal quote-to-base buy. Enable partial fill
   only for this boundary, display the expected consumed amount and refund, then send.
2. Reconcile the actual `Swap` receipt. Persist the hash, consumed input, output and refund.
3. After confirmation, read at a block at least as recent as that receipt. Authenticate
   and simulate `planMigrateAtBlock(blockNumber)` before a **separate** migration transaction.
4. Decode the confirmed migration receipt and persist `canonicalPool`.

The CLI combines these steps to make the boundary visible. In an application, a permissionless
migrator can enqueue step 3 after the user completes the buy. Persist the successful fill before
scheduling migration. If migration fails, reconcile status and its transaction hash/receipt;
do not repeat the buy. A `ReadyToMigrate` resume calls only migration: verify the successful
fill hash, nonce and canonical block first. If a migration hash was submitted, reconcile it
before attempting anything else. If the RPC simulation failed before submission, use the
same curve after restoring a working RPC; do not create or buy another token. A ready curve skips the buy, and an already graduated curve returns its
pool. The example does not migrate unrelated generations or enable an auto-route registration.

| Curve status | Trading screen |
| --- | --- |
| `0` Uninitialized | Do not offer a curve swap. |
| `1` Active | Quote and trade on the curve. |
| `2` ReadyToMigrate | Show migration pending; do not treat it as an active curve or a confirmed pool. |
| `3` Migrated | Use the confirmed `canonicalPool` and its actual pool model. |

## 7. Support the pool and launchpad fees

| Integration task | Example |
| --- | --- |
| Trade after concentrated Graduation | `quickstart:swap -- concentrated <canonicalPool> <tokenIn> <humanAmount>` |
| Inspect positions and fee estimates | `arl:get-user-positions -- <owner>` |
| Claim a position's actual fees | `arl:claim-position-fee -- <pool> <tokenId>` |
| Inspect fee policy, recipients and quote-asset claimable | `launch:fee-sharing -- <configId> [beneficiary]` |
| Claim creator/partner launch trading fees in the actual fee asset | `launch:claim-fees -- <feeAsset> [recipient]` |
| Preview aggregator execution and approvals | [routing](https://docs.ammora.org/guides/src-routing-readme) and [lightweight integration](https://docs.ammora.org/guides/src-integrations-readme) |

The auto-route examples select a **separate** complete GIWA generation. A curve/pool from
the permissionless launch examples is not automatically eligible there. Check generation,
factory, registration and runtime before offering a route; do not substitute addresses to
make verification pass. Fee claiming likewise requires the caller's actual entitlement;
Config ownership does not grant every creator/partner fee claim.

## Validation scope

Read [current validation](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) before using historical test targets.

## GIWA public-network findings and fee sharing

Use `AMMORA_GIWA_GENERATION=auto-route` to select the complete SDK-reviewed new
generation (registry `0x6d043014972b87406C4757a5f2d655A24e0b0aF9`). The default
`legacy` preserves the earlier generation; never reuse Config IDs across registries.
Public reads serialize at `AMMORA_RPC_INTERVAL_MS=600` by default.

V4 ERC-20 curve swaps in `quickstart:swap` now use an explicit confirmed-block plan
with the SDK's `PreparedExactInputSwap` execution lifecycle, because SDK 0.3.0's
convenience DBC planner internally selects a latest head that GIWA may not yet serve.
Authentication, state and quote stay at one block; current execution simulation and
minimum output remain mandatory. `launch:graduate` uses the same planner and waits
for the final fill to enter its confirmed snapshot before migrating. Clear the read-only
`AMMORA_READ_RECEIPT` override before running Graduation.

The new generation's native execution registry does not currently enable its launch
factory. Use explicitly funded WETH inputs, omitting `native`; this example never
silently switches assets or changes the registry. The separate aggregation registry
is not proof of native-router capability.

Read the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
for exact fee fractions, real fee assets, FeeVault aggregate accounting, LP fee claims,
shared-owner validation limits and the distinction from optional AFS distribution vaults.
