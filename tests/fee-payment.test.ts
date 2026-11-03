import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ammoraAFSVaultAbi } from "@ammora-protocol/sdk";
import { encodeAbiParameters, type PublicClient, type TransactionReceipt } from "viem";
import { verifyFeePayment, verifyFeePaymentReceipt, type FeePayment } from "../src/shared/fee-payment.js";

const base = "tests/fixtures/fee-payments/";
const read = (file: string) => JSON.parse(fs.readFileSync(base + file, "utf8"));
const owner = "0x13cD27a6E337097dB858C9C4FA472FbAd2F2c637";
const fixtures = ["fee-claim-creator", "fee-claim-partner", "dfs-claim-owner", "dfs-claim-creator", "dfs-claim-partner"].map(name => {
  const raw = read(name + ".receipt-0.json"), plan = read(name + ".plan.json"), result = read(name + ".result.json");
  const receipt = { ...raw, blockNumber: BigInt(raw.blockNumber),
    logs: raw.logs.map((log: Record<string, unknown>) => ({ ...log, blockNumber: BigInt(log.blockNumber as string) })) } as TransactionReceipt;
  const expected: FeePayment = { kind: name.startsWith("dfs") ? "dfs" : "launch", hash: receipt.transactionHash,
    vault: receipt.to!, token: "0x4200000000000000000000000000000000000006", beneficiary: receipt.from, payout: owner,
    ...(name.startsWith("dfs") ? { index: Number(plan.cli.args[1]) } : {}) };
  const balance = result.balances.find((row: { address: string }) => row.address.toLowerCase() === owner.toLowerCase());
  return { name, receipt, expected, input: plan.transactions[0].data as `0x${string}`, before: BigInt(balance.before), after: BigInt(balance.after) };
});
type Fixture = typeof fixtures[number];
const parentHash = `0x${"ab".repeat(32)}` as const;
function clientFor(f: Fixture, extra = 0n, logs = f.receipt.logs) {
  const reads: bigint[] = [];
  const client = {
    getTransactionReceipt: async () => f.receipt,
    getTransaction: async () => ({ hash: f.expected.hash, blockHash: f.receipt.blockHash, input: f.input }),
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ hash: blockNumber === f.receipt.blockNumber ? f.receipt.blockHash : parentHash, parentHash }),
    readContract: async ({ blockNumber }: { blockNumber: bigint }) => {
      reads.push(blockNumber);
      assert.ok(blockNumber === f.receipt.blockNumber || blockNumber === f.receipt.blockNumber - 1n, "never read the old preview baseline");
      return blockNumber === f.receipt.blockNumber ? f.after + extra : f.before;
    },
    getLogs: async () => logs.filter(log => log.address.toLowerCase() === f.expected.token.toLowerCase()),
  };
  return { client, reads, asClient: () => client as unknown as PublicClient };
}
for (const f of fixtures) test("preserved GIWA payout: " + f.name, async () => {
  const c = clientFor(f), result = await verifyFeePayment(c.asClient(), f.expected);
  assert.equal(result.netAmount, f.after - f.before);
  assert.equal(result.payoutVerified, true);
  assert.equal(result.otherBlockTransferDelta, 0n);
  assert.deepEqual(c.reads, [f.receipt.blockNumber - 1n, f.receipt.blockNumber]);
});

test("same-block unrelated income is reconciled separately from the claim", async () => {
  const f = fixtures[0]!;
  const transfer = { ...f.receipt.logs[0]!, transactionHash: `0x${"cd".repeat(32)}` as const, logIndex: 999,
    data: encodeAbiParameters([{ type: "uint256" }], [123n]) };
  const c = clientFor(f, 123n, [...f.receipt.logs, transfer]);
  const result = await verifyFeePayment(c.asClient(), f.expected);
  assert.equal(result.netAmount, 56000000n);
  assert.equal(result.otherBlockTransferDelta, 123n);
  assert.equal(result.blockBalanceDelta, 56000123n);
});

test("receipt rejects reverted, mismatched, duplicate, zero and absent payments", () => {
  const f = fixtures[0]!, verify = (receipt: TransactionReceipt, expected = f.expected, input = f.input) => verifyFeePaymentReceipt(receipt, input, expected);
  assert.throws(() => verify({ ...f.receipt, status: "reverted" }), /identity/);
  for (const key of ["hash", "vault", "token", "beneficiary", "payout"] as const) {
    const value = key === "hash" ? `0x${"11".repeat(32)}` : `0x${"11".repeat(20)}`;
    assert.throws(() => verify(f.receipt, { ...f.expected, [key]: value }), key);
  }
  assert.throws(() => verify(f.receipt, f.expected, "0x00000000"));
  assert.throws(() => verify({ ...f.receipt, logs: [] }), /exactly one/);
  assert.throws(() => verify({ ...f.receipt, logs: [...f.receipt.logs, f.receipt.logs[1]!] }), /exactly one/);
  assert.throws(() => verify({ ...f.receipt, logs: f.receipt.logs.slice(1) }), /Zero payment/);
  assert.throws(() => verify({ ...f.receipt, logs: [{ ...f.receipt.logs[0]!, removed: true }, ...f.receipt.logs.slice(1)] }), /log identity/);
});

test("DFS uses net credit, with an independent gross amount", () => {
  const f = fixtures[3]!, receipt = structuredClone(f.receipt);
  const grossEvent = ammoraAFSVaultAbi.find(e => e.type === "event" && e.name === "FeeClaimedGross")!;
  assert.ok(grossEvent);
  // The last vault event is FeeClaimedGross; preserve its indexed recipient/index/receiver.
  receipt.logs[receipt.logs.length - 1]!.data = encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [300000000n, 270000000n]);
  receipt.logs[0]!.data = encodeAbiParameters([{ type: "uint256" }], [270000000n]);
  assert.deepEqual(verifyFeePaymentReceipt(receipt, f.input, f.expected), { grossAmount: 300000000n, netAmount: 270000000n });
  assert.throws(() => verifyFeePaymentReceipt(f.receipt, f.input, { ...f.expected, index: 256 }), /uint8/);
  assert.throws(() => verifyFeePaymentReceipt(f.receipt, f.input, { ...f.expected, index: 0 }), /calldata/);
});

test("missing state/logs or a reorg cannot trigger resend or a payment success", async () => {
  const f = fixtures[0]!;
  for (const mode of ["balance", "logs", "reorg", "rpc"] as const) {
    const c = clientFor(f, mode === "balance" ? 1n : 0n, mode === "logs" ? [] : f.receipt.logs);
    if (mode === "reorg") c.client.getBlock = async () => ({ hash: parentHash, parentHash });
    if (mode === "rpc") c.client.getLogs = async () => { throw new Error("unavailable"); };
    await assert.rejects(verifyFeePayment(c.asClient(), f.expected), error => {
      assert.ok(error instanceof Error && error.cause instanceof Error);
      assert.match(error.message, /Do not resend.*fees:verify-claim/);
      assert.ok(error.message.includes(f.expected.hash));
      return true;
    });
  }
});
