# External-source self-service onboarding — SDK 0.3.9

Use this guide when your team already owns a compatible external revenue source and wants to connect it to Ammora's managed trading and revenue modules. Ordinary launchpads should start with [LAUNCHPAD.md](LAUNCHPAD.md): creating an Ammora Config is already permissionless and does **not** require this admission process.

No Ammora invitation, API credential or per-partner approval is part of registration against an enabled standard. A wallet owner still authorizes its transactions. A previously unknown source implementation, proxy, Hook, token behavior or dependency does not become supported merely by matching an ABI. A new standard needs implementation review and one platform bootstrap; that bootstrap is shared across all conforming source instances, rather than repeated for every team.

## Prepare your team's inputs

Install Node24, clone this repository and run `npm ci --ignore-scripts`. Its lockfile uses the published `@ammora-protocol/sdk`0.3.9 package. Keep `AMMORA_SEND=0` and `AMMORA_READ_RECEIPT=''` for the commands below. These commands only read, prepare unsigned requests, or reconcile known hashes. They never load a private key or send a transaction. Your application connects its own wallet and durable submission journal.

Use GIWA Sepolia (chain91342) with native test ETH for gas. Quote/base ERC20 balances are separate from native ETH. Own the source/controller wallet, obtain the actual source owner's and every initial rights holder's consent, and fund only the assets your source needs. Fee rights do not authorize spending another holder's tokens.

Load a locally reviewed profile containing chain/genesis and the exact admission, registry, factory, router and wrapper runtime pins. It is plain data, not a plugin. The SDK checks chain and live code independently. Do not manufacture a profile by trusting a remote listing or copying hashes from the same unchecked endpoint. Synthetic GIWA test configuration and its current qualification stage are recorded in [self-service validation](docs/SELF-SERVICE-VALIDATION.md). They do not certify a real issuer or production source.

## 1. Find a supported standard

```sh
npm run partner:standards -- profile.json
```

Inspect the returned template ID, verifier/driver pins, `enabled`, actual `readyAt`, epochs and reason codes. The command lists at most eight entries; pass an offset for another page. A queued standard is not active. A disabled standard is not a request to retry or change your source until it passes.

## 2. Prepare your own source and configuration

Use a source instance owned by your team which matches the standard's exact runtime, family, token and dependency rules. The source must still name its original partner as beneficiary before module creation. Preserve existing liabilities and rights; connecting a source is not permission to redirect another team's revenue.

For the **synthetic standard only**, `partner:create-test-source` builds an unsigned deployment for a new source with your controller and partner addresses:

```sh
npm run partner:create-test-source -- profile.json test-source-input.json
```

Input fields are `controller`, `partner`, `quote`, `base`, `market` and `family`(0 for V3 or1 for V4). Use the exact published test token/market addresses for that test standard. This repository includes the frozen fixture ABI/creation bytecode and runtime pins in `fixtures/self-service-test-artifacts.json`; no private repository, SDK source checkout or compiler build is required. These fixtures are openly mintable, valueless and implement synthetic1:1 exact-input transfers with a1% fee. They are **not** launch presets, actual DEX price discovery or stablecoin reserves. Their Graduation/exact-output methods are deliberately unsupported.

Your own wallet submits the prepared deployment once and reconciles its canonical receipt. Then import `prepareSelfServiceTestFunding` from `src/partner/self-service/test-source.ts` if test inventory is needed. Check both token runtimes against the returned pin before authorizing its four unsigned, bounded mint requests. This helper is only for the test bundle's open-mint tokens; it cannot fund a real asset.

Build `ExtensionConfigV2` with these fields:

- `source`: source/driver/registry/token addresses and runtime hashes; actual sourceOwner/controller/partner; the standard's Ammora receiver, family and fee cap; explicit consent/economic evidence hashes; ordered dependency addresses and hashes.
- `recipients` and `weights`: actual initial rights holders and integer weights totaling10000; these distribute the partner80% share. Ammora's20% applies only to attributable newly secured managed revenue, not principal, treasury, old fees, direct LP fees or donations.
- `rightsEvidence`: a locally reviewed nonzero rights evidence hash.

```sh
npm run partner:diagnose-standard -- profile.json TEMPLATE_ID configuration.json 1
npm run partner:deploy-module -- profile.json configuration.json
```

Stage0 is the curve and stage1 is the pool. Compatibility does not grant consent, activation or payout. The deployment plan returns the exact configuration hash, CREATE2 module/vault addresses, each holder's consent request and the controller's deployment request. Submit the missing holder consents through those holders' wallets, then the exact deployment through the controller wallet. Confirm the factory's `Created` event, runtime identities and configuration mapping before connecting the source beneficiary to the predicted module using its source-specific owner method.

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

Use `planClaim(module, asset, beneficiary)` and simulate the exact request from its actual beneficiary. Claims are fixed to that beneficiary; this module does not inherit arbitrary payout-address or LP delegation powers from other products. See [FEE-SHARING.md](FEE-SHARING.md) for Creator/Partner/FeeVault and LP delegation claims, whose unchanged canonical tests are reused separately. Record positive `Paid`/token transfer events and receipt-block balance increases; an `observed` receipt or a zero-fee no-op is not a payout proof.

## 6. Cancel or recover an uncertain submission

```sh
npm run partner:cancel-registration -- profile.json MODULE 1 RIGHTS_HOLDER
npm run partner:reconcile-registration -- profile.json recovery-envelope.json
```

A controller, source owner, partner or current rights holder can cancel. Already accrued claims remain payable. Cancellation or a guardian stop cannot be undone by simply requesting registration again. Explicit governance recovery and a new delay are a separate incident procedure, not ordinary partner onboarding.

`reconcile-registration` accepts only an SDK `exportRecovery` envelope and checks its known hash. Unknown, pending, orphaned or reverted results never permit an automatic resend; reconcile nonce, transaction, canonical block and exact-block state first. This read transport has finite budgets, no retry/fallback, and caches only state at an explicitly witnessed block hash. Dispatch counts are observations, not account billing.
