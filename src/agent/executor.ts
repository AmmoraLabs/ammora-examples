import {
  ammConcentratedPoolV3Abi, parseAmmoraV4ConfigCreatedReceipt, parseAmmoraV4LaunchCreatedReceipt,
  buildCreateAmmoraV4Config, getAmmoraV4ConfigAtBlock,
  parseAmmoraV4MigratedReceipt, parseAmmoraV4SwapReceipt, resolveAmmConcentratedPositionFeeClaimReceipt,
  resolveAmmoraV4ConcentratedMigrationPositionsReceipt,
  giwaSepoliaAutoRouteDeployment,
} from "@ammora-protocol/sdk";
import { erc20Abi, keccak256, parseEventLogs, parseTransaction, recoverTransactionAddress, type Address, type Hex, type TransactionSerializableEIP1559, type TransactionSerialized } from "viem";
import type { AgentRuntime } from "./agent.js";
import { invariant, digest, publicJson, same } from "./schema.js";
import { launchFeeProof, positiveTransfer, tokenBalanceProof } from "./proof.js";
import type { Operation } from "./types.js";

/** Only invoked with an operation ID; it never accepts calldata from an agent. */
export async function submitOperation(runtime: AgentRuntime, id: string, expectedDigest: Hex): Promise<Operation> {
  const { client, policy, journal } = runtime;
  runtime.assertActive(); let op = journal.get(id), p = op.plan;
  invariant(p.digest === expectedDigest && p.digest === digest({ ...p, digest: undefined }) && p.policyDigest === runtime.policyDigest, "PLAN_DIGEST_MISMATCH");
  if (!["PLANNED", "AUTHORIZED"].includes(op.phase)) return op; // No retry after any signing attempt.
  invariant(p.status === "READY" && p.transaction, "PLAN_NOT_READY");
  invariant(p.expiresAt > Date.now() / 1000, "PLAN_EXPIRED");
  invariant(runtime.signer && same(runtime.signer.address, policy.account), "SIGNER_NOT_CONNECTED");
  if (runtime.authorizationMode === "scoped-policy" && op.phase === "PLANNED") runtime.authorize(id, expectedDigest);
  op = journal.get(id); invariant(op.phase === "AUTHORIZED", "OWNER_AUTHORIZATION_REQUIRED");
  const s = await runtime.snapshot(), bn = BigInt(s.number), original = await client.getBlock({ blockNumber: BigInt(p.snapshot.number) });
  invariant(original.hash === p.snapshot.hash && bn >= BigInt(p.snapshot.number) && bn - BigInt(p.snapshot.number) <= BigInt(policy.maxPlanAgeBlocks), "PLAN_SNAPSHOT_STALE_OR_REORGED");
  if (p.expected.configId) await runtime.config(p.expected.configId, bn);
  if (p.expected.curve) {
    const { state } = await runtime.launch(p.expected.curve, bn);
    invariant(state.status === p.expected.stage && (!p.expected.pool || same(state.canonicalPool, p.expected.pool)), "REPLAN_REQUIRED_STAGE_CHANGED");
  }
  if (p.intent.action === "config-first-buy" || p.intent.action === "config") await runtime.config(p.intent.policy.templateId, bn);
  if (p.intent.action === "approval") {
    const parent = journal.get(p.intent.parentId); invariant(["PLANNED", "AUTHORIZED"].includes(parent.phase), "APPROVAL_PARENT_ALREADY_ATTEMPTED");
  }
  const tx = { to: p.transaction.to, data: p.transaction.data, value: BigInt(p.transaction.value) };
  await client.call({ account: policy.account, ...tx }); // Current exact-caller simulation, no snapshot substitution.
  const latest = await client.getTransactionCount({ address: policy.account, blockTag: "latest" }), pending = await client.getTransactionCount({ address: policy.account, blockTag: "pending" });
  invariant(latest === pending, "EXTERNAL_PENDING_NONCE_RECONCILE");
  const gas = (await client.estimateGas({ account: policy.account, ...tx })) * 12n / 10n;
  const maxFeePerGas = (await client.getGasPrice()) * 2n + 1n;
  invariant(maxFeePerGas <= BigInt(policy.maxFeePerGasWei), "GAS_PRICE_CAP");
  invariant(tx.value + gas * maxFeePerGas <= BigInt(policy.maxNativePerTransactionWei), "NATIVE_TRANSACTION_CAP");
  invariant(await client.getBalance({ address: policy.account }) >= tx.value + gas * maxFeePerGas, "INSUFFICIENT_NATIVE_BALANCE");
  runtime.assertActive(); invariant(p.expiresAt > Date.now() / 1000, "PLAN_EXPIRED");
  await runtime.signer.assertReady?.(); // A local guard rejection cannot become a signing uncertainty.
  runtime.assertActive(); invariant(p.expiresAt > Date.now() / 1000, "PLAN_EXPIRED");
  // Charge the full authorized native envelope, rather than pretending configured estimates are billing.
  journal.reserve(id, latest, BigInt(policy.maxNativePerTransactionWei));
  op = journal.get(id); op.signingRequest = { gas: String(gas), maxFeePerGas: String(maxFeePerGas), value: String(tx.value) }; journal.update(op);
  const request: TransactionSerializableEIP1559 = { ...tx, type: "eip1559", chainId: 91342, nonce: latest, gas, maxFeePerGas, maxPriorityFeePerGas: 0n };
  try {
    const raw = await runtime.signer.signTransaction(request), parsed = parseTransaction(raw);
    invariant(parsed.type === "eip1559" && !parsed.accessList?.length && same(await recoverTransactionAddress({ serializedTransaction: raw as TransactionSerialized }), policy.account) && parsed.chainId === 91342 && parsed.nonce === latest
      && !!parsed.to && same(parsed.to, tx.to) && parsed.data === tx.data && (parsed.value ?? 0n) === tx.value && parsed.gas === gas
      && parsed.maxFeePerGas === maxFeePerGas && (parsed.maxPriorityFeePerGas ?? 0n) === 0n, "SIGNED_TRANSACTION_MISMATCH");
    const hash = keccak256(raw); journal.signed(id, raw, hash); // Committed hash/raw precede the sole broadcast.
    runtime.assertActive(); invariant(p.expiresAt > Date.now() / 1000, "PLAN_EXPIRED");
    const returned = await client.sendRawTransaction({ serializedTransaction: raw }); invariant(returned === hash, "BROADCAST_HASH_MISMATCH");
    op = journal.get(id); op.phase = "SUBMITTED"; journal.update(op); return op;
  } catch (error) {
    op = journal.get(id); op.phase = "RECONCILIATION_REQUIRED";
    op.errorCode = error instanceof Error && /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message) ? error.message : "SIGNING_OR_SUBMISSION_UNCERTAIN";
    journal.update(op); return op;
  }
}

