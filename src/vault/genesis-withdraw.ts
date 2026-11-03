/** vault:genesis-withdraw -- <vault> <quoteAmountRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildWithdrawAGVault } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildWithdrawAGVault(natural(process.argv[3], "quoteAmountRaw", true), c.caller) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  await execute("genesis-withdraw", c, transaction);
});
