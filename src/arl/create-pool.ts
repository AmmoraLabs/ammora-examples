import { tokenAmount, integer } from "../shared/input.js";
/**
 * Create a concentrated (ARL) pool and seal its first position in the same call.
 *
 *   npm run arl:create-pool -- <baseToken> <quoteToken> <baseAmount> <quoteAmount> <minPrice> <maxPrice>
 *
 * The price and liquidity come from the seed solver, so both budgets are consumed instead
 * of one being left over. `createProductionPoolLocked` then creates, wraps and permanently
 * locks the first position before handing it over, so there is no moment where the creator
 * holds it unlocked, which is what makes "locked from block zero" a property rather than a
 * promise.
 *
 * Run `npm run arl:plan-seed` first to see the numbers without creating anything.
 */
import {
  ammConcentratedFactoryV4CreateAbi, dammV2StaticFeeConfig, planConcentratedSeed,
  sqrtPriceX64FromHumanPrice,
} from "@ammora-protocol/sdk";
import { address, deployment, explorerLink, reader, signer } from "../shared/env.js";
import { amount, approve, main, requireContract, tokenInfo } from "../shared/run.js";

/**
 * Prices on the command line are written the way a person says them: how many
 * quote tokens one base token costs. The pool works in raw units, so a pair
 * whose tokens disagree on decimals needs that gap folded in — pass the two
 * token decimals and the SDK does it.
 */
const sqrtPriceFromDecimal = (
  price: string,
  baseDecimals: number,
  quoteDecimals: number,
): bigint => sqrtPriceX64FromHumanPrice(tokenAmount(price, 18), 18, baseDecimals, quoteDecimals);

/** Minutes until the pool opens. Zero opens it immediately. */
const activationDelayMinutes = integer(process.env.AMMORA_ACTIVATION_DELAY_MINUTES ?? "0", "AMMORA_ACTIVATION_DELAY_MINUTES", 0, 525600);

main(async () => {
  const [baseArgument, quoteArgument, baseAmountArgument, quoteAmountArgument, minArgument, maxArgument] =
    process.argv.slice(2);
  const baseToken = address("AMMORA_BASE_TOKEN", baseArgument);
  const quoteToken = address("AMMORA_QUOTE_TOKEN", quoteArgument);
  if (!baseAmountArgument || !quoteAmountArgument || !minArgument || !maxArgument) {
    throw new Error(
      "usage: <baseToken> <quoteToken> <baseAmount> <quoteAmount> <minPrice> <maxPrice>",
    );
  }

  const { wallet, account } = signer();
  const client = await reader();
  const factory = deployment().contracts.launch.concentratedFactory;

  await requireContract(client, "base token", baseToken);
  await requireContract(client, "quote token", quoteToken);
  const [base, quote] = await Promise.all([
    tokenInfo(client, baseToken),
    tokenInfo(client, quoteToken),
  ]);

  const baseBudget = tokenAmount(baseAmountArgument, base.decimals);
  const quoteBudget = tokenAmount(quoteAmountArgument, quote.decimals);
  const sqrtMinPrice = sqrtPriceFromDecimal(minArgument, base.decimals, quote.decimals);
  const sqrtMaxPrice = sqrtPriceFromDecimal(maxArgument, base.decimals, quote.decimals);

  const seed = planConcentratedSeed(baseBudget, quoteBudget, sqrtMinPrice, sqrtMaxPrice);

  console.log(`factory    ${factory}`);
  console.log(`pair       ${base.symbol} / ${quote.symbol}`);
  console.log(`range      ${minArgument} .. ${maxArgument}`);
  console.log(`price      ${seed.sqrtPriceX64} (sqrt, Q64.64)`);
  console.log(`liquidity  ${seed.liquidity}`);
  console.log(`spends     ${amount(seed.baseUsed, base.decimals, base.symbol)}`);
  console.log(`           ${amount(seed.quoteUsed, quote.decimals, quote.symbol)}`);
  console.log("");

  const parameters = {
    baseToken,
    quoteToken,
    creator: account.address,
    feeBps: 100,
    sqrtMinPrice,
    sqrtMaxPrice,
    sqrtPrice: seed.sqrtPriceX64,
    liquidity: seed.liquidity,
    activationType: 0,
    collectFeeMode: 0,
    // A pool that opens later is what a genesis vault needs: its allocation is sold
    // before trading starts, and the pool refuses to install one once it is active.
    activationPoint: Number((await client.getBlock({ blockTag: "latest" })).timestamp) + activationDelayMinutes * 60,
    userSalt: `0x${"00".repeat(32)}` as const,
  } as const;

  // The factory reports exactly what it will pull, so the approvals are for that and
  // nothing more.
  const [pullBase, pullQuote] = await client.readContract({
    abi: ammConcentratedFactoryV4CreateAbi,
    address: factory,
    functionName: "quoteInitialLiquidity",
    args: [parameters],
  }) as readonly [bigint, bigint];

  await approve(
    [
      { token: baseToken, spender: factory, amount: pullBase },
      { token: quoteToken, spender: factory, amount: pullQuote },
    ],
    wallet,
    account,
    client,
  );

  // The deployed V4 factory takes (parameters, feeConfig); the fee shares
  // moved into the controller registry. dammV2StaticFeeConfig is the flat
  // fee with every optional mechanism switched off.
  const { request, result } = await client.simulateContract({
    abi: ammConcentratedFactoryV4CreateAbi,
    account,
    address: factory,
    functionName: "createProductionPoolLocked",
    args: [parameters, dammV2StaticFeeConfig(100, parameters.activationPoint)],
  });
  const [pool, tokenId] = result as readonly [`0x${string}`, bigint];

  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`creation reverted: ${explorerLink(hash)}`);

  console.log(`  createProductionPoolLocked: ${explorerLink(hash)}`);
  console.log(`\npool     ${pool}`);
  console.log(`position ${tokenId} is permanently locked and already in your wallet`);
});
