# GIWA native issuer partner examples

Start with [STABLECOIN-PARTNER.md](https://docs.ammora.org/guides/stablecoin-partner). The issuer deploys and operates its native GIWA token.
These examples consume that existing asset; they do not mint FDUSD/cUSD, provide fiat redemption or change token governance.
Public SDK 0.3.9 is pinned. The P0 runner accepts GIWA Sepolia 91342 / auto-route only.

| Action | File / npm command | Inputs |
|---|---|---|
| Inspect reviewed asset/control identity | [inspect-asset.ts](https://docs.ammora.org/examples/source/src/stablecoin/inspect-asset.ts.txt), `stablecoin:inspect` | manifest |
| Read factory-specific token policy | [read-token-policy.ts](https://docs.ammora.org/examples/source/src/stablecoin/read-token-policy.ts.txt), `stablecoin:policy` | manifest |
| Calculate decimal-aware price/seed | [plan-liquidity.ts](https://docs.ammora.org/examples/source/src/stablecoin/plan-liquidity.ts.txt), `stablecoin:plan-liquidity` | manifest, liquidity-policy JSON |
| Normal permissionless round trip | [probe-token.ts](https://docs.ammora.org/examples/source/src/stablecoin/probe-token.ts.txt), `stablecoin:probe` | manifest, probe JSON, new plan path |
| Create ARL pool + unlocked raw seed | [create-arl-pool.ts](https://docs.ammora.org/examples/source/src/stablecoin/create-arl-pool.ts.txt), `stablecoin:arl:create` | manifest, ARL creation JSON, new plan path |
| Create empty ALMM pool | [create-almm-pool.ts](https://docs.ammora.org/examples/source/src/stablecoin/create-almm-pool.ts.txt), `stablecoin:almm:create` | manifest, ALMM creation JSON, new plan path |
| Seed ALMM with unlocked manager NFT | [seed-almm.ts](https://docs.ammora.org/examples/source/src/stablecoin/seed-almm.ts.txt), `stablecoin:almm:seed` | manifest, seed JSON, new plan path |
| Add/new managed liquidity | [add-liquidity.ts](https://docs.ammora.org/examples/source/src/stablecoin/add-liquidity.ts.txt), `stablecoin:lp:add` | manifest, add JSON, new plan path |
| Remove with token refund floors | [remove-liquidity.ts](https://docs.ammora.org/examples/source/src/stablecoin/remove-liquidity.ts.txt), `stablecoin:lp:remove` | manifest, remove JSON, new plan path |
| Inspect a named NFT namespace | [position-state.ts](https://docs.ammora.org/examples/source/src/stablecoin/position-state.ts.txt), `stablecoin:position` | manifest, pool, ID, raw/managed/almm |
| Quote net output | [quote.ts](https://docs.ammora.org/examples/source/src/stablecoin/quote.ts.txt), `stablecoin:quote` | manifest, swap JSON |
| Plan exact-input, no partial fill | [swap.ts](https://docs.ammora.org/examples/source/src/stablecoin/swap.ts.txt), `stablecoin:swap` | manifest, swap JSON, new plan path |
| Grant/revoke managed ARL fee permission | [fee-delegate.ts](https://docs.ammora.org/examples/source/src/stablecoin/fee-delegate.ts.txt), `stablecoin:fee-delegate` | manifest, delegate JSON, new plan path |
| Claim existing LP entitlement | [claim-lp-fees.ts](https://docs.ammora.org/examples/source/src/stablecoin/claim-lp-fees.ts.txt), `stablecoin:claim-lp-fees` | manifest, claim JSON, new plan path |
| Close an empty ALMM NFT | [close-almm-position.ts](https://docs.ammora.org/examples/source/src/stablecoin/close-almm-position.ts.txt), `stablecoin:almm:close` | manifest, close JSON, new plan path |
| Read configured risk thresholds | [monitor-risk.ts](https://docs.ammora.org/examples/source/src/stablecoin/monitor-risk.ts.txt), `stablecoin:risk` | manifest, pool |
| Execute one reviewed plan | [execute.ts](https://docs.ammora.org/examples/source/src/stablecoin/execute.ts.txt), `stablecoin:execute` | manifest, saved plan, reviewHash |
| Reconcile without resubmitting | [reconcile.ts](https://docs.ammora.org/examples/source/src/stablecoin/reconcile.ts.txt), `stablecoin:reconcile` | saved plan, private journal |

Prefix commands with `npm run`. Planning never reads a signer even with SEND=1. Only `stablecoin:execute` sends.
[plans.ts](https://docs.ammora.org/examples/source/src/stablecoin/plans.ts.txt) contains the explicit SDK call per operation, strict request fields and action-specific authority/limit rules.
[context.ts](https://docs.ammora.org/examples/source/src/stablecoin/context.ts.txt) authenticates catalog/runtime/factory/registry, asset review and block snapshot without trust escape hatches.
[journal.ts](https://docs.ammora.org/examples/source/src/stablecoin/journal.ts.txt) provides local exclusive reservation and durable hash-before-RPC storage;
it is not a multi-host submission service. [proof.ts](https://docs.ammora.org/examples/source/src/stablecoin/proof.ts.txt) reconciles receipt identity and token movement.

[Manifest templates](https://github.com/AmmoraLabs/ammora-examples/blob/main/src/stablecoin/manifests) deliberately contain null/unreviewed values. [Request templates](https://github.com/AmmoraLabs/ammora-examples/blob/main/src/stablecoin/requests) also require real
pool/NFT values and decimal-correct raw amounts. They are schemas, not a list of authorized issuer contracts or recipients.
`native-issuer` and `synthetic-test` are separate provenance records; test assets never establish issuer/network support.

ARL initial pool NFT IDs differ from the managed IDs created by `lp:add` with tokenId=null. ALMM IDs belong to its manager.
No permanent locks, principal delegate grants, registrar/governance writes, aggregation admission, bridge or issuer admin calls occur.
ALMM default fee must match the request; P0 does not create a new governance preset.
ALMM feeOwner payout is preserved; only managed ARL receives fee-only delegation in this flow.

Existing FeeVault/DFS/Creator/Partner flows and their valid evidence remain in [FEE-SHARING.md](https://docs.ammora.org/guides/fee-sharing).
