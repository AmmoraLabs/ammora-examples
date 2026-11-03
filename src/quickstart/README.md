# Ammora copy-and-run quick starts

These contract action files contain their own RPC and SDK setup. Copy the chosen
TypeScript file into your project. For `verify-deployment.ts`, `create-launch.ts` and
`safe-swap.ts`, also copy the reviewed `runtime-pins.giwa.json` beside it; `AMMORA_RUNTIME_PINS_FILE`
can select a reviewed local snapshot elsewhere. The other quickstarts need no data file.


```bash
npm init -y
npm pkg set type=module
npm install --save-exact @ammora-protocol/sdk@0.3.4 viem dotenv
npm install --save-dev tsx typescript @types/node
```


The files use ES modules and top-level `await`. `npm pkg set type=module` adds
`"type": "module"` to `package.json`; omitting it leaves a new npm project in
CommonJS mode and `tsx` refuses to start the quickstart.

SDK 0.3.4 is published under npm `latest` as of 2026-10-25; `beta` remains 0.3.3.
Math stays 0.3.0. A new project's unversioned `npm install @ammora-protocol/sdk` selects 0.3.4; the
command above pins that version exactly. In this repository use `npm ci --ignore-scripts`
to preserve the committed lockfile. Existing pins and lockfiles do not update automatically.
Installing the SDK does not activate a partner module, change recipients or grant a wallet permission.

For the GIWA Sepolia read-only walkthrough, copy `verify-deployment.ts`,
`check-aggregation.ts`, `list-configs.ts` and `runtime-pins.giwa.json` from this folder
into the project root. They need no `.env`, wallet or private key. Then run:


```bash
export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
npx tsx verify-deployment.ts
npx tsx check-aggregation.ts
npx tsx list-configs.ts 10
```


Transaction setup uses a throwaway testnet account. Never paste a private key into a source file or
commit an `.env` file.


```bash
export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
export AMMORA_PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
export AMMORA_SEND=1

npx tsx create-launch.ts YOUR_CONFIRMED_CONFIG_ID "My Ammora Token" MAT YOUR_HOSTED_METADATA_URI
npx tsx safe-swap.ts compounding 0xPOOL 0xTOKEN_IN 0.01
```


Optional environment variables:

- `AMMORA_RPC_URL` overrides the reviewed deployment's public RPC.
- `AMMORA_RUNTIME_PINS_FILE` selects a reviewed local runtime-pin JSON snapshot. Its chain, generation, slot and source commit must match the SDK deployment, with every contract covered.
- `AMMORA_SLIPPAGE_BPS` defaults to `50`, or 0.5%.
- `AMMORA_TOKEN_DECIMALS` defaults to the selected immutable Config's `tokenDecimals`; an
  explicit override must match that Config.

Keep these boundaries if you adapt a file:

1. Select one complete reviewed generation: `legacy` uses `giwaSepoliaPermissionless`; `auto-route` uses `giwaSepoliaAutoRouteDeployment` and its matching profiles. Never accept a factory/registry from a form or use the implicit historical V3 default.
2. Verify deployment runtime code at one explicit block before constructing a wallet-facing action.
3. Treat the successful receipt as the state boundary. Allow one transient transport retry at the same `receipt.blockNumber`, preserving both failures.
   Do not retry a deterministic revert or replace the block with an unpinned `latest` read.
4. Decode created addresses and IDs from the receipt instead of predicting them after submission.
5. Use `AmmoraSwapClient` for user swaps so model-specific quote arity, exact approvals, quote expiry,
   provenance and received-balance reconciliation stay inside one reviewed flow.
6. Treat the official route catalog as the Aggregation Router activation boundary. A canary address,
   successful transaction, or copied custom manifest must not enable wallet-facing aggregation.

The examples target testnet deployments. They are integration evidence, not a production-safety claim.

The aggregation check explicitly selects `giwaSepoliaAutoRoute` and its matching Core from the
published SDK, and verifies at its manifest-confirmed block. Other V4 quickstarts select `AMMORA_GIWA_GENERATION` (`legacy` by default). Do not mix contracts from the two generations.

SDK 0.3.0 adds two reviewed legacy compatibility contracts to the permissionless deployment.
The local snapshot pins all 29 contracts in each supported GIWA generation, including
those two SDK-reviewed compatibility runtimes. Its provenance records the reviewed
release manifests and SDK supplements. Partial maps, identity mismatches and conflicting
case aliases fail before execution. Every contract still goes through actual RPC
bytecode hash verification.
No expected hash is derived from observed RPC code.

New-contract read handoffs and ERC-20 quote funding are covered in the
[launchpad guide](https://docs.ammora.org/guides/src-launch-readme). For immediate dependent reads, use
`AMMORA_READ_RECEIPT=<successful creation hash>` with the shared read-only launch commands.

`AMMORA_RPC_INTERVAL_MS=600` serializes public calls, including the aggregation check.
Aggregation output uses `atomicMultiHop`, generic `venues` and `venuesDisabled`; an
empty venue map is not a promise that external pools are available. Native-router
capability is separate: use WETH/ERC-20 input for the new GIWA launch factory.

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md)
records the original CommonJS setup failure, its ESM correction and actual GIWA
runtime/Explorer, aggregation and Config-list results for the prior copied files.
The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) records the
local pin-snapshot replacement and its current validation.
