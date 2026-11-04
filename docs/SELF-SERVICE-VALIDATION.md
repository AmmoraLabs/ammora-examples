# GIWA self-service qualification — completed synthetic flow

Published SDK 0.3.9, GIWA Sepolia (chain 91342). **76 successful canonical transactions**, nonces 1988–2063; final latest and pending nonce 2064. Actual native fees: **14,535,538,337 wei**, below the 125,000,000,000,000 wei task cap. Every transaction had value0. No SDK publication, GitHub CI, mainnet or production change occurred.

Two reusable synthetic standards remain enabled. Three independently configured source modules were registered directly by their controller, activated after their actual tickets, traded and paid fees, then deliberately stopped for cleanup. Live registration/trading targeted stage 1 (pool). A new partner creates its **own** conforming source; these stopped test modules are not reusable live trading targets. A real issuer, source implementation and independent review have not been selected.

| Required boundary | Classification | Actual scope |
| --- | --- | --- |
| Public package/default install, SDK/core/compiler proof | REUSED | Same qualified 0.3.9 archive/runtime, frozen artifacts and 41 transitive source inputs; original scope retained |
| Existing Creator/Partner/multiple-recipient and LP delegation payouts | REUSED | Original canonical receipts, authority and exact-block payments; no new LP transaction |
| Example and extraction interfaces | REUSED | Ten example and six extraction cases, root types,267 TS/198 commands; executable/test/dependency inputs unchanged |
| Deployment/runtime and holder consents | PASSED_THIS_RUN | Exact full runtimes, factory mappings and consent for all 3 Source/Port/Vault instances |
| Bootstrap and standards | PASSED_THIS_RUN | Two common templates enabled after genuine serial 3600-second gates |
| Compatibility and direct registration | PASSED_THIS_RUN | Three compatible sources, eight unsupported cases; same V3 standard reused twice, no per-instance governance call |
| SDK activation and recovery | PASSED_THIS_RUN | Three actual activations after their third real delay; genuine local plans and observed receipt-only recovery, mayResubmit=false |
| Managed exact-input trades | PASSED_THIS_RUN | Six trades, both directions across 3 modules;10,000 raw input,9,900 raw output,100 raw newly secured fee each |
| Fixed-beneficiary payments | PASSED_THIS_RUN | Twelve official SDK planClaim sends;20 raw Ammora and 80 raw partner per asset/module, Paid/Transfer and receipt-block balance increases |
| Authority and stopped-state refusals | PASSED_THIS_RUN | Earlier two waiting/wrong-controller refusals plus six stopped/debtless-holder refusals; no negative broadcasts |
| Final cleanup and signer handoff | PASSED_THIS_RUN | Three test modules stopped, source beneficiaries restored, all task allowances and Router/Port/Vault cash/debt/liability 0; own writer lease released |
| Real issuer/production standard | BLOCKED | Source/dependencies/token behavior, actual rights, independent review and operating acceptance not supplied |
| SDK republication, GitHub CI, mainnet, production | NOT_APPLICABLE | Excluded and not executed |

## Registration and activation

