# GIWA self-service qualification — in progress

SDK: published0.3.9, unchanged archive. Chain: GIWA Sepolia91342. Scope: isolated Ammora-owned synthetic standards and valueless fixture tokens. No real partner standard or independent review has been selected.

| Required check | Classification | Evidence and limit |
| --- | --- | --- |
| Original SDK/contract/EVM proof | REUSED | Exact artifact/source seals and byte-identical public `/partner` runtime; retains original local/synthetic scope |
| Fresh admission/registry/router/factory and role deployment | PASSED_THIS_RUN | Canonical deployment receipts and complete runtime bytes; separate role addresses share one approved physical test signer |
| Actual bootstrap proposals and authority/delay denial | PASSED_THIS_RUN |13 initial transactions, two read-only typed rejections; actual3600-second delay |
| Standard activation / partner registration / trades / payouts | BLOCKED | Serial actual chain delays and live follow-up remain; no completed payment claim yet |
| Real issuer/source production admission | BLOCKED | Actual source/dependencies, review, asset rights and operating acceptance not selected |
| SDK republication / GitHub CI / mainnet / production | NOT_APPLICABLE | Outside this task; not executed |

The bootstrap's latest readyAt is2026-11-04T06:26:19Z. This timestamp is not activation proof. Existing local/old receipt proofs do not turn these outstanding GIWA gates into passes.

Original validation failures are retained: child Registry metadata differed between standalone and parent-embedded compiler artifacts; Factory contained one valid code store rather than an assumed pair. Both transactions were successful and recovered by read-only checks of the original hash, full runtime/creation bytes and canonical receipt. Neither transaction was resent or redeployed. Derived embedded bytes retain every metadata byte; no runtime mask or relaxed production gate was introduced.

Relevant artifact/source/ABI, SDK/dependency, chain/genesis, runtime/roles, epochs/rights, canonical receipt or sealed evidence changes invalidate affected reused proof. Unchanged Creator/Partner/multiple-recipient and LP delegation proofs retain their original asset, authority and payout scope; they are not new transactions here.
