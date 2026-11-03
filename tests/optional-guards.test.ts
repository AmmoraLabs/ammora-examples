import test from "node:test";
import assert from "node:assert/strict";
import { zeroAddress } from "viem";
import { poolKind, requireOwner, sameTransaction, partialAccounting, requirePositiveReward, requireHelper } from "../src/arl/optional-guards.js";
const owner = "0x1111111111111111111111111111111111111111", other = "0x2222222222222222222222222222222222222222";
test("partial input accounting refuses inconsistent, negative and zero fills", () => {
  assert.deepEqual(partialAccounting(100n, {amountIn: 60n, amountLeft: 40n, amountOut: 2n}), {maximumInput: 100n, consumedInput: 60n, unusedInput: 40n, output: 2n});
  for (const q of [{amountIn: 101n, amountLeft: -1n, amountOut: 2n}, {amountIn: 60n, amountLeft: 41n, amountOut: 2n}, {amountIn: 0n, amountLeft: 100n, amountOut: 0n}]) assert.throws(() => partialAccounting(100n, q), /accounting/);
});
test("direct owner example cannot treat a delegate, manager or zero owner as the pool NFT owner", () => {
  requireOwner(owner, owner); assert.throws(() => requireOwner(owner, other), /owner/); assert.throws(() => requireOwner(zeroAddress, zeroAddress), /owner/);
});
test("raw builder comparison never replaces checked calldata or value", () => {
  const checked = {to: owner, data: "0x1234"} as const; assert.equal(sameTransaction(checked, {...checked, value: 0n}), checked);
  for (const raw of [{...checked, to: other}, {...checked, data: "0xabcd" as const}, {...checked, value: 1n}] as const) assert.throws(() => sameTransaction(checked, raw), /differs/);
});
test("zero rewards and missing deployment helpers stay blocked", () => {
  requirePositiveReward(1n); assert.throws(() => requirePositiveReward(0n), /positive/);
  requireHelper(owner, "helper"); for (const value of [undefined, null, zeroAddress]) assert.throws(() => requireHelper(value, "helper"), /reviewed/);
});
test("pool kinds cannot silently default to concentrated", () => {
  assert.equal(poolKind("compounding"), "compounding"); for (const value of [undefined, "almm", ""]) assert.throws(() => poolKind(value), /pool kind/);
});
