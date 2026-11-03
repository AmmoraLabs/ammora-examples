/** portable:curve-exact-output -- <deployment.json> <targets.json> <curve> <buy|sell> <outputRaw> <maximumInputRaw> <maxFeePerGasWei> [deadlineUnix]. */
import { readFile } from "node:fs/promises";
import { AmmoraPortableLifecyclePlanner, verifyAmmoraPortableDeploymentAtBlock, assertAmmoraPortableBlockCanonical, type AmmoraPortableDeployment, type AmmoraPortableLifecycleTargets } from "@ammora-protocol/sdk";
import { caller, deadline, execute, natural } from "../shared/actions.js";
import { address, reader, readBlock } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { requireHelper } from "../arl/optional-guards.js";
import { requirePortableLifecycleAsset } from "./asset-model.js";
import { main } from "../shared/run.js";
main(async () => {
  const [deploymentFile, targetsFile, curveArg, side, amountOut, maximumIn, maxFee, expiry] = process.argv.slice(2);
  if (!deploymentFile || !targetsFile || !["buy", "sell"].includes(side ?? "")) throw new Error("Supply reviewed deployment/targets, curve, buy|sell, output, maximum input and max fee");
  const deployment = JSON.parse(await readFile(deploymentFile, "utf8")) as AmmoraPortableDeployment;
  const targets = JSON.parse(await readFile(targetsFile, "utf8")) as AmmoraPortableLifecycleTargets;
  requireHelper(targets.exactOutputRouter, "exactOutputRouter");
  requirePortableLifecycleAsset(deployment.nativeAsset);
  const client = await reader(), block = await readBlock(client), account = caller();
  const context = await verifyAmmoraPortableDeploymentAtBlock(client, deployment, block.number);
  const plan = await new AmmoraPortableLifecyclePlanner(context, targets).planCurveExactOutput({ curve: address("CURVE", curveArg), account, recipient: account, baseForQuote: side === "sell", amountOutRaw: natural(amountOut, "outputRaw", true), maximumAmountInRaw: natural(maximumIn, "maximumInputRaw", true), deadline: expiry ? natural(expiry, "deadlineUnix", true) : deadline(), allowancePolicy: "prepare-approval", gas: { maxFeePerGasNativeRaw: natural(maxFee, "maxFeePerGasWei", true), safetyMarginBps: 2000n } });
  await assertAmmoraPortableBlockCanonical(context);
  printJson(plan);
  // Approval is one transaction, never an automatic follow-up swap. Re-run to obtain a fresh verified context and quote.
  const target = plan.status === "APPROVAL_REQUIRED" ? plan.quote.inputToken : targets.exactOutputRouter;
  await execute(plan.status === "APPROVAL_REQUIRED" ? "approve exact-output input; replan required" : "portable curve exact output", { client, caller: account, allowedTargets: [target] }, plan.transaction);
});
