/** launch:migrate -- <curve>; migration only, no buy/approval. Default unsigned preview. */
import { AmmoraV4LaunchCurveClient, parseAmmoraV4MigratedReceipt, verifyAmmoraV4CoreAtBlock } from "@ammora-protocol/sdk";
import { address, readBlock, reader, signer, v4Deployment } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main, send } from "../shared/run.js";
main(async () => {
  if (process.argv.length !== 3) throw new Error("usage: <curve>");
  if (process.env.AMMORA_READ_RECEIPT?.trim()) throw new Error("Clear AMMORA_READ_RECEIPT; migration selects a fresh confirmed snapshot");
  const curve = address("AMMORA_LAUNCH_CURVE", process.argv[2]);
  const client = await reader(), c = v4Deployment().contracts.launch, block = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, { configRegistry: c.configRegistry, launchFactory: c.factory, graduationAdapter: c.graduationAdapter, feePolicy: c.feePolicy }, block.number);
  const sdk = new AmmoraV4LaunchCurveClient(client, curve, { launchFactory: c.factory, feePolicy: c.feePolicy });
  const state = await sdk.getStateAtBlock(block.number);
  if (state.status === 3) { printJson({ classification: "NOT_APPLICABLE", reason: "Already migrated; reconcile existing receipt, never repeat terminal buy", canonicalPool: state.canonicalPool }); return; }
  if (state.status !== 2) throw new Error(`Migration requires ReadyToMigrate (2), observed ${state.status}; no buy was submitted`);
  const caller = address("AMMORA_ACCOUNT"), plan = await sdk.planMigrateAtBlock(block.number);
  await client.call({ account: caller, ...plan.transaction, blockNumber: block.number });
  printJson({ mode: process.env.AMMORA_SEND === "1" ? "SEND_REQUESTED" : "UNSIGNED_PREVIEW", blockNumber: block.number, curve, ...plan });
  if (process.env.AMMORA_SEND !== "1") return;
  const { account, wallet } = signer();
  if (caller.toLowerCase() !== account.address.toLowerCase()) throw new Error("Signer differs from preview caller");
  const hash = await send("migrate ready launch", plan.transaction, wallet, account, client);
  const receipt = await client.getTransactionReceipt({ hash });
  const migrated = parseAmmoraV4MigratedReceipt(receipt, curve);
  const actual = await sdk.getStateAtBlock(receipt.blockNumber);
  if (actual.status !== 3 || actual.canonicalPool.toLowerCase() !== migrated.canonicalPool.toLowerCase()) throw new Error("Migration event/state mismatch");
  printJson({ hash, blockNumber: receipt.blockNumber, ...migrated });
});
