# ALMM operations — public SDK 0.3.9

For the default launchpad, start with the [complete guide](https://docs.ammora.org/guides/launchpad). ALMM bin pools are a separate product; do not pass graduated ARL pool addresses or NFT IDs into them.

| Capability | Command / file |
|---|---|
| Create pool, active bin, owned NFTs | `almm:create-pool`, `almm:active-bin`, `almm:get-positions` |
| Balanced, imbalanced, single-sided | [create-position](https://docs.ammora.org/examples/source/src/almm/create-position/shared.ts.txt), `almm:create-position:balanced`, `:imbalanced`, `:one-sided` |
| Add / withdraw liquidity | [add-liquidity.ts](https://docs.ammora.org/examples/source/src/almm/add-liquidity.ts.txt), [remove-liquidity.ts](https://docs.ammora.org/examples/source/src/almm/remove-liquidity.ts.txt) |
| LP fees / rewards | [claim-position-fees.ts](https://docs.ammora.org/examples/source/src/almm/claim-position-fees.ts.txt), [claim-reward.ts](https://docs.ammora.org/examples/source/src/almm/claim-reward.ts.txt) |
| Fees across positions | [claim-all-position-fees.ts](https://docs.ammora.org/examples/source/src/almm/claim-all-position-fees.ts.txt), [sequential execution and payout proof](https://docs.ammora.org/guides/src-fees-readme) |
| Reallocate bins | [rebalance-position.ts](https://docs.ammora.org/examples/source/src/almm/rebalance-position.ts.txt), JSON below |

## Rebalance an existing position

`almm:rebalance -- <pool> <rebalance.json>` calls `ALMMClient.planRebalancePosition`. Replace the NFT ID, **actual owned bin shares**, new raw token inputs, recipient, and near-future deadline in [rebalance.example.json](https://docs.ammora.org/examples/source/src/almm/rebalance.example.json.txt). It supports 1–64 total bin operations.

```bash
export AMMORA_CHAIN_ID=91342 AMMORA_GIWA_GENERATION=auto-route
export AMMORA_ACCOUNT=YOUR_NFT_OWNER AMMORA_SEND=0 AMMORA_READ_RECEIPT=''
npm run almm:rebalance -- YOUR_ALMM_POOL ./rebalance.json
# After reviewing quote additional inputs, refunds and minimum shares
AMMORA_SEND=1 npm run almm:rebalance -- YOUR_ALMM_POOL ./rebalance.json
```

Only the owner or an SDK-authorized operator paying the owner may execute. Locked bootstrap withdrawals, another pool's NFT, out-of-range or duplicate bins, excessive shares, and incorrect callers are rejected. Approve only the additional input caps calculated by the SDK. Replan if funds, price, or active bin changes.

After execution, reconcile withdrawn/deposited bin-share changes, preserved owner/NFT ID, additional input/refund Transfers, and receipt-block balances. Rebalancing moves LP principal; it is not a fee claim or an unlock. Use existing commands for full withdrawal and empty-NFT cleanup.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) covers actual payments, rebalancing, permission denials, new-LP exits, and remaining reward/rounding state.
