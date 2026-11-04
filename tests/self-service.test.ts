import test from "node:test";
import assert from "node:assert/strict";
import { parseSelfServiceProfile, stage } from "../src/partner/self-service/context.js";
import { createAdmissionReadPort } from "../src/partner/self-service/rpc.js";

const address = "0x1111111111111111111111111111111111111111" as const;
const hash = `0x${"11".repeat(32)}`;
const pin = () => ({ address, runtimeHash: hash });
const profile = () => ({ schemaVersion: 1, label: "Isolated test", testOnly: true, evidence: "test evidence", chainId: 91342, genesisHash: hash, admission: pin(), registry: pin(), factory: pin(), router: pin(), wrapper: pin() });
const signal = () => new AbortController().signal;
function transport(handler: (method: string, params: unknown[]) => unknown) {
  const calls: string[] = [];
  const fetcher = (async (_url: unknown, init: RequestInit) => {
    const req = JSON.parse(String(init.body)) as { id: number; method: string; params: unknown[] };
    calls.push(req.method);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, result: handler(req.method, req.params) }), { status: 200 });
  }) as typeof fetch;
  return { calls, fetcher };
}

test("self-service profile accepts data pins and rejects executable or overwritten identities", () => {
  assert.equal(parseSelfServiceProfile(profile()).chainId, 91342);
  for (const invalid of [null, [], { ...profile(), chainId: 1 }, { ...profile(), driver: () => null }, { ...profile(), admission: { ...pin(), address: { status: 200 } } }, { ...profile(), registry: { ...pin(), runtimeHash: `0x${"00".repeat(32)}` } }, { ...profile(), factory: { ...pin(), callback: "code" } }]) assert.throws(() => parseSelfServiceProfile(invalid));
  assert.equal(stage("0"), 0); assert.equal(stage("1"), 1); assert.throws(() => stage("2"));
});

test("exact-block state is reused only after a witnessed block hash", async () => {
  const t = transport(method => method === "eth_getBlockByNumber" ? { number: "0x10", hash } : "0x1234");
  const p = createAdmissionReadPort(parseSelfServiceProfile(profile()), { ...t, intervalMs: 0 });
  const call = (method: string, params: unknown[]) => p.options.request(method, params, signal());
  await call("eth_getCode", [address, "0x10"]); // Not cached without the witness.
  await call("eth_getBlockByNumber", ["0x10", false]);
  await call("eth_getCode", [address, "0x10"]);
  assert.equal(await call("eth_getCode", [address, "0x10"]), "0x1234");
  assert.equal(t.calls.length, 3); assert.equal(p.stats().exactBlockCacheHits, 1);
});

test("a reorg witness invalidates exact-block state instead of caching canonical reads", async () => {
  let current = hash, state = "0x01";
  const t = transport(method => method === "eth_getBlockByNumber" ? { number: "0x10", hash: current } : state);
  const p = createAdmissionReadPort(parseSelfServiceProfile(profile()), { ...t, intervalMs: 0 });
  await p.options.request("eth_getBlockByNumber", ["0x10", false], signal());
  assert.equal(await p.options.request("eth_call", [{ to: address, data: "0x1234" }, "0x10"], signal()), "0x01");
  current = `0x${"22".repeat(32)}`; state = "0x02";
  await p.options.request("eth_getBlockByNumber", ["0x10", false], signal());
  assert.equal(await p.options.request("eth_call", [{ to: address, data: "0x1234" }, "0x10"], signal()), "0x02");
  assert.equal(t.calls.length, 4);
});

test("heads, nonces, receipts and unpinned state are always fresh", async () => {
  const t = transport(() => "0x01"), p = createAdmissionReadPort(parseSelfServiceProfile(profile()), { ...t, intervalMs: 0 });
  for (const [method, params] of [["eth_getBlockByNumber", ["latest", false]], ["eth_getTransactionCount", [address, "pending"]], ["eth_getTransactionReceipt", [hash]], ["eth_call", [{ to: address }, "latest"]]] as const) {
    await p.options.request(method, [...params], signal()); await p.options.request(method, [...params], signal());
  }
  assert.equal(t.calls.length, 8); assert.equal(p.stats().exactBlockCacheHits, 0);
});

