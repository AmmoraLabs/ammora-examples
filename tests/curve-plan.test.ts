import test from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, zeroAddress, type Address, type PublicClient } from "viem";
import { AMMORA_FEE_POLICY_VERSION, ammoraLaunchPoolV4Abi } from "@ammora-protocol/sdk";
import { planCurveAtBlock } from "../src/launch/curve-plan.js";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const a = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const core = { configRegistry: a(1), launchFactory: a(2), graduationAdapter: a(3), feePolicy: a(4) };
const base = a(5), quote = a(6), curve = a(7), recipient = a(8);
const parameters = { blockNumber: 42n, tokenIn: base, amountIn: 1000n, recipient, deadline: 2000n, slippageBps: 50 };
const fixture = (options: { partial?: boolean; foreign?: boolean; wrongPolicy?: boolean } = {}) => ({
  getBlockNumber: () => { throw new Error("must not select latest during explicit planning"); },
  readContract: async ({ functionName: name, blockNumber, address }: { functionName: string; blockNumber: bigint; address: Address }) => {
    assert.equal(blockNumber, 42n, `${name} escaped its pinned block`);
    const values: Record<string, unknown> = {
      feePolicy: options.wrongPolicy ? a(99) : core.feePolicy, feePolicyVersion: AMMORA_FEE_POLICY_VERSION,
      configRegistry: core.configRegistry, graduationAdapter: core.graduationAdapter, launchFactory: core.launchFactory,
      tokenForCurve: options.foreign ? a(99) : base, configId: 1n, baseToken: base, quoteToken: quote,
      creator: recipient, sqrtPrice: 1n, status: 1, currentFeeBps: 100, currentDynamicFeeBps: 0,
      baseReserve: 10000n, quoteReserve: 10000n, migrationQuoteThreshold: 20000n, migrationBaseThreshold: 1n,
      canonicalPool: zeroAddress, postMigrationLiquidity: 10n, launchContext: [recipient, a(9), core.graduationAdapter, 2n], protocolRecipient: a(10),
      quoteExactInput: [{ amountIn: options.partial ? 900n : 1000n, amountOut: 2000n, amountLeft: options.partial ? 100n : 0n, nextSqrtPrice: 2n }, 10n],
    };
    assert.ok(name in values, `unexpected ${name} at ${address}`); return values[name];
  },
}) as unknown as PublicClient;

test("explicit-block curve planning authenticates and encodes strict sell orders without selecting latest", async () => {
  const plan = await planCurveAtBlock(fixture(), core, curve, parameters);
  assert.equal(plan.quote.asOfBlock, 42n);
  assert.equal(plan.quote.minimumAmountOut, 1990n);
  const decoded = decodeFunctionData({ abi: ammoraLaunchPoolV4Abi, data: plan.transaction.data });
  assert.equal(decoded.functionName, "swapExactInput");
  assert.deepEqual(decoded.args, [1000n, 1990n, true, false, recipient, 2000n]);
  assert.equal(plan.approvalRequirements[0]!.spender, curve);
  await assert.rejects(planCurveAtBlock(fixture({ partial: true }), core, curve, parameters), /Unexpected partial/);
  await assert.rejects(planCurveAtBlock(fixture({ foreign: true }), core, curve, parameters), /not bound/);
  await assert.rejects(planCurveAtBlock(fixture({ wrongPolicy: true }), core, curve, parameters), /bindings/);
  await assert.rejects(planCurveAtBlock(fixture(), core, curve, { ...parameters, tokenIn: a(99) }), /not a curve asset/);
});

test("the copyable quickstart carries the identical explicit-block authenticator and planner", async () => {
  const extract = (source: string) => {
    const ast = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
    const statement = ast.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => d.name.getText(ast) === "planCurveAtBlock"));
    assert.ok(statement); return statement.getText(ast);
  };
  assert.equal(extract(await readFile("src/quickstart/safe-swap.ts", "utf8")), extract(await readFile("src/launch/curve-plan.ts", "utf8")));
});
