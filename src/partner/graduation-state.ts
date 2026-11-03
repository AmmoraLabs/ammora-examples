/** Separate from offline partner fixtures: authenticate the reviewed deployment and read chain state. */
import { readFile } from "node:fs/promises";
import { PartnerGraduationClient } from "@ammora-protocol/sdk";
import { address, readBlock, reader } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { parsePartnerManifest } from "./manifest.js";
main(async () => {
  if (!process.argv[2]) throw new Error("Supply the deployment team's reviewed partner manifest");
  const deployment = parsePartnerManifest(await readFile(process.argv[2], "utf8"));
  const curve = address("PARTNER_CURVE", process.argv[3]), client = await reader(), block = await readBlock(client);
  const sdk = new PartnerGraduationClient(client, deployment);
  await sdk.verifyDependencies(block.number, true);
  printJson({ preview: await sdk.previewPartnerGraduation(curve, block.number), blockNumber: block.number, sendEnabled: false });
});
