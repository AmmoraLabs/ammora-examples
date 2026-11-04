# SDK 0.3.9: public APIs and live deployment status

Reviewed 2026-11-04 on GIWA Sepolia (chain 91342). Public SDK **0.3.9 is npm latest**; Math remains **0.3.0**. No SDK package was republished during latest promotion.

```sh
npm install @ammora-protocol/sdk viem
```

A fresh anonymous project installed the versionless SDK as 0.3.9. All 74 package files, SDK runtime/declarations, Math and the four entrypoints matched the qualified public artifact. The examples pin 0.3.9 with a committed lockfile. Their 188 offline tests and root/unified typechecks passed with the actual npm package. Use [the launchpad guide](LAUNCHPAD.md), [agent guide](AGENT-LAUNCHPAD.md), or [stablecoin quickstart](STABLECOIN-QUICKSTART.md).

## Package availability is separate from deployment and authority

All nine groups below were imported from the actual public 0.3.9 package. An import does not deploy contracts, activate a route or grant revenue rights. `REUSED` retains the original source, assets, roles, dependency environment and canonical receipt scope; it is not a new trade or payout.

| Module | Public SDK availability | Execution qualification and remaining boundary |
| --- | --- | --- |
| ALMM fee-only routing | PASSED_THIS_RUN: official readiness/grant/revoke/claim exports and ABI | Fresh SDK 0.3.9 synthetic-asset NFT #7 execution is recorded below; reviewed version-1 deployment is opt-in |
| ALMM preset/position readiness | PASSED_THIS_RUN: official functions, available since 0.3.8 | Fresh owned-position preflight passed; existing default catalog/preset roles and token-policy checks remain |
| ARL V5 clients | PASSED_THIS_RUN: root clients and ABIs | PASSED_THIS_RUN: current GIWA profile/runtime/fee reads; 150 bps, no pending fee proposal. Historical create/swap/positive claim evidence is REUSED; current acceptance profile is read-only, with no default route activation |
| Scoped aggregation exact output | PASSED_THIS_RUN: quote/plan/evidence exports | REUSED: scoped implementation and regression proof. A reviewed router/registry/factory/adapter profile and enabled action are required; default V5 routing is not enabled by installation |
| Managed partner V4 | PASSED_THIS_RUN: quote/sign/simulate/ABI exports | REUSED within the original reviewed source/adapter scope. Current source approval and holder consent remain required |
| Managed partner V4 V2 execution | PASSED_THIS_RUN: quote/submit/reconcile exports | REUSED within the original qualification scope. Registry approval, consent, wallet permission and operating acceptance remain separate |
| Giwagmi managed profile | PASSED_THIS_RUN: quote/sign/simulate/reconcile exports | REUSED: historical C1 operating proof and cleanup. Its final registry is paused; automatic restart is not authorized |
| Standard self-service admission | PASSED_THIS_RUN: `/partner` public API | REUSED: qualified 0.3.9 runtime/core and unchanged local interfaces. **PASSED_THIS_RUN: complete owned synthetic GIWA flow**—76 canonical transactions, two enabled standards, three direct registrations/activations, six trades, twelve positive 20:80 fixed-beneficiary payments, typed refusals and zero task custody/allowance cleanup. Test modules were stopped and own writer released; real partner standard/review remains unselected. See [qualification](docs/SELF-SERVICE-VALIDATION.md) |
| Common onboarding V2 | PASSED_THIS_RUN: `/partner` catalog/entry constructors | REUSED: original local reviewed-profile qualification. Requires an executable trusted profile; remote JSON is not execution approval |

Earlier documents saying “unpublished” described historical source candidates. Their immutable npm archives and original evidence retain that history. The current API availability is established above; those old labels must not be read as current deployment approval.

## What must be selected for a new self-service admission deployment?

The SDK does not ship guessed production addresses. Required inputs are: the actual standard source and revenue rights; ordered dependency/runtime pins and token behavior; independent review; controlled governance and guardian; wrapper, fee receiver and approval delay; a fresh deployment/cleanup gas budget; and an operating/incident owner. A qualified manifest must bind the deployed admission/registry/router/factory/driver/verifier, receipts, immutable configuration and enabled standards. Activation must respect the real delay and holder consents.

Standard admission for externally reviewed revenue sources is separate from ordinary launchpad Config creation. The launchpad Config path remains permissionless; no per-Config Ammora invitation or approval is introduced. Token policy and existing privileged actions retain their own on-chain checks.

Local EVM scenarios are not GIWA transactions. Existing managed modules are not automatically migrated, unpaused or given new rights. Official FDUSD/cUSD assets remain **BLOCKED** until issuer-confirmed GIWA addresses, token-control review and funding are supplied. Synthetic LP tests certify neither an issuer nor a peg.

## Fresh public-SDK fee-routing execution

**PASSED_THIS_RUN:** 19 new canonical transactions with public SDK 0.3.9: new owned NFT #7, both swap directions, fixed and explicit-any fee payouts, revocation, principal exit and NFT closure. Both payments increased balances by 1799999999999 raw base and 1 raw quote each. Nine typed chain-call authority rejections passed; no failed broadcasts or resends. All four task allowances and controller/delegate custody were zero after cleanup. See [transaction hashes, exact-block payments and scope](VALIDATION.md).

## Reuse and exclusions

The existing launchpad/agent lifecycle, atomic issuance/first buy, Creator/Partner/multiple-recipient payouts and earlier LP delegation proofs are **REUSED** in their original scope. This release did not replay them. Relevant source, ABI, package/dependency, deployment/role, canonical receipt or sealed evidence changes invalidate the affected reuse.

GitHub CI, SDK republication, mainnet and production API/Indexer changes are **NOT_APPLICABLE**. These are direct contract examples. A successful SDK install does not certify every optional module's live deployment or application integration.
