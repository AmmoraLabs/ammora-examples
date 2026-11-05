# Partner onboarding review — SDK 0.3.9

Reviewed from the [partner quickstart](https://docs.ammora.org/guides/partner-quickstart), following each product guide to public example source. This is a documentation and interface review; historical GIWA execution evidence is reused, not a new transaction run or qualification of a new issuer's assets.

## Follow one product path

| Product | First interface | Required partner inputs and continuation |
| --- | --- | --- |
| New-token launchpad | [Launchpad](https://docs.ammora.org/guides/launchpad), `quickstart:verify` | Config owner, supported quote/template, recipients, supply and budgets; Config -> issuance -> trades -> migration -> own/delegated claims. |
| Agent platform | [Agent quickstart](https://docs.ammora.org/guides/agent-quickstart), `agent:tools` | Node24.18, actual account/policy, permitted Configs and limits; connect signer/approval UI and durable journal in trusted host code, then the lifecycle helper. Installing tools grants no signing authority. |
| Issued stablecoin pools | [Stablecoin quickstart](https://docs.ammora.org/guides/stablecoin-quickstart), unified planner `policy` | Reviewed issuer assets/decimals, roles, budgets and explicit `giwa-almm-unified-v1` profile; token policy -> pool -> LP -> swaps -> fee claims -> cleanup. No launch issuance or graduation prerequisite. |
| Fee sharing | [Fee sharing](https://docs.ammora.org/guides/fee-sharing), `launch:fee-config preview` | Own new-Config economics/recipients or existing actual fee rights, assets and positions. Creator/Partner, LP, DFS and external weighted-module claims have distinct rights and payout rules. |
| External revenue | [Self-service](https://docs.ammora.org/guides/self-service), `partner:standards` | Checked profile, compatible standard/source/controller and initial holder consent. The public CLIs prepare unsigned requests and reconcile receipts; wallet submission and durable journals belong to the partner application. Synthetic test standards are not arbitrary issuer/DEX support. |
| Token vesting | [Vesting](https://docs.ammora.org/guides/vesting), `launch:vesting-config` | Offline allocation first; supported token, actual funding account/recipient, raw quantities and schedule before create/claim. An existing completed observation lock is not a claimable fixture for a new partner. |

## Clarifications made

The partner quickstart includes common installation and explicit testnet/unsigned environment settings, an agent quickstart, product-specific first interfaces, required partner inputs, and continuation paths. It distinguishes installing the SDK from installing this repository's npm commands, ordinary launchpads from issued stablecoin pools, and unsigned external-source preparation from partner-owned wallet execution. Existing projects should not repeat installation or overwrite environment files when switching guides.

The agent graduation example comment now calls the retained amount unused input. On the documented GIWA ERC20 path it stays in the payer wallet; it is not a refund payment. The underlying agent/SDK behavior is unchanged.

## Qualification scope

- **PASSED_THIS_RUN:** product-guide command/source/fixture and local-link review; the entry note, guide and example catalog paths are checked together. No new executable implementation is introduced.
- **REUSED:** unchanged public SDK0.3.9 installation/type/helper/snippet proof, existing source-download and agent read-only smoke evidence after identity/integrity checks. Existing launchpad, Creator/Partner, LP delegation, unified stablecoin and external-source GIWA receipts/authority refusals retain their original source/runtime/asset/actor/block scope. See [current validation](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).
- **BLOCKED:** none found in supported-path navigation or command/source wiring. Actual new-partner execution still depends on its own valid addresses, rights, funds and supported deployment. New unsupported standards/implementations, restricted asset policies, real-issuer acceptance and production networks require separate qualification; this review does not mark them passed.
- **WAIVED:** none.
- **NOT_APPLICABLE:** SDK publication, GitHub CI, new signing/transactions, mainnet and backend/Indexer changes. Actual main/public Docs delivery is recorded separately from the source review.

Reopen affected proof if relevant SDK/source/gate/dependency, runtime/profile, caller/rights, assets, canonical receipt or preserved evidence integrity changes. Each new partner must run fresh read/simulation/authority checks for its own inputs before authorizing a transaction. Never report a zero claim, unsigned request, historical receipt or unsupported fixture as a new positive payment.

## Subsequent fresh execution — 2026-11-05

The [fresh public SDK 0.3.9 consumer report](FRESH-PARTNER-GIWA-039.md) now records actual documented command execution, a new 18-transaction launchpad/agent lifecycle, positive FeeVault/LP balances and approval cleanup. It explicitly separates new runs from reused stablecoin, external-source, vesting and prior delegation evidence. The original documentation-only review above remains historical.
