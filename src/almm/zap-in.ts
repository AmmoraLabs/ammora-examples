import { tokenAmount, slippage } from "../shared/input.js";
/**
 * Open a bin-pool position holding only one of the two tokens.
 *
 *   npm run almm:zap-in -- <poolAddress> <tokenIn> <amountIn> [width]
 *
 * Without this you would swap half your balance yourself, then deposit both sides, and
 * hope the price had not moved in between. The zap router does the swap and the deposit
 * in one transaction, so there is no window where the ratio can drift, and it returns
 * a position NFT to `recipient`.
 *
 * ── The two numbers that decide everything ────────────────────────────────────
 * `swapAmount` is how much of `amountIn` gets sold for the other side. It is a
 * choice, not a formula, and it is what makes a zap balanced or not:
 *
 *   swapAmount == 0           deposit one side only, no swap
 *   swapAmount == amountIn    sell everything, deposit the other side only
 *   in between                two-sided
 *
 * This example splits in half, which is the sane default for a range centred on
 * the active bin. It is not optimal: the swap moves the price, so selling exactly
 * half leaves a little of one side over. Getting to zero leftovers means solving
 * for the amount where post-swap holdings match the range's own ratio, which is a
 * loop of quote-and-adjust, and it belongs in your app rather than here.
 *
 * `expectedActiveId` with `maxActiveBinSlippage` is the protection worth
 * understanding. Between building this transaction and it being mined, someone
 * else's swap can move the active bin. Your range is then somewhere else relative
 * to the price than you intended. Naming the bin you planned against, and how far
 * it may drift, turns that into a revert instead of a surprise.
 *
 * ── minimumShares must be non-zero, every entry ───────────────────────────────
 * The position manager rejects a zero floor per bin outright, so passing an array
 * of zeros to "accept whatever comes back" reverts with InvalidConfiguration
 * before anything is deposited. The type does not say this, and the revert names
 * a struct field rather than the bin that failed, so it is worth stating.
 *
 * Real floors come from quoting the deposit: `quoteStrategyPosition` previews the
 * per-bin split, prices each bin's share, and applies your slippage to it. It also
 * refuses up front when the amounts are too small to give some bin a non-zero
 * share, which is the same condition, caught somewhere you can read it.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import { parseEventLogs, zeroAddress } from "viem";
import type { Address } from "viem";
import {
  ALMMClient,
  ALMMStrategy,
  almmZapRouterAbi,
  buildALMMZapIn,
  minOutFromSlippage,
} from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { amount, approve, asPool, main, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

/** Bins either side of the active one. Wider costs more tokens to fill. */
const DEFAULT_WIDTH = 5;

/** How far the active bin may move before the router should give up, in bins. */
const ACTIVE_BIN_SLIPPAGE = 2;

const slippageBps = slippage();

const erc721TransferAbi = [{
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: true, name: "tokenId", type: "uint256" },
  ],
}] as const;

