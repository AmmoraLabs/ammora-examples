import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { keccak256, type PublicClient } from "viem";
import { natural, caller, execute, assertPinnedCode } from "../src/shared/actions.js";
const owner = "0x1111111111111111111111111111111111111111" as const;
const target = "0x2222222222222222222222222222222222222222" as const;
const other = "0x3333333333333333333333333333333333333333" as const;

test("action amounts reject decimal, signed, scientific, missing, zero funding and uint256 overflow", () => {
  for (const value of [undefined, "", "-1", "1.2", "1e18", String(1n << 256n)]) assert.throws(() => natural(value, "amount"));
  assert.throws(() => natural("0", "amount", true));
  assert.equal(natural("0", "id"), 0n);
  assert.equal(natural(String((1n << 256n) - 1n), "amount"), (1n << 256n) - 1n);
});
test("caller cannot be missing or zero", () => {
  const before = process.env.AMMORA_ACCOUNT;
  try {
    delete process.env.AMMORA_ACCOUNT; assert.throws(caller, /AMMORA_ACCOUNT/);
    process.env.AMMORA_ACCOUNT = `0x${"0".repeat(40)}`; assert.throws(caller, /real caller/);
  } finally { if (before === undefined) delete process.env.AMMORA_ACCOUNT; else process.env.AMMORA_ACCOUNT = before; }
});
test("unsigned execution touches no RPC or signer and never reports verified payout", async () => {
  const before = process.env.AMMORA_SEND, log = console.log;
  const output: string[] = [];
  try {
    process.env.AMMORA_SEND = "0"; console.log = value => output.push(String(value));
    const client = new Proxy({}, { get() { throw new Error("Unexpected RPC/signing access"); } }) as PublicClient;
    await execute("preview", { client, caller: owner, allowedTargets: [target] }, { to: target, data: "0x" });
    const result = JSON.parse(output[0]!);
    assert.equal(result.mode, "UNSIGNED_PREVIEW"); assert.equal(result.payoutVerified, false);
  } finally { console.log = log; if (before === undefined) delete process.env.AMMORA_SEND; else process.env.AMMORA_SEND = before; }
});
test("out-of-scope target or approval spender refuses before any signer or RPC", async () => {
  const client = new Proxy({}, { get() { throw new Error("Unexpected RPC/signing access"); } }) as PublicClient;
  const context = { client, caller: owner, allowedTargets: [target] };
  await assert.rejects(execute("bad target", context, { to: other, data: "0x" }), /outside this action/);
  await assert.rejects(execute("bad approval", context, { to: target, data: "0x" }, [{ token: owner, spender: other, amount: 1n }]), /spender outside/);
});
test("new core action CLIs reject missing caller or malformed permissions before network", () => {
  const actions = [
    ["src/dfs/claim.ts", target, "0"], ["src/dfs/fund.ts", target, "1"],
    ["src/arl/remove-position-liquidity.ts", target, "5", "1"],
    ["src/almm/remove-liquidity.ts", target, "5", "100"],
    ["src/staking/stake.ts", target, "1"], ["src/vault/redeem.ts", target, "1", "1", "1"],
    ["src/almm/position-delegate.ts", target, "5", other, "255"],
  ];
  for (const args of actions) {
    const result = spawnSync(process.execPath, ["--import", "tsx", ...args], { encoding: "utf8", timeout: 10000,
      env: { ...process.env, AMMORA_ACCOUNT: "", AMMORA_SEND: "0", AMMORA_PRIVATE_KEY: "", AMMORA_RPC_URL: "http://127.0.0.1:1" } });
    assert.equal(result.status, 1, args[0]);
    assert.match(result.stderr, /AMMORA_ACCOUNT|permission must/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|fetch failed/);
  }
});
test("every added feature is an explicit published SDK call with a registered CLI", () => {
  const features = JSON.parse(readFileSync("docs/contract-feature-actions.json", "utf8")) as {command:string; file:string; sdkSymbols:string[]}[];
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const feature of features) {
    assert.equal(pkg.scripts[feature.command], `tsx ${feature.file}`);
    const source = readFileSync(feature.file, "utf8");
    for (const symbol of feature.sdkSymbols) assert.ok(source.includes((symbol.split(".").at(-1)!) + "("), `${feature.file}: ${symbol}`);
    assert.doesNotMatch(source, /getLaunchFeed|AmmoraDataApiClient|fetch\(/);
  }
});

test("reviewed pins reject empty contracts even if the caller supplied the empty-code hash", () => {
  const hash = keccak256("0x6000");
  assert.doesNotThrow(() => assertPinnedCode("0x6000", hash));
  assert.throws(() => assertPinnedCode("0x6001", hash));
  assert.throws(() => assertPinnedCode(undefined, hash));
  assert.throws(() => assertPinnedCode("0x", keccak256("0x")), /no code/);
  assert.throws(() => assertPinnedCode("0x6000", "0x12"));
});
