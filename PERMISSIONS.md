# Partner permissions and review boundaries — SDK 0.3.9

**Partners can use the public SDK and integrate an already supported, enabled contract path without an Ammora invitation or per-team approval.** They still connect their own wallets, supply funds, obtain the actual rights holders' consent and satisfy the selected deployment's on-chain checks. The examples do not provide a hosted signing service.

This repository targets **GIWA Sepolia, chain 91342**. A public SDK export, successful preview or new address does not establish support for a new implementation, asset behavior, network or production deployment. No Ammora service API or Indexer integration is required by these contract examples.

## 1. What can a partner do directly?

| Flow | No per-partner Ammora approval when… | The partner still provides… |
| --- | --- | --- |
| Install SDK/examples and read supported contracts | Public packages and the reviewed chain/profile are used | Node, configured RPC and actual addresses; reads need no signing key or gas |
| Create a new launchpad Config and choose initial recipients | The valid Config is created by its actual owner through a supported caller path | Its own economic settings, recipient addresses and gas; creating a Config does not authorize arbitrary assets |
| Issue a token, buy/sell, graduate and claim | The selected Config, quote asset, helper and deployment are enabled for that operation | Creator/trader wallet authorization, gas, separate quote-token balance, exact allowances and current stage checks |
| Create/use a pool for an already supported ERC20 pair | The selected Factory/Registry permits both assets and the chosen model/preset is ready | Liquidity, price/fee/slippage choices and actual LP/fee-owner authority |
| Register an unclassified standard ERC20 for ordinary pools | That Registry supports `registerStandardToken`, no owner policy overrides it, and the exact-transfer round-trip probe succeeds | A small token amount and bounded allowance to that exact Registry; this is not aggregation admission |
| Connect an external revenue source | An already enabled standard accepts the exact implementation, assets, dependencies, family and stage | Controller/source-owner and initial holder consent, a new conforming source/module and its actual registration delay |
| Claim own fees or grant supported fee delegation | The caller is the actual beneficiary/feeOwner or has its explicit current grant | The correct asset, position/module and permitted payout; NFT ownership alone does not imply every fee right |
| Create a new team fee vault or token lock | The selected contract supports the assets, terms and caller | Funding/allowances and the actual recipient or lock permissions; existing rights and lock terms remain intact |

Start with [launchpad](LAUNCHPAD.md), [agent](AGENT-LAUNCHPAD.md), [fee sharing](FEE-SHARING.md), [stablecoin pools](STABLECOIN-QUICKSTART.md), [external-source registration](SELF-SERVICE.md) or [vesting](VESTING.md). These are different contract flows; none grants all the others' permissions.

## 2. Which kind of “approval” is the guide referring to?

| Term | Who authorizes it? | Meaning |
| --- | --- | --- |
| Wallet signature, ERC20 allowance or NFT approval | The asset/account owner | Permission to execute or spend that wallet's assets, not Ammora customer approval |
| `reviewHash`, approved Config, budget or session policy | The partner's own application/operator | Local acceptance of the exact inputs/request; it cannot override contract permissions |
| Initial source/holder consent and registration | Actual source owner, partner, holders and controller | Required even on the self-service path; each wallet consents to the exact configuration |
| Token policy, standard, driver, helper or preset admission | The designated Registry/Factory governance or owner, where the contract requires it | Shared protocol/deployment configuration; it is not repeated for every conforming partner |
| Issuer confirmation and operating review | The asset issuer and relevant operators | Official addresses, token controls and operating requirements; SDK use is not issuer certification |

Native gas ETH and ERC20 WETH are separate balances. A timelock is also separate from approval: wait until the actual chain timestamp reaches the ticket's `readyAt`, then recheck epochs and eligibility. Elapsed wall time alone does not activate anything.

## 3. When is separate review or an administrator action needed?

### New implementation or unsupported capability

An external source, proxy, Hook, driver, dependency graph or token behavior that the enabled standard does not accept needs implementation review and, where supported, a new shared standard/deployment. Matching an ABI is insufficient. The same applies to a new first-buy callback/helper, unsupported trade mode or different network/profile. Standard bootstrap and activation are platform actions performed once for the standard; later conforming instances do not need another platform registration transaction.

