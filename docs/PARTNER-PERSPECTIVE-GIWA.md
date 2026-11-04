# Partner-perspective GIWA onboarding — SDK 0.3.9

An anonymous checkout of the public examples was used as a new partner application. It imported the published npm SDK 0.3.9 and the public feature helpers, deployed **new partner wallets, two new tokens, a new market and a new source**, and registered against the already enabled V3 standard. **No new governance or per-partner Ammora approval transaction was needed.** Every holder still consented and the controller still authorized registration.

**PASSED_THIS_RUN:** 28 successful canonical transactions, native nonces 2064–2091; final latest/pending nonce 2092. Actual native fees were **3054093350 wei**, within the 50000000000000 wei task cap. Every transaction had value 0. Receipts were observed canonically with at least 13 confirmations, without a finalized-status claim or transaction resend.

Follow [SELF-SERVICE.md](../SELF-SERVICE.md). The [machine-readable evidence](partner-perspective-giwa-039-20261104.json) binds transaction identities, results, relevant source digests and reuse scope. The earlier [76-transaction qualification](SELF-SERVICE-VALIDATION.md) remains unchanged and separate.

## What the partner needed

GIWA Sepolia (91342), Node 24, the public SDK 0.3.9, native test ETH for gas, a compatible owned source, two ERC20 inventories and explicit holder/controller consent. No Ammora invitation, service API, Indexer or private protocol source checkout was used by the application. Existing installed public dependencies were **REUSED** after exact archive/lock/environment integrity review; this case does not claim another fresh npm installation.

The enabled standard checks implementation/runtime classes and the actual source/token/dependency graph. It does not require the old sample token or market addresses. A new implementation or token behavior still requires standard review. This conclusion is separate from native-pool token policy and ordinary permissionless launchpad Config creation.

| Identity | New test address |
| --- | --- |
| Partner A / original beneficiary | `0x95979BF9661A89be9975b8669Cd8abD331cf1d1D` |
| Partner B | `0x30Bf1C2aDA019202179BF0dD0b8a5574759F016f` |
| Quote token | `0xF8A4Ac8b115d7349A86E8dFAFD5725eaAf353D9f` |
| Base token | `0x93cE816a2fE0114915CfA575A4D3f237fD19260A` |
| Market dependency | `0x4572Da5c8E154809aB300EB8b1ECD139cFd9867b` |
| Source | `0xB1A2c7ab9814E08a76E2DC31a39E1AD1A7dbf60A` |
| Module | `0x28Bea01E11e42dc3893a10Db3b323204C4Ac3b7A` |
| Vault | `0xBa7381255376aCf8891255c78F0773cf2F0282E4` |

Registration produced actual readyAt **1793794599 / 2026-11-04T12:16:39Z**. After that boundary, fresh chain time, ticket/rights epochs, nonce, runtime, source beneficiary and exact inventory were checked before signing. Elapsed wall time was not accepted as activation proof.

## Feature examples used

The public guide now connects `partner:create-test-assets`, `partner:create-test-source`, `partner:configure-test-source`, compatibility diagnostics, real holder consent/module deployment, `partner:verify-module-deployment`, direct registration/activation, `partner:quote-module`, `partner:prepare-module-claim`, cancellation and receipt-only recovery. A new unsigned configuration helper accepts the partner's own asset/dependency addresses and weighted recipients. The market deployment includes its required uint8 family constructor argument.

The public deployment-pin helper checked the known hash, chain/genesis, canonical factory event/mapping and child identities. Those exact public pins fed the actual trade/claim helpers. The application retained each genuine SDK client/plan while signing/simulating; CLI JSON was not rehydrated into executable authority. A separately controlled sender submitted the exact requests once and recorded each hash before transport completion. Frozen compiler artifacts were reused only for supplementary operator runtime verification.

## Actual trades and newly secured revenue