| Source | Module | Actual ticket readyAt Unix | Activation |
| --- | --- | --- | --- |
| sourceV3A | `0x357295bda8D847e3Be59f1a2cD0E3A7555c65bAc` | 1793781401 | [receipt](https://sepolia-explorer.giwa.io/tx/0x57420edf02cbbe371a6e449002791b51ede6ca07f794f8b82c537606d2853eb2) |
| sourceV3B | `0x64B7Eb4e601E0fa365cb3478a5817a56B4Eb89cf` | 1793781445 | [receipt](https://sepolia-explorer.giwa.io/tx/0x68e7e39e2396adfa42ec98d6561d6951dc621dc50804252fe17690a798a9e0b1) |
| sourceV4 | `0x3F5735c0E2C525e98267db0D16b03eEc9667be44` | 1793781489 | [receipt](https://sepolia-explorer.giwa.io/tx/0xbe6aefcb11440a142dd0015f7fddc1a9fed6365fa283a5e6eab0cadff726416a) |

The final ticket readyAt was 2026-11-04T08:38:09Z. Fresh chain-time, epochs, nonce, runtime and inventory checks preceded signing. Elapsed wall time alone was never accepted. Governance, guardian and partner are different controlled contract role addresses, but share one physical test signer; this is not independent production custody. Registration, activation and cancellation retained genuine SDK plan/client authority and used receipt-only recovery after submission.

## Six actual managed trades

| Source | Input asset | Owner input decrease raw | Owner output increase raw | Newly secured fee raw | Receipt |
| --- | --- | --- | --- | --- | --- |
| sourceV3A | quote | 10000 | 9900 | 100 | [receipt](https://sepolia-explorer.giwa.io/tx/0xad86a072779824827ed54af3ece8f8bd94198e816502892ee00ba71be0f49e50) |
| sourceV3A | base | 10000 | 9900 | 100 | [receipt](https://sepolia-explorer.giwa.io/tx/0xdc929bdcfa9e85ff8f848f8366cf359a13f65a0775b9a2945a67ea62d2ce3b74) |
| sourceV3B | quote | 10000 | 9900 | 100 | [receipt](https://sepolia-explorer.giwa.io/tx/0xf0d297e87407b8f4f4396d91cc933eae144ba08f2609394881b7d8ad44a65f60) |
| sourceV3B | base | 10000 | 9900 | 100 | [receipt](https://sepolia-explorer.giwa.io/tx/0xdd4aef7e99640eb9e52ada0975c14f2b9186bc26f5037f10514500cd10656a62) |
| sourceV4 | quote | 10000 | 9900 | 100 | [receipt](https://sepolia-explorer.giwa.io/tx/0xac602b687c8323e000ca284b86f54da932024605c9276d7053e5c13fd1e7678a) |
| sourceV4 | base | 10000 | 9900 | 100 | [receipt](https://sepolia-explorer.giwa.io/tx/0xd91d3beebf5042d5951f01ec93c4a133112973c38a094de5c1627131799819df) |

Actual ManagedExecuted/Routed/Executed/Allocated receipt evidence and exact-block input/output, secured fee and 20:80 debt changes were checked. Native flags were false: the quote fixture is not WETH. No mint, observation-only receipt or zero-fee no-op was counted as revenue payment.

## Twelve positive fixed-beneficiary payments

| Module | Asset | Beneficiary | Amount raw | Balance before raw | Balance after raw | Receipt |
| --- | --- | --- | --- | --- | --- | --- |
| sourceV3A | quote | Ammora EOA | 20 | 29700 | 29720 | [receipt](https://sepolia-explorer.giwa.io/tx/0x2bdbb6e58157cee93051a403d32751bde907e72ae199355b16e8981865fa9803) |
| sourceV3A | quote | Controlled partner holder | 80 | 0 | 80 | [receipt](https://sepolia-explorer.giwa.io/tx/0x37d5f57e0ebd63be3fdc5f8bb970a63b6a8d440d96c69e6bf7a6e0d8a2225dfe) |
| sourceV3A | base | Ammora EOA | 20 | 29700 | 29720 | [receipt](https://sepolia-explorer.giwa.io/tx/0x54916bdfe7f61a13c39b25caafaec0776e6666b6e0f5c6bfe3f4459346b9ea63) |
| sourceV3A | base | Controlled partner holder | 80 | 0 | 80 | [receipt](https://sepolia-explorer.giwa.io/tx/0x1a1ae516e9f8a8c1e407bd046e11a92d9759ee5eed23ae1db0d190fd80abd4ba) |
| sourceV3B | quote | Ammora EOA | 20 | 29720 | 29740 | [receipt](https://sepolia-explorer.giwa.io/tx/0x78b9b3f3a84bd2cf38143d9d5bf0aa8279312e3d1bb64b0a0229db5f8f008d9b) |
| sourceV3B | quote | Controlled partner holder | 80 | 80 | 160 | [receipt](https://sepolia-explorer.giwa.io/tx/0xbe6c8aa44680cab688ca602f55d19569d295ccef44e04c44d3a53d5c5e075ea9) |
| sourceV3B | base | Ammora EOA | 20 | 29720 | 29740 | [receipt](https://sepolia-explorer.giwa.io/tx/0x2cbb031d3506406f656805851e77f24ea34faca6ce9963a03d8d7ea141196dc1) |
| sourceV3B | base | Controlled partner holder | 80 | 80 | 160 | [receipt](https://sepolia-explorer.giwa.io/tx/0x16f9d32d6e3c8d74d7cbb09a13be5d5438ff73268d252cb8e29639fb62594e13) |
| sourceV4 | quote | Ammora EOA | 20 | 29740 | 29760 | [receipt](https://sepolia-explorer.giwa.io/tx/0x88086c549c8fbae7d933b9812d27c0aa7568c5f3a5e4f6a7c1ec019408944398) |
| sourceV4 | quote | Controlled partner holder | 80 | 160 | 240 | [receipt](https://sepolia-explorer.giwa.io/tx/0x9140c8ed4f430f4509b7f4ee98a78f0312836c00ea896ed2e248919894a9e462) |
| sourceV4 | base | Ammora EOA | 20 | 29740 | 29760 | [receipt](https://sepolia-explorer.giwa.io/tx/0xccdf9b864d14a7c0c08b9f9538e9dc0f6cf5760d56d5f4937d6717b53e17919d) |
| sourceV4 | base | Controlled partner holder | 80 | 160 | 240 | [receipt](https://sepolia-explorer.giwa.io/tx/0x00d950cc0d314280ff745d2b576be19617b49a38559e9a93be8d9a994b28985a) |

Every payment used official SDK 0.3.9 `createPartnerExtensionClientV2.planClaim`, matched the frozen Vault ABI exactly and required a positive Paid event, matching ERC20 Transfer, receipt-1/receipt-block recipient balance increase, and matching debt/liability decrease. The controlled contract holder used its reviewed outer execute call. Claims remained payable after cancellation/guardian stop. These are fixed-beneficiary rights, not arbitrary payout-address or LP delegation powers; the latter products retain their separate REUSED proofs.

## Refusals and final cleanup

Actual early activation returned TimelockPending; an outer guardian attempting controller registration returned Unauthorized. After two controller cancellations and one guardian stop, all 3 modules rejected re-registration with exact Unsupported(10). A debtless guardian could not take partner fees (InvalidRights). Refusals used real outer-actor eth_call simulations; no contract was impersonated as an EOA and no failed test transaction was broadcast.

Final canonical state has no pending task nonce, zero owner-to-Router allowances, zero Router/Port/Vault cash, zero task internal allowances, zero vault liability/debt/pass-through/unattributed balances, and zero module claimable at each source. Each module/asset secured and paid 100 raw. Original source beneficiaries were restored. The task's own writer lease was released and signing/sending stopped.

Each source still holds 50,000 raw quote and 50,000 raw base; total **150,000 raw per asset**. These openly mintable assets are valueless inventory in a fixture with no withdrawal method. This is not withdrawn principal, issuer reserves or money recovered. Synthetic1:1 exact-input / 1% fee behavior does not certify actual DEX pricing, Graduation, exact-output, arbitrary proxies/Hooks/tokens, issuer support or an independent audit.

## Preserved failures and reuse

The initial standalone Registry metadata mismatch and one-code-store assumption were recovered read-only against the original successful hashes, requiring every exact embedded/runtime byte. No resend, redeploy, metadata mask or verifier bypass occurred. Original type-only/runtime-identity and private preparation failures remain preserved; unchanged failed commands were not automatically retried.

Initial receipt/header hashes disagreed for 66 of 76 transactions. Bounded **same-hash** observation required a matching canonical block and 13 confirmations, retaining all originals with zero resends. This is observed canonical inclusion, not finalized status; the evidence does not assign caching versus reorg causes. Transport dispatch counts are not account billing.

Relevant source/ABI/compiler/artifact, SDK/dependency, chain/genesis/runtime, role/rights/epoch, canonical receipt or preserved-evidence changes invalidate affected reuse. Old fee/LP and SDK tests retain their original asset/authority scope. Main integration is separately established by the linked PR's merge metadata; passing this synthetic flow is not whole-service or real-partner certification. No production or Docs deployment is included.
