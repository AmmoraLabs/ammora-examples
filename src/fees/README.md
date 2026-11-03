# FeeVault delegation and batch claims — SDK 0.3.8

Start with the [complete guide](https://docs.ammora.org/guides/launchpad), then [fee configuration and claims](https://docs.ammora.org/guides/fee-sharing). These examples use public SDK 0.3.8 and the GIWA `auto-route` deployment.

```bash
export AMMORA_CHAIN_ID=91342 AMMORA_GIWA_GENERATION=auto-route
export AMMORA_ACCOUNT=YOUR_CONNECTED_CALLER_ADDRESS
export AMMORA_SEND=0 AMMORA_READ_RECEIPT=''
```

| Capability | Command / input | Caller |
|---|---|---|
| Grant / revoke delegation | `fees:delegate -- <feeVault> <delegate> <allow\|revoke>` | That FeeVault beneficiary |
| Delegated claim | `fees:claim-delegated -- <feeVault> <token> <beneficiary> <payout>` | Beneficiary-appointed delegate |
| Multiple FeeVault claims | `fees:batch-claim -- <requests.json> [new-progress.json]` | Beneficiary or delegate for each request |
| Multiple ARL LP claims | `arl:claim-all-position-fees -- <pool> <positions.json> <payout> [new-progress.json]` | Owner or authorized fee claimant |
| Multiple ALMM LP claims | `almm:claim-all-position-fees -- <pool> <id,id> [new-progress.json]` | SDK-authorized owner/fee-owner/caller |

Unsigned preview is the default. Send only with explicit `AMMORA_SEND=1` and the same caller. Verify FeeVault through the reviewed Factory, preserving each deployment's existing owner. `launch:claim-fees` remains the beneficiary's own-claim example.

## Beneficiary → delegate → separate payout

1. Connect as beneficiary and run `fees:delegate` with `allow`.
2. Connect as delegate, specify token/beneficiary/payout, and run `fees:claim-delegated`.
3. Check `ClaimedFor` beneficiary/caller/recipient/amount, ERC20 Transfer, and receipt-block balances.
4. Return as beneficiary and `revoke`. Unauthorized wallets and revoked delegates must be rejected.

This authority covers **all token assets of that beneficiary in that FeeVault**, including payout selection. Grant it only to a trusted delegate. It is separate from NFT ownership, LP principal rights, and Manager LP delegation. No FeeVault owner change is required. WETH claimable may aggregate several launches; do not label the total as a single launch's payout.

## Execute multiple requests sequentially

Replace every address in [batch.example.json](https://docs.ammora.org/examples/source/src/fees/batch.example.json.txt) and preview. Duplicate vault/token/beneficiary requests are rejected even with different payouts. Zero-fee requests are skipped and do not count as paid.

```bash
npm run fees:batch-claim -- ./my-claims.json
# Send with the same reviewed inputs/caller and a new progress file.
AMMORA_SEND=1 npm run fees:batch-claim -- ./my-claims.json ./claims-progress.json
```

This is **sequential execution of multiple transactions**. Persist each nonce, submitted hash, and confirmation status in progress; stop on failure. Existing progress files do not automatically resume. Reconcile submitted/unknown hashes, nonces, receipts, and canonical blocks before reviewing only the unsent requests. If `SUBMITTING_OR_UNKNOWN` has no hash, inspect the nonce and actual wallet transactions first.

SDK `buildBatchFeeClaims` / contract `batchClaim` are **owner/operator-only** and pay each recipient's own entitlement to that recipient. They differ from ordinary-wallet delegated claims with separate payouts. These examples do not change Factory/governance/operator authority.

Specify collection types in ARL `positions.json`:

```json
[{"tokenId":"YOUR_MANAGER_ID","sourceKind":"POSITION_MANAGER"}]
```

Direct pool NFTs use `RAW_POOL`; Manager NFTs use `POSITION_MANAGER`. Equal numbers can identify different collections, but this SDK batch planner rejects duplicate tokenIds, so split collisions into separate batches. Use `arl:claim-compounding-fees` for Compounding LPs; this batch is Concentrated-only. ALMM batch payouts retain ALMM owner/fee-owner rules without an arbitrary payout argument.

`payoutVerified:true` means a positive token credit and full receipt-block balance reconciliation for that receipt. It does not mean every request succeeded or every token paid positively. A zero-fee receipt is not payment evidence. If verification reads fail, reconcile existing hashes and balances read-only instead of resending progress entries.

For direct DFS fee collection, use the [source connection guide](https://docs.ammora.org/guides/src-dfs-readme#connect-revenue-sources-directly).

## One batchClaim by an existing owner/operator

`fees:operator-batch-claim -- <feeVault> <requests.json>` verifies existing owner/operator authority and calls `buildBatchFeeClaims`. Requests have the shape `{"token":"REPLACE_TOKEN","recipient":"REPLACE_BENEFICIARY"}`. That recipient is both entitlement beneficiary and payout. This does not select separate payouts or promote a beneficiary to operator. The deployed owner may be an EOA or Factory; inspect actual authority without changing ownership or granting operators.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) covers payments, rebalancing, permission denials, new-LP exits, and remaining reward/rounding state.
