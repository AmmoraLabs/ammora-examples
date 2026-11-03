import { AMMORA_FEE_POLICY_VERSION, AmmoraV4LaunchCurveClient, ammoraLaunchFactoryV4Abi, getAmmoraV4ConfigAtBlock,
  parseAmmoraV4MigratedReceipt, parseAmmoraLaunchVestingCreatedReceipt, verifyAmmoraV4CoreAtBlock } from "@ammora-protocol/sdk";
import { v4Deployment } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { context, confirmedReceipt } from "./client.js";
import { addr, hash } from "./policy.js";
main(async () => {
  const [curveArg, txArg, ...extra] = process.argv.slice(2);
  if (!curveArg || !txArg || extra.length) throw new Error("usage: <curve> <graduationHash>");
  const curve = addr(curveArg), tx = hash(txArg), c = await context(), { receipt, block } = await confirmedReceipt(c.client, tx);
  const launch = v4Deployment().contracts.launch;
  const core = { configRegistry: launch.configRegistry, launchFactory: launch.factory, graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy };
  await verifyAmmoraV4CoreAtBlock(c.client, core, receipt.blockNumber);
  await c.locks.verifyLaunchAdapterAtBlock(launch.graduationAdapter, receipt.blockNumber);
  const state = await new AmmoraV4LaunchCurveClient(c.client, curve, core).getStateAtBlock(receipt.blockNumber);
  const token = await c.client.readContract({ address: launch.factory, abi: ammoraLaunchFactoryV4Abi, functionName: "tokenForCurve", args: [curve], blockNumber: receipt.blockNumber });
  const config = await getAmmoraV4ConfigAtBlock(c.client, launch.configRegistry, state.configId, receipt.blockNumber);
  const migrated = parseAmmoraV4MigratedReceipt(receipt, curve);
  if (state.status !== 3 || token.toLowerCase() !== state.baseToken.toLowerCase()
    || state.feePolicy.toLowerCase() !== launch.feePolicy.toLowerCase() || state.feePolicyVersion !== AMMORA_FEE_POLICY_VERSION
    || migrated.canonicalPool.toLowerCase() !== state.canonicalPool.toLowerCase()) throw new Error("Graduation factory, Config, fee policy or pool mismatch");
  const escrow = parseAmmoraLaunchVestingCreatedReceipt(receipt, { adapter: launch.graduationAdapter, factory: c.locks.deployment.factory,
    curve, creator: state.creator, token: state.baseToken, config: config.config.lockedBaseVesting, graduationTimestamp: block.timestamp });
  const lock = await c.locks.readAtBlock(escrow.lock, receipt.blockNumber);
  if ((await c.client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error("Receipt block changed during reconciliation");
  printJson({ mode: "READ_ONLY", transactionHash: tx, escrow, lock, note: "Receipt-time state; inspect current vesting before a new claim. Creator is the adapter; recipient is the launch creator." });
});
