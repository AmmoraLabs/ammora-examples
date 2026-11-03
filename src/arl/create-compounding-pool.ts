import { tokenAmount } from "../shared/input.js";
/**
 * Create a full-range pool whose fees compound back into it.
 *
 *   npm run arl:create-compounding-pool -- <base> <quote> <baseAmount> <quoteAmount> [compoundBps]
 *
 * The other pool this protocol can graduate a launch into. Where a concentrated pool
 * asks you to choose a price band and hands fees back to be claimed, a compounding pool
 * spans every price and folds a share of each fee straight into its own reserves.
 *
 * ── What that changes for whoever holds the position ──────────────────────────
 * `compoundBps` splits the LP fee in two. The compounding share simply stays in
 * the pool's quote reserve and is never paid out; the rest accrues as a claim,
 * the ordinary way.
 *
 * What that does is subtler than it first sounds, and worth checking on chain
 * rather than taking on faith. `totalLiquidity` does not move. The reserve behind
 * each unit of it grows instead, so a position is worth more without holding any
 * more liquidity, and there is nothing to remember to collect. Watching
 * `totalLiquidity` for evidence of compounding will show nothing happening;
 * `reserveQuote` against it is where it shows.
 *
 * ── Why a launch might prefer it ──────────────────────────────────────────────
 * A concentrated band has to be chosen, and a band chosen badly is liquidity
 * sitting where nobody trades. Full range has no such decision, and it cannot be
 * left behind by price. It buys that with capital efficiency: the same tokens are
 * spread across every price rather than concentrated where trading happens.
 *
 * The first position is permanently locked on creation, the same as
 * `arl:create-pool`, so there is no moment where the creator could withdraw it.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import { ammCompoundingFactoryV3Abi } from "@ammora-protocol/sdk";
import { address, deployment, explorerLink, reader, signer } from "../shared/env.js";
import { amount, approve, main, requireContract, tokenInfo } from "../shared/run.js";

/** Share of the LP fee that becomes reserves instead of a claim. */
const DEFAULT_COMPOUND_BPS = 5_000;

/** Total LP fee, in basis points of each trade. */
const FEE_BPS = 100;

