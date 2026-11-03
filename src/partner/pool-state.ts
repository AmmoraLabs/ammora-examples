/** Direct partner V5 state; catalog/provenance and aggregation eligibility remain separate. */
import { readFile } from "node:fs/promises";
import { PartnerArlPoolClient } from "@ammora-protocol/sdk";
import { address, readBlock, reader } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { parsePartnerManifest } from "./manifest.js";
main(async () => {
  if (!process.argv[2]) throw new Error("Supply the deployment team's reviewed partner manifest");
  const deployment = parsePartnerManifest(await readFile(process.argv[2], "utf8"));
  const pool = address("PARTNER_POOL", process.argv[3]), client = await reader(), block = await readBlock(client);
  const sdk = new PartnerArlPoolClient(client, deployment, pool);
  printJson({ state: await sdk.getPoolState(block.number), sendEnabled: false });
});
