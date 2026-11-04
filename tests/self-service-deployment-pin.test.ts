import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encodeEventTopics, encodeAbiParameters, keccak256, type PublicClient } from "viem";
import { EXTENSION_FACTORY_ABI } from "@ammora-protocol/sdk/partner";
import { parseSelfServiceProfile } from "../src/partner/self-service/context.js";
import { readSelfServiceDeploymentPin } from "../src/partner/self-service/deployment-pin.js";
const a = (n: string) => `0x${n.repeat(40)}` as `0x${string}`, h = (n: string) => `0x${n.repeat(64)}` as `0x${string}`, code = "0x6000" as const, codeHash = keccak256(code);
const profile = parseSelfServiceProfile(JSON.parse(readFileSync(new URL("../fixtures/self-service-giwa.test.json", import.meta.url), "utf8")));
const reviewed = { ...profile, factory: { ...profile.factory, runtimeHash: codeHash } }, known = { transactionHash: h("2"), configurationHash: h("3"), module: a("4"), vault: a("5") };
function client(overrides: { chain?: number; orphaned?: boolean; factoryCode?: `0x${string}`; recordedModule?: `0x${string}`; receiptHash?: `0x${string}` } = {}) {
  const event = { address: profile.factory.address, data: encodeAbiParameters([{ type: "bytes32" }], [codeHash]), topics: encodeEventTopics({ abi: EXTENSION_FACTORY_ABI, eventName: "Created", args: { configurationHash: known.configurationHash, module: known.module, vault: known.vault } }), removed: false };
  return { getChainId: async () => overrides.chain ?? 91342, getBlock: async (p?: { blockNumber: bigint }) => p?.blockNumber === 0n ? { hash: profile.genesisHash, number: 0n } : p ? { hash: overrides.orphaned ? h("9") : h("1"), number: 100n } : { hash: h("6"), number: 112n }, getTransactionReceipt: async () => ({ transactionHash: overrides.receiptHash ?? known.transactionHash, status: "success", blockNumber: 100n, blockHash: h("1"), logs: [event] }), getBytecode: async (p: { address: string }) => p.address === profile.factory.address ? overrides.factoryCode ?? code : code, readContract: async (p: { functionName: string }) => p.functionName === "deployment" ? [overrides.recordedModule ?? known.module, codeHash] : known.module } as unknown as PublicClient;
}
test("deployment pins bind canonical trusted factory event, mapping and both children without send authority", async () => {
  const r = await readSelfServiceDeploymentPin(reviewed, client(), known); assert.equal(r.pin.address.toLowerCase(), known.module); assert.equal(r.pin.runtimeHash, codeHash); assert.equal(r.pin.vault.runtimeHash, codeHash); assert.equal(r.automaticSend, false); assert.equal(r.activationOrPayoutVerified, false); assert.equal(r.finalizedStatusClaimed, false);
});
test("deployment pin read rejects a wrong chain and an orphaned known receipt", async () => {
  await assert.rejects(readSelfServiceDeploymentPin(reviewed, client({ chain: 1 }), known), /Wrong chain/);
  await assert.rejects(readSelfServiceDeploymentPin(reviewed, client({ orphaned: true }), known), /canonical/);
  await assert.rejects(readSelfServiceDeploymentPin(reviewed, client({ receiptHash: h("8") }), known), /known hash/);
});
test("deployment pin read rejects an unchecked factory and wrong configuration mapping", async () => {
  await assert.rejects(readSelfServiceDeploymentPin(reviewed, client({ factoryCode: "0x6001" }), known), /factory runtime/);
  await assert.rejects(readSelfServiceDeploymentPin(reviewed, client({ recordedModule: a("7") }), known), /disagree/);
});
test("deployment pin input cannot add serialized plans or transaction overrides", async () => {
  await assert.rejects(readSelfServiceDeploymentPin(reviewed, client(), { ...known, request: {} }), /receipt-only/);
});
