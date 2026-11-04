# GIWA self-service qualification — in progress

SDK: published0.3.9, unchanged archive. Chain: GIWA Sepolia91342. Scope: isolated Ammora-owned synthetic standards and valueless fixture tokens. No real partner standard or independent review has been selected.

| Required check | Classification | Evidence and limit |
| --- | --- | --- |
| Original SDK/contract/EVM proof | REUSED | Exact artifact/source seals and byte-identical public `/partner` runtime; retains original local/synthetic scope |
| Fresh admission/registry/router/factory and role deployment | PASSED_THIS_RUN | Canonical deployment receipts and complete runtime bytes; separate role addresses share one approved physical test signer |
| Actual bootstrap activation and standard queue | PASSED_THIS_RUN | Initial3600-second delay honored; five new canonical activations/template proposals; two initial typed rejections retained |
| Three source modules and actual holder consent | PASSED_THIS_RUN | Six new canonical consent/deployment transactions, full Port/Vault runtime comparison, zero per-instance governance calls |
| Public SDK standards listing | PASSED_THIS_RUN | Exactly two actual queued templates, enabled=false, expected pins/readyAt;13 read dispatches, no retry/key/send |
| Standard activation / partner registration / trades / payouts | BLOCKED | Standard delay until2026-11-04T07:28:46Z, then per-source registration delay and live follow-up remain; no completed payment claim yet |
| Real issuer/source production admission | BLOCKED | Actual source/dependencies, review, asset rights and operating acceptance not selected |
| SDK republication / GitHub CI / mainnet / production | NOT_APPLICABLE | Outside this task; not executed |

The bootstrap passed after its actual readyAt2026-11-04T06:26:19Z. The two queued standards have latest readyAt **2026-11-04T07:28:46Z**. This timestamp is not standard activation proof. There are31 successful canonical task transactions and nextNonce2019. Existing local/old receipt proofs do not turn these outstanding GIWA gates into passes.

Original validation failures are retained: child Registry metadata differed between standalone and parent-embedded compiler artifacts; Factory contained one valid code store rather than an assumed pair. Both transactions were successful and recovered by read-only checks of the original hash, full runtime/creation bytes and canonical receipt. Neither transaction was resent or redeployed. Derived embedded bytes retain every metadata byte; no runtime mask or relaxed production gate was introduced.

Relevant artifact/source/ABI, SDK/dependency, chain/genesis, runtime/roles, epochs/rights, canonical receipt or sealed evidence changes invalidate affected reused proof. Unchanged Creator/Partner/multiple-recipient and LP delegation proofs retain their original asset, authority and payout scope; they are not new transactions here.

## Actual module deployments

| Source | Module | Vault | Canonical deployment |
| --- | --- | --- | --- |
| sourceV3A | `0x357295bda8D847e3Be59f1a2cD0E3A7555c65bAc` | `0x8ACAfA72b15a0316270DFDc53395c2581Cf9623E` | [receipt](https://sepolia-explorer.giwa.io/tx/0xb51ae73eb0f8c41c34f910bbd7be54a5b2b35a25557fb529562a7e38501084b5) |
| sourceV3B | `0x64B7Eb4e601E0fa365cb3478a5817a56B4Eb89cf` | `0x34DA16821c1fc28337C5Df43a871Fc47a3dcF94e` | [receipt](https://sepolia-explorer.giwa.io/tx/0x36b6978221f1e12ab1807a1ed1503ebf1f4ad59a8cb2ab00e246336782d79392) |
| sourceV4 | `0x3F5735c0E2C525e98267db0D16b03eEc9667be44` | `0xD584b9d34fb953094202961860dD7120E74e54E8` | [receipt](https://sepolia-explorer.giwa.io/tx/0x780c554fd23571caf9b608707a1d02c26e17f7d9263a62bbf71fd61934df6531) |

These source beneficiaries remain unchanged while standards are queued. No source has been registered or traded through its new module yet. The two V3 instances will use the same enabled standard after the actual wait; the V4 instance will use the second.
