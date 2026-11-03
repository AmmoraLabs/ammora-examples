# Partner quickstart — Ammora SDK 0.3.8

Create new tokens with Ammora contracts and connect trading and fee sharing before and after graduation. The default path is **GIWA Sepolia · auto-route V4 · Concentrated Graduation**. Each financial operation calls contracts through the SDK and your configured RPC.

- [Implementation sequence and arguments: complete launchpad guide](https://docs.ammora.org/guides/launchpad)
- [Recipients, splits, payout addresses, and authority: fee-sharing guide](https://docs.ammora.org/guides/fee-sharing)

## 1. Install

Use Node 24.18.0 (`nvm use` with `.nvmrc`). The public GitHub repository, npm package and [Docs source downloads](https://docs.ammora.org/examples) are available without an invitation or npm login. Run the examples from a fresh clone:

```bash
git clone https://github.com/AmmoraLabs/ammora-examples.git
cd ammora-examples
npm ci --ignore-scripts
cp .env.giwa.example .env
```

The project pins public `@ammora-protocol/sdk@0.3.8`. To install only the SDK in your own application, use the following. This does not install the examples' npm commands.

```bash
npm install --save-exact @ammora-protocol/sdk@0.3.8 viem dotenv
```

## 2. Configure GIWA and make the first reads

The GIWA environment template selects the current profile as shown below. Do not mix Registry, Config ID, Factory, or Manager values from different deployment generations.

```dotenv
AMMORA_CHAIN_ID=91342
AMMORA_GIWA_GENERATION=auto-route
AMMORA_RPC_INTERVAL_MS=600
AMMORA_SEND=0
AMMORA_READ_RECEIPT=
```

Existing shell environment variables take precedence over `.env`; align them too. An empty `AMMORA_READ_RECEIPT` prevents reads being pinned to an old transaction. These reads require neither a private key nor funds.

```bash
npm run quickstart:verify
npm run quickstart:configs -- 10
npm run launch:get-config -- 6
```

Continue to previews after deployment verification passes. The `auto-route` generation name does not imply that every aggregation or native route is active. The default quote asset is an ERC20.

## 3. Prepare wallets and funds

| Role | Preparation |
| --- | --- |
| Config creator | Configuration wallet, gas ETH, and native Config creation costs |
| Creator / Partner | Actual token Creator and Partner fee recipient; each signs their own claims |
| Trading / depositing wallet | GIWA ETH for gas and the actual trading/deposit assets; WETH and ETH are separate balances |
| LP owner / delegate | Actual Manager NFT owner; grant fee authority only when delegation is needed |
| Distribution recipients / payout | Two to five distinct recipients when required, plus reviewed payout addresses |

Roles may use different wallets. Each sender needs gas ETH; inspect exact input amounts, creation costs, and approvals in the relevant preview. A separate payout address receives funds without gaining claim authority. `AMMORA_ACCOUNT` specifies the unsigned plan's caller; it does not change the signing wallet.

Keep CLI keys in your private local environment, never in source, commits, or frontend code. Applications should use the user's connected WalletClient. Use your team's addresses, assets, Configs, and position IDs instead of copying another wallet from examples or validation reports.

## 4. Connect configuration through claims

| Step | Flow | Detailed instructions |
| --- | --- | --- |
| 1 | Select recipients and Creator/Partner split → preview before/after graduation → create Config | [Fee configuration](https://docs.ammora.org/guides/fee-sharing#fee-config), [distribution preview](https://docs.ammora.org/guides/fee-sharing#fee-preview): `launch:fee-config` → `launch:config-json` |
| 2 | Create token → trade before graduation → graduate → trade after graduation | [Launchpad steps 4–7](https://docs.ammora.org/guides/launchpad); optionally [combine the first purchase](https://docs.ammora.org/guides/launchpad#atomic-first-buy) |
| 3 | Creator and Partner separately claim positive quote/token accruals, optionally to a payout address | [Creator/Partner claims](https://docs.ammora.org/guides/launchpad#creator-partner-claims): `launch:claim-fees` |
| 4 | Optionally fund a distribution vault with received assets; each recipient claims their index | [Multi-recipient distribution](https://docs.ammora.org/guides/launchpad#multi-recipient-fees): `dfs:create-json` → `dfs:state` → `dfs:fund` → `dfs:claim` |
| 5 | LP owner claims or grants fee authority → delegate claims → revoke | [LP delegation and claims](https://docs.ammora.org/guides/launchpad#lp-fee-claims): `arl:fee-delegate` / `arl:claim-position-fee` |
| 6 | Confirm successful receipts, transfer events, and payout balance increases | [Payment verification and read-only recovery](https://docs.ammora.org/guides/fee-sharing#verify-payment) |

The Creator percentage applies to **fees after the Protocol share**. Post-graduation distribution depends on LP positions and reinvestment settings; do not reuse the pre-graduation split formula. Claiming quote fees does not also claim issued-token fees.

DFS distributes one asset using fixed recipients and weights. If fees were paid to another address, that **payout wallet** must fund the vault. Assigning a vault as Partner recipient does not automatically fund it. LP permission `claim-fee-to-owner` pays only the owner; `claim-fee` permits a delegate to choose a separate payout. Neither grants locked-principal withdrawal rights or NFT ownership.

Default to `AMMORA_SEND=0` and enable `AMMORA_SEND=1` only for the specific send step. Follow each command's documented mode; not every command supports unsigned preview. Do not count zero claims as payments or resend an existing hash after a read failure.

## Validation scope

Read [current validation](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) before using historical test targets.

## Contract agents

Follow the [public agent quickstart](https://docs.ammora.org/guides/agent-quickstart) for a complete download, SDK 0.3.8 installation, 12 tool schemas and a keyless GIWA read. No GitHub invitation is needed. Your Config and agent wallet policy are selected by your own team; see [permission boundaries](https://docs.ammora.org/guides/self-service-access).

## Share this with a partner

Send this quickstart URL first, followed by the guide matching their product:

- Launchpad: [Config through graduation and fees](LAUNCHPAD.md).
- Agent platform: [tool integration and connected lifecycle](AGENT-LAUNCHPAD.md).
- Stablecoin issuer: [pool onboarding, trading and delegated claims](STABLECOIN-QUICKSTART.md).
- Every team: [fee recipients and claims](FEE-SHARING.md), [current validation](VALIDATION.md), and this [public source repository](https://github.com/AmmoraLabs/ammora-examples).

A short introduction you can forward:

> Start with the Ammora SDK 0.3.8 partner quickstart, then follow the launchpad, agent or stablecoin guide for your product. The examples connect directly to GIWA Sepolia contracts. Prepare your team's sender, fee recipient, LP owner and payout addresses; fund native ETH for gas and separate WETH or other input assets. First run deployment reads and unsigned previews. A valid launchpad Config can be created without individual Ammora approval. Stablecoin asset policies and administrator operations retain their on-chain role requirements. Review each approval and confirm each receipt before the next step.

Collect the team's intended product, network, token addresses/decimals, wallet roles and fee split before selecting a sample request. Token-policy administrators need their actual contract roles; no repository invitation or customer account grants those rights. Use the existing templates with the partner's own values instead of distributing funded wallets or live signer files.
