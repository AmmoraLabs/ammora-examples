# DFS / AFS multi-recipient fees

Use [the fee-sharing guide](https://docs.ammora.org/guides/fee-sharing#multi-recipient-claims) for setup, funding, and claims. The public SDK supports one token per vault and 2–5 immutable recipients with relative integer weights.

| Action | Example / command | Sender |
| --- | --- | --- |
| Create from JSON | [sharing.example.json](https://docs.ammora.org/examples/source/src/dfs/sharing.example.json.txt), [create-json.ts](https://docs.ammora.org/examples/source/src/dfs/create-json.ts.txt): `dfs:create-json -- preview <sharing.json>` then `create <sharing.json> <reviewHash>` | Explicit owner matching `AMMORA_ACCOUNT` |
| Existing two-recipient CLI | [create.ts](https://docs.ammora.org/examples/source/src/dfs/create.ts.txt): `dfs:create` | Vault creator |
| Read balances and recipients | [state.ts](https://docs.ammora.org/examples/source/src/dfs/state.ts.txt): `dfs:state -- <vault>` | Read-only caller |
| Deposit a capped amount | [fund.ts](https://docs.ammora.org/examples/source/src/dfs/fund.ts.txt): `dfs:fund -- <vault> <maxAmountRaw>` | Funding wallet; approval and balance required |
| Claim to self/alternate payout | [claim.ts](https://docs.ammora.org/examples/source/src/dfs/claim.ts.txt): `dfs:claim -- <vault> <recipientIndex> [payoutAddress]` | That index's recipient |
| Inspect source setup | [delegated-funding-preflight.ts](https://docs.ammora.org/examples/source/src/dfs/delegated-funding-preflight.ts.txt): `dfs:delegated-funding-preflight -- <vault> <feeVault> <beneficiary>` | Read-only; never grants permissions |
| Pull configured source into vault | [fund-fee-vault.ts](https://docs.ammora.org/examples/source/src/dfs/fund-fee-vault.ts.txt): `dfs:fund-fee-vault -- <vault> <feeVault>` | Ready preflight only; permissions are configured separately |

`preview` never loads a key, even with inherited SEND=1. `create` requires the exact review hash and remains unsigned unless `AMMORA_SEND=1`. Set chain 91342 and generation `auto-route`; the JSON factory must match the reviewed SDK catalog. Replace the deliberately invalid recipient placeholders. A vault configured as Partner beneficiary does not automatically collect or fund its entitlement. Start with beneficiary claim → direct fund → recipient claim, then review source delegation if needed. A successful receipt alone is not net payout proof; reconcile events and receipt-block balances.

### Verify claim payment

`dfs:claim` reconciles a positive claim event, actual token transfer, and receipt-block balances before reporting `payoutVerified: true`. `recipientIndex` must fit ABI uint8 (0–255), and only the recipient registered at that index can claim. On read failure, use [read-only re-verification](https://docs.ammora.org/guides/fee-sharing), not another send.

## Connect revenue sources directly

Configure DFS-owner source registration separately from beneficiary/NFT-owner permissions. This flow was introduced with public SDK 0.3.7 and remains available in 0.3.8. `AMMORA_ACCOUNT` is each step's actual signing wallet; default to `AMMORA_SEND=0`.

| Step | Command | Caller |
|---|---|---|
| Source allow/revoke | `dfs:source -- <vault> <source.json> <allow\|revoke>` | DFS owner |
| FeeVault delegation | `fees:delegate -- <feeVault> <dfsVault> <allow\|revoke>` | Original beneficiary |
| Manager/Compounding permission | `dfs:position-permission -- <vault> <pool> <concentrated\|compounding> <nftId> <fee\|reward\|revoke>` | Actual NFT owner |
| Pull preview / execution | `dfs:fund-source -- <vault> <source.json>` | A recipient of that DFS |
| Claim distribution | `dfs:claim -- <vault> <recipientIndex> [payout]` | Recipient at that index |

Choose **one** required path in `source.json`.

```json
{"kind":"delegatedFeeVault","source":"REPLACE_WITH_FEE_VAULT","beneficiary":"REPLACE_WITH_BENEFICIARY"}
```

```json
{"kind":"compoundingFee","source":"REPLACE_WITH_COMPOUNDING_POOL","tokenId":"REPLACE_WITH_POOL_NFT_ID"}
```

```json
{"kind":"concentratedFee","source":"REPLACE_WITH_POSITION_MANAGER","sourceKind":"positionManager","tokenId":"REPLACE_WITH_MANAGER_NFT_ID","tokenIsBase":false}
```

```json
{"kind":"positionReward","source":"REPLACE_WITH_POOL_OR_MANAGER","sourceKind":"compounding","tokenId":"REPLACE_WITH_POOL_NFT_ID","index":0}
```

For an existing FeeVault entitlement owned directly by DFS, use `{"kind":"feeVault","source":"REPLACE_WITH_FEE_VAULT"}`. `positionReward.sourceKind` is `rawPool`, `positionManager`, or `compounding`; `concentratedFee.sourceKind` is `rawPool` or `positionManager`. Manager sources require the **Manager NFT ID**, not a pool NFT ID. The vault's fixed token must match the revenue token. A token allowed for rewards can still be rejected by DFS policy; check `DFSFactoryClient`/funding preflight separately. Deployments supporting per-token Concentrated claims preserve the opposite token's entitlement. Preview alone does not establish ABI support; simulation of the exact calldata must also pass.

Examples match sources against reviewed Factory/Manager/Pool contracts before SDK preflight. They do not automatically execute `setupTransactions`; the owner/beneficiary indicated by `expectedSetupSender` must review authority separately. Manager/Compounding commands set only fee=8 or reward=32 in a single delegate slot and refuse to replace a different delegate. Principal and NFT-transfer authority are excluded. `revoke` clears only this DFS's slot.

ERC721 approval allowing DFS to claim from a raw pool NFT grants **broad NFT authority**. The fee-only permission helper does not grant it automatically. Have the actual owner separately review raw NFT approval, or wrap into a Manager position and use restricted permissions. Source allowlisting alone grants no NFT authority.

Verify positive source funding by actual Transfer to the vault and receipt-block balance increase, then verify the recipient's `dfs:claim` separately. A zero-fee funding operation or source preview is not recipient payout. Revoke beneficiary/NFT permissions and source allowlisting independently after completion.

Compounding reward programs require at least **one day**, and the reward token must differ from **both** pool base and quote. Short test durations cause `InvalidReward`. Use an existing program with adequate rate and positive accrual, or a separate small test slot while recording remaining obligations and duration.

One NFT has one delegate slot. Do not configure different-token fee and reward vaults simultaneously on that NFT. Explicitly revoke the existing slot before switching to another token's vault. For concurrent operation, use separate positions or owner claim → direct deposits per token. These examples do not grant unnecessary combined fee+reward authority.

### Token policy across different registries

DFS and ARL Factory may use different registries. Standard classification or `rewardAllowed` in one does not propagate to the other. Verify each actual factory binding and policy.

For a reviewed test token that is **unclassified and has no owner policy** in the ARL registry, `dfs:register-source-token -- <pool> <concentrated|compounding> <token> <probeRaw>` uses the SDK's permissionless round-trip probe. Review registry, policy, and amount in default preview, then send with the same wallet and explicit SEND=1 if needed. Approve only the probe amount. The token sent to Registry must return exactly to that wallet; this is not revenue receipt.

This does not call `setPolicy`, `setRegistrar`, or aggregation admission. It rejects administrator-classified restrictions rather than bypassing them, leaves classified token policy unchanged, and does not guarantee future fee/callback/upgrade safety. Review implementation and controls before partner use. Reward pair exclusion, minimum duration, and DFS policy requirements remain separate.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) covers payments, rebalancing, permission denials, new-LP exits, and remaining reward/rounding state.
