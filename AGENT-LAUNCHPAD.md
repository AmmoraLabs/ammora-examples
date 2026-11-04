# Build an agent that launches and trades tokens

Start with the [public quickstart](https://docs.ammora.org/guides/agent-quickstart).
It downloads the complete source project without a GitHub invitation. After the
keyless smoke, use [the connected walkthrough](#11-connect-the-whole-lifecycle)
to pass confirmed identities and approvals between the steps below.

Use these examples to connect an agent to public SDK `@ammora-protocol/sdk@0.3.9`
on GIWA Sepolia. The agent can read Configs and balances, issue tokens, buy and
sell before graduation, migrate a ready launch, swap after graduation and collect
authorized Creator, Partner or LP fees. Calls go directly to contracts through
the configured chain RPC.

The [ordinary launchpad guide](LAUNCHPAD.md) remains the authority for Config
economics, fee splits, LP locks and the ALC-to-ARL lifecycle. This guide adds
structured tools, wallet authority, execution records and recovery. The
[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
distinguishes new agent executions from reused historical contract evidence.

## Which approval is required

**SDK installation, reading, creating your own valid Config and the default
supported-WETH launch flow require no per-team approval from Ammora.** An
external address without Registry ownership or a token-registrar role passed
live GIWA Config creation, issuance and Config-plus-issuance simulations.
See the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

In this guide, an **approved Config** means an ID/hash chosen by **your own
application's wallet policy**. It is not an Ammora-reviewed customer allowlist.
Likewise, approving a transaction or ERC-20 allowance means your wallet's
consent to spend your assets, not requesting permission from Ammora. You install
the policy locally and can choose your own Configs and recipient addresses.

A different quote asset still needs the deployed token policies to support it;
the current launch factory checks both pool and aggregation admission even on
its direct launch path. A custom callback needs global code review; the built-in
first-buy helper is already globally enabled. Registry governance retains
Config disabling authority. These conditions must not be advertised as
unrestricted permissionless support for every token or SDK admin function.

## 1. Install and prepare the wallets

Use the public downloaded project and Node 24.18.0 (`node:sqlite` is used for the
local durable execution journal):

```bash
nvm use
npm ci --ignore-scripts --no-audit --no-fund
cp src/agent/policy.example.json agent.policy.local.json
```

The published SDK is pinned in the lockfile. The public setup download and npm
installation need no authentication. Export a smaller standalone project using
[src/agent/README.md](src/agent/README.md), or import the downloaded action files
directly. No signer or credentials are included.

Choose the actual Config owner, Creator/trader, Partner beneficiary, LP owner,
optional fee delegate and reviewed payout addresses. A wallet may hold multiple
roles, but one role does not grant another role's rights. Fund each executing
wallet with gas ETH and the required input asset. GIWA native ETH and WETH are
separate balances. Inspect the selected Config's creation fee and graduation
threshold before funding; the limits in the template are illustrative.

`AgentRuntime` selects only the reviewed GIWA chain `91342` and `auto-route`
generation, independent of shell defaults. It does not read `.env`,
`AMMORA_PRIVATE_KEY`, `AMMORA_SEND` or `AMMORA_READ_RECEIPT`. Historical receipt
reads cannot accidentally become a new operation's snapshot.

## 2. Install the owner policy

Edit `agent.policy.local.json` locally. Replace the public account/payout
placeholders, choose a unique `sessionId`, and set `expiresAt` to Unix seconds
no more than 24 hours ahead. Review Config ID **and immutable hash**, asset
limits, slippage, transaction count, native fee envelope and session expiry.
Read Config #6 afresh before using the template; do not copy validation wallets
as your own recipients.

Include the signing account in `payouts` for the default buy/sell destination;
add a separate reviewed payout address when you need redirected fee payments.

Limits are raw integer strings: WETH has 18 decimals, while a launch token's
decimals come from its Config. `launchTokenLimit` applies per authenticated
launch base token; it is not a dollar-value limit across unrelated tokens.
Native reservations conservatively charge the full per-transaction envelope,
including approvals and failed attempts, rather than claiming an estimated CU
or gas value is your provider bill.

The application owner installs this file. The agent cannot supply its own
policy, caller, private state directory, signer or approval callback through a
tool call. Reopening a session with different policy contents fails; choose a
new session after explicitly reviewing changes. An unresolved signer nonce
continues to block new submissions even from another session using that journal.

## 3. Connect the tools without a signer

```ts
import { readFileSync } from "node:fs";
import { connectAgent, type AgentPolicy } from "./src/agent/index.js";

const policy = JSON.parse(readFileSync("agent.policy.local.json", "utf8")) as AgentPolicy;
const connection = connectAgent(policy, ".agent-state/my-launchpad");
const { tools } = connection;
const context = await connection.bounded(() => tools.agent_get_context({}));
const config = await connection.bounded(() => tools.agent_get_config({ configId: "6" }));
const balances = await connection.bounded(() => tools.agent_get_balances({
  tokens: ["0x4200000000000000000000000000000000000006"],
}));
// Register only tools with your framework. Keep connection.agent in trusted host code.
```

The same catalog can be used from the keyless JSON Lines adapter:

```bash
printf '%s\n' '{"tool":"agent_get_context","arguments":{}}' \
  | npm run --silent agent:tool -- agent.policy.local.json .agent-state/my-launchpad
```

Standard output contains JSON results; warnings/diagnostics belong on stderr.
The CLI has no signer and cannot submit, even if old send-related environment
variables are set. No framework-specific hosted agent service is required.

Run `npm run --silent agent:tools` or import `toolDefinitions` for each tool's
name, description and JSON `inputSchema`. Register those definitions and their
matching `tools` handlers with your framework. Runtime validation still applies
after the model's schema validation.

## 4. Create your reusable Config and issue tokens

### Create your own Config first

The Config owner is the actual signing caller. Choose your own Partner fee,
LP and leftover recipients explicitly; copying an Ammora-owned template without
replacing those fields would preserve its beneficiaries. A template supplies
valid economics, not a mandatory Ammora customer approval.

```ts
import { core, createLaunchpadConfig } from "./src/agent/index.js";

const template = await tools.agent_get_config({ configId: "6" });
const configPlan = await connection.bounded(() => createLaunchpadConfig(
  connection.agent, "platform-config-001", {
    policy: {
      schemaVersion: 1, chainId: 91342, registry: core.configRegistry,
      templateId: "6", templateHash: template.configHash,
      configOwner: policy.account,
      partnerRecipient: policy.account,
      liquidityPartner: policy.account,
      leftoverReceiver: policy.account,
    },
    saleSupplyRaw,   // Your reviewed raw base-token sale supply.
    thresholdRaw,    // Your reviewed raw quote-token graduation threshold.
  },
));
```

This plans **only Config creation**: no token or first buy and no ERC-20 allowance
is needed. The connected wallet pays transaction gas. After the host approves,
submits and reconciles it, save `operation.result.config.configId` and
`configHash`. That receipt-authenticated Config is remembered in the same
session journal and can be reused for many token launches. Its Registry entry
starts enabled without another approval transaction.

Other Creator wallets can use the same Config by selecting its observed ID/hash
in their own local policy. They do not need an Ammora registrar role or the
Config owner's key. New Config economics use the existing validation and LP
allocation rules; they do not edit the template or bypass token support checks.

### Issue a token from your Config

Import the convenience functions or call `tools.agent_prepare` with the same
strict intent:

```ts
import { createToken } from "./src/agent/index.js";

const plan = await connection.bounded(() => createToken(connection.agent, "my-launch-001", {
  configId: yourConfigId, // The actual ID from your confirmed Config receipt.
  name: "My launch token",
  symbol: "MLT",
  metadataURI: "ipfs://REPLACE_WITH_YOUR_METADATA",
}));
```

The returned `plan` includes the exact transaction, caller, Config identity,
snapshot block/hash, expiry and digest. This is an unsigned plan. Token metadata
is treated as data; the tools do not fetch its URI or execute instructions in it.
The factory's actual signing caller becomes Creator. A relayer cannot choose a
different Creator simply by adding a JSON field.

For issuance plus first buy, use `createTokenAndFirstBuy` with the existing
approved Config and explicit `firstBuyRaw` and `minimumBaseRaw`. For new Config
plus issuance/first buy, use `createConfigAndFirstBuy`, add `config-first-buy` to
the owner policy and supply the recipient policy/economics documented in
[the atomic launch section](LAUNCHPAD.md#atomic-first-buy). The actual caller
must equal Config owner. The template's LP allocation and permanent-lock ratios
are preserved. Confirmed new Configs are remembered only from authenticated
creation receipts in the same session journal.

## 5. Resolve an allowance prerequisite

A plan with `APPROVAL_REQUIRED` is not a successful launch or trade. Each
allowance is a separate reviewed operation:

```ts
const approval = await tools.agent_prepare_approval({
  operationId: plan.id,
  requestId: "my-launch-001-approval-1",
});
// The host approves/submits approval, then reconciles its canonical receipt.
// If the old allowance was nonzero, this first operation resets it to zero.
// Prepare a second allowance operation with a NEW requestId when reset is needed.
const refreshed = await tools.agent_refresh({ operationId: plan.id });
```

Approve only the required amount to the reviewed spender. After each receipt,
inspect `allowanceRaw` and prepare the next required step. Refreshing a parent
plan clears its previous exact-plan approval; do not submit its old digest.
No automatic wrapping or funding transaction is hidden in this flow.

## 6. Connect the signer in trusted host code

`connectAgent(policy, directory, signer)` accepts an `AgentSigner` with a public
`address` and `signTransaction(request)` method. Implement that method using your
own private wallet backend or isolated signing service. Keep credentials and
signed raw bytes outside model input/output. This example expects signing and
broadcasting to be separable; wallets that only offer combined send need their
own reviewed uncertain-response recovery integration.

By default the host must obtain the owner's authenticated approval of the exact
plan before execution:

```ts
import { submitAfterOwnerApproval } from "./src/agent/index.js";

// signingConnection was created by the authenticated host with its injected signer.
// Show every transaction, recipient, input/output bound and native fee envelope.
const operation = await signingConnection.bounded(() => submitAfterOwnerApproval(
  signingConnection.agent,
  readyPlan,
  ownerApprovalUI, // Your authenticated UI callback; never a model-generated boolean.
));
```

`authorize` is deliberately absent from the model tool catalog. A partner may
explicitly select `authorizationMode: "scoped-policy"` when constructing
`AgentRuntime` to allow its separately funded service wallet to act within the
installed policy. These are software controls around a partner-controlled
wallet, not an on-chain session-key or sponsored-gas product. The default is
per-operation approval. Revocation stops new authorizations; it cannot recall
an already signed or submitted transaction.

## 7. Buy and sell before graduation

Read the token and curve from the **confirmed creation result** in
`operation.result.launch`, then save those actual addresses. Do not assume a
simulated token address or Registry ID is final.

```ts
import { buy, sell } from "./src/agent/index.js";

const preview = await tools.agent_quote_trade({
  action: "trade", curve, side: "buy", amountRaw: quoteInputRaw, slippageBps: 50,
});
const buyPlan = await connection.bounded(() => buy(connection.agent, "buy-001", curve, quoteInputRaw));
const sellPlan = await connection.bounded(() => sell(connection.agent, "sell-001", curve, baseInputRaw));
```

Execute and reconcile one operation before planning its dependent action. Buy
uses quote input, sell uses base input. The ordinary path requires a full fill;
terminal partial fills need the explicit graduation branch below. A quote alone
is never executable authority. A stage change or stale snapshot requires a
fresh plan and review.

## 8. Complete graduation and swap afterward

```ts
import { finalFill, graduate, buy, sell } from "./src/agent/index.js";

const terminal = await connection.bounded(() => finalFill(connection.agent, "final-fill-001", curve, maximumQuoteRaw));
// Approve, submit and reconcile terminal. Inspect actual consumed input and refund.
const migration = await connection.bounded(() => graduate(connection.agent, "migration-001", curve));
// Separately approve, submit and reconcile migration. Save its canonicalPool.
const afterBuy = await connection.bounded(() => buy(connection.agent, "pool-buy-001", curve, quoteInputRaw));
const afterSell = await connection.bounded(() => sell(connection.agent, "pool-sell-001", curve, baseInputRaw));
```

The final fill must leave the launch ReadyToMigrate. Migration is a separate
transaction. After migration, the same buy/sell tools authenticate the
concentrated canonical pool and use its direct swap path. Do not call ordinary
`createProductionPool` to recreate the graduated pool. Other pool models and
arbitrary aggregation/native routes are outside this initial agent profile.

## 9. Claim Creator, Partner and LP fees

```ts
import { claimLaunchFees, claimLpFees } from "./src/agent/index.js";

const fees = await tools.agent_get_claimable({ curve });
const quoteFees = await connection.bounded(() => claimLaunchFees(connection.agent, "quote-fees-001", curve, "quote", payout));
const baseFees = await connection.bounded(() => claimLaunchFees(connection.agent, "base-fees-001", curve, "base", payout));
const lpFees = await connection.bounded(() => claimLpFees(connection.agent, "lp-fees-001", curve, managerNftId, payout));
```

Creator and Partner each connect their own actual beneficiary wallet and use
the same launch claim function. The payout changes the payment destination,
not entitlement. Quote-token FeeVault credits may aggregate several launches;
the result does not attribute the entire WETH payout to this one launch.

The LP claimant must be the manager NFT owner or a currently authorized fee
delegate. The owner grants/revokes that fee-only permission through the
[existing LP delegation example](src/arl/fee-delegate.ts). `ClaimFeeToOwner`
cannot redirect to a different payout; `ClaimFee` still requires the payout to
be allowed by the installed application policy. Existing delegation can be
replaced by a new grant: inspect it first. Do not grant NFT transfer or
liquidity-removal rights merely to collect fees.

`NO_CLAIMABLE_FEES` means no transaction is sent and no positive payment is
claimed. Reconciliation requires the correct events, actual transfers and
receipt-block balance accounting. The proof reports other transfers in that
block separately rather than treating the whole block's balance change as this
claim's payment. `receiptVerified` and `payoutVerified` are separate fields.

## 10. Reconcile without resending

`agent_submit` returns a stored operation with a phase and hash when known.
Poll `agent_reconcile` at a bounded cadence, for example every six seconds for
at most two minutes. Keep using the original operation ID after timeout.

```ts
const observed = await connection.bounded(() => tools.agent_reconcile({ operationId }));
// CONFIRMED or REVERTED is terminal. SUBMITTED/RECONCILIATION_REQUIRED needs investigation.
```

The same `requestId` and intent returns the existing plan. Changing the intent
under that ID is rejected. After a signing attempt, neither refresh nor a
duplicate submit can sign or broadcast again. Unknown attempts keep their
nonce/spending reservations. A signer timeout before its hash is known requires
the wallet operator to recover the original attempt; the example does not clear
that uncertainty by a timer or issue a replacement.

If the owner separately authorizes and submits a zero-value self cancellation,
the trusted host can call `agent.reconcileCancellation(originalOperationId, hash)`.
It only reads and verifies the successful canonical cancellation, the exact
wallet/nonce and nonce consumption before marking the original operation
`CANCELLED`. It never submits a cancellation, and it cannot clear a hold merely
because the original hash is missing. The model has no cancellation/hold-release tool.

Canonical receipts with at least 13 confirmations are labeled as such, not as
guaranteed finalized state. Preserve hashes and reconcile reorgs before reusing
dependent state. Keep one shared RPC transport and one private journal for the
wallet. Whole-chain scans, unbounded quote loops and a separate RPC client for
every tool call are unnecessary.

The trusted host can call `connection.agent.revokeSession()` to persistently
stop new plans and signatures for that session, including after restart.
Reconciliation remains available. Reopening an explicitly reviewed new session
does not clear an unresolved nonce in the shared journal.

When finished, close the connection, reconcile outstanding operations and use
the existing owner-controlled allowance/delegation cleanup examples where
needed. Never withdraw permanently locked LP principal as cleanup.

## 11. Connect the whole lifecycle

[executeReviewedStep](src/agent/examples/execute-step.ts) handles an operation's
exact allowance prerequisites, owner review, submission and bounded canonical
reconciliation. [runLaunchpadWalkthrough](src/agent/examples/walkthrough.ts)
connects the lifecycle in order:

1. Create only the Config and save its confirmed ID/hash.
2. Issue the token using that actual Config, then save the actual token/curve.
3. Buy and sell on the curve, complete the explicit final fill, and migrate in
   a separate transaction.
4. Save the canonical pool and owned manager NFT from the migration receipt.
5. Buy and sell on that pool, claim the connected wallet's quote/base FeeVault
   entitlement, then claim fees on its receipt-authenticated LP NFT.

This is trusted host code, not another model tool. The host approves **every**
allowance and business plan; the helper does not approve on the model's behalf.
A pending/uncertain/reverted operation stops the walkthrough before its dependent
step. Reopening an attempted request only reconciles the original attempt.
`NO_CLAIMABLE_FEES` is returned explicitly without a transaction or payment claim.

This complete adapter can be placed in your Node backend:

```typescript
import {
  connectAgent, runLaunchpadWalkthrough,
  type AgentPolicy, type AgentSigner, type Plan, type Operation, type WalkthroughInput,
} from "./src/agent/index.js";

export async function buildLaunchpad(
  policy: AgentPolicy,
  input: WalkthroughInput,
  signer: AgentSigner,
  approve: (plan: Plan) => Promise<boolean>,
  saveOperation: (operation: Operation) => Promise<void>,
) {
  const host = connectAgent(policy, ".agent-state/my-launchpad", signer);
  try {
    return await runLaunchpadWalkthrough(host, input, {
      approve, onOperation: saveOperation,
      timeoutMs: 120000, pollingIntervalMs: 6000,
    });
  } finally { host.close(); }
}
```

Supply `AgentSigner` through your existing isolated wallet backend, returning
the signed transaction to the trusted runtime only. `approve` must be the
authenticated wallet owner's UI/policy decision and `saveOperation` must persist
the operation ID/hash/result. These are host dependencies; the model cannot
supply them as tool arguments. The team supplies its own wallet authorization. Wallet services that only combine signing and broadcasting need
their own uncertain-response adapter; do not secretly broadcast inside the
`signTransaction` callback.

`WalkthroughInput` requires all economic choices explicitly:

| Field | Meaning |
| --- | --- |
| `requestPrefix` | Stable ID for this run in the same policy/session; changing it starts new work |
| `config.policy` | Template ID/hash, actual Config owner and explicit Partner/LP/leftover recipients |
| `config.saleSupplyRaw` / `thresholdRaw` | Reviewed raw base sale supply and quote graduation threshold |
| `launch` | Name, symbol and metadata URI |
| `curveBuyRaw` / `curveSellRaw` | Quote buy input / base sell input before graduation |
| `finalBuyMaximumRaw` | Maximum quote for the explicit terminal fill; unused allowance can remain |
| `poolBuyRaw` / `poolSellRaw` | Quote/base inputs for canonical-pool trades |
| `slippageBps` / `payout` | Reviewed bounds and optional fee payout destination |

Choose funding and policy caps for the entire run, including all allowance/reset
transactions. Do not copy a test supply, threshold, recipient or budget into
production economics. The policy must enable `config` and every requested action.
The template Config must be in the policy; the newly created Config is admitted
from its canonical receipt, without a separate Ammora approval.

The walkthrough uses one reviewed, unexpired session and shared private journal.
After an interruption, keep the same policy, request prefix and journal. When
the policy has expired, reconcile old IDs first and explicitly continue from
confirmed Config/curve state with the individual action helpers; starting a new
session/run is not automatic recovery. Save the returned addresses and each
operation as they are confirmed.

`COMPLETE` means all requested steps were processed. Inspect each claim's
`payoutVerified` and actual nonzero amounts before reporting a payment. Distinct
Creator and Partner wallets each perform their own claims using their own
policy/signer. LP delegation stays a separate owner-controlled permission step.
The connected helper does not grant delegation, withdraw principal, wrap ETH,
fund a wallet or revoke residual allowances implicitly.

## Supported scope

This is a direct-contract, GIWA testnet integration example using public SDK
0.3.9. It has no automatic SDK publication, mainnet activation, production
deployment, on-chain session-key creation, fee-split change or unrestricted
shell/ABI tool. Existing valid fee and LP evidence remains in its original
scope; the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
records exactly which new execution boundaries were tested.

### Temporary canonical-block reads

Each reconciliation may retry a temporary `CANONICAL_BLOCK_UNAVAILABLE` read once within the configured polling deadline. `readFailures` retains the operation ID, original hash and attempt count. A repeated failure returns `INCOMPLETE` and preserves the nonce hold. Save the whole step result; resolve the original hash with the same journal and request ID before continuing. Canonical hash mismatches and authorization errors are never treated as transient.
