/** npm run dfs:claim -- <vault> <recipientIndex> [payoutAddress]. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { zeroAddress } from "viem";
import { dfs } from "./context.js";
import { execute, validateAction } from "../shared/actions.js";
import { address, signer } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { main, send } from "../shared/run.js";
import { verifyFeePayment } from "../shared/fee-payment.js";
main(async () => {
  const c = await dfs(process.argv[2]);
  const index = integer(process.argv[3] ?? "", "recipientIndex", 0, 255);
  const state = await c.sdk.getState();
  if (state.recipients[index]?.recipient.toLowerCase() !== c.caller.toLowerCase()) throw new Error("Caller is not this DFS recipient");
  const preview = await c.sdk.getClaimPreview(index);
  printJson({ preview, note: "gross only: recipient-fee tokens can reduce net receipt" });
  if (preview.grossAmount === 0n) throw new Error("No DFS fee; no payment is claimed");
  const receiver = process.argv[4] ? address("PAYOUT_ADDRESS", process.argv[4]) : c.caller;
  if (receiver === zeroAddress || receiver.toLowerCase() === c.vault.toLowerCase()) throw new Error("Payout must be nonzero and outside the vault");
  const transaction = c.sdk.planClaim(index, receiver);
  if (process.env.AMMORA_SEND !== "1") {
    await execute("claim caller DFS share", c, transaction);
    return;
  }
  validateAction(transaction, c.allowedTargets);
  const { wallet, account } = signer();
  if (account.address.toLowerCase() !== c.caller.toLowerCase()) throw new Error("Signer differs from preview caller");
  const hash = await send("claim caller DFS share", transaction, wallet, account, c.client);
  printJson(await verifyFeePayment(c.client, {
    kind: "dfs", hash, vault: c.vault, token: state.token, beneficiary: c.caller, payout: receiver, index,
  }));
});
