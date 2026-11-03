/** npm run almm:claim-referral -- <pool> <token>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { almm, arl, natural, deadline, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await almm(process.argv[2]);
  const plan = await c.sdk.planClaimReferralFee({ token: address("TOKEN", process.argv[3]), caller: c.caller, recipient: c.caller });
  if (plan.claimable === 0n) throw new Error("No referral fees; no payment is claimed");
  await execute("claim caller referral fee", c, plan.transaction);
});
