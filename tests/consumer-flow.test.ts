import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { giwaSepoliaLegacyNativeCompatibility } from "@ammora-protocol/sdk";
import { readBlock } from "../src/shared/env.js";
import type { PublicClient, Hex } from "viem";

const quickstarts = ["create-launch", "safe-swap", "verify-deployment"];
type PinMerger = (pins: Record<string, Hex>, legacy: boolean) => Record<string, Hex>;
const loadPinMerger = async (name: string): Promise<{ text: string; merge: PinMerger }> => {
  const path = `src/quickstart/${name}.ts`;
  const source = await readFile(path, "utf8");
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const node = file.statements.find(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => declaration.name.getText(file) === "mergeRuntimePins"));
  assert.ok(node, `${path} must carry its standalone pin resolver`);
  const text = node.getText(file).replace(/^export\s+/, "");
  const compiled = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  // Execute the actual copyable helper, with its published SDK dependency supplied.
  const merge = new Function("giwaSepoliaLegacyNativeCompatibility", `${compiled}\nreturn mergeRuntimePins;`)(giwaSepoliaLegacyNativeCompatibility) as PinMerger;
  return { text, merge };
};

test("all standalone integrations retain the same SDK-reviewed compatibility pins and reject conflicts", async () => {
  const helpers = await Promise.all(quickstarts.map(loadPinMerger));
  assert.equal(new Set(helpers.map(helper => helper.text)).size, 1, "standalone copies diverged");
  const compat = giwaSepoliaLegacyNativeCompatibility;
  const registry = compat.executionRegistry.toLowerCase();
  const router = compat.nativeRouter.toLowerCase();
  const arbitrary = "0x1111111111111111111111111111111111111111";
  const sampleHash = `0x${"ab".repeat(32)}` as Hex;
  for (const { merge } of helpers) {
    const input = { [arbitrary]: sampleHash };
    const pins = merge(input, true);
    assert.equal(pins[registry], compat.executionRegistryRuntimeCodeHash);
    assert.equal(pins[router], compat.nativeRouterRuntimeCodeHash);
    assert.equal(pins[arbitrary], sampleHash);
    assert.deepEqual(input, { [arbitrary]: sampleHash });
    assert.equal(merge(input, false)[registry], undefined, "do not apply a GIWA pin to other generations");
    assert.equal(pins["0x2222222222222222222222222222222222222222"], undefined, "do not invent any other pin");
    assert.throws(() => merge({ [registry]: sampleHash }, true), /conflicts with SDK/);
    assert.throws(() => merge({ [registry]: compat.executionRegistryRuntimeCodeHash, [compat.executionRegistry]: sampleHash }, true), /Conflicting runtime pins/);
  }
});

const hash = `0x${"11".repeat(32)}` as const;
const blockHash = `0x${"22".repeat(32)}` as const;
const receiptClient = (status = "success", canonicalHash = blockHash) => ({
  chain: { id: 91342 },
  getTransactionReceipt: async (args: { hash: string }) => { assert.equal(args.hash, hash); return { status, transactionHash: hash, blockNumber: 42n, blockHash }; },
  getBlock: async (args: { blockNumber: bigint }) => { assert.deepEqual(args, { blockNumber: 42n }); return { number: 42n, hash: canonicalHash }; },
  getBlockNumber: async () => { throw new Error("receipt reads must never fall back to another head"); },
}) as unknown as PublicClient;
const withReceipt = async (value: string, run: () => Promise<void>) => {
  const saved = process.env.AMMORA_READ_RECEIPT;
  process.env.AMMORA_READ_RECEIPT = value;
  try { await run(); } finally { if (saved === undefined) delete process.env.AMMORA_READ_RECEIPT; else process.env.AMMORA_READ_RECEIPT = saved; }
};

test("a new launch can be read at its successful canonical receipt without silently changing finality policy", async () => {
  await withReceipt(hash, async () => {
    const block = await readBlock(receiptClient());
    assert.equal(block.number, 42n);
    assert.equal(block.snapshot.kind, "receipt");
    if (block.snapshot.kind === "receipt") assert.equal(block.snapshot.transactionHash, hash);
  });
});

test("receipt-bound reads reject reverted or noncanonical receipts and malformed hashes", async () => {
  await withReceipt(hash, async () => {
    await assert.rejects(readBlock(receiptClient("reverted")), /reverted/);
    await assert.rejects(readBlock(receiptClient("success", `0x${"33".repeat(32)}` as typeof blockHash)), /canonical block/);
  });
  await withReceipt("not-a-hash", async () => {
    await assert.rejects(readBlock(receiptClient()), /transaction hash/);
  });
});
