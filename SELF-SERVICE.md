# External-source self-service onboarding — SDK 0.3.9

Use this guide when your team already owns a compatible external revenue source and wants to connect it to Ammora's managed trading and revenue modules. Ordinary launchpads should start with [LAUNCHPAD.md](LAUNCHPAD.md): creating an Ammora Config is already permissionless and does **not** require this admission process.

No Ammora invitation, API credential or per-partner approval is part of registration against an enabled standard. A wallet owner still authorizes its transactions. A previously unknown source implementation, proxy, Hook, token behavior or dependency does not become supported merely by matching an ABI. A new standard needs implementation review and one platform bootstrap; that bootstrap is shared across all conforming source instances, rather than repeated for every team.

## Approval and review boundaries

**Per-partner platform approval is not required for a new instance that an already enabled standard accepts.** Your controller registers directly after actual owner/partner/initial-holder consent, then waits for that instance's on-chain ticket. New addresses are allowed when the exact implementation, token/dependency runtime and live identity rules still match. An ABI match alone is insufficient.

A new implementation/standard needs shared review and bootstrap. Existing-module weighted-right changes require the specified governance and affected-holder consents; cancellation/emergency stop cannot be bypassed through self-registration. These requirements are separate from ordinary launchpad Config creation and wallet/allowance approval. See the [permission and review matrix](PERMISSIONS.md). This guide's bundled standards are synthetic GIWA fixtures, not blanket real-issuer support.

## Prepare your team's inputs

Install Node24, clone this repository and run `npm ci --ignore-scripts`. Its lockfile uses the published `@ammora-protocol/sdk`0.3.9 package. Keep `AMMORA_SEND=0` and `AMMORA_READ_RECEIPT=''` for the commands below. These commands only read, prepare unsigned requests, or reconcile known hashes. They never load a private key or send a transaction. Your application connects its own wallet and durable submission journal.

Use GIWA Sepolia (chain91342) with native test ETH for gas. Quote/base ERC20 balances are separate from native ETH. Own the source/controller wallet, obtain the actual source owner's and every initial rights holder's consent, and fund only the assets your source needs. Fee rights do not authorize spending another holder's tokens.

Load a locally reviewed profile containing chain/genesis and the exact admission, registry, factory, router and wrapper runtime pins. It is plain data, not a plugin. The SDK checks chain and live code independently. Do not manufacture a profile by trusting a remote listing or copying hashes from the same unchecked endpoint. The [completed synthetic GIWA qualification](docs/SELF-SERVICE-VALIDATION.md) records three activations, six trades, twelve positive payments and cleanup. Both common test standards remain enabled, while the demonstrated modules were deliberately stopped. Create your own conforming source and honor its new ticket delay. These synthetic tests do not certify a real issuer or production source.

For the bundled synthetic GIWA exercise, start with the published test profile and keep its test-only label and pins:

The [new partner-address walkthrough](docs/PARTNER-PERSPECTIVE-GIWA.md) also completed 28 transactions using new token, market, source and holder addresses: direct registration without new governance, actual delayed activation, two trades, six positive 20:48:32 payments, five typed refusals and cleanup. It used the public helpers below; the stopped demonstration module is not a live trading target.

```sh
cp fixtures/self-service-giwa.test.json profile.json
cp fixtures/self-service-source-input.template.json test-source-input.json
cp fixtures/self-service-configuration-input.template.json partner-input.json
cp fixtures/self-service-known-deployment.template.json known-deployment.json
cp fixtures/self-service-trade-input.template.json trade-input.json
```

Replace every `YOUR_...` placeholder with your own actual inputs. Do not relabel this profile as a production or issuer deployment. Select the matching template/family from the enabled standards before preparing requests.

## 1. Find a supported standard

```sh
npm run partner:standards -- profile.json
```