main(async () => {
  const [poolArgument, tokenArgument, amountArgument, widthArgument] = process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (!tokenArgument || !amountArgument) {
    throw new Error("usage: npm run almm:zap-in -- <pool> <tokenIn> <amountIn> [width]");
  }
  const tokenIn = tokenArgument as Address;
  const width = Number(widthArgument ?? DEFAULT_WIDTH);

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;
  await requireContract(client, "pool", pool);
  await requireContract(client, "zap router", contracts.zapRouter);

  // Constructing the client proves the pool came from the reviewed factory. The zap
  // builders are plain encoders and do not check anything, so doing this first is what
  // stops an arbitrary address reaching the approval below.
  const sdk = new ALMMClient(client, pool, contracts.positionManager, contracts.binLens, clientOptions());
  const state = await asPool(pool, "a bin pool", () => sdk.getPoolState());

  const baseForQuote = tokenIn.toLowerCase() === state.baseToken.toLowerCase();
  if (!baseForQuote && tokenIn.toLowerCase() !== state.quoteToken.toLowerCase()) {
    throw new Error(`${tokenIn} is neither side of this pool`);
  }
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);
  const input = baseForQuote ? base : quote;
  const amountIn = tokenAmount(amountArgument, input.decimals);

  // Half in, half stays. See the header for why this leaves a remainder.
  const swapAmount = amountIn / 2n;

  // Price the swap leg through the SDK so the floor is a real number off the pool's
  // own curve, not a guess. Everything the router does after the swap is deposit.
  const quoted = await sdk.quoteExactInput(swapAmount, baseForQuote);
  const minimumSwapOut = minOutFromSlippage(quoted.amountOut, BigInt(slippageBps));

  const activeId = Number(state.activeId);
  const lowerBinId = activeId - width;
  const upperBinId = activeId + width;

  // What the router will hold once the swap leg is done. The half that was not sold
  // stays on the input side; the swap output lands on the other.
  const remainder = amountIn - swapAmount;
  const baseAmount = baseForQuote ? remainder : quoted.amountOut;
  const quoteAmount = baseForQuote ? quoted.amountOut : remainder;

  // Quote the deposit to get a real floor per bin. This throws rather than reverting
  // on chain when the amounts cannot fill every bin in the range.
  const shape = await sdk.quoteStrategyPosition(
    lowerBinId, upperBinId, baseAmount, quoteAmount, ALMMStrategy.Spot, slippageBps,
  );

  console.log(`pool        ${pool}`);
  console.log(`in          ${amount(amountIn, input.decimals, input.symbol)}`);
  console.log(`  swapping  ${amount(swapAmount, input.decimals, input.symbol)}`);
  console.log(`  for       ${amount(quoted.amountOut, (baseForQuote ? quote : base).decimals, (baseForQuote ? quote : base).symbol)} (quoted)`);
  console.log(`  floor     ${slippageBps} bps`);
  console.log(`bins        ${lowerBinId} .. ${upperBinId}  (active ${activeId})`);
  console.log(`  shares    ${shape.quotedShares.length} bins quoted, floors set ${slippageBps} bps below`);
  console.log(`aborts if the active bin moves more than ${ACTIVE_BIN_SLIPPAGE} bins`);
  console.log("");

  const transaction = {
    to: contracts.zapRouter,
    ...buildALMMZapIn({
      pool,
      tokenIn,
      amountIn,
      swapAmount,
      minimumSwapOut,
      lowerBinId,
      upperBinId,
      strategy: ALMMStrategy.Spot,
      expectedActiveId: activeId,
      maxActiveBinSlippage: ACTIVE_BIN_SLIPPAGE,
      minimumShares: shape.minimumShares,
      recipient: account.address,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    }),
  };

  // The router pulls `amountIn` from the caller, so the allowance is on the router and
  // for exactly that much. The zap builders return no approval requirements of their
  // own, unlike the client's plan methods, so it is stated here.
  await approve(
    [{ token: tokenIn, spender: contracts.zapRouter, amount: amountIn }],
    wallet,
    account,
    client,
  );

  // After the approval, not before: without an allowance the router cannot pull the
  // input, and the call would fail on the transfer rather than on anything the zap
  // itself got wrong. This still saves the zap's own gas, which is the larger half.
  await preflight(client, account, transaction, almmZapRouterAbi, "zap in");
  const hash = await send("zap in", transaction, wallet, account, client);
  const receipt = await client.getTransactionReceipt({ hash });
  const minted = parseEventLogs({
    abi: erc721TransferAbi,
    eventName: "Transfer",
    logs: receipt.logs,
  }).find((log) =>
    log.address.toLowerCase() === contracts.positionManager.toLowerCase()
    && log.args.from === zeroAddress
    && log.args.to.toLowerCase() === account.address.toLowerCase()
  );
  if (!minted) throw new Error("zap receipt contains no manager mint event");
  console.log(`  position token id: ${(minted.args as { tokenId: bigint }).tokenId}`);
});
