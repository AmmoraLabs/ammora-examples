# Validation — SDK 0.3.9

## SDK 0.3.9 compatibility and fee-routing release

The current package pin is SDK **0.3.9** and Math **0.3.0**. Fee readiness, delegation, revocation and separate-payout planners are official SDK exports; `extensions/almm-unified/fee-claims-compat.ts` retains only re-exports. Install the public npm package; the deployment profile remains explicit.

- **PASSED_THIS_RUN:** final physical archive consumer,190 downstream declaration imports, fresh example project types, unified types,185 existing cases and3 official-export cases. The actual anonymous registry install and locked 188-case example suite passed; default versionless installation also selected 0.3.9.
- **REUSED:** unchanged GIWA lifecycle, Creator/Partner/multiple-recipient and LP delegation/denial proofs below, and the qualified43-transaction ALMM fee-routing flow. No past transaction is replayed.
- **PASSED_THIS_RUN:** official0.3.9 historical ALMM planners and current runtime checks;91 read-only RPC items rechecked both fixed/explicit-any claim receipts and actual recipient balance increases. This is fresh reconciliation of existing payments, not new payouts.
- **NOT_APPLICABLE:** GitHub CI, new contract deployments, mainnet and production API/Indexer changes.
- **BLOCKED:** official issuer assets without confirmed GIWA addresses, token-control review and funding; synthetic tests do not certify an issuer.

Reuse requires unchanged relevant source/runtime/declaration/deployment/receipt identities and intact evidence. The original failures and historicalSDK0.3.8 execution scope remain below.

## Fresh SDK 0.3.9 GIWA fee-only delegation and cleanup

A fresh project used the actual public npm SDK 0.3.9, official fee-routing exports and the same extensions/almm-unified planners/proof helper. The explicit version-1 profile was checked before signing. Only a new controlled, unlocked synthetic LP NFT #7 in pool 0x7b3a0194597b7E8e159C3A48393a8E16c88898e2 was used. Existing NFTs and permanent LP were untouched; no new deployment or governance change was made.

**PASSED_THIS_RUN:** 19 unique canonical successful transactions, nonces 1969–1987; final latest/pending nonce 1988. Actual native fees totaled 706701737 wei, within the 50000000000000 wei cap. Receipts had at least 13 confirmations at observation; this is not a finalized-status claim.

The flow covered bounded approvals, LP creation, swaps in both directions, fixed-payee fee-only delegation and payout, single-grant revocation, explicit-any-payee delegation and payout, revoke-all, full principal exit and empty-NFT closure.

