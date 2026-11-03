import { tokenAmount } from "../shared/input.js";
/**
 * Leave a bin-pool position and receive one token instead of two.
 *
 *   npm run almm:zap-out -- <tokenId> <tokenOut> <minimumAmountOut> [percent]
 *
 * The mirror of `almm:zap-in`. It withdraws a share of the position, sells whichever
 * side you did not ask for, and sends you a single token.
 *
 * ── The permission step, which is easy to miss ────────────────────────────────
 * The router does not hold your position, so it has to withdraw on your behalf,
 * and the position manager will not let it until you say so. Two separate things
 * have to be true:
 *
 *   1. You still own the token. The router checks `ownerOf` itself and rejects
 *      anyone else, so an approved third party cannot drain a position.
 *   2. You have granted the router `RemoveLiquidity` on this specific token.
 *
 * That grant is per token, not per wallet, which is the safer shape: it cannot be
 * turned into a standing licence over everything you hold. This example checks
 * the current permission and only sends the grant when it is missing, so a second
 * run costs one transaction rather than two.
 *
 * `percent` is `shareBps` in the call, in hundredths of a percent. It applies to
 * every bin the position occupies, so the shape you leave behind is the shape you
 * had.
 *
 * ── When this reverts with SlippageExceeded ───────────────────────────────────
 * Paying out in one token means selling the other, and the router requires that
 * swap to fill completely. In a thin pool it cannot, and the whole zap-out
 * reverts however small the share is. `minimumAmountOut` does not help, because
 * what failed is the fill, not the price.
 *
 * The way out is to take the position apart with `almm:add-liquidity`'s opposite,
 * removing to both tokens, and swap on your own terms afterwards. Zapping out is
 * a convenience that a pool has to be deep enough to offer.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import {
  PositionDelegatePermission,
  almmBinPoolAbi,
  almmPositionManagerAbi,
  almmZapRouterAbi,
  buildALMMZapOut,
  buildUpdateALMMPositionDelegate,
} from "@ammora-protocol/sdk";
import { address, deployment, reader, signer } from "../shared/env.js";
import { main, positionOwner, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

const DEFAULT_PERCENT = 100;

main(async () => {
  const [tokenArgument, tokenOutArgument, minimumArgument, percentArgument] = process.argv.slice(2);
  if (!tokenArgument || !tokenOutArgument || !minimumArgument) {
    throw new Error(
      "usage: npm run almm:zap-out -- <tokenId> <tokenOut> <minimumAmountOut> [percent]",
    );
  }
  const tokenId = BigInt(tokenArgument);
  const tokenOut = address("TOKEN_OUT", tokenOutArgument);
  const percent = Number(percentArgument ?? DEFAULT_PERCENT);
  if (!(percent > 0 && percent <= 100)) throw new Error("percent must be above 0 and at most 100");
  const shareBps = Math.round(percent * 100);

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;
  await requireContract(client, "zap router", contracts.zapRouter);

  const owner = await positionOwner(client, almmPositionManagerAbi, contracts.positionManager, tokenId);
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`position ${tokenId} belongs to ${owner}, not to you`);
  }

  const [pool] = await client.readContract({
    abi: almmPositionManagerAbi,
    address: contracts.positionManager,
    functionName: "positions",
    args: [tokenId],
  }) as readonly [Address, number, number];

  // The router only pays out in one of the pool's own tokens. Catching that here names
  // the argument; letting it through gets an UnsupportedToken revert two calls later.
  const [poolBase, poolQuote] = await Promise.all([
    client.readContract({ abi: almmBinPoolAbi, address: pool, functionName: "baseToken" }),
    client.readContract({ abi: almmBinPoolAbi, address: pool, functionName: "quoteToken" }),
  ]) as [Address, Address];
  if (![poolBase, poolQuote].some((side) => side.toLowerCase() === tokenOut.toLowerCase())) {
    throw new Error(
      `${tokenOut} is neither side of this pool. It holds ${poolBase} and ${poolQuote}`,
    );
  }
  const output = await tokenInfo(client, tokenOut);
  const minimumAmountOut = tokenAmount(minimumArgument, output.decimals);
  if (minimumAmountOut <= 0n) {
    throw new Error("minimumAmountOut must be above zero; quote the zap before submitting it");
  }

  console.log(`position    ${tokenId}`);
  console.log(`pool        ${pool}`);
  console.log(`withdrawing ${percent}% of every bin`);
  console.log(`receiving   ${tokenOut}`);
  console.log(`minimum     ${minimumArgument} ${output.symbol}`);
  console.log("");

  // Read the grant before spending gas on it. Permissions are a bitmask, so this asks
  // whether the one bit we need is already set and leaves any others alone.
  const granted = await client.readContract({
    abi: almmPositionManagerAbi,
    address: contracts.positionManager,
    functionName: "delegatePermission",
    args: [tokenId, contracts.zapRouter],
  }).catch(() => 0) as number | bigint;
  const permission = Number(granted);
  const needed = PositionDelegatePermission.RemoveLiquidity;

  if ((permission & needed) === 0) {
    await send(
      "grant remove permission",
      {
        to: contracts.positionManager,
        ...buildUpdateALMMPositionDelegate(tokenId, contracts.zapRouter, permission | needed),
      },
      wallet,
      account,
      client,
    );
  } else {
    console.log("  router already holds remove permission on this position");
  }

  const transaction = {
    to: contracts.zapRouter,
    ...buildALMMZapOut({
      tokenId,
      shareBps,
      tokenOut,
      // The raw builder cannot infer a withdrawal quote. Requiring this value on the CLI
      // prevents an executable public example from silently accepting any output price.
      minimumAmountOut,
      recipient: account.address,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    }),
  };

  // After the grant, since without it the router cannot withdraw and the call would fail
  // on the permission rather than on anything about the withdrawal itself.
  await preflight(client, account, transaction, almmZapRouterAbi, "zap out");
  await send("zap out", transaction, wallet, account, client);
});
