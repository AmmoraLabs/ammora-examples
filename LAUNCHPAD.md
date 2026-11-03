# Build a launchpad with SDK 0.3.8

For a contract agent, follow the [agent quickstart](https://docs.ammora.org/guides/agent-quickstart) and [full agent lifecycle](https://docs.ammora.org/guides/agent-launchpad). Creating your own Config needs no per-team Ammora approval; see [permission boundaries](https://docs.ammora.org/guides/self-service-access).

New partners should start with the [quickstart](https://docs.ammora.org/guides/partner-quickstart) for SDK installation, wallets, funds, GIWA setup and the path from fee configuration to claims. Continue here for detailed implementation.

This guide describes the **shared path for any launchpad to choose its Config and recipients, issue new tokens through Ammora contracts and operate them**. It assumes neither a particular partner's existing token nor an issuance gate. Use public SDK `@ammora-protocol/sdk@0.3.8` and Math `0.3.0`; run commands at this repository's root.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) covers clean-project installation and this guide's GIWA atomic-launch preview. Actual issuance, trading and claims reuse preserved GIWA evidence within its original SDK/block scope. The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) remains available as history.

The default path uses GIWA Sepolia's `auto-route` V4 generation and **concentrated graduation**. The name auto-route does not guarantee aggregation-router or native-route activation. This guide uses direct contract calls and ERC-20 quote trades through the configured chain RPC.

```text
Launchpad creates Config — reuse it for multiple tokens
           ↓
Creator issues token — new token + pre-graduation ALC curve
           ↓
Buy / sell on ALC
           ↓
Final buy and consumed-input reconciliation → ReadyToMigrate
           ↓ Separate migration transaction
Post-graduation ARL pool + Config-defined LP positions
           ↓
Trade on ARL / claim Creator and Partner FeeVault fees / claim LP NFT fees
```

## How to follow this guide

Start with **one reusable Config and concentrated graduation**. Connect steps 2–9 in order. For issuance plus an initial buy, [step 4-A](#atomic-first-buy) offers a new-Config path or an existing-Config path. Full economic-policy editing, Compounding and time locks are optional in step 12. Quick Create and ordinary ARL pool creation are alternative workflows, not additional default steps.

| Step / app screen | Caller | Main command | Save after completion |
| --- | --- | --- | --- |
| 2. Connection/deployment verification | Anyone; reads only | `quickstart:verify`, `launch:get-config` | Chain, generation, Registry, template hash |
| 3. Platform policy registration | Config owner | Addresses only: `launch:team-config`; custom split: `launch:fee-config` → `launch:config-json` | Actual Config ID/hash, recipients/split, receipt |
| 4. Token creation form | Token Creator | `launch:create-launch` | Token, curve, Creator, receipt |
| 4-A. Creation + first buy | New Config: owner=Creator=payer; existing Config: Creator | `launch:create-config-and-first-buy` / `portable:existing-config-first-buy` | Actual Config ID/hash, token/curve, first-buy receipt |
| 5. Pre-graduation trades | Each trader | `launch:quote` → `quickstart:swap` (`dbc`) | Input/received amounts, receipt, curve status |
| 6. Graduation/recovery | Execution wallet with gas | `launch:graduate` or `launch:migrate` | Fill hash, migration hash, canonicalPool |
| 7. Post-graduation trades | Each trader | `quickstart:swap` (`concentrated`) | Pool model, trade receipt |
| 8. Launch fees | Creator and Partner separately | `launch:fee-sharing` → `launch:claim-fees` | Fee asset, beneficiary, payout, actual payment |
| 9. LP fees | NFT owner or fee delegate | `arl:claim-position-fee` | Manager, NFT ID, payout, actual payment |
| 9-A. Team split (optional) | Vault creator → funder → each recipient | `dfs:create-json` → `dfs:fund` → `dfs:claim` | Vault, fee token, recipient indices/weights, payout receipts |

This table identifies commands; use each step's code block for arguments, units and send behavior. Do not execute every `AMMORA_SEND=1` block together; inspect each receipt first.

Implement fees in order: [recipients and split](https://docs.ammora.org/guides/fee-sharing#fee-config) → [distribution preview](https://docs.ammora.org/guides/fee-sharing#fee-preview) → [Creator/Partner claims](#creator-partner-claims) / [LP owner/delegate claims](#lp-fee-claims) → optional [team split](#multi-recipient-fees), followed by [transfer/balance reconciliation without resending](https://docs.ammora.org/guides/fee-sharing#verify-payment). The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) distinguishes existing GIWA evidence for the default path from optional features requiring additional examples.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) records 18 receipts from a fresh project: new Config/GLPD issuance, trades before/after graduation, LP/FeeVault payouts, actual balance changes, allowance cleanup and the scope of reused evidence.

## 1. Distinguish terms and roles

| Term | Meaning here |
| --- | --- |
| Config | Reusable immutable configuration for supply, curve, fees, graduation, LP allocation and recipients |
| ALC curve | Pre-graduation bonding curve created with the token; CLI model `dbc` |
| ARL pool | Post-graduation AMM created by migration; `concentrated` here |
| Config owner | Launchpad wallet signing direct Config creation; Config ownership does not confer all fee rights |
| Creator | Wallet calling token creation; `msg.sender` in default V4, possibly different from Config owner |
| Partner recipient | Launchpad fee recipient in Config |
| LP beneficiary | Owner of LP allocated at graduation, subject to Config lock/allocation policy |
| Payout address | Destination selected by an already-authorized claimant; no new claim authority |

New Config creation needs no per-launchpad governance/registrar approval. However, **the direct caller must equal Config owner**. The designated Shared Core forwarder exception does not authorize arbitrary partner issuance gates. Multisig/contract Config owners must execute through a path where that wallet is the actual caller; configuring an EOA CLI key cannot impersonate a contract address.

Launchpad A uses its Config and Partner wallet; B uses its own. Each service's Creators can issue tokens with the selected Config. Changing immutable economics or Partner requires a new Config.

### Should I start with `createProductionPool`?

No. `createProductionPool` creates **only an ARL AMM** for existing tokens, without token issuance, ALC or graduation-state transitions. The default launchpad path is Config → `createLaunch` → curve migration. Do not run `arl:create-pool` again to create the graduated pool.

| Desired setup | Scope |
| --- | --- |
| Issue new tokens with platform policy and use ALC → ARL | **Default path in this guide** |
| Operate your own curve and use only ARL | Separately design ordinary ARL creation and your graduation adapter |
| Insert an already-issued ERC-20 into default ALC | No such entry point in default V4 LaunchFactory; optional extension work |

LaunchFactory creates and policy-registers new tokens in the default path. Launchpads do not request registrar registration for every token. The protocol must support the selected quote asset and deployment. This guide uses an already-supported quote asset; Config creation does not grant permission to approve arbitrary quotes. Ordinary ARL creation with external tokens requires separate TokenPolicy checks; distinguish permissionless probes for unregistered standard ERC-20s from administrator classification.

## 2. Install and select one deployment generation

```bash
curl -fL https://docs.ammora.org/examples/setup.mjs -o ammora-examples-setup.mjs
# Review the setup source, then prepare a new directory
node ammora-examples-setup.mjs ./ammora-examples
cd ammora-examples
npm ci --ignore-scripts
cp .env.example .env

export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
export AMMORA_RPC_INTERVAL_MS=600
export AMMORA_SEND=0
export AMMORA_READ_RECEIPT=''

npm run quickstart:verify
npm run quickstart:configs -- 10
npm run launch:get-config -- 6
```

Exports affect only the current terminal. `.env.example` defaults to `legacy`, so also edit the copied **local `.env`** for this guide. This prevents a new terminal or app process from reading a different Registry or Config.

```dotenv
AMMORA_CHAIN_ID=91342
AMMORA_GIWA_GENERATION=auto-route
AMMORA_RPC_INTERVAL_MS=600
AMMORA_SEND=0
AMMORA_READ_RECEIPT=
```

Never commit local `.env`. These steps need no private key. An Explorer timeout is not proof of an unverified contract; preserve the original error and recheck after connectivity recovers. Runtime-pin matches do not replace Explorer verification.

Use Node 22 or 24. A new project's direct dependencies can be installed with `npm install --save-exact @ammora-protocol/sdk@0.3.8 viem dotenv`; the full command set here requires the repository source and `npm ci` above. Copy required `src/shared` files together with `src/launch` or `src/arl`. Standalone `src/quickstart` verify/create/swap files need adjacent `runtime-pins.giwa.json`.

Do not mix `legacy` and `auto-route` Registry, Config IDs, Factory or Manager. Preserve explicit deployment selection instead of relying on implicit SDK GIWA defaults. Resolve runtime/Explorer verification failures before proceeding.

### Reads, unsigned previews and actual sends

| Command category | Key / send behavior |
| --- | --- |
| `quickstart:verify`, Config/curve/funding/fee-sharing reads | No key required |
| `launch:team-config -- preview`, `launch:config-json -- preview` | Keyless review; full JSON path needs `AMMORA_ACCOUNT` |
| `launch:author-config`, `launch:migrate`, `launch:config-enabled`, `launch:creator-metadata`, `arl:create-position`, `arl:vest-position` | Public caller `AMMORA_ACCOUNT` required; `AMMORA_SEND=0` never sends |
| `launch:create-launch`, `launch:quick-create`, `quickstart:swap`, `swap:safe`, `launch:graduate`, `launch:claim-fees`, `arl:claim-position-fee`, `arl:fee-delegate` | Send CLIs; `AMMORA_SEND=0` rejects at the send gate rather than providing a preview |

Choose your **public addresses** first. Do not copy deployment/validation wallets as recipients.

```bash
CONFIG_OWNER='REPLACE_WITH_CONFIG_OWNER_PUBLIC_ADDRESS'
CREATOR_WALLET='REPLACE_WITH_CREATOR_PUBLIC_ADDRESS'
PARTNER_WALLET='REPLACE_WITH_PARTNER_FEE_PUBLIC_ADDRESS'
LP_OWNER='REPLACE_WITH_LP_OWNER_PUBLIC_ADDRESS'
PAYOUT='REPLACE_WITH_REVIEWED_PAYOUT_ADDRESS'
export AMMORA_ACCOUNT="$CONFIG_OWNER"
```

`AMMORA_ACCOUNT` selects the unsigned caller; it does not change keys or signers. When switching roles, switch the actual connected wallet (or CLI local signing key) and also update the public account for commands that read it. Each user needs their own gas ETH and separate trade-input assets.

The `AMMORA_SEND=1` commands below actually submit transactions. Run selected steps only after configuring your own role-specific test wallet locally. Set `.env.example`'s `AMMORA_PRIVATE_KEY` only in private local CLI configuration, never source/docs/commits. Frontends sign through the connected user's WalletClient, not CLI private-key helpers.

## 3. Configure → preview → create the launchpad Config

### 3-1. Specify launchpad recipients

Save the following as `team-recipients.json` and **replace all four role addresses with your service's public addresses**. Validation rejects placeholders.

```json
{
  "schemaVersion": 1,
  "chainId": 91342,
  "registry": "0x6d043014972b87406C4757a5f2d655A24e0b0aF9",
  "templateId": "6",
  "templateHash": "0x6048908774397e0691bb0e19f72dabb790eb0d892d6081d3622b39e7f738e667",
  "configOwner": "REPLACE_WITH_CONFIG_OWNER",
  "partnerRecipient": "REPLACE_WITH_PARTNER_FEE_WALLET",
  "liquidityPartner": "REPLACE_WITH_PARTNER_LP_WALLET",
  "leftoverReceiver": "REPLACE_WITH_LEFTOVER_WALLET"
}
```

Template #6 is a reviewed GIWA example. In step 2 output, inspect enabled status, Config hash, `migrationMode: 0`, quote/decimals/fees/vesting/LP locks and allocations. For another template, update Registry, ID and hash together and compare actual reads. `launch:team-config` explicitly selects all four roles instead of silently copying template recipients.

To choose the Creator/Partner ratio too, use `launch:fee-config` in the **[fee configuration and claim guide](https://docs.ammora.org/guides/fee-sharing)**. Four recipients plus `creatorShareOfNonProtocolBps` produce pre-graduation fee and post-graduation LP/claim/compounding previews, then full Config JSON for `launch:config-json`. LP ratios, locks and vesting remain inherited. The recipient-only path below also preserves the Creator ratio.

### 3-2. Enter sale supply and graduation threshold as raw integers

```bash
SALE_SUPPLY_RAW='REPLACE_WITH_BASE_RAW_INTEGER'
QUOTE_THRESHOLD_RAW='REPLACE_WITH_QUOTE_RAW_INTEGER'

npm run launch:team-config -- preview team-recipients.json "$SALE_SUPPLY_RAW" "$QUOTE_THRESHOLD_RAW"
```

With base decimals 9, 1,000,000 tokens equal `1000000000000000` raw. With 18-decimal WETH quote, 0.001 WETH also equals `1000000000000000` raw. Identical numbers can represent different assets/units. Use actual template decimals and reviewed economics.

The helper calculates both curve and graduation-liquidity budgets from sale supply. `saleSupplyRaw` is not total issuance. Review reconciliation of `totalSupply`, graduation base, token vesting and quote-rounding surplus.

This helper uses a **concentrated template**, inheriting fees, Creator share, LP ratios, locks and vesting. Replacing four addresses does not redesign economics. Step 12 covers full Config/segments editing through `launch:author-config` / `launch:config-json`; it is an alternative, not another required creation step.

### 3-3. Create the reviewed Config

For Config+issuance+first buy in one transaction, skip this create step and step 4 and use [path A in step 4-A](#atomic-first-buy). To reuse a Config, register it here then use path B.

Connect as `configOwner`. Preview `reviewHash` binds chain, Registry, amounts, exact calldata and recipients.

```bash
REVIEW_HASH='REPLACE_WITH_PREVIEW_REVIEW_HASH'

AMMORA_SEND=1 npm run launch:team-config -- create team-recipients.json "$SALE_SUPPLY_RAW" "$QUOTE_THRESHOLD_RAW" "$REVIEW_HASH"
```

Preview again if inputs change before signing. Config creation is separate from token issuance. Save the successful transaction hash, actual Config ID and Config hash.

```bash
CONFIG_ID='REPLACE_WITH_CONFIRMED_CONFIG_ID'
CONFIG_CREATION_HASH='REPLACE_WITH_SUCCESSFUL_CONFIG_TX_HASH'

AMMORA_READ_RECEIPT="$CONFIG_CREATION_HASH" npm run launch:get-config -- "$CONFIG_ID"
```

GIWA confirmation-depth snapshots can lag a newly created Config. This receipt selector reads the successful canonical receipt's block. Do not resend creation because RPC reads are delayed.

## 4. Issue a new token and create its pre-graduation ALC

Connect the token's **Creator wallet**, which may differ from Config owner. Config owner funds Config-creation gas; Creator funds issuance gas and Config `poolCreationFee` in native ETH. Native creation value and later WETH buy funds are separate.

```bash
AMMORA_READ_RECEIPT="$CONFIG_CREATION_HASH" AMMORA_SEND=1 npm run launch:create-launch -- "$CONFIG_ID" "Launchpad Token" "LPT" "ipfs://REPLACE_WITH_METADATA_URI"
```

This creates **a new token and new ALC curve together** using the Config. Reuse a platform Config across tokens; no new Config is required for every token. Name, symbol and metadata URI may differ per token; decimals must match the selected immutable Config.

Save these actual receipt-derived values:

```bash
TOKEN='REPLACE_WITH_CREATED_TOKEN_ADDRESS'
CURVE='REPLACE_WITH_CREATED_CURVE_ADDRESS'
TOKEN_CREATION_HASH='REPLACE_WITH_SUCCESSFUL_LAUNCH_TX_HASH'

AMMORA_READ_RECEIPT="$TOKEN_CREATION_HASH" npm run launch:quote -- "$CURVE"
```

Do not confirm a token address from a prediction or metadata response. Preserve LaunchFactory receipt token/curve/Config ID/hash/block together. A platform contract or server wallet calling on behalf of users becomes Creator. The basic function cannot designate an arbitrary end-user Creator. For user-specific Creators, each user issues through their own connected wallet.

`launch:quick-create` separately combines Config and token creation, but this guide defaults to reusable Configs. **Quick Create does not include the first buy.**

<a id="atomic-first-buy"></a>
## 4-A. Combine Config creation, token issuance and the first buy

**Public SDK 0.3.8 includes the verified GIWA helper, so the convenience path needs no separate deployment files.** Atomic creation combines token/ALC creation and first buy in one transaction; failure of the buy reverts that transaction's creation too. Required ERC-20 approvals remain separate prior transactions.

| Desired UX | Example / public SDK call | Caller |
| --- | --- | --- |
| New Config + new token/ALC + first buy | `launch:create-config-and-pool-with-first-buy` / `createConfigAndPoolWithFirstBuy` | Config owner = Creator = buyer/funder/recipient |
| New token/ALC + first buy with existing platform Config | `portable:existing-config-first-buy` / `planExistingConfigAtomicFirstBuy` | Token Creator = buyer/funder/recipient; may differ from Config owner |

The first row uses public SDK 0.3.8’s `createConfigAndPoolWithFirstBuy` convenience function. Existing explicit-manifest `planAtomicFirstBuy` remains supported. After approval preparation, **all three operations share one transaction**. `launch:quick-create` stops at Config+issuance. Choose one path; do not run step 3-3 create or step 4 issuance before the new-Config atomic path.

### Current support and historical BLOCKED status

| Record / environment | Status |
| --- | --- |
| [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md), block 39687133 | `BLOCKED` then: no helper, approval or manifest for the current Factory |
| [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md), blocks 39691306 / 39692625 | Both new/existing-Config paths issued, bought and received tokens; evidence `REUSED` |
| Historical public SDK 0.3.6 default auto-route catalog alone | `firstBuyExecutor=null`; additional configuration below required |
| Historical SDK 0.3.6 plus verified configuration below | Supported; SDK rechecks runtime, Factory binding, callback approval, funds and allowance |
| **Current public SDK 0.3.8** default GIWA catalog/convenience function | Helper and 11 runtime pins included; preview, approval and creation without deployment/targets JSON |

This approves **first-buy executor contract code**, not partner registration. New partners using the same verified GIWA helper need not register their wallets as registrars. Do not copy this configuration to another chain/Factory or treat an arbitrary observed runtime hash as trusted. See the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

### Public SDK 0.3.8 convenience path without deployment files

The SDK includes GIWA helper/runtime pins and `createConfigAndPoolWithFirstBuy(client, { ...parameters, blockNumber })`. It **does not sign or send**; it returns `APPROVAL_REQUIRED` or `READY` plans.

```bash
npm install --save-exact @ammora-protocol/sdk@0.3.8 viem dotenv
```

No local SDK checkout, build or candidate tarball is required. Review [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md). Your `team-recipients.json` policy is required; deployment/targets JSON is not.

```bash
export AMMORA_CHAIN_ID=91342 AMMORA_GIWA_GENERATION=auto-route
export AMMORA_READ_RECEIPT='' AMMORA_SEND=0
ATOMIC_EXPIRY=$(( $(date +%s) + 1800 ))
CATALOG_ARGS=(team-recipients.json 1000000000000 1000000000000
  'My Launch' 'MYL' 'https://example.com/my-launch.json'
  10000000000 330000000000 100000000 "$ATOMIC_EXPIRY")
npm run launch:create-config-and-pool-with-first-buy -- "${CATALOG_ARGS[@]}"
# Review roles, amounts and deadline, then execute once with the printed reviewHash:
# AMMORA_SEND=1 npm run launch:create-config-and-pool-with-first-buy -- "${CATALOG_ARGS[@]}" "$ATOMIC_REVIEW_HASH"
```

`APPROVAL_REQUIRED` executes only approval. Verify its receipt, preview the same inputs at a fresh block, confirm `READY`, then execute to combine Config/token/first buy. Example minimum output applies only to the example economics; recalculate after policy/supply/fee changes. Config owner=Creator=buyer, and gas ETH differs from buy WETH. Never repeat successful creation; use actual receipt Config ID/hash/token/curve in later steps. Path B uses the public existing-Config example.

### Advanced explicit-manifest operations

The public SDK catalog is the recommended GIWA path above. Explicit-manifest planners remain available for reviewed deployments: [Config plus first buy](src/launch/team/create-config-and-first-buy.ts) and [existing-Config first buy](src/portable/atomic-first-buy.ts). Supply your own reviewed deployment, target identities, runtime pins and positive output bounds. Historical fixture filenames are not execution defaults. Never infer callback admission or signer authority from an observed address alone.

## 5. Pre-graduation trading on ALC

Use receipt overrides for one read only; clear them before trading to read current confirmed state. Confirm activation has passed and trading is allowed.

```bash
export AMMORA_READ_RECEIPT=''
npm run launch:quote -- "$CURVE"
```

Set the next variable from `state.quoteToken`. GIWA's default path separates WETH from native ETH: gas uses ETH, ERC-20 buys use the actual quote asset.

```bash
QUOTE_TOKEN='REPLACE_WITH_CURVE_QUOTE_TOKEN'
CREATOR_WALLET='REPLACE_WITH_CREATOR_PUBLIC_ADDRESS'
npm run launch:funding -- "$CONFIG_ID" "$CREATOR_WALLET"
```

`launch:funding` reads balances and **previews** wrapping; it does not deposit WETH. Inspect `nativeBalanceRaw` and `quoteBalanceRaw`. If quote is sufficient, no wrap is needed. Otherwise review a separate plan for only the required amount.

```bash
HUMAN_WRAP_AMOUNT='REPLACE_WITH_NEEDED_DECIMAL_WETH_AMOUNT'
npm run launch:funding -- "$CONFIG_ID" "$CREATOR_WALLET" "$HUMAN_WRAP_AMOUNT"
```

`wrap.transaction` calls reviewed WETH `deposit()`: `to` is WETH, `data` is deposit calldata, `value` is native ETH raw. Convert large JSON integer strings to `BigInt` for WalletClient. Recheck balances/gas and simulate with the connected user wallet before submission. Verify successful receipt and WETH increase before buying. Do not wrap all ETH; wrapping itself needs no ERC-20 approval or native-router activation. Explicitly wrap only when quote is the deployment's wrapped-native asset; otherwise acquire the actual ERC-20 quote. Do not assume a native route is enabled.

```bash
# Quote: both inputs are raw integers
QUOTE_BUY_RAW='REPLACE_WITH_QUOTE_RAW_INTEGER'
BASE_SELL_RAW='REPLACE_WITH_BASE_RAW_INTEGER'
npm run launch:quote -- "$CURVE" buy "$QUOTE_BUY_RAW"
npm run launch:quote -- "$CURVE" sell "$BASE_SELL_RAW"

# Swap: human-readable decimal amount of the input asset
HUMAN_QUOTE_IN='REPLACE_WITH_DECIMAL_AMOUNT'
HUMAN_BASE_IN='REPLACE_WITH_DECIMAL_AMOUNT'
AMMORA_SEND=1 npm run quickstart:swap -- dbc "$CURVE" "$QUOTE_TOKEN" "$HUMAN_QUOTE_IN"
AMMORA_SEND=1 npm run quickstart:swap -- dbc "$CURVE" "$TOKEN" "$HUMAN_BASE_IN"
```

`launch:quote` raw integers differ from `quickstart:swap` human decimal amounts. The buy/sell wallet is the actual trader. Review SDK approval target/amount, slippage and fresh simulation before signing. Do not globally allow partial fills for ordinary swaps.

| Quote classification | Handling |
| --- | --- |
| `full` | Ordinary trade with fresh quote/minimum output |
| `graduation-boundary` | Final-buy boundary; distinguish maximum, consumed and unused input in step 6 |
| Partial sell / dust / RPC failure | Stop/requery; do not display as executable success |

## 6. Graduation: final buy and migration are separate transactions

| Curve status | UI/action |
| --- | --- |
| `0` Uninitialized | Trading unavailable |
| `1` Active | Check activation/funds/quote, then trade ALC |
| `2` ReadyToMigrate | Final buy complete; await migration without repeating the buy |
| `3` Migrated | Verify canonicalPool and switch to ARL |

```bash
MAXIMUM_QUOTE_RAW='REPLACE_WITH_REVIEWED_POSITIVE_MAX_QUOTE_RAW'
AMMORA_READ_RECEIPT='' AMMORA_SEND=1 AMMORA_GRADUATION_CONFIRM=1 npm run launch:graduate -- "$CURVE" "$MAXIMUM_QUOTE_RAW"
```

Only a **final-buy boundary** makes this example show consumed/unused maximum input and buy. It does not send ordinary buy quotes. On GIWA ERC-20 paths, unused input stays in the wallet; no refund Transfer or later refund claim occurs. `launch:graduate` labels it `unused input`. Historical logs saying `refunded` refer to that same unused amount, not a refund payment. Do not count it as payout; reconcile WETH debit/transfers with `consumed`. Wait for confirmed state containing the successful fill receipt, then separately simulate/send migration.

If already status=2, skip buying. The combined CLI still requires a positive max-input argument although it does not use it; resume instead with the existing migration-only command. Set the public execution caller and add `AMMORA_SEND=1` only to send.

```bash
export AMMORA_ACCOUNT="REPLACE_WITH_MIGRATION_CALLER_PUBLIC_ADDRESS"
npm run launch:migrate -- "$CURVE"
AMMORA_SEND=1 npm run launch:migrate -- "$CURVE"
```

The SDK boundary is `planMigrateAtBlock`. Status=3 returns the existing canonicalPool. If fill succeeds and migration fails, preserve fill hash and recover **migration only**. Reconcile submitted hash/nonce/receipt/canonical block before resending. Never recreate the token or repeat the successful final buy.

### Unused final input and allowance cleanup

GIWA auto-route's final buy takes **only consumed input**. SDK `amountLeft` / `refundableAmountIn` denotes unused input, not an actual refund Transfer on this path. Reconcile receipt debits/receipts. Approving maximum input may leave allowance for unused funds. Reconcile fill and migration first, then revoke only the unused **curve-specific allowance** to zero. Do not batch-change approvals for other apps/pools.

This ERC20 cleanup example uses connected-wallet `publicClient` / `walletClient`; `account`, `quoteToken` and `curve` must match the just-verified operation.

```ts
import { erc20Abi } from "viem";

if (publicClient.chain?.id !== 91342) throw new Error("Wrong reviewed chain");
const remaining = await publicClient.readContract({
  address: quoteToken, abi: erc20Abi, functionName: "allowance",
  args: [account.address, curve],
});
if (remaining > 0n) {
  const hash = await walletClient.writeContract({
    account, chain: publicClient.chain, address: quoteToken, abi: erc20Abi,
    functionName: "approve", args: [curve, 0n],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Approval cleanup failed");
  const after = await publicClient.readContract({
    address: quoteToken, abi: erc20Abi, functionName: "allowance",
    args: [account.address, curve], blockNumber: receipt.blockNumber,
  });
  if (after !== 0n) throw new Error("Approval cleanup state mismatch");
}
```

## 7. Verify the graduated pool and LP NFTs, then switch trading

Save actual pool and successful migration transaction. Curve canonicalPool must match receipt pool.

```bash
POOL='REPLACE_WITH_CONFIRMED_CANONICAL_POOL'
MIGRATION_HASH='REPLACE_WITH_SUCCESSFUL_MIGRATION_TX_HASH'

npm run launch:quote -- "$CURVE"
npm run launch:migration-positions -- "$CURVE" "$MIGRATION_HASH"
```

Use `launch:migration-positions` after the migration receipt enters the confirmed snapshot. Preserve every output NFT, including Creator, Partner and rounding-dust positions. IDs are **Position Manager NFT IDs**, distinct from pool-internal position numbers. Receipt-time ownership and current claim ownership/delegation require separate checks.

```bash
AMMORA_SEND=1 npm run quickstart:swap -- concentrated "$POOL" "$QUOTE_TOKEN" "$HUMAN_QUOTE_IN"
AMMORA_SEND=1 npm run quickstart:swap -- concentrated "$POOL" "$TOKEN" "$HUMAN_BASE_IN"
```

Subsequent trades target POOL, not CURVE. If another Config chose `migrationMode: 1`, use its actual `compounding` model, economics and claim path. Do not force it into concentrated examples. This template helper and LP-NFT default path use concentrated.

<a id="creator-partner-claims"></a>

## 8. Creator and Partner launch-fee claims

The [fee configuration/claim guide](https://docs.ammora.org/guides/fee-sharing) connects role-specific payouts, LP delegation and 2–5-recipient team splits. Pre-graduation trading fees and post-graduation LP fees have different rights and call paths. Config owner, trader, Creator, Partner and LP owner are not interchangeable.

```bash
PARTNER_WALLET='REPLACE_WITH_CONFIG_PARTNER_RECIPIENT'
npm run launch:fee-sharing -- "$CONFIG_ID" "$CREATOR_WALLET"
npm run launch:fee-sharing -- "$CONFIG_ID" "$PARTNER_WALLET"
```

Inspect actual claimable amounts per asset/beneficiary. The default WETH example explicitly selects the fee asset; select another asset if fees accrued there. Illustrative distribution divides a fee amount; it is neither a trading-volume fee rate nor already-paid revenue.

`launch:fee-sharing` `claimableQuoteRaw` reads **quote only**. ALC buys/sells can also accrue issued-token fees, so inspect quote and `TOKEN` separately. Apps use the returned feeVault, beneficiary and actual quote/token addresses. Read both assets at one block through connected `publicClient`:

```ts
import { feeVaultAbi } from "@ammora-protocol/sdk";

const feeBlock = await publicClient.getBlockNumber();
for (const feeToken of [quoteToken, token]) {
  const claimable = await publicClient.readContract({
    address: feeVault, abi: feeVaultAbi, functionName: "claimable",
    args: [feeToken, beneficiary], blockNumber: feeBlock,
  });
  console.log({ feeToken, beneficiary, claimable });
}
```

```bash
FEE_TOKEN="$QUOTE_TOKEN"
# Creator wallet: claim Creator's own entitlement
AMMORA_SEND=1 npm run launch:claim-fees -- "$FEE_TOKEN"

# Switch to Partner wallet and claim Partner's own entitlement separately
AMMORA_SEND=1 npm run launch:claim-fees -- "$FEE_TOKEN"
```

For a separate payout, sign with **the beneficiary that owns the fees**.

```bash
PAYOUT='REPLACE_WITH_REVIEWED_PAYOUT_ADDRESS'
AMMORA_SEND=1 npm run launch:claim-fees -- "$FEE_TOKEN" "$PAYOUT"
```

If issued-token claimable is positive, separately set `FEE_TOKEN="$TOKEN"` and claim. Omitting payout pays yourself. Quote claims do not also claim token fees; reconcile positive amounts and receipts for each wallet/asset.

This calls `claimFor(feeToken, connectedAccount, payout)`. A payout gains no authority over someone else's entitlement. If Creator and Partner are one wallet, claimable may aggregate; do not count two independent payments. FeeVault aggregates multiple launches, so its total is not one token's revenue. Zero-claimable no-ops are not successful payments.

<a id="lp-fee-claims"></a>

## 9. Post-graduation LP claims and fee-only delegation

Connect as LP NFT owner. Permanent principal locks are separate from fee claims.

```bash
LP_OWNER='REPLACE_WITH_LP_NFT_OWNER'
npm run arl:get-user-positions -- "$LP_OWNER"

MANAGER_NFT_ID='REPLACE_WITH_ACTUAL_MANAGER_NFT_ID'
AMMORA_SEND=1 npm run arl:claim-position-fee -- "$POOL" "$MANAGER_NFT_ID"
AMMORA_SEND=1 npm run arl:claim-position-fee -- "$POOL" "$MANAGER_NFT_ID" "$PAYOUT"
```

The two claims above are alternatives. If one empties the balance, do not repeat the other as payout validation. Distinguish base/quote fees and count only actual positive payments.

NFT owner grants delegation only when needed.

```bash
DELEGATE='REPLACE_WITH_REVIEWED_FEE_DELEGATE'
# Run as owner: restrict fee payout to NFT owner
AMMORA_SEND=1 npm run arl:fee-delegate -- "$POOL" "$MANAGER_NFT_ID" "$DELEGATE" claim-fee-to-owner

# Connect delegate: omitting payout pays NFT owner
AMMORA_SEND=1 npm run arl:claim-position-fee -- "$POOL" "$MANAGER_NFT_ID"

# Reconnect owner and revoke when needed
AMMORA_SEND=1 npm run arl:fee-delegate -- "$POOL" "$MANAGER_NFT_ID" revoke
```

`claim-fee-to-owner` is permission 16. For a delegate to choose another payout, owner deliberately grants permission 8, `claim-fee`. These permissions differ because the latter redirects fees. Neither transfers NFT ownership nor grants withdrawal of locked principal. Unauthorized/revoked delegates and attempts to change an owner-only payout must be rejected.

For delegated separate payouts, choose the following **instead of** the owner-only path. Inspect the current grant first: setting permissions replaces a single delegate slot.

```bash
# Connect NFT owner: fee permission allowing a separate payout
AMMORA_SEND=1 npm run arl:fee-delegate -- "$POOL" "$MANAGER_NFT_ID" "$DELEGATE" claim-fee
# Switch actual delegate wallet; AMMORA_ACCOUNT alone does not change the signer.
AMMORA_SEND=1 npm run arl:claim-position-fee -- "$POOL" "$MANAGER_NFT_ID" "$PAYOUT"
# Return to NFT owner and revoke the used permission
AMMORA_SEND=1 npm run arl:fee-delegate -- "$POOL" "$MANAGER_NFT_ID" revoke
```

The CLI checks simulation and payout events. Actual receipt confirmation also needs base/quote transfers and receipt-block balance reconciliation. [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) includes separate payouts, reconciled balances and unauthorized/revoked-wallet rejection; reuse only its original execution scope.

### Distinguish time locks from permanent locks

`arl:lock-position` creates a **permanent lock**. SDK `planLockManagedConcentratedVesting` supports cliff-only/periodic vesting; dedicated `arl:vest-position` appears in step 12. Check available unlocked liquidity, deployed Manager duration limits and timestamp/block units, then simulate. Locked amounts cannot be withdrawn, but NFT transfer remains possible and the lock follows the NFT. Active schedules cannot be extended; unlocked expired amounts can be relocked. Transfer prohibition or pre-expiry extension requires separate contract design/validation.

<a id="multi-recipient-fees"></a>

## 9-A. Split Creator/Partner revenue across team wallets

Follow the [fee guide's JSON and execution blocks](https://docs.ammora.org/guides/fee-sharing#multi-recipient-claims) when needed. Creator/Partner first claims, then deposits the **same received asset** into DFS; 2–5 registered recipients each claim their own index. Actual post-graduation LP proceeds can use the same direct funding path per asset. Keep quote and base separate.

| Step | Wallet / inputs | Command/source |
| --- | --- | --- |
| 1. Review/create split policy | Vault creator; fee token, distinct recipients, positive integer weights, salt | [dfs:create-json](https://docs.ammora.org/examples/source/src/dfs/create-json.ts.txt): preview → reviewHash → create |
| 2. Inspect created vault | Public read; actual receipt vault | [dfs:state](https://docs.ammora.org/examples/source/src/dfs/state.ts.txt): reconcile token, recipient indices and shares |
| 3. Deposit an explicit amount of received revenue | Wallet holding the asset; maximum raw deposit | [dfs:fund](https://docs.ammora.org/examples/source/src/dfs/fund.ts.txt): unsigned preview → approval/deposit |
| 4. Each recipient claims | Recipient for that index; optional separate payout | [dfs:claim](https://docs.ammora.org/examples/source/src/dfs/claim.ts.txt): unsigned preview → claim/transfer/balance verification |

Match preview `AMMORA_ACCOUNT` to the sending wallet. If original payout differed from beneficiary, the **payout wallet** is the funder. One vault distributes one asset; recipients/weights are immutable. Setting a vault as `partnerRecipient` alone does not automatically claim/fund it. FeeVault delegated-source funding is an optional [separate permission preflight](https://docs.ammora.org/guides/src-dfs-readme), unnecessary for the default path.

## 10. App state and payment-completion criteria

| Stage | Preserve / next action |
| --- | --- |
| Config receipt | Chain, Registry, configId/hash, owner, partnerRecipient, tx hash, block/hash |
| Launch receipt | Factory, token, curve, Creator, configId/hash, tx hash, block/hash |
| Trade receipt | Input/output assets, maximum/consumed/unused/received amounts, trader/recipient, hash and canonical state |
| ReadyToMigrate | Save successful fill hash; continue migration only |
| Migration receipt | canonicalPool, pool model, Manager, every NFT ID/owner/lock state |
| Fee/LP receipt | Caller, beneficiary/owner, payout, event amounts and actual received increase per asset |
| DFS creation/funding/claims | Factory, vault, fee token, base, recipients/indices/weights, hashes, gross/net and actual payout increase |

Submission is not completion. Reconcile successful receipt, canonical block, asset transfers/claim events and receipt-time recipient changes. Do not offset gas ETH spending against WETH payouts. Other same-block transfers can prevent a simple balance delta from identifying one claim. Failed reads are not zero revenue; pending/unknown hashes are not failed transactions to automatically resend.

Connect Config selection/review → token creation → state-based trading → migration wait/recovery → post-graduation trading → separate Creator/Partner/LP revenue screens. An Ammora HTTP feed is not required.

## 11. SDK boundaries and executable sources

Use these boundaries to inspect commands or build a connected-wallet app. Reuse public SDK calls without bundling `src/shared` environment/signer helpers into the browser.

| Step | SDK boundary | Source |
| --- | --- | --- |
| Config authoring | `buildCreateAmmoraV4Config`, `getAmmoraV4ConfigAtBlock`, receipt parser | [team/config.ts](https://docs.ammora.org/examples/source/src/launch/team/config.ts.txt) · [policy.ts](https://docs.ammora.org/examples/source/src/launch/team/policy.ts.txt) |
| Recipients/split/distribution preview | Example helper combining Config builder and SDK fee math | [fee-config.ts](https://docs.ammora.org/examples/source/src/launch/team/fee-config.ts.txt) · [fee-policy.ts](https://docs.ammora.org/examples/source/src/launch/team/fee-policy.ts.txt) · [config-json.ts](https://docs.ammora.org/examples/source/src/launch/config-json.ts.txt) |
| New token + ALC | `buildCreateAmmoraV4Launch`, `parseAmmoraV4LaunchCreatedReceipt` | [create-launch.ts](https://docs.ammora.org/examples/source/src/launch/create-launch.ts.txt) |
| ALC state/quote | `AmmoraV4LaunchCurveClient.getStateAtBlock` / `quoteExactInputAtBlock` | [quote-curve.ts](https://docs.ammora.org/examples/source/src/launch/quote-curve.ts.txt) |
| Trades/approvals/receipts | `AmmoraSwapClient`, `PreparedExactInputSwap`, confirmed-block V4 plan | [safe-swap.ts](https://docs.ammora.org/examples/source/src/quickstart/safe-swap.ts.txt) |
| Terminal fill / migration | `classifyAmmoraV4ExactInputFill`, `planMigrateAtBlock`, `parseAmmoraV4MigratedReceipt` | [final-fill-and-graduate.ts](https://docs.ammora.org/examples/source/src/launch/final-fill-and-graduate.ts.txt) |
| LP identification | `resolveAmmoraV4ConcentratedMigrationPositionsReceipt` | [migration-positions.ts](https://docs.ammora.org/examples/source/src/launch/migration-positions.ts.txt) |
| Creator/Partner claim | `feeVaultAbi` `claimFor` and own-entitlement planner | [claim-fees.ts](https://docs.ammora.org/examples/source/src/launch/claim-fees.ts.txt) · [fee-claim-plan.ts](https://docs.ammora.org/examples/source/src/launch/fee-claim-plan.ts.txt) |
| LP fee claim | `DammV2Client.planClaimManagedConcentratedFees` | [claim-position-fee.ts](https://docs.ammora.org/examples/source/src/arl/claim-position-fee.ts.txt) |
| Fee-only delegation | `DammV2Client.planUpdateDelegatePermission` | [fee-delegate.ts](https://docs.ammora.org/examples/source/src/arl/fee-delegate.ts.txt) |
| Multi-recipient creation/state | `DFSFactoryClient.planCreateVault`, `DFSClient.getState` | [create-json.ts](https://docs.ammora.org/examples/source/src/dfs/create-json.ts.txt) · [state.ts](https://docs.ammora.org/examples/source/src/dfs/state.ts.txt) |
| Multi-recipient funding/claims | `DFSClient.planCappedDirectFundingWithApproval`, `getClaimPreview`, `planClaim` | [fund.ts](https://docs.ammora.org/examples/source/src/dfs/fund.ts.txt) · [claim.ts](https://docs.ammora.org/examples/source/src/dfs/claim.ts.txt) |
| Creator/Partner/DFS payout recheck | Example helper reconciling SDK ABI, receipt/transfers and historical balances | [verify-claim.ts](https://docs.ammora.org/examples/source/src/fees/verify-claim.ts.txt) · [fee-payment.ts](https://docs.ammora.org/examples/source/src/shared/fee-payment.ts.txt) |

Blindly copying old `buildClaimFeeVault` calls can change separate-payout semantics. Preserve the own-beneficiary `claimFor` and Manager LP claim paths described here.

## 12. Full Config authoring and optional features

Beyond template-based setup, these entry points independently review/register a full Config. Config owner administers platform Configs; each issuance's Creator is its caller. Ordinary Config/issuance needs no per-partner registrar registration.

```bash
# Read/calculate as Config owner's public address. Supply/threshold are raw units.
export AMMORA_ACCOUNT="$CONFIG_OWNER"
npm run --silent launch:author-config -- 6 1000000000000 1000000000000 concentrated > full-config.json
# Alternative destination: same launch/ALC/graduation flow with Compounding LP.
npm run --silent launch:author-config -- 6 1000000000000 1000000000000 compounding > compounding-config.json
# First edit full-config.json recipients and economics for your platform.
npm run launch:config-json -- preview full-config.json
AMMORA_SEND=1 npm run launch:config-json -- create full-config.json "REPLACE_WITH_REVIEW_HASH"
```

`AMMORA_ACCOUNT` must be Config owner. The [complete JSON example](https://docs.ammora.org/examples/source/src/launch/config-document.example.json.txt) uses GIWA test values, not economic recommendations. Review quote, decimals, supply, segments, fee schedule, Creator/Partner split, LP allocations and vesting. Large JSON integers are **decimal strings**, small ABI integers are numbers, and booleans are booleans. Unknown fields, rounded integers and overflow are rejected. SDK/Registry verify fixed Protocol policy and graduation-funding reconciliation.

**`launch:author-config` inherits template Partner fee, LP and leftover recipients.** Setting `AMMORA_ACCOUNT` does not change them. Review/edit all recipients, including `config.partnerRecipient`, `config.liquidityDistribution.partner` and `config.leftoverReceiver`, then regenerate preview/reviewHash. Use step 3 `launch:team-config` to require all four role addresses.

Authoring starts calculations from existing policy. Concentrated uses a reviewed concentrated template. Compounding sets destination range coordinates to zero, calculates liquidity from gross reserves and uses an illustrative 5000 bps LP compounding ratio. Full documents remain editable but require fresh SDK validation, preview and hash review. Historical tests preserved existing recipients and initial 62.5% Partner / 37.5% Creator permanent LP locks.

If final buy already succeeded at `ReadyToMigrate(2)`, resume without buy arguments.

```bash
# Default is unsigned preview. Rejects status=1; status=3 shows existing pool.
npm run launch:migrate -- "REPLACE_WITH_CURVE"
AMMORA_SEND=1 npm run launch:migrate -- "REPLACE_WITH_CURVE"
```

This generates no buy/approval. Reconcile uncertain prior hashes/nonces/receipts/canonical blocks first; RPC lag does not justify resending final buy or migration. Common sending, exact approvals and canonical receipts live in [shared/run.ts](https://docs.ammora.org/examples/source/src/shared/run.ts.txt); unsigned plans and caller/target verification are in [shared/actions.ts](https://docs.ammora.org/examples/source/src/shared/actions.ts.txt). These are example helpers, not evidence of newly published SDK APIs.

Compounding also follows Config → `launch:create-launch` → ALC buy/sell → terminal fill → `launch:migrate`. Trade the graduated pool as `compounding` and claim with **that pool's own LP NFT ID**, not a Concentrated Manager NFT ID.

```bash
AMMORA_SEND=1 npm run swap:safe -- compounding "REPLACE_WITH_POOL" "REPLACE_WITH_TOKEN_IN" "REPLACE_WITH_HUMAN_AMOUNT"
# Preview unsigned as the owner of that Compounding pool NFT.
export AMMORA_ACCOUNT="$LP_OWNER"
npm run arl:claim-compounding-fees -- "REPLACE_WITH_POOL" "REPLACE_WITH_POOL_NFT_ID"
```

To verify time locks with additional liquidity, create a new Manager NFT. Set LP owner's public address as `AMMORA_ACCOUNT`. These commands do not unlock initial graduation's permanent NFTs or convert them into time locks.

```bash
export AMMORA_ACCOUNT="$LP_OWNER"
npm run arl:create-position -- "REPLACE_WITH_POOL" "REPLACE_WITH_MAX_BASE_RAW" "REPLACE_WITH_MAX_QUOTE_RAW"
# Cliff-only: unlock all at cliff. Three zeros are frequency / periods / per-period.
npm run arl:vest-position -- "REPLACE_WITH_POOL" "REPLACE_WITH_MANAGER_NFT_ID" "REPLACE_WITH_FUTURE_CLIFF" 0 0 "REPLACE_WITH_LIQUIDITY" 0
# Periodic: cliffLiquidity at cliff, then perPeriod each frequency for periods steps
npm run arl:vest-position -- "REPLACE_WITH_POOL" "REPLACE_WITH_MANAGER_NFT_ID" "REPLACE_WITH_FUTURE_CLIFF" "REPLACE_WITH_FREQUENCY" "REPLACE_WITH_PERIODS" "REPLACE_WITH_CLIFF_LIQUIDITY" "REPLACE_WITH_PER_PERIOD"
npm run arl:refresh-vesting -- "REPLACE_WITH_POOL" "REPLACE_WITH_MANAGER_NFT_ID"
```

Before `AMMORA_SEND=1`, these are unsigned previews. Factory `activationType` timestamp(0) uses seconds for cliff/frequency; block number(1) uses blocks. The historical new live fixture used timestamps. Review future cliff and maximum duration. Active vesting rejects withdrawal/relocking/extension, but **NFT transfer is allowed and carries the lock to the new owner**. Fee authority is separate from principal locks. After expiry refresh unlocks all liquidity, a new time lock is possible. `arl:lock-position` remains permanent.

Separate examples cover Config-owner activation of new issuance and Creator metadata.

```bash
export AMMORA_ACCOUNT="$CONFIG_OWNER"
npm run launch:config-enabled -- "REPLACE_WITH_CONFIG_ID" false
npm run launch:config-enabled -- "REPLACE_WITH_CONFIG_ID" true
export AMMORA_ACCOUNT="$CREATOR_WALLET"
npm run launch:creator-metadata -- "REPLACE_WITH_CURVE" "REPLACE_WITH_METADATA_U_R_I"
```

Disabling Config blocks **new launches** using it; it does not change existing launches' immutable economics. Existing `launch:quick-create` atomically creates Config+launch.

| Feature | Current boundary |
| --- | --- |
| Config/issuance/ALC/both graduation models/pool trades/claims | Default launchpad path; feature-specific live evidence in step 13 |
| Separate Creator/Partner wallets, payouts, LP fee grants/revocation | Reuse positive payments, balance increases and rejection evidence |
| Split/merge, LP add/remove, rewards, DFS/AFS splits | [Feature examples](https://docs.ammora.org/guides/docs-contract-features) and original positive GIWA evidence; preserve product prerequisites |
| Atomic issuance + first buy | [Step 4-A new/existing Config paths](#atomic-first-buy); live GIWA evidence REUSED; convenience API introduced in 0.3.7 uses GIWA's default helper |
| Arbitrary external ERC20, sponsored Creator, NFT-transfer prohibition, active Manager-vesting extension | Not promised by default path; optional extensions needing separate contract design |

Use [portable:curve](https://docs.ammora.org/examples/source/src/portable/plan-curve.ts.txt) for amount/FDV calculations and the Config document for registration. Distinguish human/raw units, sale allocation, total supply and gross migration reserves.

## Validation scope

Read [current validation](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) before using historical test targets.

## Adding optional features

After the default flow, see [direct LP, Compounding, partial fills and Zap](https://docs.ammora.org/guides/src-arl-optional-positions), [Creator transfer](https://docs.ammora.org/guides/src-launch-creator-transfer) and [portable exact-output](https://docs.ammora.org/guides/src-portable-readme#curve-exact-output). The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) distinguishes 13 examples covering 18 previously missing methods from actual deployment/authority prerequisites. Code presence alone is not live payment verification.

### GIWA optional-feature execution results

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) covers the current Factory's atomic-first-buy helper, curve exact-output router, withdrawable direct LP and rewards. Follow [portable examples](https://docs.ammora.org/guides/src-portable-readme) and [direct LP examples](https://docs.ammora.org/guides/src-arl-optional-positions). Existing fee/LP-delegation evidence retains its original scope. The Compounding uint40 fix shipped in public SDK **0.3.6**; checked planners support merge, time lock and extension. See [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md). Earlier transactions were `REUSED` at original versions/blocks, not resent for that release.

### Verify claim transactions without resending

Creator, Partner and multi-recipient CLIs reconcile events and receipt-block balances automatically. If reading a submitted hash fails, use `fees:verify-claim` in the [fee guide](https://docs.ammora.org/guides/fee-sharing), without a private key. The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) describe scope and limitations.

The corrected claim CLIs' [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) confirms five separate-payout transfers and balance increases. LP delegation reused valid existing evidence.

### FeeVault delegation, revenue sources and multiple LPs

After basic claims, see [FeeVault delegation/batch claims](https://docs.ammora.org/guides/src-fees-readme), [direct DFS revenue sources](https://docs.ammora.org/guides/src-dfs-readme#connect-revenue-sources-directly) and [ALMM rebalancing](https://docs.ammora.org/guides/src-almm-readme). LP delegates and FeeVault beneficiary delegates have separate rights. Record partially completed/unknown batches in progress state and reconcile first. ALMM rebalancing reallocates principal of a separate ALMM position; never pass a graduated ARL address to an ALMM command.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) records actual payouts, rebalancing, rejections, new-LP recovery and remaining rewards/rounding.

For partners issuing stablecoins directly on GIWA and supplying DEX liquidity, use the [native stablecoin partner guide](https://docs.ammora.org/guides/stablecoin-partner). It connects issuer ERC-20s to independent pools, distinct from new Launch token issuance/graduation.

## SDK 0.3.8: token vesting and ALMM readiness

The [executable vesting guide](https://docs.ammora.org/guides/vesting) uses `launch:vesting-config`, `launch:vesting-from-graduation`, `token-lock:inspect`, `token-lock:create` and `token-lock:claim-verified`. Launch vesting starts at graduation; reserve its amount in total supply. Existing Configs, LP ratios and recipients are not changed automatically. ALMM preset/position readiness now uses public SDK 0.3.8 functions.
