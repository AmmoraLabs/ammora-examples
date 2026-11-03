import { routeGeneration } from "../src/routing/catalog.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { ExecutionRevertedError, decodeFunctionData, custom } from "viem";
import { buildPortableCurve, AmmoraSdkError, AmmoraErrorCode, ammConcentratedPoolV3Abi } from "@ammora-protocol/sdk";
import { buildAmmoraExactInCalldata } from "@ammora-protocol/sdk/integrate";
import { integer, tokenAmount } from "../src/shared/input.js";
import { retryRead, isContractRevert } from "../src/shared/retry.js";
import { describeSwapStatus } from "../src/shared/status.js";
import { signer, reader, deployment, clientOptions } from "../src/shared/env.js";
import { preflight, asPool, positionOwner, describeError } from "../src/shared/run.js";
import { parseEconomics } from "../src/portable/economics.js";
import type { Account, PublicClient } from "viem";

const address = "0x1111111111111111111111111111111111111111" as const;
const recipient = "0x2222222222222222222222222222222222222222" as const;
const hash = `0x${"00".repeat(32)}` as const;

test("amount parsing never rounds excess precision or accepts negative/zero funding", () => {
  assert.equal(tokenAmount("1.000001", 6), 1000001n);
  for (const value of ["1.0000001", "-1", "NaN", "1e6", "0"]) assert.throws(() => tokenAmount(value, 6));
  assert.equal(tokenAmount("0", 6, true), 0n);
  assert.throws(() => integer("9007199254740993", "chain", 1, Number.MAX_SAFE_INTEGER));
  assert.throws(() => integer("10000", "slippage", 0, 9999));
});

test("all submission and confirmation statuses are distinct", () => {
  assert.match(describeSwapStatus({ type: "approval-submitted", token: address, amount: 1n, hash }), /submitted/);
  assert.match(describeSwapStatus({ type: "swap-submitted", hash }), /submitted/);
  assert.match(describeSwapStatus({ type: "swap-confirmed", hash, blockNumber: 8n, amountReceived: 1n }), /block 8/);
});

test("a deterministic contract revert is attempted once and stays distinct from transport errors", async () => {
  let calls = 0;
  const revert = new ExecutionRevertedError({ message: "execution reverted: Unauthorized" });
  await assert.rejects(retryRead(async () => { calls++; throw revert; }), (error) => error === revert);
  assert.equal(calls, 1);
  assert.equal(isContractRevert(new Error("wrapper", { cause: revert })), true);
  assert.equal(isContractRevert(new Error("429 too many requests")), false);
});

test("one transient retry retains both original failures", async () => {
  const first = new Error("503 service unavailable");
  const second = new Error("ETIMEDOUT");
  let calls = 0;
  await assert.rejects(retryRead(async () => { throw ++calls === 1 ? first : second; }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [first, second]);
    return true;
  });
  assert.equal(calls, 2);
});

test("preflight retries a transport read at the same block and never retries a revert", async () => {
  const blocks: bigint[] = [];
  const client = {
    getBlockNumber: async () => 123n,
    call: async (args: { blockNumber: bigint }) => { blocks.push(args.blockNumber); if (blocks.length === 1) throw new Error("503 service unavailable"); return {}; },
  } as unknown as PublicClient;
  await preflight(client, { address, type: "json-rpc" } as Account, { to: address, data: "0x" }, [], "example");
  assert.deepEqual(blocks, [123n, 123n]);
  let calls = 0;
  const reverting = { getBlockNumber: async () => 123n, call: async () => { calls++; throw new ExecutionRevertedError(); } } as unknown as PublicClient;
  await assert.rejects(preflight(reverting, { address, type: "json-rpc" } as Account, { to: address, data: "0x" }, [], "example"));
  assert.equal(calls, 1);
});

test("transport failures are never relabelled as missing positions or invalid pools", async () => {
  const transport = new Error("503 service unavailable");
  await assert.rejects(asPool(address, "pool", async () => { throw transport; }), (error) => error === transport);
  const client = { readContract: async () => { throw transport; } } as unknown as PublicClient;
  await assert.rejects(positionOwner(client, [], address, 1n), (error) => error === transport);
});

