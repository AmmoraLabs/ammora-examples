/** Trusted host helper. No keys, hidden approvals, resubmission or model authorization. */
import { createHash } from "node:crypto";
import { BlockNotFoundError } from "viem";
import type { AgentRuntime, Intent, Operation, Plan } from "../index.js";
import { submitAfterOwnerApproval } from "./host.js";

export interface ExecutionHost {
  agent: AgentRuntime;
  bounded<T>(work: () => Promise<T>): Promise<T>;
}
export interface StepOptions {
  approve(plan: Plan): Promise<boolean>;
  onOperation?(operation: Operation): Promise<void>;
  timeoutMs?: number;
  pollingIntervalMs?: number;
}
export interface ReadFailure {
  code: "CANONICAL_BLOCK_UNAVAILABLE";
  operationId: string;
  hash?: string;
  attempt: number;
}
export interface StepResult {
  status: "CONFIRMED" | "NO_CLAIMABLE_FEES" | "INCOMPLETE";
  operation: Operation;
  prerequisites: Operation[];
  readFailures: ReadFailure[];
}

function confirmationBounds(options: StepOptions) {
  const timeout = options.timeoutMs ?? 120000, interval = options.pollingIntervalMs ?? 6000;
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 600000 || !Number.isSafeInteger(interval) || interval < 1000 || interval > 60000) throw new Error("INVALID_CONFIRMATION_BOUNDS");
  return { timeout, interval };
}
async function confirmed(host: ExecutionHost, operation: Operation, options: StepOptions, readFailures: ReadFailure[]): Promise<Operation> {
  const { timeout, interval } = confirmationBounds(options);
  const until = Date.now() + timeout;
  let unavailable = 0;
  while (true) {
    try {
      operation = await host.bounded(() => host.agent.reconcile(operation.plan.id));
    } catch (error) {
      // One bounded idempotent read retry; both failures stay in the returned result.
      // A missing block never releases the journal's hold or causes a second send.
      if (!(error instanceof BlockNotFoundError)) throw error;
      readFailures.push({ code: "CANONICAL_BLOCK_UNAVAILABLE", operationId: operation.plan.id, hash: operation.hash, attempt: ++unavailable });
      await options.onOperation?.(operation);
      if (unavailable >= 2 || Date.now() + interval >= until) return operation;
      await new Promise(resolve => setTimeout(resolve, interval));
      continue;
    }
    await options.onOperation?.(operation);
    if (["CONFIRMED", "REVERTED", "CANCELLED"].includes(operation.phase) || !operation.hash || Date.now() >= until) return operation;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/** One intent at a time; the host approves every actual allowance and business plan. */
export async function executeReviewedStep(host: ExecutionHost, requestId: string, intent: Intent, options: StepOptions): Promise<StepResult> {
  confirmationBounds(options); // Invalid polling input cannot fail only after a signature.
  let plan = await host.bounded(() => host.agent.prepare(intent, requestId));
  const prerequisites: Operation[] = [];
  const readFailures: ReadFailure[] = [];
  const existing = host.agent.operation(plan.id);
  // Reopening an attempted request only reconciles its original hash. Never sign again.
  if (!["PLANNED", "AUTHORIZED"].includes(existing.phase)) {
    const operation = await confirmed(host, existing, options, readFailures);
    return { status: operation.phase === "CONFIRMED" ? "CONFIRMED" : "INCOMPLETE", operation, prerequisites, readFailures };
  }
  for (let count = 0; plan.status === "APPROVAL_REQUIRED"; count++) {
    if (count >= 16) throw new Error("TOO_MANY_APPROVAL_PREREQUISITES");
    const r = plan.approvals[0];
    if (!r) throw new Error("MISSING_APPROVAL_REQUIREMENT");
    const reset = BigInt(r.currentAllowanceRaw) > 0n;
    const id = "allowance-" + createHash("sha256").update(JSON.stringify([requestId, r.token.toLowerCase(), r.spender.toLowerCase(), r.amountRaw, reset])).digest("hex");
    const prior = host.agent.journal.byRequest(id);
    let operation: Operation;
    if (prior && !["PLANNED", "AUTHORIZED"].includes(prior.phase)) operation = await confirmed(host, prior, options, readFailures);
    else {
      const approval = await host.bounded(() => host.agent.prepareApproval(plan.id, id));
      operation = await host.bounded(() => submitAfterOwnerApproval(host.agent, approval, options.approve));
      await options.onOperation?.(operation);
      operation = await confirmed(host, operation, options, readFailures);
    }
    prerequisites.push(operation);
    if (operation.phase !== "CONFIRMED") return { status: "INCOMPLETE", operation, prerequisites, readFailures };
    plan = await host.bounded(() => host.agent.refresh(plan.id));
  }
  if (plan.status === "NO_CLAIMABLE_FEES") return { status: "NO_CLAIMABLE_FEES", operation: host.agent.operation(plan.id), prerequisites, readFailures };
  let operation = await host.bounded(() => submitAfterOwnerApproval(host.agent, plan, options.approve));
  await options.onOperation?.(operation);
  operation = await confirmed(host, operation, options, readFailures);
  return { status: operation.phase === "CONFIRMED" ? "CONFIRMED" : "INCOMPLETE", operation, prerequisites, readFailures };
}
