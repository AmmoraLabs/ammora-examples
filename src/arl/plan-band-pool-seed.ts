import { tokenAmount } from "../shared/input.js";
/**
 * Work out the price and liquidity that seed a band pool from two fixed budgets.
 * Reads only. No key required, and nothing is created.
 *
 *   npm run arl:plan-seed -- <baseAmount> <quoteAmount> <minPrice> <maxPrice>
 *
 * Seeding a range pool by guessing a price leaves one side's remainder behind. Solving
 * for the price instead consumes both budgets down to rounding dust.
 */
import { planConcentratedSeed, sqrtPriceX64FromHumanPrice } from "@ammora-protocol/sdk";
import { main } from "../shared/run.js";

const parseDecimals = (label: string, value: string | undefined): number => {
  const decimals = Number(value ?? 18);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new RangeError(`${label} must be a whole number of decimals between 0 and 36`);
  }
  return decimals;
};

main(async () => {
  const [
    baseArgument, quoteArgument, minArgument, maxArgument, baseDecimalsArgument, quoteDecimalsArgument,
  ] = process.argv.slice(2);
  if (!baseArgument || !quoteArgument || !minArgument || !maxArgument) {
    throw new Error(
      "usage: npm run arl:plan-seed --"
      + " <baseAmount> <quoteAmount> <minPrice> <maxPrice> [baseDecimals] [quoteDecimals]",
    );
  }

  // Both default to 18, which is the common case, but a pair that disagrees has
  // to say so: prices are a ratio of raw units, and planning an 18/6 pair as
  // though it were 18/18 puts the price out by a factor of a trillion. That is
  // not a rounding error — it opens the pool far enough from the intended price
  // that the first swap takes one side of it entirely.
  const baseDecimals = parseDecimals("baseDecimals", baseDecimalsArgument);
  const quoteDecimals = parseDecimals("quoteDecimals", quoteDecimalsArgument);

  const baseAmount = tokenAmount(baseArgument, baseDecimals);
  const quoteAmount = tokenAmount(quoteArgument, quoteDecimals);
  const sqrtPriceFromDecimal = (price: string): bigint =>
    sqrtPriceX64FromHumanPrice(tokenAmount(price, 18), 18, baseDecimals, quoteDecimals);
  const sqrtMinPriceX64 = sqrtPriceFromDecimal(minArgument);
  const sqrtMaxPriceX64 = sqrtPriceFromDecimal(maxArgument);

  const plan = planConcentratedSeed(baseAmount, quoteAmount, sqrtMinPriceX64, sqrtMaxPriceX64);

  const leftoverBase = baseAmount - plan.baseUsed;
  const leftoverQuote = quoteAmount - plan.quoteUsed;
  const share = (left: bigint, total: bigint) =>
    total === 0n ? "0" : `${(Number(left * 1_000_000n / total) / 10_000).toFixed(4)}%`;

  console.log(`range        ${minArgument} .. ${maxArgument} quote per base`);
  console.log(`budget       base ${baseArgument}, quote ${quoteArgument}`);
  console.log(`decimals     base ${baseDecimals}, quote ${quoteDecimals}`);
  console.log("");
  console.log(`sqrtPriceX64 ${plan.sqrtPriceX64}`);
  console.log(`liquidity    ${plan.liquidity}`);
  console.log(`base used    ${plan.baseUsed}  (left ${leftoverBase}, ${share(leftoverBase, baseAmount)})`);
  console.log(`quote used   ${plan.quoteUsed}  (left ${leftoverQuote}, ${share(leftoverQuote, quoteAmount)})`);
  console.log("");
  console.log("Feed sqrtPriceX64 and liquidity to the factory's creation parameters.");
  console.log("createProductionPoolLocked seals the first position in the same call, so");
  console.log("there is no moment where the creator holds it unlocked.");
});
