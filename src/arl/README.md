# ARL: post-graduation swaps and LP management

Use the `canonicalPool` created by Graduation. Do not run `arl:create-pool` again
for a graduated token. Manager NFT IDs (concentrated) and pool NFT IDs (compounding)
are different namespaces; always retain the pool model and manager address.

| Action | Command / source | Entry mode |
| --- | --- | --- |
| Buy/sell after Graduation | `swap:safe` / [safe-swap.ts](https://docs.ammora.org/examples/source/src/arl/safe-swap.ts.txt) | send-only; explicit `concentrated` or `compounding` model |
| Exact-output swap | `arl:swap-exact-output` / [swap-exact-output.ts](https://docs.ammora.org/examples/source/src/arl/swap-exact-output.ts.txt) | unsigned by default; public caller |
| Discover current Manager NFTs | `arl:get-user-positions` / [get-user-positions.ts](https://docs.ammora.org/examples/source/src/arl/get-user-positions.ts.txt) | read-only; rechecks current ownership |
| New Manager NFT + liquidity | `arl:create-position` / [create-position.ts](https://docs.ammora.org/examples/source/src/arl/create-position.ts.txt) | unsigned by default; raw maximum amounts |
| Add / remove / remove all | [add-to-position.ts](https://docs.ammora.org/examples/source/src/arl/add-to-position.ts.txt), [remove-position-liquidity.ts](https://docs.ammora.org/examples/source/src/arl/remove-position-liquidity.ts.txt), [remove-all-position-liquidity.ts](https://docs.ammora.org/examples/source/src/arl/remove-all-position-liquidity.ts.txt) | unsigned by default; unlocked liquidity only |
| Split / merge | [split-position.ts](https://docs.ammora.org/examples/source/src/arl/split-position.ts.txt), [merge-positions.ts](https://docs.ammora.org/examples/source/src/arl/merge-positions.ts.txt) | split send-only; merge unsigned by default; compatible Manager positions |
| Period vesting / refresh | `arl:vest-position`, `arl:refresh-vesting` / [vest-position.ts](https://docs.ammora.org/examples/source/src/arl/vest-position.ts.txt), [refresh-vesting.ts](https://docs.ammora.org/examples/source/src/arl/refresh-vesting.ts.txt) | unsigned by default; exact activation units |
| Permanent lock | `arl:lock-position` / [lock-position.ts](https://docs.ammora.org/examples/source/src/arl/lock-position.ts.txt) | send-only; irreversible principal lock |
| LP fees / fee delegate | `arl:claim-position-fee`, `arl:fee-delegate` / [claim-position-fee.ts](https://docs.ammora.org/examples/source/src/arl/claim-position-fee.ts.txt), [fee-delegate.ts](https://docs.ammora.org/examples/source/src/arl/fee-delegate.ts.txt) | send-only; ownership/permission/payout checked below |
| Manager LP reward | `arl:claim-position-reward` / [claim-position-reward.ts](https://docs.ammora.org/examples/source/src/arl/claim-position-reward.ts.txt) | unsigned by default; deployed and funded reward required |
| Compounding LP add / remove / fees | [add-compounding-liquidity.ts](https://docs.ammora.org/examples/source/src/arl/add-compounding-liquidity.ts.txt), [remove-compounding-liquidity.ts](https://docs.ammora.org/examples/source/src/arl/remove-compounding-liquidity.ts.txt), [claim-compounding-fees.ts](https://docs.ammora.org/examples/source/src/arl/claim-compounding-fees.ts.txt) | unsigned by default; pool NFT ID |

Unsigned actions read `AMMORA_ACCOUNT`; `AMMORA_SEND=1` requires the matching signer.
Send-only commands refuse `AMMORA_SEND=0`; they are not dry-run planners. Follow each
file's argument header and the [integrated guide](https://docs.ammora.org/guides/launchpad) for actual inputs.
Current additional methods are in [direct/Compounding optional positions](https://docs.ammora.org/guides/src-arl-optional-positions).
The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) preserves historical gaps, not current availability.
Use [claim-all-position-fees.ts](https://docs.ammora.org/examples/source/src/arl/claim-all-position-fees.ts.txt) and [the batch guide](https://docs.ammora.org/guides/src-fees-readme) for sequential multi-position claims.

## Claim managed concentrated LP fees to a payout address

For the complete Config-to-Graduation launchpad flow, start with the
[single launchpad guide](https://docs.ammora.org/guides/launchpad). This page expands its LP payout/delegation step.

Connect the **Position Manager NFT owner or an authorized fee delegate** and pass the fee destination as the optional
third argument. The token ID is the manager NFT ID printed by `arl:get-user-positions`,
not the pool's internal position ID.


```bash
# Send the position's accrued base/quote fees to a reviewed treasury address.
AMMORA_SEND=1 npm run arl:claim-position-fee -- <pool> <managerNftId> <payoutAddress>
# Omit the destination to keep the existing behavior: pay the owner.
AMMORA_SEND=1 npm run arl:claim-position-fee -- <pool> <managerNftId>
```


The connected authorized caller signs and pays native gas. The payout wallet receives the fee tokens
and does not need to sign. A delegate needs the exact fee permission described below; the claim command does not grant
permission. A custom payout changes only this claim's destination: NFT ownership, future
fee rights, liquidity, vesting and permanent locks stay unchanged. Fees can be collected
from permanently locked liquidity; that does not unlock or withdraw principal.

The SDK authenticates the factory/pool/manager binding and plans
`claimPositionFees(managerNftId, payoutAddress)`. The example uses that same address for
simulation and receipt validation. It refuses a zero/invalid destination and extra
arguments. If both fee amounts are zero it sends no transaction; this is a no-op, not a
successful positive payout.

After signing, retain the hash and successful canonical receipt. Match the manager's
`PositionFeesClaimed` event to the expected manager NFT ID, destination and raw base/quote
amounts. For each fee token, compare the payout wallet's balance at receipt-1 and receipt
block; the increase must equal the event amount. Also check ERC-20 `Transfer` logs, the
owner's token balance during that claim, NFT owner, pool binding, vested/unlocked liquidity
and permanent locked liquidity. Gas changes are separate from fee-token transfers.

[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
cover existing NFTs #5/#7 paying two distinct controlled wallets, with #6's zero-fee
rounding dust excluded. Review your own full payout address before signing; copying test
addresses would send fees to those test wallets.

## Fee-only delegation and a separate payout

The owner grants one of two explicit permissions with `arl:fee-delegate`. This replaces
the NFT's **single delegate slot**, so inspect the existing delegate first. Use only
addresses and destinations reviewed by the NFT owner. No liquidity, reward, lock or
transfer permission is included.


```bash
# Connected as NFT owner: allow this delegate to send fees to a reviewed separate address.
AMMORA_SEND=1 npm run arl:fee-delegate -- <pool> <managerNftId> <delegate> claim-fee
# Connected as that delegate: claim to a separate treasury/payout wallet.
AMMORA_SEND=1 npm run arl:claim-position-fee -- <pool> <managerNftId> <payoutAddress>
# Connected as NFT owner: clear both the delegate address and all permission bits.
AMMORA_SEND=1 npm run arl:fee-delegate -- <pool> <managerNftId> revoke
```


`claim-fee` is `ClaimFee` (8): the delegate can choose any nonzero fee destination.
Grant it only to a trusted wallet because it permits redirecting fees. For collection
that must pay the NFT owner, grant `claim-fee-to-owner` (`ClaimFeeToOwner`, 16) instead;
that delegate cannot redirect to a different address. **Omitting the claim destination
always pays the NFT owner**, even if the connected caller is the delegate. Only the
owner can grant/revoke; delegation grants neither NFT ownership nor a right to withdraw
locked principal. Revocation restores the zero address with permission 0.

The SDK authenticates the pool/manager and enforces caller, permission bits and payout
before planning; the exact request must then simulate on chain before signing. An
unrelated wallet, a revoked delegate or an owner-only delegate attempting redirection
is refused. Never force a failed simulation onto the chain.

[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
includes owner-only redirection refusal, positive delegated payment, unrelated caller
refusal and permission cleanup. Refusals are deployed-contract `eth_call` simulations
with `InvalidPermission`, not intentionally mined failed transactions.

[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) repeats
the actual delegated payment and refusal boundary from the separately installed
consumer, with permission16/8 checks and final revocation. Follow the
[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) when
copying these files; they require `src/shared` as well as the SDK.