export async function reconcileOperation(runtime: AgentRuntime, id: string): Promise<Operation> {
  const { client, policy, journal } = runtime, op = journal.get(id), p = op.plan;
  // Historical reconciliation remains available after a session expires.
  invariant(await client.getChainId() === 91342, "WRONG_RPC_CHAIN");
  if (op.phase === "CONFIRMED" || op.phase === "REVERTED" || op.phase === "CANCELLED") {
    const result = op.result as { blockNumber?: string; blockHash?: string } | undefined;
    if (result?.blockNumber && result.blockHash) {
      const block = await client.getBlock({ blockNumber: BigInt(result.blockNumber) });
      if (block.hash !== result.blockHash) journal.invalidate(op);
    }
    return op;
  }
  if (!op.hash) return op;
  let receipt;
  try { receipt = await client.getTransactionReceipt({ hash: op.hash }); } catch { return op; }
  const canonical = await client.getBlock({ blockNumber: receipt.blockNumber });
  invariant(canonical.hash === receipt.blockHash && receipt.transactionHash === op.hash && same(receipt.from, policy.account), "RECEIPT_NOT_CANONICAL");
  invariant(receipt.logs.every(l => !l.removed && l.blockNumber === receipt.blockNumber && l.blockHash === receipt.blockHash && l.transactionHash === op.hash), "RECEIPT_LOG_IDENTITY_MISMATCH");
  const head = await client.getBlockNumber({ cacheTime: 0 });
  if (head < receipt.blockNumber + 12n) return op;
  const tx = await client.getTransaction({ hash: op.hash });
  invariant(tx.nonce === op.nonce && tx.to && p.transaction && same(tx.to, p.transaction.to) && tx.input === p.transaction.data && tx.value === BigInt(p.transaction.value)
    && tx.blockHash === receipt.blockHash && receipt.to && same(receipt.to, p.transaction.to), "RECEIPT_PLAN_MISMATCH");
  if (receipt.status === "reverted") { op.phase = "REVERTED"; op.result = { receiptVerified: true, payoutVerified: false, hash: op.hash, blockNumber: String(receipt.blockNumber), blockHash: receipt.blockHash }; journal.finish(op); return op; }
  const proof: Record<string, unknown> = { receiptVerified: true, payoutVerified: false, hash: op.hash, blockNumber: String(receipt.blockNumber), blockHash: receipt.blockHash, confirmationScope: "Canonical with at least 13 confirmations; not a claim of finalized status" };
  const e = p.expected;
  if (p.intent.action === "config") {
    const registry = giwaSepoliaAutoRouteDeployment.contracts.launch.configRegistry;
    const created = parseAmmoraV4ConfigCreatedReceipt(receipt, registry);
    const actual = await getAmmoraV4ConfigAtBlock(client, registry, created.configId, receipt.blockNumber);
    invariant(same(created.owner, policy.account) && same(created.feeClaimer, p.intent.policy.partnerRecipient) && actual.enabled && same(actual.configHash, created.configHash)
      && buildCreateAmmoraV4Config(actual.config, actual.segments, policy.account).data === p.transaction!.data, "CREATED_CONFIG_STATE_MISMATCH");
    journal.rememberConfig(String(created.configId), created.configHash); proof.config = publicJson(created); proof.configState = publicJson(actual);
  } else if (p.intent.action === "launch" || p.intent.action === "config-first-buy") {
    const created = parseAmmoraV4LaunchCreatedReceipt(receipt, giwaSepoliaAutoRouteDeployment.contracts.launch.factory);
    invariant(same(created.creator, policy.account) && (!e.configHash || same(e.configHash, created.configHash)) && (!e.configId || e.configId === String(created.configId)), "LAUNCH_IDENTITY_MISMATCH");
    proof.launch = publicJson(created);
    if (e.firstBuyRaw) {
      const swap = parseAmmoraV4SwapReceipt(receipt, created.curve);
      invariant(same(swap.recipient, policy.account) && !swap.baseForQuote && swap.requestedAmountIn === BigInt(e.firstBuyRaw) && swap.consumedAmountIn === BigInt(e.firstBuyRaw)
        && swap.amountOut >= BigInt(e.minimumOutputRaw!) && same(swap.trader, giwaSepoliaAutoRouteDeployment.contracts.launch.firstBuyExecutor!), "ATOMIC_FIRST_BUY_MISMATCH");
      const base = await tokenBalanceProof(client, receipt, created.token, policy.account), quote = await tokenBalanceProof(client, receipt, e.tokenIn!, policy.account);
      invariant(BigInt(base.receiptDeltaRaw) >= swap.amountOut && BigInt(quote.receiptDeltaRaw) === -swap.consumedAmountIn, "FIRST_BUY_BALANCE_MISMATCH"); proof.firstBuy = publicJson(swap); proof.balances = [base, quote];
    }
    if (p.intent.action === "config-first-buy") {
      const config = parseAmmoraV4ConfigCreatedReceipt(receipt, giwaSepoliaAutoRouteDeployment.contracts.launch.configRegistry);
      invariant(config.configId === created.configId && config.configHash === created.configHash && same(config.owner, policy.account), "CREATED_CONFIG_MISMATCH");
      journal.rememberConfig(String(config.configId), config.configHash); proof.config = publicJson(config);
    }
  } else if (p.intent.action === "approval") {
    const r = p.details as { token: Address; spender: Address; amountRaw: string };
    const value = p.intent.reset ? 0n : BigInt(r.amountRaw);
    const events = parseEventLogs({ abi: erc20Abi, eventName: "Approval", logs: receipt.logs.filter(l => same(l.address, r.token)), strict: true });
    invariant(events.some(l => same(l.args.owner, policy.account) && same(l.args.spender, r.spender) && l.args.value === value), "APPROVAL_EVENT_MISMATCH");
    const allowance = await client.readContract({ address: r.token, abi: erc20Abi, functionName: "allowance", args: [policy.account, r.spender], blockNumber: receipt.blockNumber });
    invariant(allowance === value, "APPROVAL_STATE_MISMATCH"); proof.allowanceRaw = String(allowance); proof.nextAction = "Refresh parent plan; approval is not a trade or launch";
  } else if (p.intent.action === "trade") {
    const output = await tokenBalanceProof(client, receipt, e.tokenOut!, e.payout!), input = await tokenBalanceProof(client, receipt, e.tokenIn!, policy.account);
    invariant(BigInt(output.receiptDeltaRaw) >= BigInt(e.minimumOutputRaw!) && BigInt(input.receiptDeltaRaw) <= 0n && -BigInt(input.receiptDeltaRaw) <= BigInt(p.input!.maximumRaw), "TRADE_BALANCE_MISMATCH");
    if (e.stage === 1) {
      const swap = parseAmmoraV4SwapReceipt(receipt, e.curve!, { trader: policy.account, recipient: e.payout!, baseForQuote: e.baseForQuote!, requestedAmountIn: BigInt(p.intent.amountRaw), minimumAmountOut: BigInt(e.minimumOutputRaw!) });
      invariant(-BigInt(input.receiptDeltaRaw) === swap.consumedAmountIn && BigInt(output.receiptDeltaRaw) === swap.amountOut, "CURVE_EVENT_BALANCE_MISMATCH");
      invariant(p.intent.graduationBoundary ? swap.amountLeft >= 0n : swap.amountLeft === 0n, "UNEXPECTED_PARTIAL_FILL"); proof.swap = publicJson(swap);
    } else {
      const swaps = parseEventLogs({ abi: ammConcentratedPoolV3Abi, eventName: "Swap", logs: receipt.logs.filter(l => same(l.address, e.pool!)), strict: true });
      invariant(swaps.length === 1 && same(swaps[0]!.args.sender, policy.account) && same(swaps[0]!.args.recipient, e.payout!) && same(swaps[0]!.args.tokenIn, e.tokenIn!)
        && swaps[0]!.args.amountIn === BigInt(p.intent.amountRaw) && swaps[0]!.args.amountOut === BigInt(output.receiptDeltaRaw), "POOL_SWAP_EVENT_MISMATCH"); proof.swap = publicJson(swaps[0]!.args);
    }
    proof.balances = [input, output]; proof.receivedVerified = true;
  } else if (p.intent.action === "migrate") {
    const migrated = parseAmmoraV4MigratedReceipt(receipt, e.curve!);
    const { state } = await runtime.launch(e.curve!, receipt.blockNumber);
    invariant(state.status === 3 && same(state.canonicalPool, migrated.canonicalPool), "MIGRATION_STATE_MISMATCH"); proof.migration = publicJson(migrated);
    proof.positions = publicJson(resolveAmmoraV4ConcentratedMigrationPositionsReceipt({ chainId: 91342, receipt, expectedTransactionHash: op.hash, curve: e.curve!, positionManager: giwaSepoliaAutoRouteDeployment.contracts.launch.concentratedPositionManager, canonicalPool: migrated.canonicalPool, creator: state.creator, partner: state.partnerRecipient }));
  } else if (p.intent.action === "claim-launch") {
    const payment = await launchFeeProof(client, receipt, e.token!, policy.account, e.payout!);
    proof.payment = publicJson(payment); proof.payoutVerified = payment.payoutVerified; proof.attribution = "Aggregate beneficiary/token FeeVault payout, not per-launch";
  } else {
    const paid = resolveAmmConcentratedPositionFeeClaimReceipt({ chainId: 91342, receipt, expectedTransactionHash: op.hash, positionManager: giwaSepoliaAutoRouteDeployment.contracts.launch.concentratedPositionManager, tokenId: BigInt(e.tokenId!), recipient: e.payout! });
    invariant(paid.baseAmount > 0n || paid.quoteAmount > 0n, "ZERO_FEE_IS_NOT_PAYMENT");
    const details = p.details as { baseToken: Address; quoteToken: Address }, balances = [];
    for (const [token, amount] of [[details.baseToken, paid.baseAmount], [details.quoteToken, paid.quoteAmount]] as const) {
      if (amount === 0n) continue;
      const balance = await tokenBalanceProof(client, receipt, token, e.payout!);
      invariant(BigInt(balance.receiptDeltaRaw) === amount && positiveTransfer(receipt, token, e.payout!) >= amount, "LP_PAYMENT_BALANCE_MISMATCH"); balances.push(balance);
    }
    proof.payment = publicJson(paid); proof.balances = balances; proof.payoutVerified = true;
  }
  const recheck = await client.getBlock({ blockNumber: receipt.blockNumber }); invariant(recheck.hash === receipt.blockHash, "REORG_DURING_RECONCILIATION");
  op.phase = "CONFIRMED"; op.result = proof; journal.finish(op); return publicJson(op);
}

