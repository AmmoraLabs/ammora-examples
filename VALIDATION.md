# Validation — public SDK 0.3.8

Reviewed 2026-11-04 KST. These are GIWA Sepolia (91342) contract examples for controlled test assets. They do not certify a partner’s assets, roles, funds, metadata hosting or mainnet readiness.

## Connected agent lifecycle

A fresh source project used the public npm SDK 0.3.8 and the same connected helper files shipped here. The host supplied the controlled signer, explicit session limits and approval for each actual allowance/business plan. No customer account or individual Ammora Config approval was used.

Config **#24** → new test token → pre-graduation buy/sell → terminal partial fill → separate Graduation → graduated-pool buy/sell → own quote/base FeeVault and LP fee claims completed. There were **16 unique canonical transactions: 11 business actions and 5 approvals**, nonces **1953–1968**. Final latest and pending nonces both equaled **1969**. Receipts were canonical with at least 13 confirmations; this is not a claim of finalized status.

- Token: `0x00452E076ED201927cF0bE9004Ef087740D69159`
- Curve: `0xa1E8b1564Fcb1AEFc60EC03021e917614d856726`
- Pool: `0x5619126A82008Ee98b79353bf9114bfD9F3bD050`
- Claimed LP NFT: `#32`

| Action | Nonce | Canonical transaction |
| --- | --- | --- |
| config | 1953 | [0xa3f0ee7d3a4dce17ae21fbdc2ac179e6ac42af37e32a861787ea7ce9c2937ad0](https://sepolia-explorer.giwa.io/tx/0xa3f0ee7d3a4dce17ae21fbdc2ac179e6ac42af37e32a861787ea7ce9c2937ad0) |
| launch | 1954 | [0x6e67eba76c86d31a6868ab28bae97a72ffe4a8777f6c8c3ace01b4af0e090448](https://sepolia-explorer.giwa.io/tx/0x6e67eba76c86d31a6868ab28bae97a72ffe4a8777f6c8c3ace01b4af0e090448) |
| Exact ERC20 allowance | 1955 | [0xe7cf1deeecb63a7afff36d893baac463ec9fd2f47f022f9ed17844de84b0d61e](https://sepolia-explorer.giwa.io/tx/0xe7cf1deeecb63a7afff36d893baac463ec9fd2f47f022f9ed17844de84b0d61e) |
| curve-buy | 1956 | [0xcf4d6186e10804f2904c9154da72421fbf0d39d5d5adcd172a7b93560d463694](https://sepolia-explorer.giwa.io/tx/0xcf4d6186e10804f2904c9154da72421fbf0d39d5d5adcd172a7b93560d463694) |
| Exact ERC20 allowance | 1957 | [0x6a98e9f9a103e392f981cfa5f0276b00e778807fb5b99a42353446e0a314c84a](https://sepolia-explorer.giwa.io/tx/0x6a98e9f9a103e392f981cfa5f0276b00e778807fb5b99a42353446e0a314c84a) |
| curve-sell | 1958 | [0x6737bb53d7e0a19c7c94cd0b3584832dedf6b7c00e50b1d176d9e45cc7f0943a](https://sepolia-explorer.giwa.io/tx/0x6737bb53d7e0a19c7c94cd0b3584832dedf6b7c00e50b1d176d9e45cc7f0943a) |
| Exact ERC20 allowance | 1959 | [0x84e0ce23dcba6ad4a3cf39522c295ba956ac33d724308fbbf1247458ba4792b1](https://sepolia-explorer.giwa.io/tx/0x84e0ce23dcba6ad4a3cf39522c295ba956ac33d724308fbbf1247458ba4792b1) |
| final-fill | 1960 | [0x5f9b44689e75c3a2daab8199fb6a1110c343556b8a2aaae4f0b60813cc912ccb](https://sepolia-explorer.giwa.io/tx/0x5f9b44689e75c3a2daab8199fb6a1110c343556b8a2aaae4f0b60813cc912ccb) |
| migrate | 1961 | [0x260103152c4a3315964b509d478e0cb6533cd6886c464a479c480c33213997f5](https://sepolia-explorer.giwa.io/tx/0x260103152c4a3315964b509d478e0cb6533cd6886c464a479c480c33213997f5) |
| Exact ERC20 allowance | 1962 | [0x502332f453d56d03cc9c8b0c5fc06acd4fcbe1251a0b8d8cbbfba27a6d137e25](https://sepolia-explorer.giwa.io/tx/0x502332f453d56d03cc9c8b0c5fc06acd4fcbe1251a0b8d8cbbfba27a6d137e25) |
| pool-buy | 1963 | [0xfaeacd31903818ddf5327c16eab3e15ada26203bb00984a0671c27cecaf26eec](https://sepolia-explorer.giwa.io/tx/0xfaeacd31903818ddf5327c16eab3e15ada26203bb00984a0671c27cecaf26eec) |
| Exact ERC20 allowance | 1964 | [0xa3b65999021297865bd471042178066ff06219a22725288e39edadb6ca2e03d1](https://sepolia-explorer.giwa.io/tx/0xa3b65999021297865bd471042178066ff06219a22725288e39edadb6ca2e03d1) |
| pool-sell | 1965 | [0x2355a798d76da53b4b68fb5596af7436733cdf42949cf37634a61efe1e63e841](https://sepolia-explorer.giwa.io/tx/0x2355a798d76da53b4b68fb5596af7436733cdf42949cf37634a61efe1e63e841) |
| claim-own-quote | 1966 | [0x1a5013cb4a8c03d2c71b0ba5ba1973b36bfba40c3750ac107d0d7690f626a897](https://sepolia-explorer.giwa.io/tx/0x1a5013cb4a8c03d2c71b0ba5ba1973b36bfba40c3750ac107d0d7690f626a897) |
| claim-own-base | 1967 | [0x17db81ae16b7857c5124308f30a0ebd45c140de6e867533fe227b4158de59f32](https://sepolia-explorer.giwa.io/tx/0x17db81ae16b7857c5124308f30a0ebd45c140de6e867533fe227b4158de59f32) |
| claim-lp | 1968 | [0xbed49c2559b7841fdb97808ea64c42b24765ff2ae03765c2ee67a908b311be8d](https://sepolia-explorer.giwa.io/tx/0xbed49c2559b7841fdb97808ea64c42b24765ff2ae03765c2ee67a908b311be8d) |

## Actual payment evidence

All three claims had positive transfer/event evidence and receipt-block balance increases. Zero-fee no-ops were not counted as payments.

| Claim | Actual received amount (raw units) | Result |
| --- | --- | --- |
| claim-own-quote | WETH 1218880509795 | PASSED_THIS_RUN |
| claim-own-base | Base 20408163 | PASSED_THIS_RUN |
| claim-lp | Base 49999; WETH 4999999 | PASSED_THIS_RUN |

The Config Creator and Partner shared the controlled test wallet. Quote-token FeeVault credits can include several launches: the WETH claim is an aggregate beneficiary/token payout, not revenue attributed solely to this token. Distinct Creator/Partner wallets, separate payouts, multi-recipient distribution and delegated LP authority are covered by reused evidence within their original deployments, callers, assets and receipt blocks. They were not falsely counted as new transactions in this run.

LP ownership and total unlocked/vested/permanently locked principal were read after claims and matched the migration receipts. The original permanent LP ratios were retained; no locked principal was withdrawn.

## Temporary read failures and recovery

Original public-RPC canonical-block lookup failures are retained. The Config and two allowance attempts were reconciled under their original hashes before continuation; none was resent. The final helper retries a temporary canonical-block read at most once and returns structured `readFailures`. A second failure stops with INCOMPLETE and preserves the nonce hold. Canonical mismatches and authority errors propagate.

During the final continuation, the quote claim recorded one transient missing-block read and then confirmed the same original hash. No extra signature was requested for the read retry. Local boundary tests cover both successful recovery and stopping after two failed reads.

A diagnostic initially looked for a nonexistent single `liquidity` field. The corrected closeout sums the ABI’s unlocked, vested and permanently locked fields. The diagnostic failure remains preserved; it was not a contract or payout failure. A transient local evidence-write failure also remains recorded; write capability recovered before closeout.

## Allowance state

At block 40382758, the terminal partial fill left **999854498650 raw WETH allowance** to the graduated test curve. The duplicate observer rows refer to the same token/spender pair. Automatic cleanup was not submitted or claimed complete. Review an owner-controlled zero-allowance transaction separately; revoking an agent session does not revoke ERC20 allowances. Pool trade approvals were consumed. Keep this distinction when integrating your own wallet lifecycle.

## Software and reuse scope

| Gate | Classification | Scope |
| --- | --- | --- |
| Current connected lifecycle and positive claims | PASSED_THIS_RUN | 16 canonical transactions, 3 positive claims |
| Final nonce, allowances and LP principal reads | PASSED_THIS_RUN | Read-only closeout, no new signatures |
| Current helper regression cases | PASSED_THIS_RUN | 12 cases, including single-read retry and no duplicate send |
| Existing unaffected offline cases | REUSED | 170 cases after source/input/SDK integrity review |
| Runtime-pin decoding boundaries | PASSED_THIS_RUN | 3 cases after public provenance-label cleanup; actual pins unchanged |
| Root and extension type safety | REUSED | Qualified source and npm SDK/Math artifacts; source changes invalidate affected checks |
| Prior atomic first-buy, distinct-wallet fees and LP delegation | REUSED | Original runtime, caller, asset and block scope only |
| Public service API / Indexer integration | NOT_APPLICABLE | These examples call contracts through configured RPC |
| GitHub CI, SDK publication, mainnet or backend deployment | NOT_APPLICABLE | Excluded from this release |

The qualified software scope totals **185 distinct offline cases**: 170 unchanged cases reused, plus the current 12 helper and 3 runtime-pin cases. No duplicate full-suite execution is claimed.

A command being included does not grant a contract role or establish asset admission. Valid launchpad Config creation is permissionless; factory token-policy and administrator actions keep their on-chain authority checks. Issuer addresses and off-chain metadata hosting remain partner inputs.

Source, SDK artifacts, chain/deployment, policy, input assets, claimant/payout authority or canonical receipt changes invalidate the affected evidence. Historical receipts, original failures and operational records remain preserved separately. Public publication and anonymous installation are separately qualified delivery steps; local checks alone do not prove them.
