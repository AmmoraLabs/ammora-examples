# From recipients to fee claims — SDK 0.3.9

Use this guide at the Config step of the [integrated launchpad guide](https://docs.ammora.org/guides/launchpad).
It uses the public `@ammora-protocol/sdk@0.3.9` for direct contract calls.
Choose recipients and the Creator/Partner split for a new Config, preview distributions before and after graduation, then follow the claim path for each role.

## Approval and review boundaries

Your team can choose permitted recipients and splits for its own **new** Config/vault and use supported own/delegated fee claims without per-partner Ammora approval. The actual beneficiary or feeOwner must authorize the caller and permitted payout; Config ownership, NFT approval and an issuer title do not automatically grant all fee rights. Alternate payouts depend on the specific claim API/grant. External weighted-module claims remain fixed to their beneficiary.

Changing an existing external-source module's weighted rights or recovering a stopped module has its own governance/affected-holder procedure. That is separate from ordinary owner-authorized FeeVault/LP delegate grants and revocations. Protocol fee settings and other people's rights remain restricted. See [partner permissions and review boundaries](PERMISSIONS.md).

## 1. Who configures and who claims?

| Role | Configuration | Claim authority / payout address |
| --- | --- | --- |
| Config owner | `configOwner` | Creates and administers the Config; does not automatically become every token's Creator or fee recipient |
| Creator | Creator selected at token creation | Receives the Creator share before graduation; may specify a separate payout address when claiming |
| Partner | `partnerRecipient` | Receives the Partner share before graduation; may differ from the Config owner and Creator |
| Partner LP recipient | `liquidityPartner` | Holds rights to the LP position allocated at graduation; may differ from the Partner trading-fee recipient |
| LP owner / delegate | Actual position owner / fee authority granted by the owner | Claims according to the NFT ID and permissions; changing payout does not transfer principal or NFT ownership |
| Multiple recipients | DFS/AFS vault `recipients[]` | Each recipient signs for their index to claim one deposited asset according to relative weights |

The signing EOA and payout address may differ. A contract wallet named as a beneficiary must be able to call the claim function. Accumulating assets for an address does not give you control of that address.

<a id="fee-config"></a>

## 2. Configure recipients and the Creator/Partner split

Complete installation, wallet and funding setup in the integrated guide first. On GIWA, ETH for gas and WETH for trading or deposits are separate balances. Reads and previews need no private key or funds.

```bash
export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
export AMMORA_SEND=0
export AMMORA_READ_RECEIPT=''

cp src/launch/team/fees.example.json team-fees.json
```

Replace the four address placeholders in `team-fees.json` with your team's actual addresses and choose `creatorShareOfNonProtocolBps`. The full JSON also includes the chain, registry, template ID and hash for review. Default template #6 is a Concentrated example; compare its hash and enabled status with `launch:get-config -- 6`.

| Field | Meaning |
| --- | --- |
| `configOwner` | Wallet that creates this new Config |
| `partnerRecipient` | Partner's trading-fee recipient before graduation |
| `liquidityPartner` | Partner's LP recipient after graduation |
| `leftoverReceiver` | Separate recipient for leftover tokens |
| `creatorShareOfNonProtocolBps` | Creator's share of fees after the Protocol share; integer 0–10000, with the remainder going to the Partner |

The example value `7000` means **70% of the non-Protocol share**, not 70% of trading volume. `10000` allocates all of that share to the Creator; `0` allocates it all to the Partner. This file cannot change the fixed Protocol share.

```bash
# Base/quote raw integers from the integrated guide; depends on token decimals.
SALE_SUPPLY_RAW='REPLACE_WITH_SALE_SUPPLY_RAW'
QUOTE_THRESHOLD_RAW='REPLACE_WITH_QUOTE_THRESHOLD_RAW'

npm run launch:fee-config -- preview team-fees.json "$SALE_SUPPLY_RAW" "$QUOTE_THRESHOLD_RAW"

# -s removes the npm banner. Document mode stdout is the full Config JSON.
npm run -s launch:fee-config -- document team-fees.json "$SALE_SUPPLY_RAW" "$QUOTE_THRESHOLD_RAW" > full-config.json

export AMMORA_ACCOUNT='REPLACE_WITH_CONFIG_OWNER'
npm run launch:config-json -- preview full-config.json
```

The first preview shows the completed Config, distribution and calldata. The last preview simulates the same calldata on GIWA through the existing `launch:config-json` path. Connect the owner wallet, review the **last preview's** reviewHash, then create the Config.

```bash
REVIEW_HASH='REPLACE_WITH_CONFIG_JSON_PREVIEW_HASH'
AMMORA_SEND=1 npm run launch:config-json -- create full-config.json "$REVIEW_HASH"
```

Save the Config ID, hash and receipt, then continue with token creation → trading → graduation in the [integrated guide](https://docs.ammora.org/guides/launchpad). Existing Configs remain unchanged. New recipients, ratios, amounts or thresholds require a new preview.

This convenience path is an **alternative** to `launch:team-config`. Recipient-only files, including the recipient-only atomic creation path, retain the template's Creator ratio. To use your selected ratio for atomic token creation plus the first buy, pass the Config ID you already created to `portable:existing-config-first-buy`. To create the Config in the same transaction too, use the reviewed `full-config.json` values as the full `config`/`segments` inputs to SDK `createConfigAndPoolWithFirstBuy`. Adding ratio fields to an existing recipient-only JSON is unsupported.

Trading fee rates, decay schedules, migration fees, LP allocations, locks and vesting remain those of the reviewed template. Use `launch:author-config` and the full Config JSON path to design LP ratios or lock policy. That is a separate economic design; this guide does not change existing permanent LP allocations or another team's recipients.

<a id="fee-preview"></a>

## 3. Read the before/after graduation preview

The following example assumes **10000 raw units of fees**.

| Scenario | Final Protocol amount | Referral | Direct Creator amount | Direct Partner amount | LP share |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before graduation, Creator BPS 7000, no referral | 2000 | 0 | 5600 | 2400 | 0 |
| Before graduation, same ratio, with referral | 1600 | 400 | 5600 | 2400 | 0 |
| After graduation, no referral | 2000 | 0 | 0 | 0 | 8000 |

Referral fees come from the Protocol share. Integer rounding follows SDK/contract calculations, so small raw amounts may differ from displayed percentages.

`distribution.beforeGraduation` shows the actual Creator/Partner formula. `afterGraduation` shows claimable and compounded LP shares. With `postMigrationCompoundingFeeBps=0`, all 8000 LP units in this example remain on the claim side; with `5000`, 4000 remain claimable and 4000 are compounded.

`initialLpAllocationBps` describes initial unlocked, permanently locked and vesting LP allocations. Creator unlocked is the remainder. Template #6 permanently locks Partner 6250 / Creator 3750 BPS, which the convenience path preserves. **Initial LP allocations do not guarantee future trading-fee yields.** Active price ranges, later liquidity, vesting, position type and compounding affect returns. Creators and Partners can earn from their LP after graduation, but the pre-graduation split is not reapplied.

Read the created Config without a key:

```bash
npm run launch:fee-sharing -- "$CONFIG_ID" "$CREATOR_WALLET"
npm run launch:fee-sharing -- "$CONFIG_ID" "$PARTNER_WALLET"
```

`claimableQuoteRaw` reads only the quote asset and aggregates multiple sources for the same beneficiary and asset. Do not display it as revenue from one particular launch. Creation fees, migration fees, surplus and leftovers are separate from the trading-fee table; their paths are linked in the integrated guide.

<a id="creator-partner-claims"></a>

## 4. Creator and Partner claims

Run each claim with **the beneficiary's own wallet**. Payout selects the receiving address and does not replace claim authority. The claim CLI requires a signing wallet; use `launch:fee-sharing` above for initial reads. Keep private keys in your local environment, never in JSON, source or shared logs.

The following commands reuse values saved in the [integrated guide](https://docs.ammora.org/guides/launchpad). `AMMORA_READ_RECEIPT=''` also overrides stale receipt pins in a local `.env`. Switching roles means switching the actual connected wallet; `AMMORA_ACCOUNT` only identifies the caller for unsigned operations.

| Variable | Source |
| --- | --- |
| `CONFIG_ID`, `TOKEN`, `QUOTE_TOKEN`, `POOL` | Your Config, creation and migration receipts and curve state; keep chain and generation consistent |
| `CREATOR_WALLET`, `PARTNER_WALLET` | Actual Creator and Config `partnerRecipient` |
| `PAYOUT` | Reviewed payout address; if omitted, the CLI's default destination applies |
| `FEE_VAULT`, `FEE_TOKEN` | `feeVault` from `launch:fee-sharing` and the asset being claimed: quote or launched token |
| `MANAGER_NFT_ID`, `DELEGATE` | Actual Concentrated Manager NFT ID and delegate selected by the owner |
| `DFS_VAULT`, recipient index | Successful DFS creation receipt and actual vault/recipient array from `dfs:state` |

Do not copy another team's addresses or historical test NFT IDs from examples or validation reports. First set `PAYOUT='REPLACE_WITH_REVIEWED_PAYOUT_ADDRESS'` to your own reviewed destination.

```bash
# Connect Creator wallet; later switch to Partner to claim each entitlement separately.
AMMORA_SEND=1 npm run launch:claim-fees -- "$QUOTE_TOKEN" "$PAYOUT"
AMMORA_SEND=1 npm run launch:claim-fees -- "$TOKEN" "$PAYOUT"
```

Omitting payout sends to yourself. Claiming quote/WETH does not also claim the launched token. A zero claim is not a successful payment. Do not resend a successful or unknown hash: reconcile the receipt, canonical block, events and recipient balance increase at that block first. This CLI verifies the ClaimedFor event and actual recipient balance at the receipt block.

<a id="lp-fee-claims"></a>

## 5. LP owner and delegate claims

For Concentrated positions, the ID is the **Position Manager NFT ID**, not the pool's internal position ID. Check the actual owner and ID with `launch:migration-positions` and `arl:get-user-positions`. Choose the owner claim, owner-only payout delegation or separate-payout delegation path for your purpose. Do not run all three against the same accrued fees and count each as a payment.

```bash
# NFT owner: send fees to a separate payout
AMMORA_SEND=1 npm run arl:claim-position-fee -- "$POOL" "$MANAGER_NFT_ID" "$PAYOUT"

# NFT owner: allow one delegate to claim only to the owner
AMMORA_SEND=1 npm run arl:fee-delegate -- "$POOL" "$MANAGER_NFT_ID" "$DELEGATE" claim-fee-to-owner

# Switch to delegate wallet. Omitting payout pays the NFT owner.
AMMORA_SEND=1 npm run arl:claim-position-fee -- "$POOL" "$MANAGER_NFT_ID"

# To allow separate payouts, NFT owner must choose the following permission.
AMMORA_SEND=1 npm run arl:fee-delegate -- "$POOL" "$MANAGER_NFT_ID" "$DELEGATE" claim-fee

# Delegate wallet: pay a separate address
AMMORA_SEND=1 npm run arl:claim-position-fee -- "$POOL" "$MANAGER_NFT_ID" "$PAYOUT"

# Return to NFT owner and revoke after use
AMMORA_SEND=1 npm run arl:fee-delegate -- "$POOL" "$MANAGER_NFT_ID" revoke
```

These permission changes replace the existing delegate slot. A `claim-fee-to-owner` grant rejects another payout address, and an unauthorized wallet cannot claim. Selecting a payout does not unlock LP principal or transfer the NFT. The LP CLI checks simulation and receipt payout events; confirming actual payment also requires per-asset receipt-block balance reconciliation. Existing GIWA validation preserves that reconciliation.

For Compounding positions, use `arl:claim-compounding-fees -- <pool> <directPositionId>`. Set `AMMORA_ACCOUNT` to the actual owner and preview unsigned before sending. This CLI fixes payout to the connected wallet. Do not apply the Concentrated Manager NFT delegation example to a Compounding ID.

<a id="multi-recipient-claims"></a>

## 6. Split revenue among 2–5 team wallets

Use the JSON creation path in the [DFS/AFS examples](https://docs.ammora.org/guides/src-dfs-readme). A new vault distributes **one fee token** to **2–5 distinct addresses** with immutable relative weights. `50/30/20` and `5/3/2` express the same proportions; weights need not sum to 10000 BPS. Use positive integer strings with total weight no greater than uint32. A different recipient or weighting policy requires a new vault.

```bash
cp src/dfs/sharing.example.json sharing.json
# Replace owner/token/base/recipients/userSalt with actual values.
# Factory is the public SDK 0.3.9 GIWA auto-route catalog address.
export AMMORA_ACCOUNT='REPLACE_WITH_VAULT_CREATOR'
npm run dfs:create-json -- preview sharing.json
AMMORA_SEND=1 npm run dfs:create-json -- create sharing.json 'REPLACE_WITH_SHARING_REVIEW_HASH'
```

`base` is the logical source token; `token` is the asset actually distributed. Use a fresh bytes32 `userSalt` and do not recreate a vault that already exists for the same owner/base/token/salt. Compare preview `predictedVault` with the successful receipt, then inspect the vault, asset, recipient indices and shares through `dfs:state`.

The simplest funding flow is **Creator/Partner claims their share → funds DFS with the received asset → each recipient claims**. If the original claim used a separate payout, that **payout wallet** holds the asset and must fund the vault. `MAX_AMOUNT_RAW` is the maximum integer amount of that fee token to deposit; it is separate from native ETH for gas.

```bash
DFS_VAULT='REPLACE_WITH_VAULT_FROM_SUCCESSFUL_CREATION_RECEIPT'
MAX_AMOUNT_RAW='REPLACE_WITH_REVIEWED_FEE_TOKEN_RAW_AMOUNT'
export AMMORA_ACCOUNT='REPLACE_WITH_FUNDING_WALLET'
npm run dfs:state -- "$DFS_VAULT"
npm run dfs:fund -- "$DFS_VAULT" "$MAX_AMOUNT_RAW"
AMMORA_SEND=1 npm run dfs:fund -- "$DFS_VAULT" "$MAX_AMOUNT_RAW"

# Connect the wallet at index 0 of recipients
export AMMORA_ACCOUNT='REPLACE_WITH_RECIPIENT_0'
npm run dfs:claim -- "$DFS_VAULT" 0 "$PAYOUT"
AMMORA_SEND=1 npm run dfs:claim -- "$DFS_VAULT" 0 "$PAYOUT"
```

Switch to each other recipient wallet to claim its own index. Funding is capped and checks approvals, balances and token policy. Do not execute if the approving wallet differs from `AMMORA_ACCOUNT`. Gas ETH is also required.

DFS previews show gross amounts; transfer fees can reduce net receipts. `dfs:claim` and `launch:claim-fees` reconcile the successful transaction's caller/calldata, claim events, ERC-20 transfers and balances before/at the receipt block, then output `payoutVerified: true`. `grossAmount` is the gross claim; `netAmount` is the actual receipt. Other transfers in the same block appear separately as `otherBlockTransferDelta`; do not interpret `blockBalanceDelta` as the claim amount. A zero claim is not a successful payment.

<a id="verify-payment"></a>

### Verify transfers and balances without resending

If RPC access or verification fails after submission, do not resend the claim. Run this **read-only** command with the printed transaction hash. It needs no private key and never signs or sends, even with `AMMORA_SEND=1`.

```bash
AMMORA_SEND=0 AMMORA_PRIVATE_KEY= AMMORA_READ_RECEIPT= npm run fees:verify-claim -- \
  launch "$CLAIM_TX_HASH" "$FEE_VAULT" "$FEE_TOKEN" "$BENEFICIARY" "$PAYOUT"
AMMORA_SEND=0 AMMORA_PRIVATE_KEY= AMMORA_READ_RECEIPT= npm run fees:verify-claim -- \
  dfs "$CLAIM_TX_HASH" "$DFS_VAULT" "$FEE_TOKEN" "$BENEFICIARY" "$PAYOUT" 0
```

This command covers `claimFor` / `claimTo` transactions sent directly by the beneficiary. `CLAIM_TX_HASH` is the already-submitted hash; `BENEFICIARY` is the signing recipient. For DFS, provide the vault's actual token and recipient index; the final `0` is only the index-zero example. GIWA auto-route configuration is unchanged; the vault is checked against the catalog factory at the relevant block. LP, delegated-contract and batch claims use their respective LP verification paths. Missing historical state or token behavior that cannot be reconciled with standard ERC-20 transfer logs leaves verification incomplete; it does not justify another send.

Setting a vault as `partnerRecipient` does not automatically deposit or distribute funds. To connect an existing FeeVault as a source, review `expectedSetupSender` and permissions from `dfs:delegated-funding-preflight -- <vault> <feeVault> <beneficiary>`. `dfs:fund-fee-vault` requires source setup and authority in advance; it grants neither automatically. Start with explicit claim → fund when integrating for the first time.

## Validation scope

Read [current validation](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) before using historical test targets.

## FeeVault delegation, DFS sources and batch claims

- [FeeVault beneficiary delegation and separate payout](https://docs.ammora.org/guides/src-fees-readme): `fees:delegate` → `fees:claim-delegated` → revoke.
- [Connect DFS revenue sources](https://docs.ammora.org/guides/src-dfs-readme#connect-revenue-sources-directly): owner allows source → beneficiary/NFT permission → `dfs:fund-source` → recipient claim → remove permission/source.
- [FeeVault, ARL and ALMM batch claims](https://docs.ammora.org/guides/src-fees-readme#execute-multiple-requests-sequentially): multiple transactions with progress records, distinct from FeeVault owner/operator-only `batchClaim`.
- [ALMM rebalancing](https://docs.ammora.org/guides/src-almm-readme#rebalance-an-existing-position): change LP principal allocation by specifying bin shares, inputs and refunds.

Existing Creator/Partner/LP payment evidence remains reusable only within its original scope. Consult separate validation reports for each new path; unsigned previews and zero-fee calls are not positive payments.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) records actual payouts, rebalancing, authority rejections, recovery of new LP principal, and remaining rewards/rounding state.