/** Read-only host recovery after the owner separately authorizes and confirms a nonce cancellation.
 * No elapsed timer, missing receipt or operator assertion can release the original hold. */
export async function reconcileCancellation(runtime: AgentRuntime, id: string, hash: Hex): Promise<Operation> {
  const op = runtime.journal.get(id), client = runtime.client;
  invariant(op.phase === "RECONCILIATION_REQUIRED" && op.nonce !== undefined, "NO_UNCERTAIN_NONCE");
  invariant(await client.getChainId() === 91342, "WRONG_RPC_CHAIN");
  const receipt = await client.getTransactionReceipt({ hash }), tx = await client.getTransaction({ hash });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber }), head = await client.getBlockNumber({ cacheTime: 0 });
  invariant(receipt.status === "success" && receipt.transactionHash === hash && tx.hash === hash && block.hash === receipt.blockHash && tx.blockHash === receipt.blockHash
    && head >= receipt.blockNumber + 12n, "CANCELLATION_NOT_CONFIRMED_CANONICAL");
  invariant(same(tx.from, runtime.policy.account) && tx.to && same(tx.to, runtime.policy.account) && tx.value === 0n && tx.input === "0x" && tx.nonce === op.nonce
    && same(receipt.from, runtime.policy.account) && receipt.to && same(receipt.to, runtime.policy.account), "CANCELLATION_IDENTITY_MISMATCH");
  const nonce = await client.getTransactionCount({ address: runtime.policy.account, blockTag: "latest" });
  invariant(nonce > op.nonce, "CANCELLATION_NONCE_NOT_CONSUMED");
  op.phase = "CANCELLED";
  op.result = { receiptVerified: false, payoutVerified: false, originalOperationCancelled: true, cancellationHash: hash,
    blockNumber: String(receipt.blockNumber), blockHash: receipt.blockHash, consumedNonce: op.nonce,
    note: "Only the separately authorized zero-value self cancellation is confirmed; the original action is not a success." };
  runtime.journal.finish(op); return op;
}
