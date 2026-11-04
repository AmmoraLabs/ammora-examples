import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeFunctionData } from "viem";
import { EXTENSION_VAULT_ABI } from "@ammora-protocol/sdk/partner";
import { parseSelfServiceProfile } from "../src/partner/self-service/context.js";
import { parseSelfServiceModulePin } from "../src/partner/self-service/extension.js";
import { parseSelfServiceTradeInput } from "../src/partner/self-service/trade.js";
import { prepareSelfServiceClaim } from "../src/partner/self-service/claim.js";
const a = (n: string) => `0x${n.repeat(40)}` as `0x${string}`, h = `0x${"11".repeat(32)}`;
const profile = parseSelfServiceProfile(JSON.parse(readFileSync(new URL("../fixtures/self-service-giwa.test.json", import.meta.url), "utf8")));
const pin = () => ({ address: a("1"), runtimeHash: h, vault: { address: a("2"), runtimeHash: h } });
const input = () => ({ assetIn: a("3"), amountRaw: "10000", minOutputRaw: "9900", payer: a("4"), recipient: a("4"), refundTo: a("4"), executor: a("4"), nonce: "7", ttlSeconds: "240" });
test("module pins reject overwritten identities, executable fields and aliasing", () => {
  assert.equal(parseSelfServiceModulePin(pin()).vault.address.toLowerCase(), a("2"));
  for (const invalid of [{ ...pin(), address: { status: 200 } }, { ...pin(), callback: "code" }, { ...pin(), vault: { ...pin().vault, address: a("1") } }, { ...pin(), vault: { ...pin().vault, runtimeHash: `0x${"00".repeat(32)}` } }]) assert.throws(() => parseSelfServiceModulePin(invalid));
});
test("trade inputs keep explicit amounts, receiver, nonce and ERC20 native flags", () => {
  const p = parseSelfServiceTradeInput(input()); assert.equal(p.amount, 10000n); assert.equal(p.limit, 9900n); assert.equal(p.nonce, 7n); assert.equal(p.ttlSeconds, 240n); assert.equal(p.nativeIn, false); assert.equal(p.nativeOut, false); assert.equal(p.mode, "exact-input");
});
test("trade parsing rejects unbounded integers, missing slippage and transaction/secret overrides", () => {
  for (const changed of [{ amountRaw: "0" }, { amountRaw: "-1" }, { amountRaw: "1.5" }, { amountRaw: (2n ** 256n).toString() }, { minOutputRaw: "0" }, { ttlSeconds: "301" }, { to: a("5") }, { privateKey: "not accepted" }, { payer: { address: a("4") } }]) assert.throws(() => parseSelfServiceTradeInput({ ...input(), ...changed }));
});
test("public claim helper uses the actual beneficiary and frozen SDK ABI with no network", () => {
  const m = parseSelfServiceModulePin(pin()), p = prepareSelfServiceClaim(profile, m, a("3"), a("4")); assert.equal(p.request.to, m.vault.address); assert.equal(p.request.account.toLowerCase(), a("4")); assert.equal(p.request.value, 0n); const d = decodeFunctionData({ abi: EXTENSION_VAULT_ABI, data: p.request.data }); assert.equal(d.functionName, "claim"); assert.deepEqual(d.args, [a("3")]); assert.equal(p.stats.networkDispatchAttempts, 0); assert.equal(p.payoutVerified, false); assert.equal(p.automaticSend, false);
});
