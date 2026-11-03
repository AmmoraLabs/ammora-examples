/** Read ETH and quote balance at one confirmed block; print a budget without signing. */
import { readFile } from "node:fs/promises";
import { erc20Abi } from "viem";
import { calculateAmmoraPortableGasBudget, verifyAmmoraPortableDeploymentAtBlock, assertAmmoraPortableBlockCanonical, type AmmoraPortableDeployment } from "@ammora-protocol/sdk";
import { address, readBlock, reader } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { requirePortableLifecycleAsset } from "./asset-model.js";
main(async () => {
  if (!process.argv[2] || !process.argv[3] || !process.argv[4]) throw new Error("Supply reviewed deployment manifest, account and estimated native gas cost (raw bigint)");
  const deployment = JSON.parse(await readFile(process.argv[2], "utf8")) as AmmoraPortableDeployment;
  requirePortableLifecycleAsset(deployment.nativeAsset);
  const account = address("ACCOUNT", process.argv[3]), client = await reader(), block = await readBlock(client);
  const context = await verifyAmmoraPortableDeploymentAtBlock(client, deployment, block.number);
  const [nativeBalanceRaw, quoteBalanceRaw] = await Promise.all([
    client.getBalance({ address: account, blockNumber: block.number }),
    client.readContract({ address: deployment.quoteAsset.token, abi: erc20Abi, functionName: "balanceOf", args: [account], blockNumber: block.number }),
  ]);
  const budget = calculateAmmoraPortableGasBudget({ assetModel: deployment.nativeAsset, nativeBalanceRaw,
    quoteBalanceRaw, estimatedGasCostNativeRaw: BigInt(process.argv[4]), safetyMarginBps: 2000n, nativeValueRaw: 0n });
  await assertAmmoraPortableBlockCanonical(context);
  printJson({ asOfBlock: block.number, asOfBlockHash: block.hash, budget, sendEnabled: false });
});
