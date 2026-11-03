/** staking:claim-v2 -- <vaultV2> <maximumQuoteFeeRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildClaimAStakeV2 } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildClaimAStakeV2(natural(process.argv[3], "maximumQuoteFeeRaw"), c.caller) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  await execute("claim-v2", c, transaction);
});
