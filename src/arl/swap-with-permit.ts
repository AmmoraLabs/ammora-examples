import { tokenAmount, slippage } from "../shared/input.js";
/**
 * Swap through Permit2 with an exact token allowance and a one-use signature.
 *
 *   npm run arl:swap-with-permit -- <poolAddress> <amountIn> [base|quote]
 *
 * The wallet signs a message saying "this router may take exactly this much of this
 * token, once, before this time", and the router presents it when it pulls. Signing is
 * not a transaction. A fresh exact ERC-20 allowance may still require one approval
 * transaction first; unlike an unlimited approval, it is consumed by this transfer.
 *
 * ── Permit2, and the approval you still make ──────────────────────────────────
 * EIP-2612 lets a token accept signed approvals directly, but most tokens do not
 * implement it, including wrapped native and everything this launchpad mints.
 * Permit2 is the way round that: a canonical contract that can move the exact
 * approved amount when a matching signature is supplied.
 *
 * This example deliberately approves only the current input amount. That allowance
 * is consumed by the transfer, so a later run may need another approval, but a stale
 * unlimited allowance is never left behind.
 *
 * ── Funding and swapping are one call ─────────────────────────────────────────
 * The router pulls the tokens into a credit balance, then spends that credit on
 * the swap. Doing them as two transactions would leave funded credit sitting in
 * the router if the second failed, so they are batched through `multicall` and
 * either both happen or neither does.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address, Hex } from "viem";
import {
  DammV2Client,
  ammoraV3PermitRouterAbi,
  buildV3Permit2Funding,
  buildV3PermitMulticall,
  buildV3PermitPoolExactInput,
  minOutFromSlippage,
} from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { amount, approve, asPool, main, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

const NO_REFERRER = "0x0000000000000000000000000000000000000000" as Address;
const slippageBps = slippage();

main(async () => {
  const [poolArgument, amountArgument, sideArgument = "quote"] = process.argv.slice(2);
  const pool = address("ARL_POOL", poolArgument);
  if (!amountArgument) {
    throw new Error("usage: npm run arl:swap-with-permit -- <pool> <amountIn> [base|quote]");
  }
  if (sideArgument !== "base" && sideArgument !== "quote") {
    throw new Error("the side you are selling is base or quote");
  }

  const { wallet, account } = signer();
  const client = await reader();
  const target = deployment();
  const contracts = target.contracts.launch;
  const router = target.contracts.routers.permit;
  const permit2 = target.contracts.routers.permit2;

  await requireContract(client, "pool", pool);
  await requireContract(client, "permit router", router);
  await requireContract(client, "permit2", permit2);

  const sdk = new DammV2Client(
    client, pool, "concentrated", contracts.concentratedFactory, contracts.concentratedPositionManager, clientOptions(),
  );
  const state = await asPool(pool, "a concentrated pool", () => sdk.getPoolState());

  // Selling quote is the direction someone buying the pool's token takes; selling base is
  // the way back out. Permit works the same either way, since the signature only ever
  // describes the token going in.
  const sellBase = sideArgument === "base";
  const tokenIn = (sellBase ? state.baseToken : state.quoteToken) as Address;
  const [input, output] = await Promise.all([
    tokenInfo(client, sellBase ? state.baseToken : state.quoteToken),
    tokenInfo(client, sellBase ? state.quoteToken : state.baseToken),
  ]);
  const amountIn = tokenAmount(amountArgument, input.decimals);

  const quoted = await sdk.quoteExactInput(tokenIn, amountIn).catch(() => {
    throw new Error(`this pool cannot fill ${amountArgument} ${input.symbol}. Try a smaller amount`);
  });
  const minimumAmountOut = minOutFromSlippage(quoted.amountOut, BigInt(slippageBps));

  console.log(`pool     ${pool}`);
  console.log(`router   ${router}`);
  console.log(`in       ${amount(amountIn, input.decimals, input.symbol)}`);
  console.log(`out      ${amount(quoted.amountOut, output.decimals, output.symbol)} (quoted)`);
  console.log("");

  // Exact allowance only. `approve` also handles tokens that require a zero reset and
  // pins the confirmation read to the receipt block on lagging RPC endpoints.
  await approve(
    [{ token: tokenIn, spender: permit2, amount: amountIn }],
    wallet,
    account,
    client,
  );

  // A nonce is spent, not counted up: any unused number works, and reusing one is what
  // stops a signature being replayed. Deriving it from the clock keeps runs apart.
  const nonce = BigInt(Math.floor(Date.now() / 1000));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const signature = await wallet.signTypedData({
    account,
    domain: { name: "Permit2", chainId: target.chain.id, verifyingContract: permit2 },
    types: {
      TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      PermitTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "PermitTransferFrom",
    message: {
      permitted: { token: tokenIn, amount: amountIn },
      // The signature names the router, so it is useless to anyone else.
      spender: router,
      nonce,
      deadline,
    },
  }) as Hex;

  const transaction = {
    to: router,
    ...buildV3PermitMulticall([
      buildV3Permit2Funding({ token: tokenIn, amount: amountIn, nonce, deadline, signature }).data,
      buildV3PermitPoolExactInput(
        pool, tokenIn, amountIn, minimumAmountOut, account.address, deadline, NO_REFERRER,
      ).data,
    ]),
  };

  await preflight(client, account, transaction, ammoraV3PermitRouterAbi, "permit swap");
  await send("swap with permit", transaction, wallet, account, client);
});
