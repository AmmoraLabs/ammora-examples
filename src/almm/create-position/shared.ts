import { tokenAmount } from "../../shared/input.js";
// The three position-creation examples differ only in how the two sides are funded, so
// the call itself lives here and each script says what it is demonstrating.
import { parseEventLogs, zeroAddress } from "viem";
import { ALMMClient } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../../shared/env.js";
import { amount, approve, asPool, main, requireContract, send, tokenInfo } from "../../shared/run.js";

/** Bins either side of the active one, unless the caller says otherwise. */
const DEFAULT_WIDTH = 2;

const erc721TransferAbi = [{
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: true, name: "tokenId", type: "uint256" },
  ],
}] as const;

export const createStrategyPosition = (options: {
  label: string;
  strategy: number;
  describe: string;
  requireOneSided?: boolean;
}): void => main(async () => {
  const [poolArgument, baseArgument, quoteArgument, widthArgument] = process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (!baseArgument || !quoteArgument) {
    throw new Error(`usage: <pool> <baseAmount> <quoteAmount> [width]  (${options.label})`);
  }
  const width = widthArgument ? Number(widthArgument) : DEFAULT_WIDTH;
  if (!Number.isInteger(width) || width < 1) throw new Error("width must be a positive whole number of bins");

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

  const totalBaseAmount = tokenAmount(baseArgument, base.decimals, true);
  const totalQuoteAmount = tokenAmount(quoteArgument, quote.decimals, true);
  if (totalBaseAmount === 0n && totalQuoteAmount === 0n) {
    throw new Error("fund at least one side");
  }
  if (options.requireOneSided && totalBaseAmount !== 0n && totalQuoteAmount !== 0n) {
    throw new Error("this example funds one side, so pass 0 for the other");
  }

  // A two-sided position straddles the active bin, because that is where both tokens
  // are wanted. A one-sided one cannot: a bin below the active price holds quote and a
  // bin above it holds base, so funding only one side means the range has to sit on
  // that side of the price. Straddling with one token reverts in the pool, which is a
  // long way from where the mistake was made.
  const baseOnly = totalQuoteAmount === 0n;
  const [lowerBinId, upperBinId] = options.requireOneSided
    ? baseOnly
      ? [state.activeId + 1, state.activeId + width * 2]
      : [state.activeId - width * 2, state.activeId - 1]
    : [state.activeId - width, state.activeId + width];

  console.log(`pool     ${pool}`);
  console.log(`shape    ${options.label}: ${options.describe}`);
  console.log(`range    bins ${lowerBinId} .. ${upperBinId}  (active ${state.activeId})`);
  console.log(`base     ${amount(totalBaseAmount, base.decimals, base.symbol)}`);
  console.log(`quote    ${amount(totalQuoteAmount, quote.decimals, quote.symbol)}`);

  const plan = await sdk.planCreateStrategyPosition({
    lowerBinId,
    upperBinId,
    totalBaseAmount,
    totalQuoteAmount,
    strategy: options.strategy,
    shareSlippageBps: 100,
    // How far the active bin may move between quoting and landing before this reverts.
    maxActiveBinSlippage: 5,
    recipient: account.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
  });

  console.log(`bins     ${plan.quote.binIds.length} funded`);
  console.log("");

  await approve(plan.approvalRequirements, wallet, account, client);
  const hash = await send(
    `create ${options.label} position`, plan.transaction, wallet, account, client,
  );
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
  if (!minted) throw new Error("position receipt contains no manager mint event");
  console.log(`  position token id: ${(minted.args as { tokenId: bigint }).tokenId}`);
});
