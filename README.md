# Ammora examples

Contract integration examples for **@ammora-protocol/sdk 0.3.9** on GIWA Sepolia.
MIT licensed. No Ammora invitation is required to read, install or use these examples.
Creating a launchpad Config is permissionless; a wallet owner still authorizes their transactions. Token-policy and administrator-only operations retain their contract permission checks.

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

## Choose a flow

- [Partner quickstart](PARTNER-QUICKSTART.md)
- [Config → issuance → trading → graduation → claims](LAUNCHPAD.md)
- [Agent tools and connected lifecycle](AGENT-LAUNCHPAD.md)
- [Fee splits, Creator/Partner claims and LP delegation](FEE-SHARING.md)
- [Stablecoin pool onboarding](STABLECOIN-QUICKSTART.md)
- [Vesting](VESTING.md)
- [All 190 contract/tool commands](docs/CONTRACT-FEATURES.md)
- [Validation and execution scope](VALIDATION.md)

Browse [public documentation](https://docs.ammora.org/) or [source downloads](https://docs.ammora.org/examples).

## Local checks

```sh
npm run check:files
npm test
npm run unified:typecheck
```

Tests are local and offline. Live transactions are separate, explicit operations. Confirm each submitted hash and canonical receipt before continuing; reuse the same journal and request ID after an uncertain response.
