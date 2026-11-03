import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ammoraLaunchConfigRegistryV4Abi, type AmmoraV4Config, type AmmoraV4ConfigSnapshot } from "@ammora-protocol/sdk";
import { decodeFunctionData, type Address, type Hex } from "viem";
import { parseTeamFeePolicy, planTeamFeeConfig, previewTeamFees } from "../src/launch/team/fee-policy.js";
import { parseConfigDocument } from "../src/launch/config-document.js";
import { planSharingPolicy } from "../src/dfs/sharing-policy.js";

const addr = (n: number) => ("0x" + String(n).repeat(40)) as Address;
const policy = { schemaVersion: 1, chainId: 91342, registry: addr(2), templateId: "6", templateHash: ("0x" + "ab".repeat(32)) as Hex, configOwner: addr(3), partnerRecipient: addr(4), liquidityPartner: addr(5), leftoverReceiver: addr(6), creatorShareOfNonProtocolBps: 7000 };
const load = async () => {
  const text = await readFile(new URL("./fixtures/synthetic-concentrated-template.json", import.meta.url), "utf8");
  const config = JSON.parse(text, (_, v: unknown) => typeof v === "string" && /^\d+$/.test(v) ? BigInt(v) : v) as AmmoraV4Config;
  return { configId: 6n, config, configHash: policy.templateHash, enabled: true } as AmmoraV4ConfigSnapshot;
};
const build = (snapshot: AmmoraV4ConfigSnapshot, share = 7000) => planTeamFeeConfig(snapshot, parseTeamFeePolicy({ ...policy, creatorShareOfNonProtocolBps: share }), { chainId: 91342, registry: addr(2) }, 750_000_000_000_000_000n, 6_500_000_000_000_000_000n);

test("chosen fee split survives full-document parsing and SDK calldata, with immutable template LP/vesting", async () => {
  const snapshot = await load(), before = structuredClone(snapshot), plan = build(snapshot);
  const decoded = decodeFunctionData({ abi: ammoraLaunchConfigRegistryV4Abi, data: plan.plan.transaction.data });
  assert.equal(decoded.functionName, "createConfig");
  if (decoded.functionName !== "createConfig") throw new Error("wrong selector");
  assert.equal(decoded.args[0].creatorShareOfNonProtocolBps, 7000);
  assert.equal(decoded.args[0].partnerRecipient, addr(4));
  assert.equal(decoded.args[0].liquidityDistribution.partner, addr(5));
  assert.deepEqual(plan.plan.config.liquidityDistribution, { ...before.config.liquidityDistribution, partner: addr(5) });
  assert.equal(plan.plan.config.cliffFeeBps, before.config.cliffFeeBps);
  assert.deepEqual(snapshot, before);
  assert.equal(parseConfigDocument(plan.document).reviewHash, plan.plan.reviewHash);
  assert.notEqual(build(snapshot, 3000).plan.reviewHash, plan.plan.reviewHash);
  for (const share of [0, 10000]) assert.equal(build(snapshot, share).plan.config.creatorShareOfNonProtocolBps, share);
});

test("invalid fee settings and implicit protocol/LP overrides fail closed", () => {
  for (const share of [undefined, "7000", -1, 10001, 0.5, NaN]) assert.throws(() => parseTeamFeePolicy({ ...policy, creatorShareOfNonProtocolBps: share }));
  for (const extra of [{ protocolShareBps: 0 }, { partnerUnlockedBps: 10000 }, { creator: addr(7) }]) assert.throws(() => parseTeamFeePolicy({ ...policy, ...extra }));
});

test("before/after/referral/rounding conserve fee tokens without promising LP income", async () => {
  const config = build(await load()).plan.config;
  const standard = previewTeamFees(config, 10000n);
  assert.deepEqual([standard.beforeGraduation.withoutReferral.protocolFeeNet, standard.beforeGraduation.withoutReferral.creatorFee, standard.beforeGraduation.withoutReferral.partnerFee], [2000n, 5600n, 2400n]);
  assert.equal(standard.beforeGraduation.withReferral.referralFee, 400n);
  assert.equal(standard.afterGraduation.withoutReferral.creatorDirectFee, 0n);
  assert.equal(standard.initialLpAllocationBps.partner.permanentLocked, 6250);
  assert.equal(standard.initialLpAllocationBps.creator.permanentLocked, 3750);
  assert.equal(standard.initialLpAllocationBps.creator.unlocked, 0);
  for (const amount of [0n, 1n, 7n, 101n, 10000n]) for (const share of [0, 3000, 7000, 10000]) {
    const preview = previewTeamFees({ ...config, creatorShareOfNonProtocolBps: share, postMigrationCompoundingFeeBps: share }, amount);
    for (const row of Object.values(preview.beforeGraduation)) assert.equal(row.protocolFeeNet + row.referralFee + row.creatorFee + row.partnerFee, amount);
    for (const row of [preview.afterGraduation.withReferral, preview.afterGraduation.withoutReferral]) assert.equal(row.protocolFeeNet + row.referralFee + row.claimingLpFee + row.compoundingLpFee, amount);
  }
  assert.throws(() => previewTeamFees(config, -1n));
});

const sharing = { schemaVersion: 1, chainId: 91342, factory: addr(1), owner: addr(2), token: addr(3), base: addr(4),
  recipients: [{ recipient: addr(5), share: "50" }, { recipient: addr(6), share: "30" }, { recipient: addr(7), share: "20" }], userSalt: "0x" + "ab".repeat(32) };
test("multi-recipient weights remain exact and review binds sender, chain, asset and recipients", () => {
  const result = planSharingPolicy(sharing);
  assert.equal(result.policy.totalShares, 100n);
  assert.deepEqual(result.recipients.map(r => [r.index, r.ratio]), [[0, "50/100"], [1, "30/100"], [2, "20/100"]]);
  for (const input of [{ ...sharing, owner: addr(9) }, { ...sharing, token: addr(9) }, { ...sharing, factory: addr(9) }, { ...sharing, chainId: 123 }, { ...sharing, recipients: [...sharing.recipients].reverse() }, { ...sharing, userSalt: "0x" + "cd".repeat(32) }]) assert.notEqual(planSharingPolicy(input).reviewHash, result.reviewHash);
  for (const count of [2, 5]) assert.equal(planSharingPolicy({ ...sharing, recipients: Array.from({ length: count }, (_, i) => ({ recipient: addr(i + 1), share: "1" })) }).recipients.length, count);
});

test("multi-recipient rejects duplicates, zero/overflow/fractional weights, count and unknown fields", () => {
  for (const input of [
    { ...sharing, recipients: [] }, { ...sharing, recipients: [sharing.recipients[0]] },
    { ...sharing, recipients: Array(6).fill(sharing.recipients[0]) },
    { ...sharing, recipients: [sharing.recipients[0], sharing.recipients[0]] },
    ...["0", "-1", "1.5", "01", "4294967295", 1].map(share => ({ ...sharing, recipients: [{ recipient: addr(5), share }, sharing.recipients[1]] })),
    { ...sharing, owner: "0x" + "0".repeat(40) }, { ...sharing, userSalt: "0x00" }, { ...sharing, protocolRecipient: addr(9) },
  ]) assert.throws(() => planSharingPolicy(input));
});
