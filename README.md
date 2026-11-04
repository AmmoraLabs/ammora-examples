# Ammora examples

Contract integration examples for **@ammora-protocol/sdk 0.3.9** on GIWA Sepolia.
MIT licensed. No Ammora invitation is required to read, install or use these examples.
Creating a launchpad Config is permissionless; a wallet owner still authorizes their transactions. Token-policy and administrator-only operations retain their contract permission checks.

## Approval and review boundaries

**No Ammora invitation or per-team approval is needed for valid Config creation or an already supported, enabled contract path.** Your users still authorize their wallets, allowances and fee rights, supply funds and respect on-chain delays.

| Your integration | Can proceed directly | Needs separate review/authority |
| --- | --- | --- |
| Launchpad or agent | Own valid Config; supported quote/helper; issue, trade, graduate and claim under current rules | New/restricted quote policy, custom helper or privileged configuration; Config creation does not admit every asset |
| Stablecoin/ordinary pool | Supported pair/preset, or supported self-service probe for an unclassified exact-transfer token without an owner override | Owner policy blocking the operation or needing a change, new preset/implementation, issuer controls; a pool probe does not grant aggregation admission |
| External revenue source | New conforming instance of an already enabled standard, real holder consent and its registration delay | New standard, post-registration rights changes or stopped-module recovery |
| Fee claims/delegation | Actual beneficiary/feeOwner or its explicit current delegate, with the permitted payout | Other people's rights, protocol fee changes or a capability absent from that contract |

See **[PERMISSIONS.md](PERMISSIONS.md)** for who approves each action, the precise token-policy distinction and review cases. Wallet signatures, ERC20 approvals and local `reviewHash` checks are your own authorization, not Ammora customer approval. The bundled self-service standards are synthetic GIWA fixtures; they do not automatically support an arbitrary issuer or new implementation.

## Start

Use Node 24 and a fresh project:

```sh
git clone https://github.com/AmmoraLabs/ammora-examples.git
cd ammora-examples
npm ci --ignore-scripts
cp .env.giwa.example .env
npm run typecheck
npm run agent:tools
node --import tsx onboarding/agent-readonly.mjs
```

The default environment is GIWA Sepolia, auto-route and unsigned mode. Keep private keys on your own backend. Native ETH pays gas; WETH is a separate quote-token balance. Review your own addresses, raw amounts, allowances and session limits before enabling sends.

Partner teams should start with [PARTNER-QUICKSTART.md](PARTNER-QUICKSTART.md), then select the guide for their product and use their own wallet/asset configuration.

For a ready-to-forward Korean introduction with product links and permission boundaries, see [Partner introduction (한국어)](PARTNER-INTRO-KO.md).

## Choose a flow

- [Permission and review matrix](PERMISSIONS.md)
- [Partner quickstart](PARTNER-QUICKSTART.md)
- [Config → issuance → trading → graduation → claims](LAUNCHPAD.md)
- [Agent tools and connected lifecycle](AGENT-LAUNCHPAD.md)
- [Fee splits, Creator/Partner claims and LP delegation](FEE-SHARING.md)
- [Stablecoin pool onboarding](STABLECOIN-QUICKSTART.md)
- [External-source self-service registration](SELF-SERVICE.md)
- [New partner-address GIWA walkthrough and payment results](docs/PARTNER-PERSPECTIVE-GIWA.md)
- [Vesting](VESTING.md)
- [All 203 contract/tool commands](docs/CONTRACT-FEATURES.md)
- [SDK 0.3.9 module availability and deployment requirements](SDK-STATUS.md)
- [Validation and execution scope](VALIDATION.md)

Browse [public documentation](https://docs.ammora.org/) or [source downloads](https://docs.ammora.org/examples).

## Local checks

```sh
npm run check:files
npm test
npm run unified:typecheck
```

Tests are local and offline. Live transactions are separate, explicit operations. Confirm each submitted hash and canonical receipt before continuing; reuse the same journal and request ID after an uncertain response.