| Claim | Canonical transaction | Actual base increase (18 decimals, raw) | Actual quote increase (6 decimals, raw) | Result |
| --- | --- | --- | --- | --- |
| Fixed separate payout | [0xdbfcfbe41c6d2156b8ab1505605f8c5e5b7c2a8855533756dd8c492000a85d10](https://sepolia-explorer.giwa.io/tx/0xdbfcfbe41c6d2156b8ab1505605f8c5e5b7c2a8855533756dd8c492000a85d10) | 1799999999999 | 1 | PASSED_THIS_RUN |
| Explicit-any payout | [0xc92534aad43f413ce1ce3f747898acbf34fabebda16eff5efd3697129e483c03](https://sepolia-explorer.giwa.io/tx/0xc92534aad43f413ce1ce3f747898acbf34fabebda16eff5efd3697129e483c03) | 1799999999999 | 1 | PASSED_THIS_RUN |

Each proof independently matched the RewardManager claim event (pool/NFT/caller/recipient), ERC20 Transfers and recipient balance differences between receipt block−1 and receipt block. Both assets increased; a zero-fee no-op was not counted as payment. Assets are controlled, valueless test tokens, not official issuer assets.

**PASSED_THIS_RUN:** 9 typed live-chain eth_call authority rejections: unauthorized-wallet claims; fixed delegate with a wrong payee; fee delegate trying principal withdrawal, NFT transfer or owner-grant revocation; and claims after single/all-grant revocation. These are real chain simulations, not nine reverted broadcasts. Granting fee-only rights did not grant principal or NFT approval.

**PASSED_THIS_RUN:** full new-position cleanup: both principal assets returned, NFT #7 burned, its shares/bin count zero, all four task-specific token allowances to Pool/Manager zero, and fee-controller/delegate token custody zero. The shared signer lease was released only after canonical closeout. This does not claim all allowances of the wallet are zero; the older graduated-curve allowance retains its original scope.

| Step | Nonce | Canonical transaction |
| --- | --- | --- |
| 01-approve-manager-base | 1969 | [0xe85ba9a8549b3291697c075b7c9b32168d03d6ebc7f67339b56e0ae1a0642d0d](https://sepolia-explorer.giwa.io/tx/0xe85ba9a8549b3291697c075b7c9b32168d03d6ebc7f67339b56e0ae1a0642d0d) |
| 02-approve-manager-quote | 1970 | [0x8f721bde106ca00a1f45b576a8b1343b82da0e9cdbded4b3c24691ecbc44ded3](https://sepolia-explorer.giwa.io/tx/0x8f721bde106ca00a1f45b576a8b1343b82da0e9cdbded4b3c24691ecbc44ded3) |
| 03-seed | 1971 | [0x4c2ea0a2737b9bbdf0896665b27d43afefe860d5b904046ac56aa570a9e77045](https://sepolia-explorer.giwa.io/tx/0x4c2ea0a2737b9bbdf0896665b27d43afefe860d5b904046ac56aa570a9e77045) |
| 04-approve-pool-base | 1972 | [0x03d27b8ae4ca5f8afea1959165cb91db2997d3a89fd28138598f1fa390ab8f0c](https://sepolia-explorer.giwa.io/tx/0x03d27b8ae4ca5f8afea1959165cb91db2997d3a89fd28138598f1fa390ab8f0c) |
| 05-swap-base | 1973 | [0x547b0059ce43bf4a6a65dfe3c960b1ad33bcbc7e0fc95307bb299f8271dfe9e9](https://sepolia-explorer.giwa.io/tx/0x547b0059ce43bf4a6a65dfe3c960b1ad33bcbc7e0fc95307bb299f8271dfe9e9) |
| 06-approve-pool-quote | 1974 | [0x6e24c6a5097f6dcaed461fb6278968ee2b8b9ce7a05eb3dbac6cfd213e0f5519](https://sepolia-explorer.giwa.io/tx/0x6e24c6a5097f6dcaed461fb6278968ee2b8b9ce7a05eb3dbac6cfd213e0f5519) |
| 07-swap-quote | 1975 | [0xf4cc172408430c12ece33b2ea3cb97c44ce3dc860c4c8ffe3f2d941d5103c2c2](https://sepolia-explorer.giwa.io/tx/0xf4cc172408430c12ece33b2ea3cb97c44ce3dc860c4c8ffe3f2d941d5103c2c2) |
| 08-grant-fixed | 1976 | [0x638ba106c5694d523c4f2bafd7139cdc6a2684020763182792ccb177db1481aa](https://sepolia-explorer.giwa.io/tx/0x638ba106c5694d523c4f2bafd7139cdc6a2684020763182792ccb177db1481aa) |
| 09-claim-fixed | 1977 | [0xdbfcfbe41c6d2156b8ab1505605f8c5e5b7c2a8855533756dd8c492000a85d10](https://sepolia-explorer.giwa.io/tx/0xdbfcfbe41c6d2156b8ab1505605f8c5e5b7c2a8855533756dd8c492000a85d10) |
| 10-revoke-one | 1978 | [0xd5e6f07ac3ed632453f0624eea5cb671389c794cb1200c0c47d948074ec61349](https://sepolia-explorer.giwa.io/tx/0xd5e6f07ac3ed632453f0624eea5cb671389c794cb1200c0c47d948074ec61349) |
| 11-grant-any | 1979 | [0x025372c2d842e4c821407b2116fa6bd48c7b09cc33dd7123f991d6ba07f84176](https://sepolia-explorer.giwa.io/tx/0x025372c2d842e4c821407b2116fa6bd48c7b09cc33dd7123f991d6ba07f84176) |
| 12-approve-pool-base | 1980 | [0x47e9b26d9c19fe7553d6ae8f416cbf556dca76c3f8f9216c96f25f8687d6800d](https://sepolia-explorer.giwa.io/tx/0x47e9b26d9c19fe7553d6ae8f416cbf556dca76c3f8f9216c96f25f8687d6800d) |
| 13-swap-base | 1981 | [0xf1d9a79357a6dd08b48680e475eb0b3f6a7f14852b19badf3cab715782d4c964](https://sepolia-explorer.giwa.io/tx/0xf1d9a79357a6dd08b48680e475eb0b3f6a7f14852b19badf3cab715782d4c964) |
| 14-approve-pool-quote | 1982 | [0x44b18ea542cc42a47ac2e825fb60db06cb9b9030179257fd376df2539c81648d](https://sepolia-explorer.giwa.io/tx/0x44b18ea542cc42a47ac2e825fb60db06cb9b9030179257fd376df2539c81648d) |
| 15-swap-quote | 1983 | [0xe4351d56d57cbf3c3958737308e25a33909a86e16ec1da894b0799f538cfe3d9](https://sepolia-explorer.giwa.io/tx/0xe4351d56d57cbf3c3958737308e25a33909a86e16ec1da894b0799f538cfe3d9) |
| 16-claim-any | 1984 | [0xc92534aad43f413ce1ce3f747898acbf34fabebda16eff5efd3697129e483c03](https://sepolia-explorer.giwa.io/tx/0xc92534aad43f413ce1ce3f747898acbf34fabebda16eff5efd3697129e483c03) |
| 17-revoke-all | 1985 | [0x22872d9c8ed15f09d43a06a69f0fead0e6acfe799882a689a2c0008923505ba0](https://sepolia-explorer.giwa.io/tx/0x22872d9c8ed15f09d43a06a69f0fead0e6acfe799882a689a2c0008923505ba0) |
| 18-exit | 1986 | [0xf49530d20979b107a25da1ebad3bbd4ed484c02c4e205c08bc6c469708f831cf](https://sepolia-explorer.giwa.io/tx/0xf49530d20979b107a25da1ebad3bbd4ed484c02c4e205c08bc6c469708f831cf) |
| 19-close | 1987 | [0x192c328d0f2cbda99f17698245942c302e970d1b3d71e66f0f11f31560fa9d41](https://sepolia-explorer.giwa.io/tx/0x192c328d0f2cbda99f17698245942c302e970d1b3d71e66f0f11f31560fa9d41) |

Original nonce-diagnostic and receipt/header disagreement failures were retained. The original hashes were reconciled under the canonical header and exact-block state before continuation; no successful or unknown transaction was resent. Earlier historical fee/LP proofs remain REUSED, never counted as new payments.

See [current module availability and deployment requirements](SDK-STATUS.md). Owned synthetic self-service now has49 canonical transactions: full runtime/consent checks, two active standards, three direct controller registrations, actual waiting/denial and valueless inventory checks; [remaining live gates](docs/SELF-SERVICE-VALIDATION.md) are module activation after2026-11-04T08:38:09Z and actual trade/payment/cleanup closure. Real-standard review and official issuer onboarding remain separate BLOCKED prerequisites.

## Preserved SDK 0.3.8 lifecycle execution

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
