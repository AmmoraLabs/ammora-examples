/**
 * Read a launch config, or list what is registered. No key required.
 *
 *   npm run launch:get-config              # list the first page
 *   npm run launch:get-config -- <configId>  # one config in detail
 *
 * A config is the shape of a launch: the curve, the fee schedule, what happens at
 * graduation. Launches reference one by id rather than restating it, so reading the config
 * tells you what a launch built on it will do.
 */
import {
  getAmmoraV4ConfigAtBlock,
  getAmmoraV4NextConfigId,
} from "@ammora-protocol/sdk";
import { readBlock, reader, v4Deployment } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";

main(async () => {
  const idArgument = process.argv[2];
  const client = await reader();
  const contracts = v4Deployment().contracts.launch;
  const { number: blockNumber } = await readBlock(client);

  if (!idArgument) {
    const nextConfigId = await getAmmoraV4NextConfigId(
      client,
      contracts.configRegistry,
      blockNumber,
    );
    const ids = Array.from(
      { length: Number(nextConfigId > 17n ? 16n : nextConfigId - 1n) },
      (_, index) => BigInt(index + 1),
    );
    const items: Awaited<ReturnType<typeof getAmmoraV4ConfigAtBlock>>[] = [];
    for (const configId of ids) {
      if (items.length > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
      items.push(await getAmmoraV4ConfigAtBlock(client, contracts.configRegistry, configId, blockNumber));
    }
    console.log(`registry  ${contracts.configRegistry}`);
    console.log(`as of     block ${blockNumber}`);
    console.log(`showing   ${items.length} config(s)`);
    for (const entry of items) {
      console.log(
        `  #${entry.configId}  ${entry.enabled ? "enabled " : "disabled"}`
        + `  segments ${entry.segments.length}`
        + `  quote threshold ${entry.config.migrationQuoteThreshold}`
        + `  owner ${entry.identity.owner}`,
      );
    }
    if (items.length === 0) console.log("\nnothing registered on this deployment yet");
    return;
  }

  if (!/^\d+$/.test(idArgument)) throw new Error("config id must be a positive integer");
  const entry = await getAmmoraV4ConfigAtBlock(
    client,
    contracts.configRegistry,
    BigInt(idArgument),
    blockNumber,
  );

  console.log(`config    #${idArgument}  ${entry.enabled ? "enabled" : "disabled"}`);
  console.log(`hash      ${entry.configHash}`);
  console.log(`segments  ${entry.segments.length}`);
  console.log(`owner     ${entry.identity.owner}`);
  console.log(`fee claim ${entry.identity.feeClaimer}`);
  console.log(`created   block ${entry.identity.createdAtBlock}`);
  console.log(`policy    ${entry.feePolicyVersion}`);
  console.log("");
  console.log(`quote threshold   ${entry.config.migrationQuoteThreshold}`);
  console.log(`base threshold    ${entry.config.migrationBaseThreshold}`);
  console.log(`total supply      ${entry.config.totalSupply}`);
  console.log(`cliff fee         ${entry.config.cliffFeeBps} bps`);
  console.log(`migration mode    ${entry.config.migrationMode}`);
  printJson({ config: entry.config, note: "Full inherited fee, recipient, vesting and LP policy. Config ownership does not redirect partner fees." });
  console.log("");
  for (const [index, segment] of entry.segments.entries()) {
    console.log(
      `  segment ${index}  sqrt ${segment.lowerSqrtPrice} .. ${segment.upperSqrtPrice}`
      + `  liquidity ${segment.liquidity}`,
    );
  }
});