test("synthetic 9/6 curve conserves allocations and migration funds", async () => {
  const text = await readFile(new URL("../src/portable/fixtures/synthetic-9-6.json", import.meta.url), "utf8");
  const input = parseEconomics(text);
  const result = buildPortableCurve(input);
  assert.equal(result.startSqrtPrice, 1n << 64n);
  assert.equal(result.migrationSqrtPrice, 2n << 64n);
  assert.equal(result.migrationQuoteThreshold, 10_000_000_000_000n);
  assert.equal(result.reconciliation.grossMigrationBaseRaw, 2_500_000_000_000n);
  const r = result.reconciliation;
  assert.equal(input.totalSupplyRaw, r.curveBaseRaw + r.grossMigrationBaseRaw + r.lockedBaseRaw + r.leftoverBaseRaw);
  assert.throws(() => buildPortableCurve({ ...input, migrationQuoteThreshold: { kind: "exact", raw: 1n } }));
  assert.throws(() => parseEconomics(text.replace('"5000000000000"', '5000000000000')));
});

test("lightweight integrate calldata preserves exact approval, recipient, deadline, and minimum output", () => {
  const transaction = buildAmmoraExactInCalldata({ pool: address, poolKind: "concentrated", tokenIn: recipient, amountIn: 123n, minimumAmountOut: 456n, recipient, deadline: 789n });
  assert.equal(transaction.to, address);
  assert.equal(transaction.approvalSpender, address);
  assert.equal(transaction.approvalAmount, 123n);
  const decoded = decodeFunctionData({ abi: ammConcentratedPoolV3Abi, data: transaction.data });
  assert.equal(decoded.functionName, "swapExactIn");
  assert.deepEqual(decoded.args, [recipient, 123n, 456n, recipient, 789n]);
});

test("V4 examples explicitly retain permissionless addresses instead of the SDK historical V3 default", () => {
  const saved = process.env.AMMORA_CHAIN_ID;
  process.env.AMMORA_CHAIN_ID = "91342";
  try {
    const selected = deployment();
    assert.equal(selected.slot, "permissionless");
    assert.equal(selected.contracts.launch.protocolVersion, 4);
    assert.equal(clientOptions().deploymentSource.resolve(91342)?.active.launch.factory, selected.contracts.launch.factory);
  } finally {
    if (saved === undefined) delete process.env.AMMORA_CHAIN_ID; else process.env.AMMORA_CHAIN_ID = saved;
  }
});

test("signer refuses before loading any key unless AMMORA_SEND=1", () => {
  process.env.AMMORA_SEND = "0";
  assert.throws(signer, /AMMORA_SEND=1/);
});

test("shared reader compares eth_chainId against configuration before returning a client", async () => {
  const saved = process.env.AMMORA_CHAIN_ID;
  try {
    process.env.AMMORA_CHAIN_ID = "91342";
    const transport = custom({ request: async ({ method }) => { assert.equal(method, "eth_chainId"); return "0x1"; } });
    await assert.rejects(reader(transport), /RPC chain 1 does not match/);
  } finally {
    if (saved === undefined) delete process.env.AMMORA_CHAIN_ID; else process.env.AMMORA_CHAIN_ID = saved;
  }
});

