import { tokenAmount } from "../shared/input.js";
/**
 * Seed a bin pool from one side, spread across a range.
 *
 *   npm run almm:seed-liquidity -- <pool> <base|quote> <amount> <lowerBin> <upperBin>
 *
 * Seeding funds a range from a single token and hands the position an operator and a fee
 * owner, which is the shape a launch uses to place its own liquidity. The caller must be the
 * operator, which the SDK checks before planning anything.
 */
import { parseEventLogs, zeroAddress } from "viem";
import { ALMMClient } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { amount, approve, asPool, main, requireContract, send, tokenInfo } from "../shared/run.js";

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
  const [poolArgument, sideArgument, amountArgument, lowerArgument, upperArgument] =
    process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (sideArgument !== "base" && sideArgument !== "quote") {
    throw new Error("usage: <pool> <base|quote> <amount> <lowerBin> <upperBin>");
  }
  if (!amountArgument || !lowerArgument || !upperArgument) {
    throw new Error("usage: <pool> <base|quote> <amount> <lowerBin> <upperBin>");
  }
  const lowerBinId = Number(lowerArgument);
  const upperBinId = Number(upperArgument);
  if (!Number.isInteger(lowerBinId) || !Number.isInteger(upperBinId) || upperBinId < lowerBinId) {
    throw new Error("bin ids must be whole numbers with upper at or above lower");
  }

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;

  await requireContract(client, "pool", pool);
  const sdk = new ALMMClient(client, pool, contracts.positionManager, contracts.binLens, clientOptions());
  const state = await asPool(pool, "a bin pool", () => sdk.getPoolState());
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);
  const side = sideArgument === "base" ? base : quote;

  console.log(`pool     ${pool}`);
  console.log(`seeding  ${amount(tokenAmount(amountArgument, side.decimals), side.decimals, side.symbol)}`);
  console.log(`range    bins ${lowerBinId} .. ${upperBinId}`);
  console.log("");

  const plan = await sdk.planSeedLiquidity({
    lowerBinId,
    upperBinId,
    tokenSide: sideArgument,
    amount: tokenAmount(amountArgument, side.decimals),
    strategy: 0,
    shareSlippageBps: 100,
    maxActiveBinSlippage: 5,
    recipient: account.address,
    // Who collects the position's fees, and who may operate it. Seeding exists so those
    // can differ from the owner; here they are all the caller.
    feeOwner: account.address,
    operator: account.address,
    caller: account.address,
    lockReleasePoint: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
  });

  await approve(plan.approvalRequirements, wallet, account, client);
  const hash = await send("seedLiquidity", plan.transaction, wallet, account, client);
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
  if (!minted) throw new Error("seed receipt contains no manager mint event");
  console.log(`  position token id: ${(minted.args as { tokenId: bigint }).tokenId}`);
});
