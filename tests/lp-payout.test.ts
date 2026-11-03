import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { encodeFunctionData, decodeFunctionData, getAddress, zeroAddress } from "viem";
import { DammV2Client, ammConcentratedPositionManagerV3Abi } from "@ammora-protocol/sdk";

const owner = "0x1111111111111111111111111111111111111111";
const payout = "0x2222222222222222222222222222222222222222";
const pool = "0x3333333333333333333333333333333333333333";
const manager = "0x4444444444444444444444444444444444444444";
const source = readFileSync("src/arl/claim-position-fee.ts", "utf8");
const file = ts.createSourceFile("claim-position-fee.ts", source, ts.ScriptTarget.Latest, true);
const executable = file.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(file)).join("\n");
const compiled = ts.transpileModule(executable, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;

// Execute the real CLI body with synthetic chain boundaries. Assert that one reviewed
// destination reaches planning, simulation, calldata and receipt validation unchanged.
const run = async (args: string[], options: { zero?: boolean; otherOwner?: boolean; delegatePermission?: number } = {}) => {
  const calls: { plan?: unknown[]; simulation?: unknown[]; sent?: unknown; receipt?: unknown; signer: number } = { signer: 0 };
  let task: Promise<unknown> = Promise.resolve();
  const deps = {
    process: { argv: ["node", "example", pool, "5", ...args] }, console: { log() {} }, zeroAddress,
    main: (callback: () => Promise<void>) => { task = callback(); },
    address: (_: string, value: string) => getAddress(value.toLowerCase()),
    signer: () => { calls.signer++; return { wallet: {}, account: { address: owner } }; },
    reader: async () => ({ simulateContract: async (input: { args: unknown[] }) => { calls.simulation = input.args; return { result: options.zero ? [0n, 0n] : [0n, 42n] }; }, getTransactionReceipt: async () => ({}) }),
    deployment: () => ({ chain: { id: 91342 }, contracts: { launch: { concentratedFactory: manager, concentratedPositionManager: manager } } }),
    clientOptions: () => ({}), requireContract: async () => {}, asPool: async (_: unknown, _label: unknown, f: () => unknown) => f(),
    tokenInfo: async () => ({ symbol: "WETH", decimals: 18 }), positionOwner: async () => options.otherOwner ? payout : owner,
    DammV2Client: class {
      async getPoolState() { return { baseToken: owner, quoteToken: payout }; }
      async planClaimManagedConcentratedFees(id: bigint, recipient: `0x${string}`, caller: string) {
        calls.plan = [id, recipient, caller];
        const actualOwner = options.otherOwner ? payout : owner;
        // Exercise the published SDK permission boundary, including owner-only destinations.
        (DammV2Client.prototype as unknown as { assertManagedConcentratedPermission: (authority: unknown, unrestricted: number, ownerOnly: number, recipient: string) => void }).assertManagedConcentratedPermission({ owner: actualOwner, callerIsOwner: caller === actualOwner, callerIsDelegate: options.delegatePermission !== undefined, permission: options.delegatePermission ?? 0 }, 8, 16, recipient);
        return { to: manager, data: encodeFunctionData({ abi: ammConcentratedPositionManagerV3Abi, functionName: "claimPositionFees", args: [id, recipient] }) };
      }
    },
    ammConcentratedPositionManagerV3Abi, amount: () => "synthetic",
    send: async (_: string, transaction: { data: `0x${string}` }) => { calls.sent = decodeFunctionData({ abi: ammConcentratedPositionManagerV3Abi, data: transaction.data }); return `0x${"ab".repeat(32)}`; },
    resolveAmmConcentratedPositionFeeClaimReceipt: (input: unknown) => { calls.receipt = input; return { baseAmount: 0n, quoteAmount: 42n }; },
  };
  new Function(...Object.keys(deps), compiled)(...Object.values(deps));
  await task;
  return calls;
};

test("LP alternate payout is identical across the SDK planner, simulation, sent calldata and receipt expectation", async () => {
  const calls = await run([payout]);
  assert.deepEqual(calls.plan, [5n, payout, owner]);
  assert.deepEqual(calls.simulation, [5n, payout]);
  assert.deepEqual(calls.sent, { functionName: "claimPositionFees", args: [5n, payout] });
  assert.equal((calls.receipt as { recipient: string }).recipient, payout);
});

test("omitting LP payout keeps owner payment and zero fees send no transaction", async () => {
  const own = await run([]);
  assert.deepEqual(own.plan, [5n, owner, owner]);
  assert.equal((own.receipt as { recipient: string }).recipient, owner);
  const empty = await run([payout], { zero: true });
  assert.equal(empty.sent, undefined);
  assert.equal(empty.receipt, undefined);
});

test("invalid LP destination/extra arguments and a different NFT owner cannot reach a send", async () => {
  await assert.rejects(run([zeroAddress]), /zero address/);
  await assert.rejects(run(["invalid"]));
  await assert.rejects(run([payout, "unexpected"]), /pass the position token id/);
  await assert.rejects(run([payout], { otherOwner: true }), /required position permission/);
});


test("a fee delegate can choose another payout while the omitted destination stays the NFT owner", async () => {
  const custom = await run([pool], { otherOwner: true, delegatePermission: 8 });
  assert.deepEqual(custom.plan, [5n, pool, owner]);
  assert.deepEqual(custom.simulation, [5n, pool]);
  assert.equal((custom.receipt as { recipient: string }).recipient, pool);
  const defaulted = await run([], { otherOwner: true, delegatePermission: 8 });
  assert.deepEqual(defaulted.plan, [5n, payout, owner]);
});

test("owner-only fee delegation cannot redirect, unrelated permissions and revoked callers cannot claim", async () => {
  const restricted = await run([], { otherOwner: true, delegatePermission: 16 });
  assert.deepEqual(restricted.plan, [5n, payout, owner]);
  for (const permission of [0, 1, 2, 4, 32, 64, 128]) {
    await assert.rejects(run([pool], { otherOwner: true, delegatePermission: permission }), /required position permission/);
  }
  await assert.rejects(run([pool], { otherOwner: true, delegatePermission: 16 }), /required position permission/);
});