test("transaction entrypoints refuse valid-looking inputs without a key or network request", () => {
  const fixtures: Record<string, string[]> = {
    "src/almm/swap.ts": [address, "1"],
    "src/almm/create-pool.ts": [address, recipient, "10"],
    "src/almm/create-position/balanced.ts": [address, "1", "1"],
    "src/almm/create-position/imbalanced.ts": [address, "1", "2"],
    "src/almm/create-position/one-sided.ts": [address, "1", "0"],
    "src/almm/add-liquidity.ts": [address, "1", "1", "1"],
    "src/almm/create-extended-positions.ts": [address, "1", "1", "2", "2"],
    "src/almm/seed-liquidity.ts": [address, "base", "1", "1", "2"],
    "src/almm/zap-in.ts": [address, recipient, "1"],
    "src/almm/zap-out.ts": ["1", recipient, "1"],
    "src/almm/create-limit-order.ts": [address, "base", "1"],
    "src/almm/close-limit-order.ts": ["1"],
    "src/almm/create-reward.ts": [address, recipient, "1"],
    "src/almm/claim-reward.ts": ["1"],
    "src/arl/add-liquidity-and-lock.ts": [address, "1", "1", "1"],
    "src/arl/claim-position-fee.ts": [address, "1"],
    "src/arl/lock-position.ts": [address, "1"],
    "src/arl/split-position.ts": [address, "1", recipient, "50"],
    "src/arl/swap-native.ts": [address, "1"],
    "src/arl/swap-with-permit.ts": [address, "1"],
    "src/launch/create-config.ts": ["1", "1000000", "1000000"],
    "src/launch/quick-create.ts": ["1", "1000000", "1000000", "Synthetic", "SYN", "ipfs://synthetic"],
    "src/launch/claim-fees.ts": [recipient],
    "src/vault/create-yield-vault.ts": [recipient],
    "src/vault/create-genesis-vault.ts": [address, "1", "1"],
    "src/vault/deposit.ts": [address, "1"],
    "src/vault/deposit-genesis.ts": [address, "1"],
    "src/arl/safe-swap.ts": ["concentrated", address, recipient, "1"],
    "src/arl/create-pool.ts": [address, recipient, "100", "100", "1", "2"],
    "src/arl/create-compounding-pool.ts": [address, recipient, "100", "100"],
    "src/launch/create-launch.ts": ["1", "Synthetic", "SYN", "ipfs://synthetic"],
    "src/quickstart/safe-swap.ts": ["concentrated", address, recipient, "1"],
    "src/quickstart/create-launch.ts": ["1", "Synthetic", "SYN", "ipfs://synthetic"],
    "src/launch/final-fill-and-graduate.ts": [address, "1"],
  };
  for (const [file, args] of Object.entries(fixtures)) {
    const result = spawnSync(process.execPath, ["--import", "tsx", file, ...args], { encoding: "utf8", timeout: 10000, env: { ...process.env, AMMORA_SEND: "0", AMMORA_PRIVATE_KEY: "", AMMORA_RPC_URL: "http://127.0.0.1:1", AMMORA_GRADUATION_CONFIRM: "1" } });
    assert.equal(result.status, 1, file);
    assert.match(result.stderr, /AMMORA_SEND=1/, file);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|fetch failed/, file);
  }
});


test("aggregation uses one complete published current generation and rejects other chains", () => {
  const selected = routeGeneration(91342);
  assert.equal(selected.route.slot, "v4-auto-route-20260917");
  assert.equal(selected.deploymentCatalog[91342], selected.core);
  assert.equal(selected.routeCatalog[91342], selected.route);
  assert.equal(selected.route.tokenPolicyRegistry.toLowerCase(), selected.core.contracts.policy.tokenPolicyRegistry.toLowerCase());
  assert.ok(selected.factoryProfiles.some(profile => profile.factory.toLowerCase() === selected.core.contracts.launch.concentratedFactory.toLowerCase()));
  assert.throws(() => routeGeneration(1), /GIWA Sepolia/);
});


test("SDK trust failures retain their root-cause detail while redacting RPC URLs", () => {
  const error = new AmmoraSdkError(AmmoraErrorCode.UnverifiedDeployment, "atomic multi-hop runtime verification failed", "deployment", false, { cause: "Provider https://rpc.example.invalid/?auth=synthetic failed\nprivate transport details" });
  const message = describeError(error);
  assert.match(message, /AMMORA_SDK_UNVERIFIED_DEPLOYMENT/);
  assert.match(message, /Provider \[RPC URL\] failed/);
  assert.doesNotMatch(message, /auth=synthetic|private transport details/);
});