Inspect the returned template ID, verifier/driver pins, `enabled`, actual `readyAt`, epochs and reason codes. The command lists at most eight entries; pass an offset for another page. A queued standard is not active. A disabled standard is not a request to retry or change your source until it passes.

## 2. Prepare your own source and configuration

Use a source instance owned by your team which matches the standard's exact runtime, family, token and dependency rules. The source must still name its original partner as beneficiary before module creation. Preserve existing liabilities and rights; connecting a source is not permission to redirect another team's revenue.

For the **synthetic standard only**, prepare your own new quote token, base token and market fixture addresses:

```sh
npm run --silent partner:create-test-assets -- profile.json YOUR_CONTROLLER 0 > asset-deployments.json
```

The three unsigned deployments use the bundle's frozen creation bytes. The market constructor receives the selected family (0 or1); tokens take no constructor arguments. Your wallet submits each request once, records its hash and reconciles its canonical receipt before using the resulting address. Never mint or fund an unrelated token merely because its ABI looks similar. These assets are openly mintable and valueless.

Then `partner:create-test-source` prepares a source owned by your controller and original partner:

```sh
npm run partner:create-test-source -- profile.json test-source-input.json
```

Copy `fixtures/self-service-source-input.template.json`, replace its two wallet placeholders with your own addresses, and keep your original partner different from the Ammora receiver. The exact V3/V4 verifier, driver, source/token/dependency hashes, market addresses, fee limits and Ammora receiver are in [synthetic standard terms](fixtures/self-service-standard-terms.test.json). Use those terms to fill `ExtensionConfigV2`; predicted template IDs alone are not active admission.

Input fields are `controller`, `partner`, `quote`, `base`, `market` and `family`(0 for V3 or1 for V4). Use either the published sample token/market addresses or your own newly deployed fixture addresses whose exact runtime hashes match that standard. The standard verifies runtime classes and the source's actual dependency graph, not a company or address allowlist. A new runtime or token behavior still needs standard review; an ABI match is insufficient. This repository includes the frozen fixture ABI/creation bytecode and runtime pins in `fixtures/self-service-test-artifacts.json`; no private repository, SDK source checkout or compiler build is required. These fixtures are openly mintable, valueless and implement synthetic1:1 exact-input transfers with a1% fee. They are **not** launch presets, actual DEX price discovery or stablecoin reserves. Their Graduation/exact-output methods are deliberately unsupported.

Your own wallet submits the prepared deployment once and reconciles its canonical receipt. Then import `prepareSelfServiceTestFunding` from `src/partner/self-service/test-source.ts` if test inventory is needed. Check both token runtimes against the returned pin before authorizing its four unsigned, bounded mint requests. This helper is only for the test bundle's open-mint tokens; it cannot fund a real asset.

For the bundled synthetic standard, copy `fixtures/self-service-configuration-input.template.json` and fill your source/controller/original partner, the actual token/market addresses, initial rights holders, weights and explicit nonzero local review evidence hashes. The helper prepares the complete configuration:

```sh
npm run --silent partner:configure-test-source -- profile.json partner-input.json > configuration.json
```

Use `--silent` when redirecting npm output so the file contains only JSON. This configuration is plain input data, not an executable SDK plan or consent. Each holder must still approve the exact configuration through their own wallet. The helper keeps the original partner among the initial holders and permits at most eight holders as an example-level bound.

For example, weights `[6000, 4000]` split the partner's80% share60:40. A newly secured100raw fee allocates20raw to Ammora and48/32raw to the two partner holders. The protocol's20% allocation is unchanged. Do not treat an evidence hash alone as an approval or a payment.

Build `ExtensionConfigV2` with these fields:

- `source`: source/driver/registry/token addresses and runtime hashes; actual sourceOwner/controller/partner; the standard's Ammora receiver, family and fee cap; explicit consent/economic evidence hashes; ordered dependency addresses and hashes.
- `recipients` and `weights`: actual initial rights holders and integer weights totaling10000; these distribute the partner80% share. Ammora's20% applies only to attributable newly secured managed revenue, not principal, treasury, old fees, direct LP fees or donations.
- `rightsEvidence`: a locally reviewed nonzero rights evidence hash.

