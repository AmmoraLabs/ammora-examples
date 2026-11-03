/**
 * Create a permissionless launch config by starting from one that already works.
 *
 *   npm run launch:create-config -- <templateConfigId> <saleSupply> <quoteThreshold>
 *
 * A config has around fifty fields covering the fee schedule, rate limiter, dynamic fee, graduation
 * mode, post-migration pool shape, vesting. Writing them all out from scratch is how a
 * launch ends up with a graduation that can never reconcile, so this reads an existing
 * config, changes the two things a new launch usually differs in, and creates a new one.
 *
 * Read the template first with `launch:get-config <id>` and make sure it is the shape you
 * want. No governance approval or registrar role is required. The caller becomes the
 * immutable Config owner, while `partnerRecipient` remains the fee claimer encoded in the Config.
 */
import {
  buildCreateAmmoraV4Config,
  getAmmoraV4ConfigAtBlock,
  parseAmmoraV4ConfigCreatedReceipt,
  verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";
import { readBlock, reader, signer, v4Deployment } from "../shared/env.js";
import { main, send } from "../shared/run.js";
import { deriveConfigFromTemplate } from "./config-from-template.js";

main(async () => {
  const [templateArgument, supplyArgument, thresholdArgument] = process.argv.slice(2);
  if (!templateArgument || !supplyArgument || !thresholdArgument) {
    throw new Error("usage: <templateConfigId> <saleSupply> <quoteThreshold>");
  }
  if (!/^\d+$/.test(templateArgument)) throw new Error("template config id must be a positive integer");
  const saleSupply = BigInt(supplyArgument);
  const migrationQuoteThreshold = BigInt(thresholdArgument);

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = v4Deployment().contracts.launch;
  const { number: snapshotBlock } = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, {
    configRegistry: contracts.configRegistry,
    launchFactory: contracts.factory,
    graduationAdapter: contracts.graduationAdapter,
    feePolicy: contracts.feePolicy,
  }, snapshotBlock);
  const template = await getAmmoraV4ConfigAtBlock(
    client,
    contracts.configRegistry,
    BigInt(templateArgument),
    snapshotBlock,
  );
  if (!template.enabled) throw new Error(`template Config #${templateArgument} is disabled`);

  const { config, curve } = deriveConfigFromTemplate(
    template,
    saleSupply,
    migrationQuoteThreshold,
  );

  console.log(`registry   ${contracts.configRegistry}`);
  console.log(`template   #${templateArgument}`);
  console.log(`sale       ${saleSupply}`);
  console.log(`threshold  ${migrationQuoteThreshold}`);
  console.log(`curve      sqrt ${curve[0]!.lowerSqrtPrice} .. ${curve[0]!.upperSqrtPrice}`);
  console.log(`liquidity  ${curve[0]!.liquidity}`);
  console.log(`owner      ${account.address}`);
  console.log(`feeClaimer ${config.partnerRecipient}`);
  console.log(`totalSupply ${config.totalSupply}`);
  console.log(`migrationBase ${config.migrationBaseThreshold}`);
  console.log("");

  // Validation runs before encoding, so a config whose graduation could never reconcile
  // fails here, not after buyers have deposited into it.
  const { data } = buildCreateAmmoraV4Config(config, curve, account.address);

  const hash = await send(
    "create config",
    { to: contracts.configRegistry, data },
    wallet,
    account,
    client,
  );
  const receipt = await client.getTransactionReceipt({ hash });
  const created = parseAmmoraV4ConfigCreatedReceipt(receipt, contracts.configRegistry);
  const confirmed = await getAmmoraV4ConfigAtBlock(
    client,
    contracts.configRegistry,
    created.configId,
    receipt.blockNumber,
  );
  if (confirmed.configHash !== created.configHash
    || confirmed.identity.owner.toLowerCase() !== created.owner.toLowerCase()
    || confirmed.identity.feeClaimer.toLowerCase() !== created.feeClaimer.toLowerCase()) {
    throw new Error("receipt-bound V4 Config identity does not match registry storage");
  }

  console.log("");
  console.log(`config     #${created.configId}`);
  console.log(`hash       ${created.configHash}`);
  console.log(`owner      ${created.owner}`);
  console.log(`feeClaimer ${created.feeClaimer}`);
  console.log(`block      ${created.createdAtBlock}`);
  console.log(`policy     ${created.feePolicyVersion}`);
});
