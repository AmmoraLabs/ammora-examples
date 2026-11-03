/** vault:request-redeem -- <vault> <sharesRaw> <minimumAssetsRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildRequestAYVaultRedeem } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildRequestAYVaultRedeem(natural(process.argv[3], "sharesRaw", true), c.caller, natural(process.argv[4], "minimumAssetsRaw", true)) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  await execute("request-redeem", c, transaction);
});