```sh
npm run partner:diagnose-standard -- profile.json TEMPLATE_ID configuration.json 1
npm run partner:deploy-module -- profile.json configuration.json
```

Stage0 is the curve and stage1 is the pool. Compatibility does not grant consent, activation or payout. The deployment plan returns the exact configuration hash, CREATE2 module/vault addresses, each holder's consent request and the controller's deployment request. Submit the missing holder consents through those holders' wallets, then the exact deployment through the controller wallet. Confirm the factory's `Created` event, runtime identities and configuration mapping before connecting the source beneficiary to the predicted module using its source-specific owner method.

After your module deployment succeeds, copy `fixtures/self-service-known-deployment.template.json` and fill the **known hash and expected identities from your own wallet journal/SDK deployment plan**. Derive the child pins through the trusted factory's canonical event and mapping:

```sh
npm run --silent partner:verify-module-deployment -- profile.json known-deployment.json > module-pin.json
```

This read-only helper checks chain/genesis, the exact known hash, successful canonical receipt with at least13 observed confirmations, pinned factory runtime, matching `Created` identities, recorded module runtime, nonempty vault code and its module creditor. It does not activate a module, grant send authority, verify a payout or claim finalized status. Unknown/pending/orphaned results require receipt reconciliation, never an automatic resend. Your application may import `readSelfServiceDeploymentPin` and provide its own read-only client configured with caching and automatic retries disabled; no private protocol checkout/compiler is required.

For this synthetic source, the owner connects the checked module with the bundle's `StandardSourceFixture.setBeneficiary(module)` method. The following is unsigned request construction in your application, after runtime/ownership and existing-liability checks:

```ts
import { encodeFunctionData } from "viem";
// sourceAbi is bundle.artifacts.StandardSourceFixture.abi from the public fixture JSON.
const connectRequest = {
  account: controller,
  to: source,
  data: encodeFunctionData({ abi: sourceAbi, functionName: "setBeneficiary", args: [modulePin.address] }),
  value: 0n,
};
```

Your source owner simulates and submits that exact request once, then checks the receipt and actual beneficiary before registration. Real source implementations use their own reviewed owner/connection method; the synthetic setter is not a generic instruction to redirect existing revenue.

## 3. Register without a platform transaction

```sh
npm run partner:register -- profile.json TEMPLATE_ID MODULE 1 CONTROLLER
```

The module controller calls the returned request directly; governance is not the caller. The SDK requires the source, module provenance, current rights, consent, runtime and supported stage to match. A fresh queued ticket contains an epoch, global epoch and actual chain `readyAt`.

For application integration, use the same exported example functions and official SDK methods. Immediately before an explicit wallet submission, call `admission.simulate(plan)`, compare the exact request with your durable attempt record, and atomically reserve its nonce/request identity. Record the transaction hash even if the transport result is uncertain. `admission.exportRecovery(plan, hash)` produces the receipt-check envelope; it grants no send authority. Keep the original SDK client and genuine local plan together until `reconcile`/`exportRecovery`; parsing a saved plan JSON into a new client does not restore executable authority. After a process restart use only `reconcileRecovery` with the exported receipt envelope. Keep your sender and durable journal on your own backend rather than adding keys to examples or browser environment variables.

## 4. Respect the real activation delay

```sh
npm run partner:activate -- profile.json TEMPLATE_ID MODULE 1 CALLER
```

The result is `waiting` with an actual `readyAt`, `existing`, or `action` with an unsigned plan. Do not poll in a tight loop or use elapsed wall time as proof. After the on-chain timestamp reaches the ticket's `readyAt`, any caller may simulate and submit that exact activation; matching ticket/registry epochs and current eligibility remain required. Rights revocation, a changed source, a disabled standard or an emergency stop can prevent it.

