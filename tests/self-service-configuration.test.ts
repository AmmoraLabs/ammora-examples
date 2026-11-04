import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareSelfServiceTestConfiguration } from "../src/partner/self-service/configuration.js";
import { parseSelfServiceProfile } from "../src/partner/self-service/context.js";
import { prepareSelfServiceTestAssets } from "../src/partner/self-service/test-source.js";
import { decodeAbiParameters } from "viem";

const profile = parseSelfServiceProfile(JSON.parse(readFileSync(new URL("../fixtures/self-service-giwa.test.json", import.meta.url), "utf8")));
const a = (n: string) => `0x${n.repeat(40)}`;
const evidence = `0x${"11".repeat(32)}`;
const input = () => ({ templateId: "0x170fe40d872e93e5c9202209e95b7e57d695e4fbf1b8d45813b7e72afc72e603", source: a("4"), controller: a("1"), partner: a("2"), recipients: [a("2"), a("3")], weights: [6000, 4000], consentHash: evidence, economicId: evidence, rightsEvidence: evidence });

test("partner inputs preserve each holder's weights and use bundled standard bindings without network", () => {
  const p = prepareSelfServiceTestConfiguration(profile, input());
  assert.deepEqual(p.configuration.weights, [6000, 4000]);
  assert.deepEqual(p.configuration.recipients.map(x => x.toLowerCase()), [a("2"), a("3")]);
  assert.equal(p.configuration.source.controller.toLowerCase(), a("1"));
  assert.equal(p.configuration.source.registry, profile.registry.address);
  assert.equal(p.configuration.source.maxFeeBps, 100);
  assert.equal(p.automaticSend, false);
  assert.match(p.eligibility, /PREPARED_ONLY/);
});
test("configuration preparation requires an isolated test profile and a known standard", () => {
  assert.throws(() => prepareSelfServiceTestConfiguration({ ...profile, testOnly: false }, input()), /Synthetic/);
  assert.throws(() => prepareSelfServiceTestConfiguration(profile, { ...input(), templateId: evidence }), /Unknown/);
});
test("configuration rejects secrets, zero evidence and absent original rights", () => {
  assert.throws(() => prepareSelfServiceTestConfiguration(profile, { ...input(), privateKey: "not accepted" }), /explicit/);
  assert.throws(() => prepareSelfServiceTestConfiguration(profile, { ...input(), consentHash: `0x${"00".repeat(32)}` }), /nonzero/);
  assert.throws(() => prepareSelfServiceTestConfiguration(profile, { ...input(), recipients: [a("3")], weights: [10000] }), /original partner/);
});
test("weights cannot duplicate holders, change total, or use noninteger values", () => {
  for (const bad of [{ recipients: [a("2"), a("2")] }, { weights: [6000, 3000] }, { weights: [6000.1, 3999.9] }, { weights: [0, 10000] }, { weights: [6000] }]) assert.throws(() => prepareSelfServiceTestConfiguration(profile, { ...input(), ...bad }));
});
test("configuration keeps the partner distinct from Ammora and validates caller addresses", () => {
  assert.throws(() => prepareSelfServiceTestConfiguration(profile, { ...input(), partner: "0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637" }), /differ/);
  assert.throws(() => prepareSelfServiceTestConfiguration(profile, { ...input(), controller: "YOUR_CONTROLLER" }));
});
test("new token and dependency addresses retain reviewed code pins without address allowlisting", () => {
  const p = prepareSelfServiceTestConfiguration(profile, { ...input(), quote: a("5"), base: a("6"), market: a("7") });
  assert.equal(p.configuration.source.quoteToken.toLowerCase(), a("5"));
  assert.equal(p.configuration.source.baseToken.toLowerCase(), a("6"));
  assert.equal(p.configuration.source.dependencies[0]!.target.toLowerCase(), a("7"));
  assert.throws(() => prepareSelfServiceTestConfiguration(profile, { ...input(), quote: a("5"), base: a("5") }), /Distinct/);
});
test("new test assets prepare exactly three zero-value frozen deployments without authority", () => {
  const plan = prepareSelfServiceTestAssets(profile, a("1") as `0x${string}`);
  assert.deepEqual(plan.deployments.map(x => x.label), ["quote", "base", "market"]);
  assert.equal(plan.deployments[0]!.request.data, plan.deployments[1]!.request.data);
  for (const d of plan.deployments) { assert.equal(d.request.value, 0n); assert.equal(d.request.account.toLowerCase(), a("1")); assert.match(d.runtimeHashRequired, /^0x[0-9a-f]{64}$/); }
  assert.equal(plan.automaticSend, false);
  const bundle = JSON.parse(readFileSync(new URL("../fixtures/self-service-test-artifacts.json", import.meta.url), "utf8"));
  const bytecode = bundle.artifacts.StandardMarketFixture.bytecode as string;
  for (const family of [0, 1] as const) {
    const market = prepareSelfServiceTestAssets(profile, a("1") as `0x${string}`, family).deployments[2]!;
    const encodedArgs = `0x${market.request.data.slice(bytecode.length)}` as `0x${string}`;
    assert.deepEqual(decodeAbiParameters([{ type: "uint8" }], encodedArgs), [family]);
  }
});
test("test asset deployments reject a production profile and zero controller", () => {
  assert.throws(() => prepareSelfServiceTestAssets({ ...profile, testOnly: false }, a("1") as `0x${string}`));
  assert.throws(() => prepareSelfServiceTestAssets(profile, a("0") as `0x${string}`));
  assert.throws(() => prepareSelfServiceTestAssets(profile, a("1") as `0x${string}`, 2 as 0));
});
