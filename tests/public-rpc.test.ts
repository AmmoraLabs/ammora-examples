import test from "node:test";
import assert from "node:assert/strict";
import { createPublicClient } from "viem";
import { pacedHttp } from "../src/shared/rpc.js";
import { deployment, clientOptions } from "../src/shared/env.js";
import { giwaSepoliaAutoRouteDeployment, giwaSepoliaPermissionless, giwaSepoliaAutoRoutePoolProfiles } from "@ammora-protocol/sdk";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("reviewed generation selection never mixes legacy IDs with auto-route contracts", () => {
  const saved = { chain: process.env.AMMORA_CHAIN_ID, generation: process.env.AMMORA_GIWA_GENERATION };
  try {
    process.env.AMMORA_CHAIN_ID = "91342";
    delete process.env.AMMORA_GIWA_GENERATION;
    assert.equal(deployment(), giwaSepoliaPermissionless);
    process.env.AMMORA_GIWA_GENERATION = "auto-route";
    assert.equal(deployment(), giwaSepoliaAutoRouteDeployment);
    assert.equal(clientOptions().factoryProfiles, giwaSepoliaAutoRoutePoolProfiles);
    process.env.AMMORA_CHAIN_ID = "1";
    assert.throws(deployment, /GIWA only/);
    process.env.AMMORA_GIWA_GENERATION = "guess";
    assert.throws(deployment, /must be/);
  } finally {
    for (const [name, value] of [["AMMORA_CHAIN_ID", saved.chain], ["AMMORA_GIWA_GENERATION", saved.generation]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  }
});

test("standalone quickstarts carry the identical serialized, non-retrying read transport", async () => {
  const extract = (path: string, source: string) => {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const statement = ast.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => d.name.getText(ast) === "pacedHttp"));
    assert.ok(statement, path);
    return statement.getText(ast);
  };
  const shared = extract("shared", await readFile("src/shared/rpc.ts", "utf8"));
  for (const name of ["create-launch", "safe-swap", "verify-deployment", "list-configs", "check-aggregation"]) {
    const path = `src/quickstart/${name}.ts`;
    assert.equal(extract(path, await readFile(path, "utf8")), shared);
  }
});

test("parallel reads are spaced, a 429 is not retried, and a failed queue continues", async () => {
  const calls: number[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    calls.push(Date.now());
    const request = JSON.parse(String(init?.body));
    if (calls.length === 1) return new Response("rate limited", { status: 429 });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: "0x164ce" }), { headers: { "content-type": "application/json" } });
  };
  try {
    const client = createPublicClient({ transport: pacedHttp("https://fixture.invalid", 100) });
    const result = await Promise.allSettled([client.request({ method: "eth_chainId" }), client.request({ method: "eth_chainId" }), client.request({ method: "eth_chainId" })]);
    assert.equal(result[0]!.status, "rejected");
    assert.equal(result[1]!.status, "fulfilled"); assert.equal(result[2]!.status, "fulfilled");
    assert.equal(calls.length, 3, "no hidden retry or HTTP batch");
    for (let i = 1; i < calls.length; i++) assert.ok(calls[i]! - calls[i - 1]! >= 75, "calls must be paced");
  } finally { globalThis.fetch = originalFetch; }
  assert.throws(() => pacedHttp(undefined, -1), /INTERVAL/);
});

test("shared sends reject a pending nonce and retain the submitted hash through confirmation failure", async () => {
  const { send } = await import("../src/shared/run.js");
  const saved = process.env.AMMORA_SEND, savedChain = process.env.AMMORA_CHAIN_ID; process.env.AMMORA_SEND = "1"; process.env.AMMORA_CHAIN_ID = "91342";
  const address = "0x1111111111111111111111111111111111111111" as const;
  const hash = `0x${"12".repeat(32)}` as const;
  const blockHash = `0x${"34".repeat(32)}` as const;
  let submitted = 0, simulated = 0;
  const wallet = { chain: { id: 91342 }, sendTransaction: async (request: { nonce: number }) => { assert.equal(request.nonce, 4); submitted++; return hash; } };
  const pending = { chain: { id: 91342 }, getTransactionCount: async ({ blockTag }: { blockTag: string }) => blockTag === "latest" ? 4 : 5, call: async () => { simulated++; } };
  try {
    await assert.rejects(send("fixture", { to: address, data: "0x" }, wallet as never, { address } as never, pending as never), /Pending transaction/);
    assert.equal(submitted, 0); assert.equal(simulated, 0);
    const ready = { ...pending, getTransactionCount: async () => 4,
      waitForTransactionReceipt: async (request: { confirmations: number; retryCount: number }) => { assert.equal(request.confirmations, 13); assert.equal(request.retryCount, 0); return { status: "success", blockNumber: 42n, blockHash }; },
      getBlock: async () => ({ hash: blockHash }),
    };
    await send("fixture", { to: address, data: "0x" }, wallet as never, { address } as never, ready as never);
    assert.equal(submitted, 1); assert.equal(simulated, 1);
    const failing = { ...ready, waitForTransactionReceipt: async () => { throw new Error("RPC confirmation unavailable"); } };
    await assert.rejects(send("fixture", { to: address, data: "0x" }, wallet as never, { address } as never, failing as never), /confirmation unavailable/);
    assert.equal(submitted, 2, "one broadcast for each distinct call, no implicit resend");
  } finally { if (saved === undefined) delete process.env.AMMORA_SEND; else process.env.AMMORA_SEND = saved; if (savedChain === undefined) delete process.env.AMMORA_CHAIN_ID; else process.env.AMMORA_CHAIN_ID = savedChain; }
});