test("the read port cannot send, sign or silently switch provider", async () => {
  const t = transport(() => "0x01"), p = createAdmissionReadPort(parseSelfServiceProfile(profile()), { ...t, intervalMs: 0 });
  for (const method of ["eth_sendRawTransaction", "eth_sign", "wallet_sendCalls"]) await assert.rejects(p.options.request(method, [], signal()), /Read-only/);
  assert.equal(t.calls.length, 0);
  assert.throws(() => createAdmissionReadPort(parseSelfServiceProfile(profile()), { url: "http://localhost" }), /HTTPS/);
});

test("an exact-state failure is preserved without an automatic retry", async () => {
  let calls = 0;
  const fetcher = (async (_url: unknown, init: RequestInit) => {
    calls++; const req = JSON.parse(String(init.body));
    return new Response(JSON.stringify(req.method === "eth_getBlockByNumber" ? { id: req.id, result: { number: "0x10", hash } } : { id: req.id, error: { code: -32000, message: "sensitive provider detail" } }));
  }) as typeof fetch;
  const p = createAdmissionReadPort(parseSelfServiceProfile(profile()), { fetcher, intervalMs: 0 });
  await p.options.request("eth_getBlockByNumber", ["0x10", false], signal());
  for (let i = 0; i < 2; i++) await assert.rejects(p.options.request("eth_call", [{ to: address }, "0x10"], signal()), /^Error: RPC failed \(-32000\)$/);
  assert.equal(calls, 2); assert.equal(p.stats().retries, 0);
});

test("budgets count dispatch attempts honestly and abort before network use", async () => {
  const t = transport(() => "0x01"), p = createAdmissionReadPort(parseSelfServiceProfile(profile()), { ...t, intervalMs: 0, maximumDispatches: 1, maximumLogicalReads: 4 });
  await p.options.request("eth_chainId", [], signal());
  await assert.rejects(p.options.request("eth_chainId", [], signal()), /budget exhausted/);
  assert.equal(p.stats().networkDispatchAttempts, 1);
  for (let i = 0; i < 4; i++) await p.options.beforeRead!("eth_chainId", signal());
  await assert.rejects(p.options.beforeRead!("eth_chainId", signal()), /budget exhausted/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(p.options.request("eth_chainId", [], controller.signal));
  assert.equal(t.calls.length, 1); assert.equal(p.stats().billingMeasured, false);
});

test("mismatched JSON-RPC envelopes do not become successful cached state", async () => {
  const fetcher = (async () => new Response(JSON.stringify({ id: 999, result: "0x01" }))) as typeof fetch;
  const p = createAdmissionReadPort(parseSelfServiceProfile(profile()), { fetcher, intervalMs: 0 });
  await assert.rejects(p.options.request("eth_chainId", [], signal()), /invalid response/);
});

import { prepareSelfServiceTestSource, prepareSelfServiceTestFunding } from "../src/partner/self-service/test-source.js";
import { decodeFunctionData, parseAbi } from "viem";

test("synthetic setup belongs to the supplied controller and refuses non-test profiles", () => {
  const p = parseSelfServiceProfile(profile()), input = { controller: address, partner: address, quote: address, base: "0x2222222222222222222222222222222222222222" as const, market: address, family: 0 as const };
  const plan = prepareSelfServiceTestSource(p, input);
  assert.equal(plan.request.account, address); assert.equal(plan.request.value, 0n); assert.equal(plan.automaticSend, false);
  assert.equal(plan.economicValue, false); assert.match(plan.runtimeHash, /^0x[0-9a-f]{64}$/);
  assert.throws(() => prepareSelfServiceTestSource({ ...p, testOnly: false }, input), /synthetic/);
  assert.throws(() => prepareSelfServiceTestSource(p, { ...input, base: input.quote }), /Distinct/);
});

test("test funding is bounded, unsigned and gives no native value to a fixture", () => {
  const p = parseSelfServiceProfile(profile()), plan = prepareSelfServiceTestFunding(p, { controller: address, source: address, quote: address, base: "0x2222222222222222222222222222222222222222", amountRaw: 100000n });
  assert.equal(plan.requests.length, 4); assert(plan.requests.every(x => x.account === address && x.value === 0n));
  for (const req of plan.requests) assert.deepEqual(decodeFunctionData({ abi: parseAbi(["function mint(address to,uint256 n)"]), data: req.data }).args, [address, 100000n]);
  assert.throws(() => prepareSelfServiceTestFunding(p, { controller: address, source: address, quote: address, base: address, amountRaw: 1000000001n }), /Bounded/);
});
