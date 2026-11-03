/**
 * Create a bin pool for a token pair.
 *
 *   npm run almm:create-pool -- <baseToken> <quoteToken> <binStepBps> [activeId]
 *
 * The preflight runs first and refuses anything the factory would reject, such as an unsupported
 * token, a bin step outside policy, a pair that already has a pool at this step. Read its
 * complaints instead of guessing at a revert.
 */
import { ALMMFactoryClient } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { main, requireContract, send, tokenInfo } from "../shared/run.js";

main(async () => {
  const [baseArgument, quoteArgument, stepArgument, activeArgument] = process.argv.slice(2);
  const baseToken = address("AMMORA_BASE_TOKEN", baseArgument);
  const quoteToken = address("AMMORA_QUOTE_TOKEN", quoteArgument);
  if (!stepArgument) throw new Error("usage: <baseToken> <quoteToken> <binStepBps> [activeId]");
  const binStepBps = Number(stepArgument);
  const activeId = activeArgument ? Number(activeArgument) : 0;

  const { wallet, account } = signer();
  const client = await reader();
  const factoryAddress = deployment().contracts.liquidityMarketMaker.factory;

  await requireContract(client, "base token", baseToken);
  await requireContract(client, "quote token", quoteToken);
  const [base, quote] = await Promise.all([
    tokenInfo(client, baseToken),
    tokenInfo(client, quoteToken),
  ]);

  const factory = new ALMMFactoryClient(client, factoryAddress, clientOptions());
  const creation = await factory.planCreatePool({ baseToken, quoteToken, binStepBps, activeId });

  console.log(`factory   ${factoryAddress}`);
  console.log(`pair      ${base.symbol} / ${quote.symbol}`);
  console.log(`bin step  ${binStepBps} bps, active id ${activeId}`);
  console.log(`pool      ${creation.predictedPool} (predicted)`);
  console.log("");

  await send("create pool", creation.transaction, wallet, account, client);
  console.log(`\npool is live at ${creation.predictedPool}`);
});
