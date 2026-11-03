/** vault:redeem -- <vault> <sharesRaw> <minimumAssetsRaw> <maximumStrategies>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildRedeemAYVault } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildRedeemAYVault(natural(process.argv[3], "sharesRaw", true), c.caller, c.caller, natural(process.argv[4], "minimumAssetsRaw", true), integer(process.argv[5] ?? "", "maximumStrategies", 1, 64)) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  await execute("redeem", c, transaction);
});
