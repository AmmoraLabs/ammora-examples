/**
 * Create an immutable Config and launch a token in one transaction.
 *
 *   npm run launch:quick-create -- <templateId> <saleSupply> <quoteThreshold> <name> <symbol> <metadataURI>
 *
 * This is the public Quick Create path. It is permissionless, but it is not a
 * reduced-security encoder: the connected client verifies the shared factory,
 * registry, one-shot forwarder and optional callback before returning a plan.
 * The receipt remains canonical if another Config is created between planning
 * and inclusion, so the example resolves both the final Config identity and the
 * launched token addresses from that receipt.
 */
import {
  buildRegisterConfigAndCreateAmmoraV4Launch,
  getAmmoraV4ConfigAtBlock,
  parseAmmoraV4ConfigCreatedReceipt,
  parseAmmoraV4LaunchCreatedReceipt,
  verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";
import { zeroAddress } from "viem";
import { readBlock, reader, signer, v4Deployment } from "../shared/env.js";
import { main, send } from "../shared/run.js";
import { deriveConfigFromTemplate } from "./config-from-template.js";

main(async () => {
  const [
    templateArgument,
    supplyArgument,
    thresholdArgument,
    name,
    symbol,
    metadataURI,
  ] = process.argv.slice(2);
  if (
    !templateArgument
      || !supplyArgument
      || !thresholdArgument
      || !name
      || !symbol
      || !metadataURI
  ) {
    throw new Error(
      "usage: <templateId> <saleSupply> <quoteThreshold> <name> <symbol> <metadataURI>",
    );
  }
  if (!/^\d+$/.test(templateArgument)) {
    throw new Error("template config id must be a positive integer");
  }

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
    BigInt(supplyArgument),
    BigInt(thresholdArgument),
  );

  const transaction = buildRegisterConfigAndCreateAmmoraV4Launch(config, curve, {
      name,
      symbol,
      metadataURI,
      creatorMetadataURI: metadataURI,
      tokenDecimals: config.tokenDecimals,
      callback: zeroAddress,
      callbackData: "0x",
  });

  console.log(`factory    ${contracts.factory}`);
  console.log(`registry   ${contracts.configRegistry}`);
  console.log(`template   #${templateArgument}`);
  console.log(`owner      ${account.address}`);
  console.log(`feeClaimer ${config.partnerRecipient}`);
  console.log(`totalSupply ${config.totalSupply}`);
  console.log(`migrationBase ${config.migrationBaseThreshold}`);
  console.log(`value      ${transaction.value} wei`);
  console.log("");

  const hash = await send(
    "quick create Config and launch",
    { to: contracts.factory, ...transaction },
    wallet,
    account,
    client,
  );
  const receipt = await client.getTransactionReceipt({ hash });
  const created = parseAmmoraV4ConfigCreatedReceipt(receipt, contracts.configRegistry);
  const launch = parseAmmoraV4LaunchCreatedReceipt(receipt, contracts.factory);
  const confirmed = await getAmmoraV4ConfigAtBlock(
    client,
    contracts.configRegistry,
    created.configId,
    receipt.blockNumber,
  );
  if (launch.configId !== created.configId
    || launch.configHash !== created.configHash
    || confirmed.configHash !== created.configHash
    || confirmed.identity.owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("atomic V4 Quick Create receipt does not match confirmed registry state");
  }

  console.log("");
  console.log(`config     #${created.configId}`);
  console.log(`hash       ${created.configHash}`);
  console.log(`owner      ${created.owner}`);
  console.log(`feeClaimer ${created.feeClaimer}`);
  console.log(`token      ${launch.token}`);
  console.log(`curve      ${launch.curve}`);
  console.log(`version    ${launch.protocolVersion}`);
  console.log(`block      ${receipt.blockNumber}`);
});