main(async () => {
  const [baseArgument, quoteArgument, baseAmountArgument, quoteAmountArgument, compoundArgument] =
    process.argv.slice(2);
  if (!baseArgument || !quoteArgument || !baseAmountArgument || !quoteAmountArgument) {
    throw new Error(
      "usage: npm run arl:create-compounding-pool -- <base> <quote> <baseAmount> <quoteAmount> [compoundBps]",
    );
  }
  const baseToken = address("AMMORA_BASE_TOKEN", baseArgument);
  const quoteToken = address("AMMORA_QUOTE_TOKEN", quoteArgument);
  const compoundingFeeBps = Number(compoundArgument ?? DEFAULT_COMPOUND_BPS);
  if (!Number.isInteger(compoundingFeeBps) || compoundingFeeBps < 0 || compoundingFeeBps > 10_000) {
    throw new Error("compoundBps is between 0 and 10000");
  }

  const { wallet, account } = signer();
  const client = await reader();
  const factory = deployment().contracts.launch.compoundingFactory;
  await requireContract(client, "compounding factory", factory);
  await requireContract(client, "base token", baseToken);
  await requireContract(client, "quote token", quoteToken);

  const [base, quote] = await Promise.all([
    tokenInfo(client, baseToken),
    tokenInfo(client, quoteToken),
  ]);
  const baseAmount = tokenAmount(baseAmountArgument, base.decimals);
  const quoteAmount = tokenAmount(quoteAmountArgument, quote.decimals);

  // Full range means there is no band to solve for, which is the arithmetic
  // `arl:plan-seed` exists to do for a concentrated pool. What is left is the pool's own
  // convention, and it is not the geometric mean anyone would reach for first: the pool
  // derives reserves from the pair it is given as
  //
  //   baseAmount  = liquidity / sqrtPrice
  //   quoteAmount = liquidity * sqrtPrice / 2^128
  //
  // so going the other way, the price is the ratio of the deposits and the liquidity is
  // the base side scaled by that price. Passing sqrt(base * quote) instead is rejected
  // as InvalidLiquidity, which names the argument without saying what it should have been.
  const sqrtPrice = sqrtOf((quoteAmount << 128n) / baseAmount);
  const liquidity = baseAmount * sqrtPrice;

  const parameters = {
    baseToken,
    quoteToken,
    creator: account.address,
    feeBps: FEE_BPS,
    protocolFeeShareBps: 2_000,
    creatorFeeShareBps: 0,
    referralShareOfProtocolBps: 0,
    compoundingFeeBps,
    sqrtPrice,
    liquidity,
    activationType: 0,
    activationPoint: Math.floor(Date.now() / 1000),
    initialPositionPermanent: true,
    userSalt: `0x${"00".repeat(32)}` as const,
  } as const;

  console.log(`factory    ${factory}`);
  console.log(`pair       ${base.symbol} / ${quote.symbol}`);
  console.log(`seeding    ${amount(baseAmount, base.decimals, base.symbol)}`);
  console.log(`           ${amount(quoteAmount, quote.decimals, quote.symbol)}`);
  console.log(`fee        ${FEE_BPS} bps, of which ${compoundingFeeBps / 100}% compounds`);
  console.log("first position is locked permanently at creation");
  console.log("");

  await approve(
    [
      { token: baseToken, spender: factory, amount: baseAmount },
      { token: quoteToken, spender: factory, amount: quoteAmount },
    ],
    wallet,
    account,
    client,
  );

  const { request, result } = await client.simulateContract({
    abi: ammCompoundingFactoryV3Abi,
    account,
    address: factory,
    functionName: "createProductionPool",
    args: [parameters, staticFeeConfig(FEE_BPS, parameters.activationPoint)],
  });
  const pool = (Array.isArray(result) ? result[0] : result) as Address;

  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`creation reverted: ${explorerLink(hash)}`);
  console.log(`  createProductionPool: ${explorerLink(hash)}`);
  console.log(`\npool is live at ${pool}`);
});

/** Integer square root, so the seed price is exact rather than rounded through a float. */
function sqrtOf(value: bigint): bigint {
  if (value <= 1n) return value;
  let guess = value;
  let next = (value >> 1n) + 1n;
  while (next < guess) {
    guess = next;
    next = (guess + value / guess) >> 1n;
  }
  return guess;
}

/** A flat fee with every optional mechanism switched off, matching `arl:create-pool`. */
const staticFeeConfig = (cliffFeeBps: number, activationTime: number) => ({
  schedule: {
    cliffFeeBps, numberOfPeriods: 0, periodFrequency: 0, reductionFactorBps: 0, mode: 0,
  },
  marketCapFeeEnabled: false,
  marketCapFee: {
    mode: 0, cliffFeeBps: 0, numberOfPeriods: 0, sqrtPriceStepBps: 0,
    expirationDuration: 0, reductionFactorBps: 0, activationTime: 0, initSqrtPrice: 0n,
  },
  rateLimiterEnabled: false,
  rateLimiter: {
    cliffFeeBps: 0, feeIncrementBps: 0, maxLimiterDuration: 0, referenceAmount: 0n,
  },
  dynamicFee: {
    enabled: false, maxVolatilityAccumulator: 0, variableFeeControl: 0, binStepBps: 0,
    filterPeriod: 0, decayPeriod: 0, reductionFactorBps: 0, binStepQ64: 0n,
  },
  referralShareOfProtocolBps: 0,
  protocolFee2ShareBps: 0,
  protocolFee2Recipient: `0x${"00".repeat(20)}` as const,
  zapFeeBps: 0,
  activationTime,
});
