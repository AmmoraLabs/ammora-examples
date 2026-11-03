import { tokenAmount } from "../shared/input.js";
/**
 * Open several bin positions in one transaction.
 *
 *   npm run almm:create-extended-positions -- <pool> <baseAmount> <quoteAmount> <width> <count>
 *
 * A position covers a bounded number of bins, so covering a wide range means several of
 * them. Doing it in one call keeps them at one price instead of letting the market move
 * between transactions.
 */
import { parseEventLogs, zeroAddress } from "viem";
import { ALMMClient } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { explorerLink } from "../shared/env.js";
import { amount, approve, asPool, main, requireContract, send, tokenInfo } from "../shared/run.js";

/** The mint shows up as an ERC-721 transfer from the zero address. */
const erc721TransferAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

main(async () => {
  const [poolArgument, baseArgument, quoteArgument, widthArgument, countArgument] =
    process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (!baseArgument || !quoteArgument || !widthArgument || !countArgument) {
    throw new Error("usage: <pool> <baseAmount> <quoteAmount> <width> <count>");
  }
  const width = Number(widthArgument);
  const count = Number(countArgument);
  if (!Number.isInteger(width) || width <= 0) throw new Error("width must be a positive whole number");
  if (!Number.isInteger(count) || count <= 0) throw new Error("count must be a positive whole number");

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

  const totalBase = tokenAmount(baseArgument, base.decimals, true);
  const totalQuote = tokenAmount(quoteArgument, quote.decimals, true);
  // Split evenly, giving the last position whatever the division left over so the whole
  // budget is used.
  const perBase = totalBase / BigInt(count);
  const perQuote = totalQuote / BigInt(count);

  const positions = Array.from({ length: count }, (_, index) => {
    const lowerBinId = state.activeId + index * width - Math.floor((count * width) / 2);
    const upperBinId = lowerBinId + width - 1;
    const last = index === count - 1;
    const baseAmount = last ? totalBase - perBase * BigInt(count - 1) : perBase;
    const quoteAmount = last ? totalQuote - perQuote * BigInt(count - 1) : perQuote;
    return {
      lowerBinId,
      upperBinId,
      depositChunks: [[{ binId: lowerBinId, baseAmount, quoteAmount }]],
    };
  });

  console.log(`pool      ${pool}`);
  console.log(`positions ${count}, ${width} bin(s) each`);
  console.log(`range     bins ${positions[0]!.lowerBinId} .. ${positions.at(-1)!.upperBinId}`);
  console.log(`budget    ${amount(totalBase, base.decimals, base.symbol)}`);
  console.log(`          ${amount(totalQuote, quote.decimals, quote.symbol)}`);
  console.log("");

  const plan = await sdk.planCreateExtendedPositions({
    positions,
    shareSlippageBps: 100,
    recipient: account.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
  });

  await approve(plan.approvalRequirements, wallet, account, client);

  // Two phases: mint the empty positions, then fund them. The funding calls need the token
  // ids the first phase minted, so the SDK hands back a builder, not a transaction.
  //
  // Take each id from its own mint receipt. Simulating the call beforehand looks like it
  // should work and does not: the simulation for the second position can be served from a
  // node that has not applied the first mint yet, so it returns the id already taken. The
  // mints still land correctly, but the funding calls are then aimed one position behind,
  // and the pool rejects a bin the position does not span. The receipt cannot be stale.
  const tokenIds: bigint[] = [];
  for (const [index, transaction] of plan.createTransactions.entries()) {
    const hash = await wallet.sendTransaction({
      account, chain: wallet.chain, to: transaction.to, data: transaction.data,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`creating position ${index} reverted`);

    const minted = parseEventLogs({
      abi: erc721TransferAbi,
      eventName: "Transfer",
      logs: receipt.logs,
    }).find((log) =>
      log.address.toLowerCase() === contracts.positionManager.toLowerCase()
      && log.args.from === zeroAddress
      && log.args.to.toLowerCase() === account.address.toLowerCase()
    );
    if (!minted) throw new Error(`creating position ${index} minted no position token`);
    const tokenId = (minted.args as { tokenId: bigint }).tokenId;

    tokenIds.push(tokenId);
    console.log(
      `  position ${index} minted as token ${tokenId}: ${explorerLink(hash)}`,
    );
  }

  for (const [index, transaction] of plan.buildFundingTransactions(tokenIds).entries()) {
    await send(`fund chunk ${index}`, transaction, wallet, account, client);
  }
});
