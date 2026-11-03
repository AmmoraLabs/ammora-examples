/** vault:process-withdrawal -- <vault> <requestId> <maximumStrategies>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildProcessAYVaultWithdrawal } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildProcessAYVaultWithdrawal(natural(process.argv[3], "requestId"), integer(process.argv[4] ?? "", "maximumStrategies", 1, 64)) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  await execute("process-withdrawal", c, transaction);
});
