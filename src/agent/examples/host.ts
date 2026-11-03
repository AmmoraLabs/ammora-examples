/** This is trusted application code, never an agent tool. It imports no signer/key helper. */
import type { AgentRuntime, Plan } from "../index.js";

export async function submitAfterOwnerApproval(agent: AgentRuntime, plan: Plan,
  approve: (plan: Plan) => Promise<boolean>) {
  if (plan.status !== "READY") throw new Error("Resolve approval/no-fee status before requesting a signature");
  if (!await approve(plan)) throw new Error("Owner declined the exact plan");
  agent.authorize(plan.id, plan.digest);
  return agent.submit(plan.id, plan.digest);
}
