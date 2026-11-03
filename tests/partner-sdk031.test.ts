import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { decodeFunctionData } from "viem";
import { createPartnerSdkCatalogV2, POOL_RIGHTS_MODULE_ABI } from "@ammora-protocol/sdk/partner";
import { previewCatalog, createReviewedCatalog } from "../src/partner/catalog.js";
import { previewManualOnboarding } from "../src/partner/onboarding-preview.js";
import { previewQuoteCosts } from "../src/partner/quote.js";
import { createClaimExample, preparePartnerClaim } from "../src/partner/claims.js";
import { previewReconciliation } from "../src/partner/reconcile.js";
import { createPartnerFixture, fixtureActors, fixtureToken, fixtureModes } from "../src/partner/fixture.js";

test("catalog selection remains nonexecuting and rejects unsupported route combinations", () => {
  const result = previewCatalog();
  assert.equal(result.rpcReads, 0);
  assert.equal(result.selected.status, "selected");
  assert.equal(result.selected.executionApproved, false);
  assert.equal(result.selected.mayAutoSubmit, false);
  assert.notEqual(result.unsupported.status, "selected");
  assert.equal(result.custody.executionApproved, false);
});

test("parsed manifests and stale catalog references cannot install or authorize an SDK client", () => {
  const f = createPartnerFixture(), catalog = createReviewedCatalog([f.entry]);
  assert.throws(() => createReviewedCatalog([structuredClone(f.entry)]));
  const request = { purpose: "trade", route: f.route } as const;
  const selected = catalog.select({ ...request, chainId: "31337", genesisHash: f.profile.genesisHash, source: f.entry.manifest.source });
  assert.equal(selected.status, "selected");
  if (selected.status !== "selected") throw new Error("fixture selection");
  const current = createPartnerSdkCatalogV2({ entries: [f.entry], minimumRevisions: { "synthetic-pool-rights": "2" } });
  assert.throws(() => current.open(selected.reference, request));
});

test("C2 onboarding preserves original fee rights and requests review rather than managed 20:80", async () => {
  const result = await previewManualOnboarding();
  assert.equal(result.plan.mode, "C2");
  assert.equal(result.plan.impact.ammoraBps, 0);
  assert.equal(result.plan.impact.originalUnmanagedPreserved, true);
  assert.equal(result.plan.executionApproved, false);
  assert.equal(result.plan.automaticExecution, false);
  assert.equal(result.plan.steps[0]?.status, "review-required");
  assert.equal(result.plan.steps[0]?.role, "original-claim-authority");
  assert.equal(result.rpcReads, 0);
});

test("quote costs keep treasury excluded, receipt-dependent allocation unknown and gas in its own asset", () => {
  const result = previewQuoteCosts();
  const rows = result.costs.components;
  assert.equal(rows.find(x => x.id === "creator")?.ammora, null);
  assert.equal(rows.find(x => x.id === "treasury")?.eligible, false);
  assert.equal(rows.find(x => x.id === "gas")?.amount, null);
  assert.equal(result.costs.assets.length, 2);
  assert.equal(result.costs.allocationRequiresReceipt, true);
  assert.equal(result.costs.executionApproved, false);
  assert.throws(() => previewQuoteCosts(fixtureToken, -1n));
});

test("custody claim binds the actual beneficiary and asset and remains unsigned after exact simulation", async () => {
  const example = await createClaimExample(), result = await example.planClaim();
  const decoded = decodeFunctionData({ abi: POOL_RIGHTS_MODULE_ABI, data: result.plan.request.data });
  assert.equal(decoded.functionName, "claim");
  assert.equal(decoded.args?.[0].toLowerCase(), fixtureToken.toLowerCase());
  assert.equal(result.plan.request.account, fixtureActors.beneficiary);
  assert.equal(result.plan.request.to, example.fixture.profile.module.address);
  assert.equal(result.plan.request.value, 0n);
  assert.equal(result.plan.automaticExecution, false);
  assert.equal(result.payoutVerified, false);
  assert.deepEqual(result.simulation.request, result.plan.request);
  assert.ok(example.fixture.calls.includes("eth_call"));
  assert.ok(example.fixture.calls.every(x => !x.startsWith("eth_send")));
});

test("unauthorized/revoked claims, substituted plans, runtime drift and exhausted read budget fail closed", async () => {
  const example = await createClaimExample(), good = await example.planClaim();
  await assert.rejects(preparePartnerClaim(example.handle, fixtureToken, fixtureActors.stranger));
  const revoked = await createClaimExample({ authorized: false });
  await assert.rejects(revoked.planClaim());
  const drift = await createClaimExample({ wrongRuntime: true });
  await assert.rejects(drift.planClaim());
  await assert.rejects(example.handle.client.simulateAction({ ...good.plan, request: { ...good.plan.request, account: fixtureActors.stranger } }));
  const budget = await createClaimExample({ maxReads: 4 });
  await assert.rejects(budget.planClaim());
});

test("canonical fixture receipt states never authorize resending or attest a positive fee payout", async () => {
  for (const mode of fixtureModes) {
    const result = await previewReconciliation(mode);
    assert.equal(result.receipt.status, mode);
    assert.equal(result.receipt.mayResubmit, false);
    assert.equal(result.guidance.mayResubmit, false);
    assert.equal(result.guidance.nextAction, "reconcile");
    assert.equal(result.payoutVerified, false);
    assert.equal(result.amountPaid, null);
    if (mode === "observed") assert.equal(result.status.targetReached, false);
    if (mode === "finalized") assert.equal(result.status.targetReached, true);
  }
});

test("all five partner commands run offline without keys and explicitly refuse send mode", () => {
  const files = ["catalog", "onboarding-preview", "quote", "claims", "reconcile"];
  for (const file of files) {
    const args = ["--import", "tsx", `src/partner/${file}.ts`];
    const env = { ...process.env, AMMORA_PRIVATE_KEY: "", AMMORA_RPC_URL: "http://127.0.0.1:1", AMMORA_SEND: "0" };
    const result = spawnSync(process.execPath, args, { env, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).scope, "SYNTHETIC_OFFLINE");
    const blocked = spawnSync(process.execPath, args, { env: { ...env, AMMORA_SEND: "1" }, encoding: "utf8", timeout: 10000 });
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /offline\/read-only/);
    assert.equal(blocked.stdout, "");
  }
});