For a new platform deployment there are three serial delay boundaries: factory/driver bootstrap, standard activation, then the partner's own registration. Ordinary partners on an already enabled standard encounter only the last boundary. Neither an operator's manual shortcut nor a reduced testnet delay is used to demonstrate self-service.

## 5. Trade and claim through your admitted module

Construct `createPartnerExtensionClientV2` with the same checked deployment profile and a module pin obtained from canonical factory deployment evidence. Use `quote`, the returned typed-data/signature flow and `simulate` before your own wallet submits. The exact route specifies stage, source, payer, recipient, refund, native flags, nonce/epochs, input and slippage bounds. Native handling requires a genuine reviewed wrapped-native contract; the synthetic test quote token is not WETH.

Copy `fixtures/self-service-trade-input.template.json`, choose an unused **managed trade nonce** (separate from the wallet's transaction nonce), and set the actual payer/recipient/refund/executor, raw amounts, minimum output and short TTL. The sample amounts are for the1:1 fixture, not a production price:

```sh
npm run partner:quote-module -- profile.json module-pin.json trade-input.json
npm run partner:prepare-module-claim -- profile.json module-pin.json ASSET BENEFICIARY
```

Before an ERC20 trade, the actual payer needs the input balance and an exact bounded allowance to `profile.router.address`. For each direction in this exercise use `approve(router, 10000n)` on that direction's input token, after checking its runtime, current allowance and intended amount. Do not approve the output token for the same trade, assume native ETH is the quote ERC20, or leave an unlimited allowance. Reconcile each approval before signing its trade. The synthetic funding helper above can prepare 50000 raw per token to the new source and payer; it never supplies native gas or funds a real issuer asset.

These commands never sign or send. For wallet integration, import `quoteSelfServiceTrade` from `src/partner/self-service/trade.ts`. It returns `{client, plan, stats}`. Keep that same client and genuine plan in memory while calling `client.sign(plan, yourWalletAdapter)` and `client.simulate(plan, signature, actualExecutor)`, then let your wallet submit the exact simulated request once. The CLI's JSON quote is a view and must not be loaded into a new client to manufacture send authority. Record every submitted hash before relying on transport success.

Import `prepareSelfServiceClaim` from `src/partner/self-service/claim.ts` to obtain the fixed-beneficiary unsigned request. The named beneficiary uses its own wallet and simulates the request before signing. A controlled test contract holder can use its own reviewed outer wallet adapter; this is not a generic smart-wallet custody certification.

Use `planClaim(module, asset, beneficiary)` and simulate the exact request from its actual beneficiary. Claims are fixed to that beneficiary; this module does not inherit arbitrary payout-address or LP delegation powers from other products. See [FEE-SHARING.md](FEE-SHARING.md) for Creator/Partner/FeeVault and LP delegation claims, whose unchanged canonical tests are reused separately. Record positive `Paid`/token transfer events and receipt-block balance increases; an `observed` receipt or a zero-fee no-op is not a payout proof.

## 6. Cancel or recover an uncertain submission

```sh
npm run partner:cancel-registration -- profile.json MODULE 1 RIGHTS_HOLDER
npm run partner:reconcile-registration -- profile.json recovery-envelope.json
```

A controller, source owner, partner or current rights holder can cancel. Already accrued claims remain payable. Cancellation or a guardian stop cannot be undone by simply requesting registration again. Explicit governance recovery and a new delay are a separate incident procedure, not ordinary partner onboarding.

`reconcile-registration` accepts only an SDK `exportRecovery` envelope and checks its known hash. Unknown, pending, orphaned or reverted results never permit an automatic resend; reconcile nonce, transaction, canonical block and exact-block state first. This read transport has finite budgets, no retry/fallback, and caches only state at an explicitly witnessed block hash. Dispatch counts are observations, not account billing.