**A new address alone is not a new standard.** New source, token, market and recipient addresses can be used when all the enabled standard's exact runtime and live identity rules still hold. The bundled synthetic standards accept their reviewed fixture classes; they do not automatically accept a real issuer token, upgradeable proxy or arbitrary DEX implementation.

### Asset policy and launch/aggregation admission

At the **selected Factory's bound Registry**, distinguish these states:

| Asset state | Next step |
| --- | --- |
| Already supported for the requested operation | Continue with the relevant wallet/funding checks |
| Unclassified, no owner override, exact-transfer behavior | Use the supported permissionless small round-trip registration path for ordinary pools |
| Owner policy blocks the requested operation or needs a change | Ask that Registry owner to review the restriction/change; a probe cannot overwrite its policy. An already permitted operation needs no new approval |
| Fee-on-transfer, rebasing, callbacks, issuer pause/blacklist or changed implementation/control | Resolve issuer/implementation requirements and compatibility before executing; passing one probe is only a behavioral snapshot |

Ordinary pool support **does not grant aggregation token admission**. The current auto-route launch Factory checks both pool and aggregation policy for its quote asset, including its direct launch path. A new quote may therefore require an owner-authorized policy change even when it works in an ordinary pool. The guide's existing supported WETH path does not need per-team approval.

LaunchFactory already registers tokens it creates through its authorized provenance path. Partners do **not** need their issuance gate or wallet made a registrar for each ordinary Ammora launch. Changing registrar roles is an administrator action, not a universal onboarding step. See [stablecoin policy registration](STABLECOIN-QUICKSTART.md#4-check-and-register-policy-at-the-selected-factory).

### Existing revenue rights, restricted configuration or emergency recovery

Choose initial recipients and permitted splits when creating your own new Config/module/vault. That does not authorize modifying someone else's existing rights or the protocol fee share.

For the external-source weighted module, **post-registration rights changes** require the specified governance consent and affected owner/old/new holder consents. Cancelling or stopping a module also cannot be undone by self-registering again: governance recovery and a new delay are separate procedures. Those rules do not turn ordinary owner-authorized FeeVault/LP delegate grants or revocations into per-partner Ammora approval.

Using an enabled ALMM preset is separate from creating/changing a preset or privileged Factory setting. New presets and administrator settings require their actual owner. Existing minimum fees, supported operations and permanently locked principal cannot be changed through an SDK preview or a wallet approval.

### Real issuer and production operating acceptance

Official token addresses, mint/upgrade/pause/blacklist controls, issuer confirmation, liquidity and actual multisig/smart-account operation need their own evidence. Mainnet/new deployments require separate qualification. Pool creation or an SDK receipt does not establish reserves, redemption, peg safety, independent custody or public-app listing.

These are concrete asset/deployment/rights requirements, not an invitation requirement for downloading or using the SDK. Never relabel a synthetic GIWA test profile as an issuer or production profile.

## 4. Decide the next step

1. Select the product guide and one complete chain/deployment profile.
2. Check current Config/preset/asset/standard support and the exact required caller.
3. If supported, prepare funds/allowances and holder consent, preview with your own wallet policy, then submit once and reconcile its known hash and canonical receipt.
4. If unsupported or administratively restricted, keep the actual reason/state and identify the required issuer, Registry/Factory owner or standard review. Do not bypass the gate, change pins blindly or repeatedly resubmit.

An agent follows the same boundaries. It needs the owner's explicit wallet/session authority and durable execution journal; installing agent tools does not grant keys, fee rights or administrator powers.

## 5. What has actually been verified?

The [partner-address GIWA walkthrough](docs/PARTNER-PERSPECTIVE-GIWA.md) used public SDK 0.3.9 and new valueless token, market, source and holder addresses: **28 canonical transactions, zero new governance transactions, two trades, six positive 20:48:32 payments, five typed refusals and cleanup**. The demonstrated module was stopped after qualification; create your own conforming instance and honor its new ticket delay.

The [validation record](VALIDATION.md) separately retains launchpad, Creator/Partner and LP delegation evidence. These valid proofs are **REUSED** within their original source, runtime, asset, caller and receipt scope. The new-address test used one physical controlled signer to simulate partner roles; it is not an independent custody or real-issuer certification. This documentation clarification changes no SDK, contract, policy, deployment or execution authority.
