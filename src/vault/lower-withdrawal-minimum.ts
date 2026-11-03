/** vault:lower-withdrawal-minimum -- <vault> <requestId> <newMinimumRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildLowerAYVaultWithdrawalMinimum } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildLowerAYVaultWithdrawalMinimum(natural(process.argv[3], "requestId"), natural(process.argv[4], "newMinimumRaw", true)) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  await execute("lower-withdrawal-minimum", c, transaction);
});
