/** Read actual V5 state with a deployment-team-reviewed manifest; never substitute V4 addresses. */
import { readFile } from "node:fs/promises";
import { ArlV5FactoryClient, ArlV5PoolClient } from "@ammora-protocol/sdk";
import { parseV5Manifest } from "./manifest.js";
import { address, readBlock, reader } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  if (!process.argv[2]) throw new Error("Supply the independently reviewed V5 manifest; no built-in V5 profile is implied");
  // Raw input only: normalization and SDK on-chain verification produce the evidence.
  const deployment = parseV5Manifest(await readFile(process.argv[2], "utf8"));
  const pool = address("V5_POOL", process.argv[3]), client = await reader(), block = await readBlock(client);
  const factory = new ArlV5FactoryClient(client, deployment);
  const verification = await factory.verifyDeploymentAtBlock(block.number);
  const provenance = await factory.verifyPoolAtBlock(pool, block.number);
  const sdk = new ArlV5PoolClient(client, deployment, pool);
  printJson({ verification, provenance, fees: await sdk.getFees(block.number), sendEnabled: false });
});
