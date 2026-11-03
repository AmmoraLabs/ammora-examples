/** presale:deposit -- <presale> <maximumQuoteRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildDepositToAmmoraPresale, ammoraPresaleAbi } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildDepositToAmmoraPresale(c.caller, natural(process.argv[3], "maximumQuoteRaw", true)) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  const token = await c.client.readContract({ address: c.target, abi: ammoraPresaleAbi, functionName: "quoteToken", blockNumber: c.blockNumber });
  await execute("deposit", c, transaction, [{ token, spender: c.target, amount: natural(process.argv[3], "amountRaw", true) }]);
});
