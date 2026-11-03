import test from "node:test";
import assert from "node:assert/strict";
import { BlockNotFoundError } from "viem";
import { executeReviewedStep, runLaunchpadWalkthrough, core, type AgentRuntime, type Intent, type Operation, type Plan, type WalkthroughInput } from "../src/agent/index.js";
const A = "0x1111111111111111111111111111111111111111", B = "0x2222222222222222222222222222222222222222", C = "0x3333333333333333333333333333333333333333", H = `0x${"a".repeat(64)}` as const;
function fixture(options: { allowances?: number; pendingAction?: string; noFees?: boolean } = {}) {
  const operations = new Map<string, Operation>(), requests = new Map<string, string>(), intents: Intent[] = [];
  const approved: string[] = [], submitted: string[] = []; let allowance = options.allowances ?? 0;
  function plan(intent: Intent, requestId: string): Plan {
    const id = requests.get(requestId); if (id) return operations.get(id)!.plan;
    const p: Plan = { version: 1, id: requestId, requestId, intent, intentDigest: H, policyDigest: H, digest: H, account: A, chainId: 91342, generation: "auto-route", snapshot: { number: "1", hash: H, timestamp: "1" }, expiresAt: 9999999999,
      status: intent.action === "claim-launch" && options.noFees ? "NO_CLAIMABLE_FEES" : intent.action === "trade" && allowance ? "APPROVAL_REQUIRED" : "READY",
      approvals: intent.action === "trade" && allowance ? [{ token: A, spender: B, amountRaw: "10", currentAllowanceRaw: allowance === 2 ? "1" : "0" }] : [], expected: {}, details: {}, transaction: { to: B, data: "0x", value: "0" } };
    operations.set(p.id, { phase: "PLANNED", plan: p }); requests.set(requestId, p.id); intents.push(intent); return p;
  }
  const agent = {
    policy: { account: A }, journal: { byRequest: (id: string) => operations.get(requests.get(id)!) },
    prepare: async (intent: Intent, id: string) => plan(intent, id), operation: (id: string) => operations.get(id)!,
    prepareApproval: async (parent: string, id: string) => plan({ action: "approval", parentId: parent, requirementIndex: 0, reset: allowance === 2 }, id),
    refresh: async (id: string) => { const p = operations.get(id)!.plan; p.status = allowance ? "APPROVAL_REQUIRED" : "READY"; p.approvals = allowance ? [{ token: A, spender: B, amountRaw: "10", currentAllowanceRaw: "0" }] : []; return p; },
    authorize: (id: string) => { approved.push(id); operations.get(id)!.phase = "AUTHORIZED"; },
    submit: async (id: string) => { submitted.push(id); const op = operations.get(id)!; op.phase = "SUBMITTED"; op.hash = H; return op; },
    reconcile: async (id: string) => {
      const op = operations.get(id)!; if (op.plan.intent.action === options.pendingAction) return op;
      if (op.phase !== "CONFIRMED" && op.plan.intent.action === "approval") allowance--;
      op.phase = "CONFIRMED";
      op.result = op.plan.intent.action === "config" ? { config: { configId: "41", configHash: H } }
        : op.plan.intent.action === "launch" ? { launch: { token: B, curve: C } }
        : op.plan.intent.action === "migrate" ? { migration: { canonicalPool: B }, positions: { positions: [{ tokenId: "19", owner: A, liquidity: "10000" }, { tokenId: "20", owner: A, liquidity: "1" }] } } : { receiptVerified: true };
      return op;
    },
  } as unknown as AgentRuntime;
  return { host: { agent, bounded: async <T>(work: () => Promise<T>) => work() }, approved, submitted, intents };
}
const approve = async () => true;
test("invalid confirmation bounds reject before any owner approval or send", async () => {
  const f = fixture(); await assert.rejects(executeReviewedStep(f.host, "one", { action: "migrate", curve: C }, { approve, timeoutMs: -1 }), /INVALID_CONFIRMATION_BOUNDS/); assert.equal(f.submitted.length, 0); assert.equal(f.intents.length, 0);
});
test("reviewed step approves a zero reset, exact allowance and business plan separately", async () => {
  const f = fixture({ allowances: 2 });
  const result = await executeReviewedStep(f.host, "buy-one", { action: "trade", curve: C, side: "buy", amountRaw: "10", slippageBps: 50 }, { approve, timeoutMs: 0 });
  assert.equal(result.status, "CONFIRMED"); assert.equal(result.prerequisites.length, 2); assert.equal(f.approved.length, 3); assert.equal(new Set(f.submitted).size, 3);
});
test("uncertain business request reconciles its existing attempt without another approval or send", async () => {
  const f = fixture({ pendingAction: "launch" }), intent: Intent = { action: "launch", configId: "41", name: "N", symbol: "N", metadataURI: "ipfs://n" };
  assert.equal((await executeReviewedStep(f.host, "one", intent, { approve, timeoutMs: 0 })).status, "INCOMPLETE");
  assert.equal((await executeReviewedStep(f.host, "one", intent, { approve, timeoutMs: 0 })).status, "INCOMPLETE");
  assert.equal(f.submitted.length, 1); assert.equal(f.approved.length, 1);
});
test("an incomplete allowance stops before the business transaction", async () => {
  const f = fixture({ allowances: 1, pendingAction: "approval" });
  const result = await executeReviewedStep(f.host, "trade", { action: "trade", curve: C, side: "buy", amountRaw: "10", slippageBps: 50 }, { approve, timeoutMs: 0 });
  assert.equal(result.status, "INCOMPLETE"); assert.equal(result.operation.plan.intent.action, "approval"); assert.equal(f.submitted.length, 1);
});
test("an unavailable canonical block preserves the attempt and resumes without resubmission", async () => {
  const f = fixture();
  const original = f.host.agent.reconcile.bind(f.host.agent);
  let reads = 0;
  f.host.agent.reconcile = async id => {
    if (++reads === 1) throw new BlockNotFoundError({ blockNumber: 1n });
    return original(id);
  };
  const intent: Intent = { action: "migrate", curve: C };
  const pending = await executeReviewedStep(f.host, "one", intent, { approve, timeoutMs: 0 });
  assert.equal(pending.status, "INCOMPLETE"); assert.equal(pending.operation.hash, H);
  assert.equal(pending.readFailures[0]!.code, "CANONICAL_BLOCK_UNAVAILABLE");
  assert.equal((await executeReviewedStep(f.host, "one", intent, { approve, timeoutMs: 0 })).status, "CONFIRMED");
  assert.equal(f.submitted.length, 1); assert.equal(f.approved.length, 1);
});
test("one transient canonical read retries once without a second transaction", async () => {
  const f = fixture(); const original = f.host.agent.reconcile.bind(f.host.agent); let reads = 0;
  f.host.agent.reconcile = async id => {
    if (++reads === 1) throw new BlockNotFoundError({ blockNumber: 1n });
    return original(id);
  };
  const result = await executeReviewedStep(f.host, "one", { action: "migrate", curve: C }, { approve, timeoutMs: 10000, pollingIntervalMs: 1000 });
  assert.equal(result.status, "CONFIRMED"); assert.equal(result.readFailures.length, 1);
  assert.equal(reads, 2); assert.equal(f.submitted.length, 1);
});
test("repeated canonical read failure retains both attempts and stops after one retry", async () => {
  const f = fixture(); let reads = 0;
  f.host.agent.reconcile = async () => { reads++; throw new BlockNotFoundError({ blockNumber: 1n }); };
  const result = await executeReviewedStep(f.host, "one", { action: "migrate", curve: C }, { approve, timeoutMs: 10000, pollingIntervalMs: 1000 });
  assert.equal(result.status, "INCOMPLETE"); assert.equal(result.readFailures.length, 2);
  assert.equal(reads, 2); assert.equal(f.submitted.length, 1);
});
test("canonical integrity failures propagate instead of being classified as transient", async () => {
  const f = fixture(); f.host.agent.reconcile = async () => { throw new Error("CANONICAL_HASH_MISMATCH"); };
  await assert.rejects(executeReviewedStep(f.host, "one", { action: "migrate", curve: C }, { approve, timeoutMs: 0 }), /CANONICAL_HASH_MISMATCH/);
  assert.equal(f.submitted.length, 1);
});
test("declining host consent signs/submits nothing", async () => {
  const f = fixture(); await assert.rejects(executeReviewedStep(f.host, "one", { action: "migrate", curve: C }, { approve: async () => false, timeoutMs: 0 }), /Owner declined/); assert.equal(f.submitted.length, 0);
});
test("zero fee is explicit and requests no approval or transaction", async () => {
  const f = fixture({ noFees: true }); const result = await executeReviewedStep(f.host, "claim", { action: "claim-launch", curve: C, asset: "quote" }, { approve, timeoutMs: 0 });
  assert.equal(result.status, "NO_CLAIMABLE_FEES"); assert.equal(f.submitted.length, 0);
});
const input: WalkthroughInput = { requestPrefix: "example-one", config: { policy: { schemaVersion: 1, chainId: 91342, registry: core.configRegistry, templateId: "6", templateHash: H, configOwner: A, partnerRecipient: A, liquidityPartner: A, leftoverReceiver: A }, saleSupplyRaw: "1000000000000", thresholdRaw: "1000000000000" }, launch: { name: "Test", symbol: "T", metadataURI: "ipfs://test" }, curveBuyRaw: "10000000000", curveSellRaw: "1000000000", finalBuyMaximumRaw: "2000000000000", poolBuyRaw: "1000000000", poolSellRaw: "10000000", slippageBps: 50 };
test("walkthrough passes only confirmed Config/curve/NFT identities to later actions", async () => {
  const f = fixture(); const result = await runLaunchpadWalkthrough(f.host, input, { approve, timeoutMs: 0 });
  assert.equal(result.status, "COMPLETE"); assert.equal(result.config!.id, "41"); assert.equal(result.launch!.curve, C); assert.equal(result.lpTokenId, "19");
  assert.equal(f.intents.find(i => i.action === "launch")!.configId, "41");
  assert.ok(f.intents.filter(i => "curve" in i).every(i => "curve" in i && i.curve === C));
  assert.equal(f.intents.find(i => i.action === "claim-lp")!.tokenId, "19");
});
test("walkthrough stops on pending migration before pool trades or claims", async () => {
  const f = fixture({ pendingAction: "migrate" }); const result = await runLaunchpadWalkthrough(f.host, input, { approve, timeoutMs: 0 });
  assert.equal(result.status, "INCOMPLETE"); assert.equal(result.steps.at(-1)!.name, "migrate"); assert.equal(result.steps.some(s => s.name.startsWith("pool-") || s.name.startsWith("claim-")), false);
});