| Direction | Input decrease raw | Output increase raw | Fee secured raw | Canonical transaction |
| --- | --- | --- | --- | --- |
| quote → base | 10000 | 9900 | 100 | [receipt](https://sepolia-explorer.giwa.io/tx/0x1cd09c944072d6091d1f7253a1a72803cc34131cbfefe0802932eecb4a5738d7) |
| base → quote | 10000 | 9900 | 100 | [receipt](https://sepolia-explorer.giwa.io/tx/0x6cb9e9380aa65b62e5d4bd916a9189d77f82cfdff92accb56da5cb34609ff1c0) |

Each trade matched `ManagedExecuted`, `Routed`, `Executed` and `Allocated` event identities, SDK receipt reconciliation, and receipt-block balances/debt. For each newly secured 100 raw fee, Ammora received rights to 20 raw and the partner's 80 raw split 60:40 into 48/32. The checked on-chain recipient order was Partner B then A, with corresponding weights 4000/6000; each holder kept its intended share. Managed nonces 7/8 were separate from the wallet transaction nonce.

## Six positive fixed-beneficiary payments

| Asset | Beneficiary | Paid raw | Exact receipt-block balance raw | Canonical transaction |
| --- | --- | --- | --- | --- |
| quote | `0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637` | 20 | 49900 → 49920 | [receipt](https://sepolia-explorer.giwa.io/tx/0x178b9d3a3adf8284228f1786e270a7c4edfb34859471d9e2aad5ec33c8dc9cbe) |
| quote | `0x95979BF9661A89be9975b8669Cd8abD331cf1d1D` | 48 | 0 → 48 | [receipt](https://sepolia-explorer.giwa.io/tx/0x74d7f2463e155d2d48b278ccf71fd713ed0cd6c055125656734d3250e13679fb) |
| quote | `0x30Bf1C2aDA019202179BF0dD0b8a5574759F016f` | 32 | 0 → 32 | [receipt](https://sepolia-explorer.giwa.io/tx/0x8db9020e2d7a705885a338d5bf3ff64b047d321e38cd87fe4d83a4ab0fc8b2c1) |
| base | `0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637` | 20 | 49900 → 49920 | [receipt](https://sepolia-explorer.giwa.io/tx/0x488f5d2876a0cb83540e3d826f578a9d08ca92da619ee508fe620c0e582991b8) |
| base | `0x95979BF9661A89be9975b8669Cd8abD331cf1d1D` | 48 | 0 → 48 | [receipt](https://sepolia-explorer.giwa.io/tx/0xe3f0190b7704f9a67f8a15181ebf2f6c74bdb7235c2c3d2515f03367a1ec9202) |
| base | `0x30Bf1C2aDA019202179BF0dD0b8a5574759F016f` | 32 | 0 → 32 | [receipt](https://sepolia-explorer.giwa.io/tx/0x45e484489f73e75372b1c5c87081703f6727fbf0e88520c9a43b95adcad8f392) |

All six official SDK `planClaim` calls matched `Paid`, ERC20 `Transfer`, positive beneficiary balance increases, and matching Vault debt/liability/cash decreases. A no-op, mint or planned request was not counted as a payment. These module claims are fixed to their beneficiary and do not grant arbitrary payout-address or LP delegation powers. Existing Creator/Partner and delegated LP proofs are **REUSED** in their original scope.

## Refusals and cleanup

**PASSED_THIS_RUN:** five exact live-chain call refusals: early activation (`TimelockPending()`), registration by a rights holder who is not controller (`Unauthorized()`), re-registration after cancellation (`Unsupported(10)`), and debtless guardian claims for each new asset (`InvalidRights()`). No negative transaction was broadcast.

The module was stopped, the source's original new partner beneficiary restored, and the task's token allowances and Router/Module/Vault balances, debt and liability were zero. Secured and claimed amounts matched at 100 raw per asset. The existing three source inventories were unchanged. Only this task's writer lease was released and signing/sending stopped.

The new source retains **50000 raw per asset of openly mintable, valueless fixture inventory**; it was not withdrawn or described as recovered principal. Both partner contract wallets share one approved physical test signer. This verifies controlled role separation, not independent production custody.

## Checks and honest limits

| Required gate | Classification | Scope |
| --- | --- | --- |
| New-address partner flow and canonical deployment pins | PASSED_THIS_RUN | Public SDK/example application, no new governance transaction |
| Changed helper tests and strict types | PASSED_THIS_RUN | 16 distinct cases; current inventory 273 TS files / 203 commands |
| Public package installation, SDK/core/compiler and unchanged example proofs | REUSED | Same qualified archive, lock, runtime and original proof inputs |
| Two trades, six payments, five typed denials and cleanup | PASSED_THIS_RUN | This new synthetic source and assets only |
| Existing launchpad, Creator/Partner and LP delegation proofs | REUSED | Original deployments, callers, assets and canonical blocks only |
| Real issuer or arbitrary new implementation | BLOCKED | No real issuer, novel standard or independent operating review supplied |
| SDK publication, GitHub CI, mainnet and production | NOT_APPLICABLE | Not executed |

Original failures remain preserved: strict tuple typing was corrected before sending; a missing market constructor family was caught by simulation **before signing/broadcast**, then only the corrected unsent request was submitted. The four successful deployments before that failure were reused. The 25 initial receipt/header disagreements were preserved and recovered through the same original hashes with at least 13 canonical confirmations; no successful prefix was resent. This does not establish finalized status or a particular provider/reorganization root cause.

This fixture implements synthetic ERC20 exact-input transfers with a 1% fee. It does not qualify real DEX pricing, Graduation, native-asset execution, a stablecoin issuer, arbitrary proxies/Hooks or production custody. Those are separate product/standard requirements. Relevant source/ABI/SDK/dependency, deployment/rights/epoch, input, receipt or evidence integrity changes invalidate affected reuse.

## All 28 transaction identities

| Native nonce | Action | Canonical transaction |
| --- | --- | --- |
| 2064 | 01-wallet-partnerA | [receipt](https://sepolia-explorer.giwa.io/tx/0x3c59cca6bac5856b40fdcde3af41c8a0c853d10dcdaede2a61f4810da7bf17e6) |
| 2065 | 02-wallet-partnerB | [receipt](https://sepolia-explorer.giwa.io/tx/0x8ea90e0b9fc6e63a7392658dd4a2e776dfc441770ba4b2fb6eed78a4f8401d04) |
| 2066 | 03-new-quote | [receipt](https://sepolia-explorer.giwa.io/tx/0x8e580e71e80ad78af7716bceb1fc46c9447f7d44829804413440ac9c27c72da4) |
| 2067 | 04-new-base | [receipt](https://sepolia-explorer.giwa.io/tx/0x6b93904b39222082c640816f0644f150edffbd2f93a2b935ef4434b9ff9a6658) |
| 2068 | 05-new-market-v2 | [receipt](https://sepolia-explorer.giwa.io/tx/0xb36f0ce9cd1acf5c4ef6852745e27a32be871135605189401048f0f2411a9b6d) |
| 2069 | 06-new-source | [receipt](https://sepolia-explorer.giwa.io/tx/0xd6fbb7868f623a4eb0afb5079d7eb6c1029b27ba73d1ffab7292bd5aa2f0503c) |
| 2070 | 07-consent-partnerA | [receipt](https://sepolia-explorer.giwa.io/tx/0x1bb3bdfbaea57ca6e72b9e292b952172fa2c06d555d80dac5ca4137e14f189a0) |
| 2071 | 08-consent-partnerB | [receipt](https://sepolia-explorer.giwa.io/tx/0x8b9ada2186cc46d1b88fcfcd14bccc61e2b138f521fcbbf3777631a5305f1fd0) |
| 2072 | 09-create-module | [receipt](https://sepolia-explorer.giwa.io/tx/0xbd2fdea66efc035d02ce0051daf82eec03fa501f803c496c214f009b88f59b06) |
| 2073 | 10-connect-source | [receipt](https://sepolia-explorer.giwa.io/tx/0x6ca9f70ed45f1fc84dde028269a7e00cfa4453b43e26cccfb256b87cb931bdca) |
| 2074 | 11-register-source | [receipt](https://sepolia-explorer.giwa.io/tx/0x2df08cd7e3cd7b977b54fd5f0525446e018ecc744d05a5d97b57eaffa6f4f87b) |
| 2075 | 12-mint-quote-source | [receipt](https://sepolia-explorer.giwa.io/tx/0x3394d774180481a6d8acd996d024a9fc655c2456613d8069e2b0fbba0b893e5e) |
| 2076 | 13-mint-quote-owner | [receipt](https://sepolia-explorer.giwa.io/tx/0x9bdc07aaa7dbc9dc3f2db0489395f900a8ee11fe0efb301701bec29066bef32a) |
| 2077 | 14-mint-base-source | [receipt](https://sepolia-explorer.giwa.io/tx/0x66dd918278d19b21875c313cb509f772d4af99179414e636cf25e62d8628860a) |
| 2078 | 15-mint-base-owner | [receipt](https://sepolia-explorer.giwa.io/tx/0x298dc5614fbada69bff0f85e223eb272c8dd37857aad9496fbbf999e1e16e09e) |
| 2079 | 16-approve-quote | [receipt](https://sepolia-explorer.giwa.io/tx/0xeb551ec16769416f1864a840d547bb9360ca851124d05855a411dd46b3b4ee95) |
| 2080 | 17-approve-base | [receipt](https://sepolia-explorer.giwa.io/tx/0x6f058d1cc445d7268bdfd56a4d10e86486ab8f877828cc2adf9edc5f6c1910cc) |
| 2081 | 18-activate-source | [receipt](https://sepolia-explorer.giwa.io/tx/0x44a43d87759bd4d62e51597868990d29df1c121aeb4838203ad1aba251e22925) |
| 2082 | 19-trade-quote | [receipt](https://sepolia-explorer.giwa.io/tx/0x1cd09c944072d6091d1f7253a1a72803cc34131cbfefe0802932eecb4a5738d7) |
| 2083 | 20-trade-base | [receipt](https://sepolia-explorer.giwa.io/tx/0x6cb9e9380aa65b62e5d4bd916a9189d77f82cfdff92accb56da5cb34609ff1c0) |
| 2084 | 21-cancel-source | [receipt](https://sepolia-explorer.giwa.io/tx/0x7c4344f3613f0f31a4a60be8cdfe40309edcd1fd6abee039834a873a6a1117e5) |
| 2085 | 22-claim-quote-ammora | [receipt](https://sepolia-explorer.giwa.io/tx/0x178b9d3a3adf8284228f1786e270a7c4edfb34859471d9e2aad5ec33c8dc9cbe) |
| 2086 | 23-claim-quote-partnerA | [receipt](https://sepolia-explorer.giwa.io/tx/0x74d7f2463e155d2d48b278ccf71fd713ed0cd6c055125656734d3250e13679fb) |
| 2087 | 24-claim-quote-partnerB | [receipt](https://sepolia-explorer.giwa.io/tx/0x8db9020e2d7a705885a338d5bf3ff64b047d321e38cd87fe4d83a4ab0fc8b2c1) |
| 2088 | 25-claim-base-ammora | [receipt](https://sepolia-explorer.giwa.io/tx/0x488f5d2876a0cb83540e3d826f578a9d08ca92da619ee508fe620c0e582991b8) |
| 2089 | 26-claim-base-partnerA | [receipt](https://sepolia-explorer.giwa.io/tx/0xe3f0190b7704f9a67f8a15181ebf2f6c74bdb7235c2c3d2515f03367a1ec9202) |
| 2090 | 27-claim-base-partnerB | [receipt](https://sepolia-explorer.giwa.io/tx/0x45e484489f73e75372b1c5c87081703f6727fbf0e88520c9a43b95adcad8f392) |
| 2091 | 28-restore-source | [receipt](https://sepolia-explorer.giwa.io/tx/0xcc3fa365b241b2d76a40617e165911550fc9afa813e3a54743b4721e50e0316e) |
