import test from "node:test";
import assert from "node:assert/strict";
import { feeVaultAbi } from "@ammora-protocol/sdk";
import { decodeFunctionData } from "viem";
import { planOwnFeeClaim } from "../src/launch/fee-claim-plan.js";

const token = "0x4200000000000000000000000000000000000006";
const creator = "0x1111111111111111111111111111111111111111";
const partner = "0x2222222222222222222222222222222222222222";
const payout = "0x3333333333333333333333333333333333333333";

test("an alternate payout spends the signing beneficiary's entitlement", () => {
  const plan = planOwnFeeClaim(token, creator, payout);
  const decoded = decodeFunctionData({ abi: feeVaultAbi, data: plan.data });
  assert.equal(decoded.functionName, "claimFor");
  assert.deepEqual(decoded.args, [token, creator, payout]);
});

test("creator and partner self-claims remain separate without a fixed beneficiary", () => {
  const creatorPlan = planOwnFeeClaim(token, creator);
  const partnerPlan = planOwnFeeClaim(token, partner);
  assert.deepEqual(decodeFunctionData({ abi: feeVaultAbi, data: creatorPlan.data }).args,
    [token, creator, creator]);
  assert.deepEqual(decodeFunctionData({ abi: feeVaultAbi, data: partnerPlan.data }).args,
    [token, partner, partner]);
  assert.notEqual(creatorPlan.data, partnerPlan.data);
});
