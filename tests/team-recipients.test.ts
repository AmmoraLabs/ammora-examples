import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ammoraLaunchConfigRegistryV4Abi, type AmmoraV4Config, type AmmoraV4ConfigSnapshot } from "@ammora-protocol/sdk";
import { decodeFunctionData, type Address, type Hex } from "viem";
import { parseTeamRecipientPolicy, planTeamConfig, assertTeamConfigReview } from "../src/launch/team/policy.js";
import { deriveConfigFromTemplate } from "../src/launch/config-from-template.js";

const addr = (n: number) => `0x${String(n).repeat(40)}` as Address;
const templateHash = `0x${"ab".repeat(32)}` as Hex;
const policyInput = { schemaVersion: 1, chainId: 91342, registry: addr(2), templateId: "6", templateHash, configOwner: addr(3), partnerRecipient: addr(4), liquidityPartner: addr(5), leftoverReceiver: addr(6) };
const load = async () => {
  const fixture = await readFile(new URL("./fixtures/synthetic-concentrated-template.json", import.meta.url), "utf8");
  const config = JSON.parse(fixture, (_, value: unknown) => typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : value) as AmmoraV4Config;
  return { configId: 6n, config, configHash: templateHash, enabled: true } as AmmoraV4ConfigSnapshot;
};
const build = (snapshot: AmmoraV4ConfigSnapshot, policy = parseTeamRecipientPolicy(policyInput), supply = 750_000_000_000_000_000n) => planTeamConfig(snapshot, policy, { chainId: 91342, registry: addr(2) }, supply, 6_500_000_000_000_000_000n);

test("team recipients reach SDK calldata while all other economics and the template remain unchanged", async () => {
  const snapshot = await load();
  const before = structuredClone(snapshot);
  const inherited = deriveConfigFromTemplate(snapshot, 750_000_000_000_000_000n, 6_500_000_000_000_000_000n);
  const plan = build(snapshot);
  const decoded = decodeFunctionData({ abi: ammoraLaunchConfigRegistryV4Abi, data: plan.transaction.data });
  assert.equal(decoded.functionName, "createConfig");
  if (decoded.functionName !== "createConfig") throw new Error("wrong selector");
  assert.equal(decoded.args[0].partnerRecipient, addr(4));
  assert.equal(decoded.args[0].liquidityDistribution.partner, addr(5));
  assert.equal(decoded.args[0].leftoverReceiver, addr(6));
  assert.equal(decoded.args[2], addr(3));
  assert.deepEqual(plan.config, { ...inherited.config, partnerRecipient: addr(4), leftoverReceiver: addr(6), liquidityDistribution: { ...inherited.config.liquidityDistribution, partner: addr(5) } });
  assert.deepEqual(plan.curve, inherited.curve);
  assert.deepEqual(snapshot, before);
  assert.equal(plan.config.liquidityDistribution.partnerPermanentLockedBps, 6250);
  assert.equal(plan.config.liquidityDistribution.creatorPermanentLockedBps, 3750);
});

test("recipient files reject ambiguous overrides, missing fields, invalid/zero addresses and noncanonical IDs", () => {
  for (const input of [null, [], { ...policyInput, creator: addr(7) }, { ...policyInput, cliffFeeBps: 0 }, { ...policyInput, templateId: "06" }, { ...policyInput, chainId: 0 }, { ...policyInput, templateHash: "0x00" }, { ...policyInput, partnerRecipient: "REPLACE_ME" }, { ...policyInput, liquidityPartner: `0x${"0".repeat(40)}` }, { ...policyInput, configOwner: undefined }]) {
    assert.throws(() => parseTeamRecipientPolicy(input));
  }
  assert.equal(parseTeamRecipientPolicy(policyInput).partnerRecipient, addr(4));
});

test("a stale template, disabled template or wrong deployment is refused before authoring", async () => {
  const snapshot = await load();
  const policy = parseTeamRecipientPolicy(policyInput);
  assert.throws(() => build({ ...snapshot, configId: 7n }), /template identity/);
  assert.throws(() => build({ ...snapshot, configHash: `0x${"cd".repeat(32)}` }), /template identity/);
  assert.throws(() => build({ ...snapshot, enabled: false }), /disabled/);
  assert.throws(() => planTeamConfig(snapshot, policy, { chainId: 1, registry: addr(2) }, 1n, 1n), /chain\/registry/);
  assert.throws(() => planTeamConfig(snapshot, policy, { chainId: 91342, registry: addr(7) }, 1n, 1n), /chain\/registry/);
});

test("review hash binds every selected recipient, owner, supply, chain and registry", async () => {
  const snapshot = await load();
  const original = build(snapshot);
  assert.doesNotThrow(() => assertTeamConfigReview(original.reviewHash, original.reviewHash));
  assert.throws(() => assertTeamConfigReview(undefined, original.reviewHash), /reviewHash mismatch/);
  for (const field of ["configOwner", "partnerRecipient", "liquidityPartner", "leftoverReceiver"] as const) {
    const changed = build(snapshot, parseTeamRecipientPolicy({ ...policyInput, [field]: addr(7) }));
    assert.throws(() => assertTeamConfigReview(original.reviewHash, changed.reviewHash), /reviewHash mismatch/);
  }
  assert.notEqual(build(snapshot, undefined, 700_000_000_000_000_000n).reviewHash, original.reviewHash);
  for (const changed of [{ ...policyInput, chainId: 123 }, { ...policyInput, registry: addr(8) }]) {
    const policy = parseTeamRecipientPolicy(changed);
    const plan = planTeamConfig(snapshot, policy, { chainId: policy.chainId, registry: policy.registry }, 750_000_000_000_000_000n, 6_500_000_000_000_000_000n);
    assert.notEqual(plan.reviewHash, original.reviewHash);
  }
});
