import { tokenAmount } from "../shared/input.js";
import { slippage } from "../shared/input.js";
/**
 * Buy a pool's token with native ETH. No wrapping, no approval, one transaction.
 *
 *   npm run arl:swap-native -- <poolAddress> <ethAmount>
 *
 * Every other swap example here needs the input token already wrapped and already
 * approved. That is two transactions and a concept before anyone can trade, and it is
 * not how people hold money: they hold the chain's own coin.
 *
 * The native router closes that gap. It takes ETH as `msg.value`, wraps it, swaps it
 * through the pool and sends the output straight to the recipient. There is no approval
 * because there is no token to approve yet, and no leftover allowance afterwards.
 *
 * ── What it will and will not accept ──────────────────────────────────────────
 * The router asks an execution registry which factory a pool came from, and that
 * registry knows the concentrated pools. Bin (ALMM) pools are not registered, so
 * this route is not open to them; use `almm:swap` with wrapped input there.
 *
 * The pool must also hold the wrapped native token as one of its sides, which is
 * checked here before anything is sent, because the router's own refusal names a
 * token rather than the reason.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import { parseEther } from "viem";
import type { Address } from "viem";
import {
  DammV2Client,
  ammoraV3NativeRouterAbi,
  buildV3NativePoolExactInput,
  minOutFromSlippage,
} from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { amount, asPool, main, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

/** No referral attribution. A front end passes its own address to earn a share. */
const NO_REFERRER = "0x0000000000000000000000000000000000000000" as Address;

const slippageBps = slippage();

main(async () => {
  const [poolArgument, ethArgument] = process.argv.slice(2);
  const pool = address("ARL_POOL", poolArgument);
  if (!ethArgument) {
    throw new Error("pass an amount of ETH: npm run arl:swap-native -- <pool> <ethAmount>");
  }
  const nativeAmountIn = tokenAmount(ethArgument, 18);

  const { wallet, account } = signer();
  const client = await reader();
  const target = deployment();
  const contracts = target.contracts.launch;
  const router = target.contracts.routers.native;
  const wrapped = target.contracts.tokens.wrappedNative;

  await requireContract(client, "pool", pool);
  await requireContract(client, "native router", router);

  const sdk = new DammV2Client(
    client, pool, "concentrated", contracts.concentratedFactory, contracts.concentratedPositionManager, clientOptions(),
  );
  const state = await asPool(pool, "a concentrated pool", () => sdk.getPoolState());

  // Which side is the wrapped native token decides the direction, and its absence means
  // this route simply does not apply to this pool.
  const baseIsWrapped = state.baseToken.toLowerCase() === wrapped.toLowerCase();
  const quoteIsWrapped = state.quoteToken.toLowerCase() === wrapped.toLowerCase();
  if (!baseIsWrapped && !quoteIsWrapped) {
    throw new Error(
      `this pool holds ${state.baseToken} and ${state.quoteToken}, neither of which is the`
      + ` wrapped native token ${wrapped}, so ETH cannot be swapped into it directly`,
    );
  }

  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);
  const output = baseIsWrapped ? quote : base;

  // Price it as the wrapped token, which is exactly what the router deposits before the
  // swap reaches the pool. Quoting the native amount directly would price a token the
  // pool has never heard of.
  const quoted = await sdk.quoteExactInput(wrapped, nativeAmountIn).catch(() => {
    // The pool prices a swap by walking its own liquidity, and reverts rather than
    // returning a worse number when it runs out. That is a statement about size, not
    // about the arguments, so say which one.
    throw new Error(
      `this pool cannot fill ${ethArgument} ETH. Try a smaller amount, or add liquidity first`,
    );
  });
  const minimumAmountOut = minOutFromSlippage(quoted.amountOut, BigInt(slippageBps));

  console.log(`pool     ${pool}`);
  console.log(`router   ${router}`);
  console.log(`in       ${ethArgument} ETH (native, nothing to approve)`);
  console.log(`out      ${amount(quoted.amountOut, output.decimals, output.symbol)} (quoted)`);
  console.log(`floor    ${amount(minimumAmountOut, output.decimals, output.symbol)} at ${slippageBps} bps`);
  console.log("");

  const transaction = {
    to: router,
    ...buildV3NativePoolExactInput(
      pool,
      nativeAmountIn,
      minimumAmountOut,
      account.address,
      BigInt(Math.floor(Date.now() / 1000) + 600),
      NO_REFERRER,
    ),
  };

  await preflight(client, account, transaction, ammoraV3NativeRouterAbi, "native swap");
  await send("swap native", transaction, wallet, account, client);
});
