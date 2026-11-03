/**
 * Launch a token on a registered config.
 *
 *   npm run launch:create-launch -- <configId> <name> <symbol> <metadataURI> [decimals]
 *
 * The config decides the curve, the fees and what happens at graduation; this only names
 * the token. Read the config first with `launch:get-config`, because once a launch is created it
 * follows that config for its whole life.
 */
import {
  buildCreateAmmoraV4Launch,
  getAmmoraV4ConfigAtBlock,
  parseAmmoraV4LaunchCreatedReceipt,
  verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";
import { integer, rawAmount } from "../shared/input.js";
import { readBlock, reader, signer, v4Deployment } from "../shared/env.js";
import { main, send } from "../shared/run.js";

main(async () => {
  const [idArgument, name, symbol, metadataURI, decimalsArgument] = process.argv.slice(2);
  if (!idArgument || !name || !symbol || !metadataURI) {
    throw new Error("usage: <configId> <name> <symbol> <metadataURI> [decimals]");
  }
  if (!/^\d+$/.test(idArgument)) throw new Error("config id must be a positive integer");
  const configId = rawAmount(idArgument, "config id");
  // The curve stores balances in this many decimals; the contract accepts 6 to 9.

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
  const entry = await getAmmoraV4ConfigAtBlock(
    client,
    contracts.configRegistry,
    configId,
    snapshotBlock,
  );
  const tokenDecimals = integer(decimalsArgument ?? String(entry.config.tokenDecimals), "decimals", 6, 9);
  if (tokenDecimals !== entry.config.tokenDecimals) throw new Error("decimals must match the selected immutable Config");
  if (!entry.enabled) throw new Error(`config #${configId} is disabled, so it cannot be launched on`);

  const transaction = buildCreateAmmoraV4Launch({
    name,
    symbol,
    metadataURI,
    creatorMetadataURI: metadataURI,
    tokenDecimals,
  }, configId, entry.config.poolCreationFee);

  console.log(`factory   ${contracts.factory}`);
  console.log(`config    #${configId}  (${entry.segments.length} segment(s))`);
  console.log(`token     ${name} (${symbol}), ${tokenDecimals} decimals`);
  console.log(`fee       ${transaction.value ?? 0n} wei`);
  console.log("");

  const hash = await send(
    "createLaunch",
    { to: contracts.factory, ...transaction },
    wallet,
    account,
    client,
  );

  // The receipt is canonical. Do not infer token or curve addresses from an unconfirmed
  // latest-state read because public RPCs can lag immediately after a write.
  const receipt = await client.getTransactionReceipt({ hash });
  const created = parseAmmoraV4LaunchCreatedReceipt(receipt, contracts.factory);
  if (created.configId !== configId || created.configHash !== entry.configHash) {
    throw new Error("V4 launch receipt does not match the selected immutable Config");
  }
  console.log("");
  console.log(`token     ${created.token}`);
  console.log(`curve     ${created.curve}`);
  console.log(`version   ${created.protocolVersion}`);
  console.log(`block     ${receipt.blockNumber}`);
});
