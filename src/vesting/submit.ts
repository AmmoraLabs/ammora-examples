import type { PublicClient } from "viem";
import { signer } from "../shared/env.js";
import { send } from "../shared/run.js";
import { assertReview, type VestingPlan } from "./policy.js";
/** Exactly one transaction. Never loop from an approval into escrow creation. */
export async function submit(client: PublicClient, plan: VestingPlan, expected: string | undefined) {
  assertReview(plan, expected);
  const { account, wallet } = signer();
  const caller = "status" in plan ? plan.creator : plan.caller;
  if (account.address.toLowerCase() !== caller.toLowerCase()) throw new Error("Signer differs from reviewed caller");
  // send() checks AMMORA_SEND, pending nonce, exact simulation and canonical confirmations.
  // Persist its printed hash; if receipt parsing fails, reconcile that hash instead of rerunning.
  return send("status" in plan ? plan.status : "claim vested tokens", plan.transaction, wallet, account, client);
}
