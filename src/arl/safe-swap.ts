/**
 * Executes the preferred wallet-facing exact-input flow: reviewed pool,
 * revision-correct quote, exact approval, receipt-block simulation, swap, and
 * receipt-block output reconciliation.
 *
 *   npm run swap:safe -- <almm|concentrated|compounding|dbc> <pool> <tokenIn> <amountIn> [native]
 */
import { tokenAmount, slippage } from "../shared/input.js";
import { describeSwapStatus } from "../shared/status.js";
import {
  AmmoraSwapClient,
  type AmmoraSwapModel,
} from "@ammora-protocol/sdk";
import { deployment, address, explorerLink, reader, signer } from "../shared/env.js";
import { amount, main, requireContract, tokenInfo } from "../shared/run.js";

const models = new Set<AmmoraSwapModel>([
  "almm",
  "concentrated",
  "compounding",
  "dbc",
]);

main(async () => {
  const [modelArgument, poolArgument, tokenArgument, amountArgument, inputAssetArgument]
    = process.argv.slice(2);
  if (!models.has(modelArgument as AmmoraSwapModel)) {
    throw new Error("model must be almm, concentrated, compounding, or dbc");
  }
  if (!amountArgument) throw new Error("amountIn is required");
  if (inputAssetArgument && inputAssetArgument !== "native") {
    throw new Error("the optional fifth argument must be native");
  }
  const model = modelArgument as AmmoraSwapModel;
  const pool = address("POOL", poolArgument);
  const tokenIn = address("TOKEN_IN", tokenArgument);
  const { wallet, account } = signer();
  const client = await reader();
  await Promise.all([
    requireContract(client, "pool", pool),
    requireContract(client, "input token", tokenIn),
  ]);
  const input = await tokenInfo(client, tokenIn);
  const amountIn = tokenAmount(amountArgument, input.decimals);
  const swaps = await AmmoraSwapClient.create(client, { deploymentCatalog: { [deployment().chain.id]: deployment() } });
  const prepared = await swaps.prepareExactIn({
    model,
    pool,
    tokenIn,
    inputAsset: inputAssetArgument === "native" ? "native" : "erc20",
    amountIn,
    payer: account.address,
    recipient: account.address,
    slippageBps: slippage(),
    executionMode: "direct-wallet",
  });
  const output = await tokenInfo(client, prepared.quote.tokenOut);

  console.log(`model      ${model}`);
  console.log(`pay        ${amount(
    amountIn,
    input.decimals,
    inputAssetArgument === "native" ? "ETH" : input.symbol,
  )}`);
  console.log(`approval   ${prepared.approvalRequirements.length === 0 ? "not required" : "required"}`);
  console.log(`receive    ${amount(
    prepared.quote.expectedAmountOut,
    output.decimals,
    output.symbol,
  )} estimated`);
  console.log(`minimum    ${amount(
    prepared.quote.minimumAmountOut,
    output.decimals,
    output.symbol,
  )}`);
  console.log(`quote block ${prepared.quote.quoteBlockNumber}`);

  const result = await prepared.execute(wallet, {
    onStatus: (status) => console.log(`  ${describeSwapStatus(status)}`),
  });
  console.log(`transaction ${explorerLink(result.hash)}`);
  console.log(result.amountReceived === null
    ? "received    receipt-block balance verification unavailable"
    : `received    ${amount(result.amountReceived, output.decimals, output.symbol)} verified`);
});
