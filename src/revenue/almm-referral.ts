/** npm run revenue:almm-referral -- <pool> <token>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { RevenueCenterClient } from "@ammora-protocol/sdk";
import { address, clientOptions, reader } from "../shared/env.js";
import { caller, execute } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const account = caller(), pool = address("POOL", process.argv[2]), token = address("TOKEN", process.argv[3]);
  const client = await reader(), sdk = new RevenueCenterClient(client, clientOptions());
  const claim = await sdk.planClaimALMMReferral({ pool, token, beneficiary: account });
  printJson(claim);
  if (claim.claimable === 0n) throw new Error("No claimable revenue");
  await execute("almm-referral", { client, caller: account, allowedTargets: [claim.source] }, claim.transaction);
});
