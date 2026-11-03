/** npm run routing:quote -- <almm|concentrated|compounding|dbc> <pool> <tokenIn> <tokenOut> <amountInRaw> <recipient> */
import { AmmoraRouteClient, resolveAmmoraFinalizedHead, type AmmoraSwapModel } from "@ammora-protocol/sdk";
import { address, deployment, reader } from "../shared/env.js";
import { printJson, rawAmount, slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
import { routeGeneration } from "./catalog.js";

main(async () => {
  const [model, poolArg, inArg, outArg, raw, recipientArg] = process.argv.slice(2);
  if (!["almm", "concentrated", "compounding", "dbc"].includes(model ?? "")) throw new Error("model must be almm, concentrated, compounding, or dbc");
  const pool = address("AMMORA_POOL", poolArg);
  const tokenIn = address("TOKEN_IN", inArg);
  const tokenOut = address("TOKEN_OUT", outArg);
  const recipient = address("AMMORA_RECIPIENT", recipientArg);
  const amountIn = rawAmount(raw, "amountInRaw");
  const client = await reader();
  const generation = routeGeneration(deployment().chain.id);
  // Let the SDK construct its read-only batched, freshness-checked transport.
  // The generic example reader does not include the SDK route freshness checks.
  const routes = await AmmoraRouteClient.create({ chainId: generation.route.chainId, rpcUrls: process.env.AMMORA_RPC_URL?.trim() ? [process.env.AMMORA_RPC_URL.trim()] : generation.route.rpcUrls, routeCatalog: generation.routeCatalog, deploymentCatalog: generation.deploymentCatalog, factoryProfiles: generation.factoryProfiles, pools: [{ model: model as AmmoraSwapModel, pool }], verificationBlock: await resolveAmmoraFinalizedHead([client], generation.route.finality) });
  const quote = await routes.quoteExactIn({ tokenIn, tokenOut, amountIn, recipient, slippageBps: slippage() });
  printJson({ generation: generation.route.slot, coreSlot: generation.core.slot, quote, venueObservations: routes.venueObservations, riskPolicy: routes.riskPolicy, note: "Quote only; revalidate expiry and route before execution. No wallet is created." });
});
