/** Verify raw custom deployment pins before constructing a portable planning context. */
import { readFile } from "node:fs/promises";
import { verifyAmmoraPortableDeploymentAtBlock, AmmoraPortableLifecyclePlanner, type AmmoraPortableDeployment, type AmmoraPortableLifecycleTargets } from "@ammora-protocol/sdk";
import { address, readBlock, reader } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { requirePortableLifecycleAsset } from "./asset-model.js";
main(async () => {
  if (!process.argv[2] || !process.argv[3]) throw new Error("Supply reviewed raw deployment and lifecycle target manifests");
  const deployment = JSON.parse(await readFile(process.argv[2], "utf8")) as AmmoraPortableDeployment;
  requirePortableLifecycleAsset(deployment.nativeAsset);
  const targets = JSON.parse(await readFile(process.argv[3], "utf8")) as AmmoraPortableLifecycleTargets;
  const curve = address("CURVE", process.argv[4]), client = await reader(), block = await readBlock(client);
  const context = await verifyAmmoraPortableDeploymentAtBlock(client, deployment, block.number);
  // Never cast input JSON to a verified context. Only the SDK verifier creates this one.
  const sdk = new AmmoraPortableLifecyclePlanner(context, targets);
  printJson({ pool: await sdk.discoverGraduatedPool(curve), feeSources: await sdk.discoverFeeVaultSources(curve), sendEnabled: false });
});
