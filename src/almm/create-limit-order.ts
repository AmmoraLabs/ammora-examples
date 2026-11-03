import { tokenAmount } from "../shared/input.js";
/**
 * Place a resting order on a bin pool at a price you choose.
 *
 *   npm run almm:create-limit-order -- <pool> <base|quote> <amount> [binsAway]
 *
 * A swap takes whatever the pool offers now. A limit order sits in a single bin and is
 * filled by other people's swaps as price reaches it, so you name the price instead of
 * accepting it. Nothing is filled at the moment you place it.
 *
 * ── Which side you sell decides which way the order can sit ───────────────────
 * A bin above the active one holds base, and a bin below it holds quote. So an
 * order to sell base has to rest at or above the active bin, and one to sell
 * quote at or below. The manager rejects the other arrangement outright, since
 * it would be an order that is already through the money.
 *
 * `binsAway` is that distance. This example turns it into the signed offset the
 * manager wants, since it adds the offset to the active bin as given. Further out
 * is a better price and a longer wait.
 *
 * The bin also has to be free of the token you would be paid in. An order is
 * liquidity in a single bin, and joining a bin that already holds proceeds would
 * hand the new order a share of them, so the manager refuses.
 *
 * ── The order is a token ──────────────────────────────────────────────────────
 * Placing one mints an order id to `recipient`, and `almm:close-limit-order`
 * takes it from there: claiming whatever filled, cancelling whatever did not, and
 * collecting the fees the resting liquidity earned in the meantime.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import { parseEventLogs } from "viem";
import {
  ALMMClient,
  almmLimitOrderManagerAbi,
  buildCreateALMMLimitOrderRelative,
} from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { amount, approve, asPool, main, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

/** Bins away from the active one. One bin is one bin-step of price. */
const DEFAULT_BINS_AWAY = 2;

/** How far the active bin may drift before placing is abandoned. */
const ACTIVE_BIN_SLIPPAGE = 3;

main(async () => {
  const [poolArgument, sideArgument, amountArgument, binsArgument] = process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (sideArgument !== "base" && sideArgument !== "quote") {
    throw new Error("say which side you are selling: base or quote");
  }
  if (!amountArgument) {
    throw new Error("usage: npm run almm:create-limit-order -- <pool> <base|quote> <amount> [binsAway]");
  }
  const sellBase = sideArgument === "base";
  const binsAway = Number(binsArgument ?? DEFAULT_BINS_AWAY);
  if (!Number.isInteger(binsAway) || binsAway < 0) {
    throw new Error("binsAway must be a whole number of bins");
  }

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;
  await requireContract(client, "pool", pool);
  await requireContract(client, "limit order manager", contracts.limitOrderManager);

  const sdk = new ALMMClient(client, pool, contracts.positionManager, contracts.binLens, clientOptions());
  const state = await asPool(pool, "a bin pool", () => sdk.getPoolState());
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);
  const input = sellBase ? base : quote;
  const inputToken = sellBase ? state.baseToken : state.quoteToken;
  const inputAmount = tokenAmount(amountArgument, input.decimals);

  // The offset is signed and applied as `activeId + binOffset`, so the sign is what puts
  // the order on the correct side of the price: base sells rest above, quote sells below.
  // Passing a distance without the sign puts a quote sell above the price, which the
  // manager rejects as InvalidOrder because it would already be through the money.
  const activeId = Number(state.activeId);
  const binOffset = sellBase ? binsAway : -binsAway;
  const restingBin = activeId + binOffset;

  console.log(`pool       ${pool}`);
  console.log(`selling    ${amount(inputAmount, input.decimals, input.symbol)}`);
  console.log(`resting at bin ${restingBin}  (active ${activeId}, ${binsAway} away)`);
  console.log(`aborts if the active bin moves more than ${ACTIVE_BIN_SLIPPAGE} bins`);
  console.log("");

  const transaction = {
    to: contracts.limitOrderManager,
    ...buildCreateALMMLimitOrderRelative(
      pool,
      binOffset,
      sellBase,
      inputAmount,
      // One bin, so one floor. Zero would let the deposit mint nothing and still succeed;
      // 1 asks only that the order exists, which is what a resting order needs.
      1n,
      account.address,
      activeId,
      ACTIVE_BIN_SLIPPAGE,
      BigInt(Math.floor(Date.now() / 1000) + 600),
    ),
  };

  await approve(
    [{ token: inputToken, spender: contracts.limitOrderManager, amount: inputAmount }],
    wallet,
    account,
    client,
  );
  await preflight(client, account, transaction, almmLimitOrderManagerAbi, "create limit order");
  const hash = await send("create limit order", transaction, wallet, account, client);
  const receipt = await client.getTransactionReceipt({ hash });
  const created = parseEventLogs({
    abi: almmLimitOrderManagerAbi,
    eventName: "LimitOrderCreated",
    logs: receipt.logs,
  }).find((log) => log.address.toLowerCase() === contracts.limitOrderManager.toLowerCase());
  if (!created) throw new Error("limit-order receipt contains no creation event");
  console.log(`  order id: ${(created.args as { orderId: bigint }).orderId}`);
});
