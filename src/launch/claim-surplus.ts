/** SDK-authenticated creator/partner recovery; unsigned by default. */
import { AmmoraV4LaunchCurveClient } from "@ammora-protocol/sdk";
import { address, reader, v4Deployment } from "../shared/env.js";
import { caller, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const account = caller(), curve = address("CURVE", process.argv[2]), client = await reader();
  const launch = v4Deployment().contracts.launch;
  const sdk = new AmmoraV4LaunchCurveClient(client, curve, { launchFactory: launch.factory, feePolicy: launch.feePolicy });
  const plan = await sdk.planClaimSurplus(account);
  await execute("claim-surplus", { client, caller: account, allowedTargets: [curve, launch.factory] }, plan.transaction);
});
