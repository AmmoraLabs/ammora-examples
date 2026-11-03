/** vault:genesis-claim-base -- <vault>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildClaimAGVaultBase } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildClaimAGVaultBase(c.caller) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  await execute("genesis-claim-base", c, transaction);
});
