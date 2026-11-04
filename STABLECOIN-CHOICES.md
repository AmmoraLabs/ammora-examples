# Stablecoin issuers: choosing an integration path

Use this guide to choose model, fees, payout, and withdrawal conditions for the [partner integration](https://docs.ammora.org/guides/stablecoin-partner). It describes **public SDK 0.3.9 / GIWA Sepolia 91342**, with on-chain state rechecked on 2026-10-29. It does not extend support approval to other chains or official issuer assets.

## Approval and review boundaries

Choosing a model does not itself grant token, preset, fee or administrator rights. A partner may use an already supported pair and enabled preset without per-team Ammora approval, with its own liquidity and current wallet/feeOwner authorization. Where supported, an unclassified exact-transfer ERC20 can be registered by a small round-trip probe.

New/restricted asset policies, new presets, unreviewed implementations and real-issuer controls require the designated Registry/Factory owner or issuer review. A probe does not grant aggregation admission. See the [common permission matrix](PERMISSIONS.md); the [quickstart](STABLECOIN-QUICKSTART.md) supplies the selected deployment's actual checks.

## Recommended starting point

**Start a first pilot with ALMM, direct LP-owner fee claims, and one reviewed pair.** New LP entry, swaps in both directions, positive claims, full share withdrawal, and empty-NFT closure were verified. A basic issuer DEX pilot does not require delegation, arbitrary payouts, and automatic rebalancing from the outset. If issuer treasury owns the LP, default LP fees are paid to that owner. Do not substitute treasury key sharing for permission separation. Validate actual multisig or smart-account signing/execution separately.

**Choose fees separately.** The default ALMM's 30bp is an executable technical path, not a commercial recommendation for stable/stable trading. If low fees are a contractual requirement, obtain a reviewed preset on the official deployment first. The isolated synthetic 1bp result is verified, but its addresses cannot be copied into a real-asset issuer manifest.

## Choose by required capability

| Required capability | Path | Start or hold condition |
|---|---|---|
| Basic pool, trading, direct LP claims, full exit | **Default ALMM** | Technical pilot if the current 30bp default is explicitly accepted; never silently raise requested fees/caps |
| Low fees for stable/stable trading | **Reviewed low-fee ALMM preset** | Canonical factory owner supplies ID, complete hash, enabled state, fee cap, and protocol share; pass readiness first. **Real-asset pilot BLOCKED** until the agreed official preset is confirmed |
| Fee-only delegation to a specific wallet and separate payout | **Managed ARL** | Reuse verified delegation/payout/unauthorized-rejection evidence if the 25bp floor, retained final 1 raw liquidity, and minimum-only reseeding limits are acceptable |
| Low fees, strict fee-only delegation, complete closure | **Review the ALMM extension that meets these conditions** | The default partner path does not combine them. Integrate the separately reviewed SDK/contracts/examples and authority/accounting checks; do not use ARL permission numbers in ALMM |
| Fixed separation of LP owner and feeOwner, or third-party claim triggering | **Review advanced ALMM separately** | Bootstrap feeOwner and permissionless claim exist, but differ from the P0-tested creation/claim flow. Do not label them unsupported or fully validated without review |
| Trading yield-share tokens such as cUSD and stcUSD | **Review asset conversion/redemption separately** | Do not assume a 1:1 stable price before checking share exchange rates and redemption limits |

ALMM position delegate bits are AddLiquidity=1, RemoveLiquidity=2, and RemoveToOwner=4; they are not ARL fee-only permissions. ALMM permissionless ClaimFee=1 separately allows **anyone to trigger a claim**, rather than allowlisting one fee-only wallet. Payment remains fixed to feeOwner; it does not permit an arbitrary recipient at claim time. These advanced features do not automatically clear the existing P0 blockers.

## Agree on fees and revenue rights

1. Specify total swap fees in bps: 1bp=0.01%, 25bp=0.25%, 30bp=0.30%. Include the maximum enabled dynamic fee in the cap, and agree on net output/minOut and depth at target order sizes.
2. Protocol share is a fraction of swap fees. Default ALMM's 1,000bp is **10% of fees**, not principal; protocol fees do not automatically belong to the pool creator or issuer.
3. LP income follows actual LP shares and feeOwner rights. Record issuer, LP owner, operator, fee claimant, payout, and protocol feeRecipient separately. Grant only needed permissions.
4. Check discovery's economics.owner and feeRecipient. The controlled wallet is not canonical factory owner; wanting lower fees does not authorize arbitrary governance changes or registrar registration.
5. This ALMM revision has no on-chain cooldown for owner fee changes. Reviewing a preset hash verifies initial creation conditions, not permanent immutability of every setting. Recheck actual fees, owner, and policy at planning/execution. Stop new exposure and review if caps, price/cost, or issuer conditions change; reconcile minOut, deadline, and execution receipt too.

1bp is a technically validated candidate. Agree on commercial fees using asset volatility/redemption/liquidity costs and LP/MM budgets and target orders. This guide guarantees no revenue.

## Inputs required from the issuer

| Input | Required review |
|---|---|
| Asset identity | GIWA chain ID, official base/quote addresses, decimals, and approval scope; never choose by symbol alone |
| Controls | Runtime/source, proxy implementation/admin, owner/roles, mint/burn, pause/blacklist, upgrade, and responsible parties |
| Wallets and funds | LP owner, actual balances of both ERC20s, sender gas ETH, claim/payout wallets; ETH is distinct from WETH |
| Economics and operations | Model, total fee cap/protocol share, bins/ranges, amount caps, slippage/minOut, gas, deadlines, and withdrawal/stop responsibility |
| Price and redemption | Independent source, observation time, validity, and actual redemption/exit terms; a pool's spot price cannot certify its own peg |

Templates without official FDUSD/cUSD assets, authority review, and partnership approval remain **BLOCKED**. Connect normal exact-transfer ERC20s issued natively on GIWA; do not turn this into Ammora token reissuance or Launch Config/graduation. This path does not approve FOT, rebasing, or unreviewed proxy/issuer ABI behavior.

## When running the guide now

- Liquidity was withdrawn from historical synthetic verification pools. A valid address is not necessarily a currently tradable market. Discovery's existing-pool result means review that address instead of recreating it; create your own **new LP** and review funding/depth.
- Do not reuse burned ALMM NFTs #19/#20 or isolated #1. Record the collection and ID from the actual new receipt.
- Price review in stored October 28 manifests has expired; blocking a fresh swap is expected. Review real independent price/redemption data and create a new manifest/plan instead of merely changing observedAt to now.
- Reference-price expiry is not an independent prerequisite for legitimate claims/withdrawals. Actual NFT permissions, issuer pause/blacklist, and transfer restrictions still apply.
- Do not resend success/unknown hashes. Reconcile journal, nonce, receipt, canonical block, and exact-block balances first.

Review both the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) and [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).
