# SDK 0.3.9 partner examples

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
maps SDK coverage and remaining operational gates. These commands retain the local
synthetic scope below. Direct FeeVault/LP examples have separate
[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

For external-source registration on GIWA, use the [self-service guide](../../SELF-SERVICE.md) and the feature examples in `self-service/`. They use the public 0.3.9 package and are separate from the offline fixtures below.

Live-profile self-service feature commands prepare/read only: `partner:create-test-assets`, `partner:create-test-source`, `partner:configure-test-source`, `partner:diagnose-standard`, `partner:deploy-module`, `partner:verify-module-deployment`, `partner:register`, `partner:activate`, `partner:quote-module`, `partner:prepare-module-claim`, `partner:cancel-registration` and `partner:reconcile-registration`. See the guide for wallet-owned consent, actual timelocks, genuine local plan handling and positive receipt-block payout checks. `partner:standards` lists enabled standards. Quote/claim commands in the offline section below remain separate demonstrations.

These five commands are deterministic **SYNTHETIC_OFFLINE** examples. They use local
installed SDK 0.3.9 APIs, chain **31337** and a bounded in-memory RPC fixture. No API service,
network, key, signer, wallet prompt or broadcast is involved. Unset `AMMORA_SEND`;
setting it to `1` makes every command refuse to run.


```bash
npm run partner:catalog
npm run partner:onboarding
npm run partner:quote
npm run partner:claims
npm run partner:reconcile -- unknown
npm run partner:reconcile -- finalized
```


| Command | Actual SDK boundary shown |
| --- | --- |
| `partner:catalog` | Install a locally reviewed V2 entry, select/diagnose an exact route or custody purpose; unsupported combinations remain unsupported |
| `partner:onboarding` | `planOnboarding("C2")` returns original-claim-authority review with Ammora allocation 0, no automatic execution and no RPC read |
| `partner:quote` | Per-asset quote cost display: creator/source eligibility differs from treasury; allocation requires receipt and native gas remains unknown |
| `partner:claims` | Plan a fixed-beneficiary module custody claim and simulate that exact request against a pinned fixture runtime; unsigned and not a payout proof |
| `partner:reconcile` | Correlate known plan/sender/calldata/runtime/canonical status; unknown/pending/invalid/orphaned/reverted/observed/finalized never permit automatic resend |

The fixture's addresses, runtime hash, review evidence hash and `local-fork` enum are
synthetic inputs required by the SDK types. They do not certify a deployed or fork-tested
integration, actual source rights, payer authorization, settled revenue or real finality.
Never copy this profile into a wallet or deployment workflow.

## Move from the fixture to read-only application integration

Install profiles/drivers in trusted local application code. A remote JSON manifest is
not executable and cannot install an SDK entry. `createReviewedCatalog` accepts only
locally constructed entries. Review chain/genesis, factory/registry/module/driver pins,
assets, route order/mode, wallet family and supported claim authority. Source-specific
connectors/ABIs are imported from `@ammora-protocol/sdk/partner-adapters`; generic client,
catalog, custody and receipt methods belong in `@ammora-protocol/sdk/partner`.

Use a `ProductReadOptions` transport with exact chain/genesis, cancellation, finite
per-operation reads/timeouts and an account-wide `beforeRead` budget reservation.
The fixture throws on unexpected methods; production transports must not silently retry,
switch provider or expose raw provider errors. `selected`/`inspect` is never execution
approval. Reopen against the current catalog; stale references and unreviewed revisions
must fail before trading. Preserve historical references for custody/reconciliation.

`quoteReviewedPool(handle, intent)` in [quote.ts](https://docs.ammora.org/examples/source/src/partner/quote.ts.txt) calls the selected pool-rights
trade handle's real `quote` method with that transport and formats SDK quote costs. The
CLI itself displays only synthetic costs; it does not fabricate an executable trade plan.
Live quotes still require the correct runtime/approval/rights epochs, nonce, source
configuration and account capabilities. This helper never signs or submits.

`preparePartnerClaim(handle, asset, beneficiary)` in [claims.ts](https://docs.ammora.org/examples/source/src/partner/claims.ts.txt) invokes the
custody handle's `planClaim` and then `simulateAction` for the same beneficiary request.
A plan is not authority: the simulation can reject unauthorized/revoked callers, runtime
drift or exhausted budget. No callback from a server listing can replace this local plan.

## Keep fee families and payout authority separate

- The existing [FeeVault and LP guide](https://docs.ammora.org/guides/src-arl-readme) retains its exact own/delegate
  permission and alternate payout behavior. Upgrading the SDK does not redirect those
  recipients or change their fee economics.
- The pool-rights **module custody claim** here encodes `claim(asset)` for its beneficiary.
  It has no arbitrary payout parameter. Do not invent alternate-recipient capability
  because the ARL manager supports one.
- C2 **source manual claim** is a different method, `planManualClaim(asset, originalActor)`.
  The live source driver's original claim authority and fresh simulation are required.
  C2 preserves 100% of original rights and does not enable managed 20:80. After a source
  claim, fresh recovery may be required to credit module surplus to its original payee.
- D1/C1/C3 split only eligible, attributable **newly secured managed revenue**. Treasury,
  principal, refunds, old/unmanaged fees, direct LP claims and donations are excluded.
  C1/C3 exact-input support does not imply exact-output or arbitrary wallet/Hook support.

## Receipt status is not a positive payout attestation

`partner:reconcile` accepts the seven fixture observation names in the table. An SDK
`finalized` action receipt authenticates execution identity/canonical finality within the
transport's evidence. It does not independently prove a positive fee event or recipient
balance increase. Every displayed result therefore keeps `payoutVerified:false` and
`amountPaid:null`, including the finalized fixture. Actual payout verification requires
source-specific exact events and receipt-1 / receipt-block token balances, as in the
preserved [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

Production submission additionally requires an atomic durable `PartnerSubmissionJournal`
and a separately reviewed sender. Persist submitted/unknown attempts and their hashes;
reconcile before reuse of any nonce. Do not release uncertain reservations by timer or
stale RPC. These examples intentionally provide no sender or in-memory substitute for
that durable store. SDK guidance always has `mayResubmit:false` and sanitizes errors.

Source/module deployment, independent approver/guardian, actual role consent, timelock,
EIP-7702/account support, audit and partner acceptance remain separate activation gates.
No existing C1 automation or public contract is restarted by these examples. See
[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

## Direct contract state examples

`partner:graduation-state` and `partner:pool-state` read deployed contracts through
the installed SDK 0.3.9 and RPC. They are separate from the offline examples above and require a
raw deployment manifest with independently reviewed addresses, runtime hashes,
start blocks, source/destination versions and source-review/admission fields:


```bash
AMMORA_CHAIN_ID=91342 AMMORA_SEND=0 AMMORA_READ_RECEIPT='' \
  npm run partner:graduation-state -- <manifest.json> <sourceCurve>
AMMORA_CHAIN_ID=91342 AMMORA_SEND=0 AMMORA_READ_RECEIPT='' \
  npm run partner:pool-state -- <manifest.json> <partnerPool>
```


JSON `startBlock` values may be non-negative decimal strings or safe integers.
The parser restores `bigint` coordinates; SDK dependency hashes, chain and registry
bindings are still checked. Do not copy a runtime hash from the same RPC response
being verified, manufacture a verified context, or upgrade `reference-only` into a
reviewed external partner.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
includes a real, isolated reference-source deployment and its manifest. Its source
has public test setters. It qualifies these direct reads and binding/migration
interfaces; external-source economics/certification, metadata review and aggregation
eligibility remain separate and are not implied by a successful state read.
