# Configure your team's recipients

This example uses public SDK 0.3.7 and creates a **new immutable Config** from a reviewed concentrated
Launch template. It explicitly sets four independent roles. It preserves the template's
fee rates, creator share, LP distribution percentages, locks and vesting. It cannot
redirect protocol fees or change an existing Config or token.

| Policy field | Receives/controls |
| --- | --- |
| `configOwner` | Config identity; ownership alone does not collect every launch's fees |
| `partnerRecipient` | Launch partner trading fees in the FeeVault, keyed by actual fee asset |
| `liquidityPartner` | Partner Graduation LP position ownership, subject to inherited locks |
| `leftoverReceiver` | Remaining base tokens when the Config's migration policy allocates leftovers |

The token creator is set by token creation, independently of these roles. Protocol
recipients and protocol share are fixed by the selected deployment's fee policy.
A single team treasury may fill all four fields, or each role may use a different
reviewed address. Use addresses whose controllers can actually claim; sending to a
contract wallet requires that wallet's supported call flow. Never put keys in this file.
For direct Config creation, connect the `configOwner` wallet: the Registry requires
the direct caller to be that owner. The designated Shared Core forwarder exception
does not grant arbitrary launchpad gates authority to name another owner.
See the [single launchpad guide](https://docs.ammora.org/guides/launchpad) for the complete platform flow.
This example configures one partner recipient; it does not deploy or fund an AFS
multi-recipient distribution vault.

For explicit Creator/Partner ratios, use [fees.example.json](https://docs.ammora.org/examples/source/src/launch/team/fees.example.json.txt) with
`launch:fee-config -- preview|document <fees.json> <saleSupplyRaw> <quoteThresholdRaw>`.
It preserves LP/vesting economics and produces the full JSON consumed by `launch:config-json`.
See the [recipient, distribution and claim guide](https://docs.ammora.org/guides/fee-sharing) for the complete flow.
The recipient-only schema below remains unchanged.

## Preview, review and create

From the repository root:


```bash
cp src/launch/team/recipients.example.json team-recipients.json
```


Replace **all four** `REPLACE_WITH_...` values with your team's reviewed public addresses.
The placeholder file intentionally fails validation. It selects chain 91342, the
`auto-route` registry and managed template #6's immutable hash. For another deployment,
read its Config first and replace `chainId`, `registry`, `templateId` and `templateHash`
together; IDs are scoped to a registry. Check enabled state, fees, quote asset, token
decimals, vesting and locks using `launch:get-config`. A different hash fails closed.


```bash
AMMORA_CHAIN_ID=91342 AMMORA_GIWA_GENERATION=auto-route \
  npm run launch:team-config -- preview team-recipients.json 'REPLACE_WITH_SALE_SUPPLY_RAW' 'REPLACE_WITH_QUOTE_THRESHOLD_RAW'
```


Preview loads no key and sends nothing. Review the complete Config, inherited and selected
recipient addresses, economics reconciliation, curve, transaction and `reviewHash`.
Amounts are raw integers in the template's base/quote decimals. The review hash binds
chain, registry, value and exact calldata, including owner, all recipients and economics.
It is an integrity check, not an authorization signature or a transaction simulation.
After reviewing, use that exact hash:


```bash
AMMORA_CHAIN_ID=91342 AMMORA_GIWA_GENERATION=auto-route AMMORA_SEND=1 \
  npm run launch:team-config -- create team-recipients.json 'REPLACE_WITH_SALE_SUPPLY_RAW' 'REPLACE_WITH_QUOTE_THRESHOLD_RAW' 'REPLACE_WITH_REVIEW_HASH'
```


Creation rebuilds the plan at a fresh confirmed snapshot and refuses a hash mismatch
before loading a signer. It simulates the exact request before sending, then compares
the receipt-block registry Config and curve's complete SDK encoding to the reviewed
calldata. The output contains the actual Config ID and hash. A successful creation must
never be repeated because a later read failed: reconcile its printed transaction first.
Use this confirmed Config ID with `launch:create-launch`; every token created from it
uses the same fixed partner recipient and its own launch creator. To use a different
partner recipient, preview and create a new Config.

## Inspect and claim fees


```bash
npm run launch:fee-sharing -- 'REPLACE_WITH_CONFIRMED_CONFIG_ID' 'REPLACE_WITH_PARTNER_RECIPIENT'
AMMORA_SEND=1 npm run launch:claim-fees -- 'REPLACE_WITH_FEE_ASSET' 'REPLACE_WITH_PAYOUT_RECIPIENT'
```


The claim example claims **the connected signer's entitlement**. The optional payout
recipient changes where that signer sends its proceeds; it does not select another
beneficiary or grant permission. Connect the `partnerRecipient` wallet for partner fees,
or the launch creator wallet for creator fees. Use the actual fee asset from the policy
and accrued events (often WETH, which is distinct from native ETH). Claimable balances
aggregate all launches for an asset/beneficiary. Inspect the event and receipt-block
balance increase for the actual payment. Graduated LP fees use `arl:claim-position-fee`
and the actual managed NFT ID; permanent principal locks remain in force.

The example uses shared CLI helpers. For a frontend, reuse the pure `policy.ts` planner
with a connected wallet and present the same policy/preview before requesting signatures.
See [the integration flow](https://docs.ammora.org/guides/src-launch-readme) and [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

## Different creator and partner wallets

The launch creator is the account that signs `launch:create-launch`. The partner fee
beneficiary is the Config's `partnerRecipient`; the Config owner is a separate role.
Set the partner address in the reviewed JSON, create the Config, then connect the
creator wallet to create the token. Each wallet needs native gas to claim, even when
its fees are WETH.

After trading, inspect both entitlements and run the claim command separately with each
wallet's privately configured signer:


```bash
npm run launch:fee-sharing -- 'REPLACE_WITH_CONFIG_ID' 'REPLACE_WITH_CREATOR_WALLET'
npm run launch:fee-sharing -- 'REPLACE_WITH_CONFIG_ID' 'REPLACE_WITH_PARTNER_WALLET'
# Run once connected as creator, then once connected as partner:
AMMORA_SEND=1 npm run launch:claim-fees -- 'REPLACE_WITH_QUOTE_TOKEN'
```


The example builds `claimFor(quoteToken, connectedAccount, payoutRecipient)`. Omitting
`payoutRecipient` pays that same account. Supplying another address redirects only the
connected account's entitlement. It never selects another fee beneficiary. The legacy
SDK `buildClaimFeeVault(token, recipient)` instead builds `claim(token, recipient)`,
which pays that recipient's own entitlement to that recipient; it cannot express this
alternate-payout operation. Unauthorized `claimFor` redirection is refused unless the
beneficiary explicitly granted a claim delegate. No delegate is granted by these examples.

See the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
for exact per-trade splits and both wallets' signed, receipt-backed payments.


## Claim to a different payout address

Connect the fee beneficiary's wallet and pass the destination as the second argument:


```bash
# Connected as creator; send only the creator's claim to a reviewed treasury address.
AMMORA_SEND=1 npm run launch:claim-fees -- 'REPLACE_WITH_QUOTE_TOKEN' 'REPLACE_WITH_CREATOR_PAYOUT_ADDRESS'
# Connected as partner; send only the partner's claim to its reviewed destination.
AMMORA_SEND=1 npm run launch:claim-fees -- 'REPLACE_WITH_QUOTE_TOKEN' 'REPLACE_WITH_PARTNER_PAYOUT_ADDRESS'
```


The signing wallet pays native gas and owns the claim. The payout wallet receives the
fee token (for example WETH); it does not need to sign this claim. Its own existing
FeeVault entitlement is separate and remains unchanged. This command does not change
any Config recipient or authorize a delegate. Verify the entire destination address
before signing: a completed payment cannot be redirected afterward.

Keep the transaction hash and successful canonical receipt. Check `ClaimedFor` **caller**
and **beneficiary** against the connected account, **recipient** against the reviewed
payout address, and **amount** against the payout address's receipt-block token balance
increase. The beneficiary's entitlement should become zero while the payout wallet's
own entitlement is preserved; native gas balance changes are not fee-token payments.

[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
validate creator → partner and partner → creator with distinct EOAs and existing WETH
balances. Use your own reviewed payout addresses rather than copying these test wallets.

LP fees support a separate destination through `arl:claim-position-fee -- <pool> <managerNftId> [payoutAddress]`.
See the [LP payout guide](https://docs.ammora.org/guides/src-arl-readme) for owner authority and actual receipt-block transfer proof.

## Atomic creation paths

The public SDK introduced `launch:create-config-and-pool-with-first-buy` in 0.3.7; it remains available in 0.3.8. This uses the GIWA SDK catalog without separate deployment files. Specify your team's recipient policy, amounts, and deadline explicitly. Install the public 0.3.8 package; no local SDK candidate is needed. See [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).

To combine a new Config, token creation, and first buy, follow [section 4-A](https://docs.ammora.org/guides/launchpad#atomic-first-buy) with `launch:create-config-and-first-buy`. It reads the same `team-recipients.json` and calls `planAtomicFirstBuy`, retained from 0.3.7. This path uses the same wallet for Config owner, Creator, and payer. For a separate Creator, use the guide's existing-Config path.
