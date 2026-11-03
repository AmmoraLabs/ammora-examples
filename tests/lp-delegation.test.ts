import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { AmmConcentratedV3PositionDelegatePermission } from "@ammora-protocol/sdk";
import { zeroAddress, getAddress } from "viem";
const pool = "0x1111111111111111111111111111111111111111", owner = "0x2222222222222222222222222222222222222222", delegate = "0x3333333333333333333333333333333333333333";
const source = readFileSync("src/arl/fee-delegate.ts", "utf8");
const file = ts.createSourceFile("fee-delegate.ts", source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(file.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(file)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const run = async (args: string[], notOwner = false) => {
  let task: Promise<unknown> = Promise.resolve();
  let plan: unknown[] = [], sent = false;
  const deps = {
    process: { argv: ["node", "example", pool, "5", ...args] }, console: { log() {} }, zeroAddress, AmmConcentratedV3PositionDelegatePermission,
    main: (f: () => Promise<void>) => { task = f(); }, address: (_: string, value: string) => getAddress(value),
    signer: () => ({ wallet: {}, account: { address: owner } }), reader: async () => ({ getTransactionReceipt: async () => ({ blockNumber: 42n }), readContract: async (x: { functionName: string; blockNumber: bigint }) => { assert.equal(x.blockNumber, 42n); return x.functionName === "positionDelegate" ? plan[1] : plan[2]; } }),
    deployment: () => ({ contracts: { launch: { concentratedFactory: pool, concentratedPositionManager: pool } } }), requireContract: async () => {}, clientOptions: () => ({}), ammConcentratedPositionManagerV3Abi: [],
    DammV2Client: class { async planUpdateDelegatePermission(...args: unknown[]) { if (notOwner) throw new Error("only position owner can update delegation"); plan = args; return {}; } },
    send: async () => { sent = true; return "synthetic"; },
  };
  new Function(...Object.keys(deps), code)(...Object.values(deps)); await task; return { plan, sent };
};
test("fee delegation example grants only named fee bits and revoke clears address and permission", async () => {
  for (const [mode, permission] of [["claim-fee", 8], ["claim-fee-to-owner", 16]] as const) {
    const result = await run([delegate, mode]); assert.deepEqual(result.plan, [5n, delegate, permission, owner]); assert.equal(result.sent, true);
  }
  assert.deepEqual((await run(["revoke"])).plan, [5n, zeroAddress, 0, owner]);
});
test("fee delegation refuses broad numeric masks, invalid combinations and nonowner updates", async () => {
  for (const args of [[delegate, "255"], [delegate, "remove-liquidity"], [delegate], [zeroAddress, "claim-fee"], ["revoke", "claim-fee"], [delegate, "claim-fee", "extra"], [owner, "claim-fee"]]) await assert.rejects(run(args));
  await assert.rejects(run([delegate, "claim-fee"], true), /only position owner/);
});


test("LP delegation transaction entrypoints refuse sending before any key or network access", () => {
  for (const [file, args] of [
    ["src/arl/fee-delegate.ts", [pool, "5", delegate, "claim-fee"]],
    ["src/arl/fee-delegate.ts", [pool, "5", "revoke"]],
    ["src/arl/claim-position-fee.ts", [pool, "5", delegate]],
  ] as const) {
    const result = spawnSync(process.execPath, ["--import", "tsx", file, ...args], { encoding: "utf8", timeout: 10000, env: { ...process.env, AMMORA_SEND: "0", AMMORA_PRIVATE_KEY: "", AMMORA_RPC_URL: "http://127.0.0.1:1" } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AMMORA_SEND=1/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|fetch failed/);
  }
});
