/** SDK-authenticated creator/partner recovery; unsigned by default. */
import { parseAbi } from "viem";
import { printJson } from "../shared/input.js";
import { AmmoraV4LaunchCurveClient, ammoraLaunchPoolV4Abi } from "@ammora-protocol/sdk";
import { address, reader, v4Deployment } from "../shared/env.js";
import { caller, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const account = caller(), curve = address("CURVE", process.argv[2]), client = await reader();
  const launch = v4Deployment().contracts.launch;
  const sdk = new AmmoraV4LaunchCurveClient(client, curve, { launchFactory: launch.factory, feePolicy: launch.feePolicy });
  const plan = await sdk.planWithdrawLeftover(account);
  const recipient = await client.readContract({ address: curve,
    abi: parseAbi(["function leftoverReceiver() view returns (address)"]), functionName: "leftoverReceiver" });
  const simulation = await client.simulateContract({ account, address: curve,
    abi: ammoraLaunchPoolV4Abi, functionName: "withdrawLeftover" });
  if (simulation.result <= 0n) throw new Error("No positive leftover; no payment is claimed");
  printJson({ expectedPayoutRecipient: recipient, expectedAmount: simulation.result, payoutVerified: false });
  await execute("withdraw-leftover", { client, caller: account, allowedTargets: [curve, launch.factory] }, plan.transaction);
});
