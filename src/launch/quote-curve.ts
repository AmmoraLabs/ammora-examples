/** npm run launch:quote -- <curve> [buy|sell <amountInRaw>] */
import {
  AMMORA_FEE_POLICY_VERSION,
  AmmoraV4LaunchCurveClient,
  ammoraLaunchFactoryV4Abi,
  verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";
import { zeroAddress } from "viem";
import { address, readBlock, reader, v4Deployment } from "../shared/env.js";
import { printJson, rawAmount } from "../shared/input.js";
import { main } from "../shared/run.js";
import { readCurveQuote } from "./curve-quote.js";

main(async () => {
  const [curveArg, direction, raw, ...extra] = process.argv.slice(2);
  if (!curveArg || extra.length || (direction !== undefined && direction !== "buy" && direction !== "sell")) {
    throw new Error("usage: <curve> [buy|sell <amountInRaw>]");
  }
  const curve = address("AMMORA_LAUNCH_CURVE", curveArg);
  const request = direction ? { amountIn: rawAmount(raw, "amountInRaw"), baseForQuote: direction === "sell" } : undefined;
  const client = await reader();
  const launch = v4Deployment().contracts.launch;
  const core = { configRegistry: launch.configRegistry, launchFactory: launch.factory, graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy };
  const block = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, core, block.number);
  const code = await client.getCode({ address: curve, blockNumber: block.number });
  if (!code || code === "0x") throw new Error(`No curve at snapshot block ${block.number}. For a new launch, set AMMORA_READ_RECEIPT to its confirmed creation hash, or wait for the reviewed confirmation window.`);
  const sdk = new AmmoraV4LaunchCurveClient(client, curve, core);
  const result = await readCurveQuote(sdk, block.number, request);
  // Raw state/quote methods alone do not authenticate a curve. Bind it to the
  // reviewed factory and immutable policy at that same block before displaying it.
  const factoryToken = await client.readContract({ address: launch.factory, abi: ammoraLaunchFactoryV4Abi, functionName: "tokenForCurve", args: [curve], blockNumber: block.number });
  if (factoryToken === zeroAddress || factoryToken.toLowerCase() !== result.state.baseToken.toLowerCase()
    || result.state.feePolicy.toLowerCase() !== launch.feePolicy.toLowerCase()
    || result.state.feePolicyVersion !== AMMORA_FEE_POLICY_VERSION) {
    throw new Error("curve is not bound to the reviewed V4 factory and fee policy");
  }
  printJson({ curve, blockNumber: block.number, blockHash: block.hash, snapshot: block.snapshot, direction: direction ?? null, ...result,
    note: result.state.status === 1
      ? "Read-only snapshot. Re-quote and simulate before signing; partial sells remain strict."
      : "Curve is not active; no curve trade quoted. ReadyToMigrate requires a separate migration; after graduation use canonicalPool.",
  });
});
