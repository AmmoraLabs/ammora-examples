# Optional ARL operations: direct positions and managed NFTs

Use public SDK **0.3.9**. Follow the [complete guide](https://docs.ammora.org/guides/launchpad) for the default launchpad flow. This page covers partial fills, zaps, direct position management, and other optional operations.

`AMMORA_ACCOUNT` is the actual caller. The CLI defaults to unsigned preview without loading a key or sending. SEND=1 follows the root README's signer, nonce, and simulation procedure. Preview success is not evidence of payment, liquidity changes, or increased balances.

- **Pool NFT**: issued by that pool contract; store both poolNftId and collection address.
- **Managed NFT**: issued by PositionManager. Never pass a graduated Manager NFT ID to direct-position commands.
- **Compounding**: uses the pool's own NFT, automatically burned on full withdrawal; no separate close command.

```sh
# GIWA: use .env.example RPC/generation and clear stale receipt overrides.
export AMMORA_CHAIN_ID=91342 AMMORA_GIWA_GENERATION=auto-route
export AMMORA_ACCOUNT=YOUR_CALLER_ADDRESS
export AMMORA_SEND=0 AMMORA_READ_RECEIPT=''

# 1. Separate explicitly partial-fill order; ordinary swap:safe still requires full fill.
npm run arl:partial-swap -- POOL TOKEN_IN MAXIMUM_INPUT_RAW

# 2. One-token swap + new LP. SWAP_RAW < INPUT_RAW; review fees and refunds.
npm run arl:zap-in -- POOL concentrated TOKEN_IN INPUT_RAW SWAP_RAW
npm run arl:zap-in -- POOL compounding TOKEN_IN INPUT_RAW SWAP_RAW

# 3. Resolve pool position ID from addLiquidity receipt; not proof of current ownership.
npm run arl:resolve-added-position -- POOL compounding ADD_LIQUIDITY_TX_HASH

# 4. Add to direct pool NFT. Managed NFTs use arl:add-to-position.
npm run arl:add-to-direct-position -- POOL compounding POOL_NFT_ID MAX_BASE_RAW MAX_QUOTE_RAW

# 5. Claim positive rewards only from initialized/funded slot 0 or 1.
npm run arl:claim-compounding-reward -- POOL POOL_NFT_ID 0 PAYOUT_ADDRESS

# 6. Split direct positions and close empty concentrated positions; owner only here.
npm run arl:split-direct-position -- POOL concentrated POOL_NFT_ID LIQUIDITY_RAW
npm run arl:close-direct-position -- POOL EMPTY_POOL_NFT_ID

# 7. Compounding merge/time lock/extension using SDK 0.3.6 checked planners.
npm run arl:merge-compounding-positions -- POOL DESTINATION_ID SOURCE_ID
npm run arl:lock-compounding-position -- POOL POOL_NFT_ID FUTURE_RELEASE_POINT

# 8. Convert direct concentrated position to Manager NFT; approve only that NFT.
npm run arl:wrap-direct-position -- POOL POOL_NFT_ID

# 9. Single-asset seed calculation/Factory quote; read-only, no pool creation.
npm run arl:prepare-single-side-pool -- BASE_TOKEN QUOTE_TOKEN base AMOUNT_RAW SQRT_MIN_Q64 SQRT_MAX_Q64 SALT_32_BYTES
```

Lock units follow the pool's `activationType`: timestamps or blocks, not necessarily seconds. A new time lock must extend the existing release point; these examples do not modify permanent locks. Merges require matching ownership and lock conditions.

SDK 0.3.6 normalized viem `uint40` decoding for checked merge/time-lock operations. Ownership, authority, identical-lock, permanent-lock, and extension-only checks remain. Extend an existing lock with the same `arl:lock-compounding-position` command and a larger releasePoint. If pinned to older 0.3.4/0.3.5, run `npm ci` to use this project's current 0.3.9 lockfile.

Raw reward/merge/lock builders are used only to **compare calldata after checked planning succeeds**. A raw builder does not prove authority; do not send twice for comparison.

Reconcile the following separately:

| Operation | Evidence after execution |
|---|---|
| Partial swap | Canonical receipt, actual Swap input/output, input balance decrease, unspent amount; unspent input is not a refund transfer |
| Zap | Swap/LP mint events, exact Pool/Manager collection and ID, supplied/refunded token and fee balances |
| Reward | Positive claimable, reward-token Transfer, payout receipt-block balance increase |
| Add/split/merge/close | Before/after liquidity and owner, new ID or burn event, preserved rewards and locks |
| Wrap | Separate NFT approval and wrap receipts, Pool NFT custody in Manager, new managed NFT owner/ID |
| Time lock | Before/after releasePoint, withdrawal rejection while locked, successful withdrawal after expiry; NFT transfer restrictions are separate contract behavior |

Partial swaps and zaps retain slippage minima. A zero reward is not a successful payment. For failed or uncertain transactions, reconcile nonce, receipt, and canonical block before any resend.

## Withdrawable direct LP test positions

```sh
npm run arl:add-direct-liquidity -- POOL concentrated MAX_BASE_RAW MAX_QUOTE_RAW
npm run arl:add-direct-liquidity -- POOL compounding MAX_BASE_RAW MAX_QUOTE_RAW
npm run arl:remove-direct-liquidity -- POOL KIND POOL_NFT_ID LIQUIDITY_RAW
```

New positions use `lockDuration=0`, `permanentLock=false`, and the caller as payout. Commands accept an optional final `deadlineUnix`. Resolve the actual receipt collection/ID using `arl:resolve-added-position`; equal numeric IDs in different pools are different NFTs. Withdrawal planners check current ownership, locks, and minimum received. Do not test using permanently locked graduation LPs or pass Manager IDs to direct-pool commands.

Review the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) and [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md). Existing merge/lock/extension/withdrawal transactions are reused for the same runtime, not counted as new sends. Compounding time locks restrict liquidity withdrawal; do not describe them as preventing pool NFT transfers.
