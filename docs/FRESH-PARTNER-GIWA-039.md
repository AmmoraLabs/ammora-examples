# Fresh partner execution — public SDK 0.3.9

On **2026-11-05 KST**, a new anonymous source project followed the [Korean partner introduction](https://docs.ammora.org/guides/partner-intro-ko) and its product guides. Public npm SDK **0.3.9** ran against **GIWA Sepolia (91342)** without a customer invitation or per-Config Ammora approval. Actual writes used an explicitly approved, controlled test wallet and a durable signer journal. This is a controlled partner-role test, not qualification of a real issuer or independent custody.

The supported launchpad/agent lifecycle completed **18 unique canonical successful transactions**, nonces **2092–2109**. Final latest and pending nonce were **2110**. Creator/Partner FeeVault and two LP claims matched payment events, token Transfers and exact receipt-block balance increases. No public SDK or executable-example change was needed.

## Product-by-product result

| Product | Newly executed in this project | Reused evidence and limits |
| --- | --- | --- |
| Launchpad | Deployment/Explorer gate, Config list/read, new Config #25, token issuance, curve buy/sell, terminal partial fill, Graduation, pool buy/sell | Existing atomic first-buy and other unchanged Config variants retain their original receipts. |
| Agent | Tool schemas, keyless live smoke, public `connectAgent` + `runLaunchpadWalkthrough` + reviewed per-step execution, allowance prerequisites and durable receipt reconciliation | A trusted host supplies its own signer, policy and owner review. Installing tools grants no signing rights. |
| Fee sharing | Config preview/state; real own WETH and new-token FeeVault payouts; real LP #35/#37 payouts; foreign FeeVault/LP caller refusals | Existing distinct-wallet Creator/Partner/multi-recipient and fee-only LP delegation, separate-payee and revocation proofs are REUSED. Current role addresses share one physical signer. |
| Issued stablecoin pool | Actual unified `policy` and `discover` CLI against reviewed synthetic 18/6-decimal assets and explicit `giwa-almm-unified-v1` profile | Prior synthetic pool/LP/swaps/delegated payouts/denials/exit are REUSED, not sent again. This does not certify FDUSD, cUSD, USDT, a peg or a live price oracle. |
| External revenue | Actual `partner:standards` CLI and enabled-standard discovery | Prior fresh nongovernance partner registration, actual delayed activation, two trades, six positive 20:48:32 payments, typed refusals and cleanup are REUSED. Completed modules remain stopped. Arbitrary source implementations still need review. |
| Token vesting | Actual offline allocation and live inspection of the documented completed public lock | Existing supported creation/claim evidence is REUSED. The completed lock has zero claimable and supplies no new payment to a new partner. |

All ten documented keyless commands and both unified stablecoin planner commands exited successfully. `quickstart:verify` checked **30 deployed contracts**, including Explorer source verification. A separate exact public Config call simulated successfully from a nongovernance public address; this was an unsigned simulation, not a new persisted Config from that address.

## New launch and positive payments

- Config: **25**
- Token: `0xeFD0b74cB733534D6554894c0FdF5931a711BCFB` (KGPT, 9 decimals)
- Curve: `0xCc803Eb81b7Cf3a71dBF17d25E342e45F17be209`
- Graduated pool: `0xD912Fa18061E5665136AE5dBc002aDa0fc0D3c28`
- Position manager: `0x089163706d9956d7baeCeDF4eAb4aD6CcE7Ca2D6`

| Claim | Transaction | Exact recipient increase (raw) |
| --- | --- | --- |
| claim-own-quote | [0xd53386a278eacc29c4cf0f43c81898bf30ea9c2cc4dfd973c62174e6e2c3db49](https://sepolia-explorer.giwa.io/tx/0xd53386a278eacc29c4cf0f43c81898bf30ea9c2cc4dfd973c62174e6e2c3db49) | 0x4200000000000000000000000000000000000006: 7232101895479 |
| claim-own-base | [0xaacaf278dfcd58f3ecc9bdfe7255d60f6fc9c2799aefc623bc5c7d98857ca23d](https://sepolia-explorer.giwa.io/tx/0xaacaf278dfcd58f3ecc9bdfe7255d60f6fc9c2799aefc623bc5c7d98857ca23d) | 0xeFD0b74cB733534D6554894c0FdF5931a711BCFB: 20408163 |
| claim-lp | [0xe99284ddf00ea057c51c1442a406e2459e4318d230bc66edc6304038ad429993](https://sepolia-explorer.giwa.io/tx/0xe99284ddf00ea057c51c1442a406e2459e4318d230bc66edc6304038ad429993) | 0xeFD0b74cB733534D6554894c0FdF5931a711BCFB: 49999; 0x4200000000000000000000000000000000000006: 4999999 |
| extra-lp-37 | [0xcff24c987fc1ff3a37d6907aaa2d09f17b9d6a8715909c53366d4356c5328ef3](https://sepolia-explorer.giwa.io/tx/0xcff24c987fc1ff3a37d6907aaa2d09f17b9d6a8715909c53366d4356c5328ef3) | 0xeFD0b74cB733534D6554894c0FdF5931a711BCFB: 29999; 0x4200000000000000000000000000000000000006: 2999999 |

**FeeVault WETH is aggregate beneficiary/token revenue, not per-launch revenue.** Both Creator and Partner were the same controlled wallet in this new run. Separate-payee/delegated evidence is reused within its original actor/asset/receipt scope. LP #36 had zero accrued fees: no signature or transaction was made, and it is NOT_APPLICABLE as a payment.

Current-chain `eth_call` controls confirmed `Unauthorized` for redirecting a foreign FeeVault beneficiary and `InvalidPermission` for a foreign caller on the new LP. Authorized control calls succeeded. These are simulations, not reverted transactions or payouts.

## Transactions

| Nonce | Action | Canonical transaction |
| --- | --- | --- |
| 2092 | config | [0x646d114e693fe58d4b64354448e415833f0c0312430969fddc72d50cc92a8385](https://sepolia-explorer.giwa.io/tx/0x646d114e693fe58d4b64354448e415833f0c0312430969fddc72d50cc92a8385) |
| 2093 | launch | [0xe7e60b5c7edd591ef69f7d05f77c56829ae9f7dc0b32d6fdecb02a1c61bfb93b](https://sepolia-explorer.giwa.io/tx/0xe7e60b5c7edd591ef69f7d05f77c56829ae9f7dc0b32d6fdecb02a1c61bfb93b) |
| 2094 | approval | [0xbb0ea5eb61dea456c1d261c1c44ab6f7334b8a1670643e67e7ce30175b4e6806](https://sepolia-explorer.giwa.io/tx/0xbb0ea5eb61dea456c1d261c1c44ab6f7334b8a1670643e67e7ce30175b4e6806) |
| 2095 | trade | [0xcb02b80e544b56c5c9bfc2d103e8b8d0da697ebc800519eb4376b0b038c4083c](https://sepolia-explorer.giwa.io/tx/0xcb02b80e544b56c5c9bfc2d103e8b8d0da697ebc800519eb4376b0b038c4083c) |
| 2096 | approval | [0x2c9d497c4e8cc72d10d8cd3a4cfdbda1cac273e856ae24c294ea731027d307d7](https://sepolia-explorer.giwa.io/tx/0x2c9d497c4e8cc72d10d8cd3a4cfdbda1cac273e856ae24c294ea731027d307d7) |
| 2097 | trade | [0xbd511feb606f44fb780060d4678c0916139b46894d9ba0e2fa69160e52422655](https://sepolia-explorer.giwa.io/tx/0xbd511feb606f44fb780060d4678c0916139b46894d9ba0e2fa69160e52422655) |
| 2098 | approval | [0xb809bbce71033d014e50b2fe4321ab0a6946dd4631689280cce3d168a3cdafe9](https://sepolia-explorer.giwa.io/tx/0xb809bbce71033d014e50b2fe4321ab0a6946dd4631689280cce3d168a3cdafe9) |
| 2099 | trade | [0x12d1e4c020c8b56819d9f6010e82c4e8a8c1855aebfb0bcdab9c2a8a013f2c90](https://sepolia-explorer.giwa.io/tx/0x12d1e4c020c8b56819d9f6010e82c4e8a8c1855aebfb0bcdab9c2a8a013f2c90) |
| 2100 | migrate | [0x433f2c803f3dbb3b1d9090b3da848f7b7e35304346cafb9ab753a4d90601b276](https://sepolia-explorer.giwa.io/tx/0x433f2c803f3dbb3b1d9090b3da848f7b7e35304346cafb9ab753a4d90601b276) |
| 2101 | approval | [0xaae971080b6479f4e96761a83804f6f7bc20672f0a644a73bbef90e418772e39](https://sepolia-explorer.giwa.io/tx/0xaae971080b6479f4e96761a83804f6f7bc20672f0a644a73bbef90e418772e39) |
| 2102 | trade | [0xd8cffa8f41120ec583f1a85e49738128587b06d8745d1721c6dc69e4feca8e25](https://sepolia-explorer.giwa.io/tx/0xd8cffa8f41120ec583f1a85e49738128587b06d8745d1721c6dc69e4feca8e25) |
| 2103 | approval | [0x2b00818f59b28b24081dcc9e3989fd45f32fcaaacca8b5f99bf56702cfb0826f](https://sepolia-explorer.giwa.io/tx/0x2b00818f59b28b24081dcc9e3989fd45f32fcaaacca8b5f99bf56702cfb0826f) |
| 2104 | trade | [0x74914d0c0fbb4b3f53bc7e68cd0099d50da1cfbb77f2341cc89be3dde5a7d85d](https://sepolia-explorer.giwa.io/tx/0x74914d0c0fbb4b3f53bc7e68cd0099d50da1cfbb77f2341cc89be3dde5a7d85d) |
| 2105 | claim-launch | [0xd53386a278eacc29c4cf0f43c81898bf30ea9c2cc4dfd973c62174e6e2c3db49](https://sepolia-explorer.giwa.io/tx/0xd53386a278eacc29c4cf0f43c81898bf30ea9c2cc4dfd973c62174e6e2c3db49) |
| 2106 | claim-launch | [0xaacaf278dfcd58f3ecc9bdfe7255d60f6fc9c2799aefc623bc5c7d98857ca23d](https://sepolia-explorer.giwa.io/tx/0xaacaf278dfcd58f3ecc9bdfe7255d60f6fc9c2799aefc623bc5c7d98857ca23d) |
| 2107 | claim-lp | [0xe99284ddf00ea057c51c1442a406e2459e4318d230bc66edc6304038ad429993](https://sepolia-explorer.giwa.io/tx/0xe99284ddf00ea057c51c1442a406e2459e4318d230bc66edc6304038ad429993) |
| 2108 | claim-lp | [0xcff24c987fc1ff3a37d6907aaa2d09f17b9d6a8715909c53366d4356c5328ef3](https://sepolia-explorer.giwa.io/tx/0xcff24c987fc1ff3a37d6907aaa2d09f17b9d6a8715909c53366d4356c5328ef3) |
| 2109 | task-allowance-revoke | [0x291cd56266c301f271d31f5f73d30d7ab208b02025de88b591ef42f929147b08](https://sepolia-explorer.giwa.io/tx/0x291cd56266c301f271d31f5f73d30d7ab208b02025de88b591ef42f929147b08) |

Receipts were independently checked against their canonical headers, original hashes/nonces and at least 13 confirmations. This is **not a finalized-status claim**. Terminal partial-fill unused ERC20 input stayed in the payer wallet; it was not a refund payment.

## Cleanup and retained inventory

All four task-specific WETH/KGPT allowances to the new curve/pool are zero. Only the unused new-curve allowance required a zero-approval transaction. The own writer lease was released after final canonical/nonce reconciliation; signing and sending stopped. Legacy approvals and other teams’ assets/recipients were unchanged.

New LP NFTs **#35 and #37 retain permanent liquidity**; #36 retains one raw unit of unlocked dust. No permanent principal was withdrawn or lock ratio changed. The new Config/token/curve/pool and remaining owned test-token inventory persist. The machine-readable snapshot below records exact liquidity and balances, not a claim that every wallet allowance or all assets are empty.

The 18 raw receipts report **1603966415 wei** execution gas plus **3498 wei** explicit L1 fees = **1603969913 wei** total recorded native fees, below the 250000000000000 wei task cap. Reserved gas envelopes are not actual fees or account billing.

## Evidence classification and preserved failures

- **PASSED_THIS_RUN:** anonymous fresh installation, documented read/plan examples, new connected lifecycle and positive payout proofs, current refusal controls, final hash/nonce/receipt reconciliation and task-only approval cleanup.
- **REUSED:** unchanged SDK/helper/type/compiler and prior financial evidence listed in the product table after digest/component checks. 334 executable/config/dependency files matched the preceding qualified source; 180 documentation delivery files, 24 SDK release-delivery files and 535 partner evidence leaf files matched their preserved digests.
- **BLOCKED:** no unresolved gate for this controlled supported-path run. A real issuer’s unconfirmed assets, unsupported standards/implementations, restricted policies or missing partner authority/funding remain separate prerequisites; this report does not qualify them.
- **WAIVED:** none.
- **NOT_APPLICABLE:** zero-fee LP #36 payment; SDK publication, GitHub CI, mainnet and API/Indexer/production changes.

Original failures remain preserved: the first private host gas cap rejected before keys/signatures; the host cap was corrected for the actual SDK gas-price formula with the total budget unchanged. Two private Config-simulation invocations used the wrong pure-helper arguments and were corrected. One restricted-network extra-LP attempt failed before signing and resumed with network access under the same request IDs. A historical integrity map referenced an earlier digest of its own seal; that self-reference was not qualified, while all 535 financial evidence leaf digests matched. Temporary canonical-block lookup failures reconciled the original hashes; no known successful or uncertain hash was resent. None required an SDK change.

Reopen affected evidence when relevant SDK/source/dependency/runtime/profile, inputs, caller/rights, asset or canonical receipt identity changes, or when a preserved digest no longer matches. Reused proof never authorizes a different partner’s transaction.

## Source and machine-readable evidence

- Executed source commit: `35b67bd042153fbe3386bad1a4f683b23b3db347`; tree `223c0ee7cfd271982b2c6c36cffbc8e51f3a5229`.
- SDK runtime SHA256: `b511c00514e90aaf18f52f29833f5eda72423659bd34e5f80bce46ba3489b3ad`.
- Node **24.18.0**, macOS arm64; anonymous clone and `npm ci --ignore-scripts` using the repository lockfile.
- [Public receipt, balance, cleanup and digest snapshot](fresh-partner-giwa-039-20261105.json).
- [Existing validation and prior financial scope](../VALIDATION.md).

Main integration and public Docs delivery are tracked separately from these chain results. This report does not certify the whole service, public app visibility, real-issuer onboarding or mainnet readiness.
