/** A source-specific positive FeeVault claim with independent ETH/WETH gas budgeting. */
import { readFile } from "node:fs/promises";
import { verifyAmmoraPortableDeploymentAtBlock, AmmoraPortableLifecyclePlanner, assertAmmoraPortableBlockCanonical, type AmmoraPortableDeployment, type AmmoraPortableLifecycleTargets } from "@ammora-protocol/sdk";
import { address, readBlock, reader } from "../shared/env.js";
import { caller, execute, natural } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { requirePortableLifecycleAsset } from "./asset-model.js";
main(async () => {
  if (!process.argv[2] || !process.argv[3]) throw new Error("Supply reviewed deployment and lifecycle target manifests, curve, source kind and max fee per gas (wei)");
  const deployment = JSON.parse(await readFile(process.argv[2], "utf8")) as AmmoraPortableDeployment;
  requirePortableLifecycleAsset(deployment.nativeAsset);
  const targets = JSON.parse(await readFile(process.argv[3], "utf8")) as AmmoraPortableLifecycleTargets;
  const account = caller(), curve = address("CURVE", process.argv[4]), client = await reader(), block = await readBlock(client);
  const context = await verifyAmmoraPortableDeploymentAtBlock(client, deployment, block.number);
  const sdk = new AmmoraPortableLifecyclePlanner(context, targets);
  const sources = await sdk.discoverFeeVaultSources(curve);
  const source = sources.find(item => item.kind === process.argv[5]);
  if (!source) throw new Error("Requested source kind was not discovered at this block");
  const plan = await sdk.planFeeVaultClaim({ source, account, beneficiary: account, token: deployment.quoteAsset.token,
    minimumAmountRaw: 1n, gas: { maxFeePerGasNativeRaw: natural(process.argv[6], "max fee per gas", true), safetyMarginBps: 2000n } });
  await assertAmmoraPortableBlockCanonical(context);
  printJson({ claim: plan.claim, gasBudget: plan.gasBudget, asOfBlock: block.number, payoutVerified: false });
  await execute("portable-source-claim", { client, caller: account, allowedTargets: [source.source] }, plan.transaction);
});
