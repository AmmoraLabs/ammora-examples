import {
  AMMORA_FEE_POLICY_VERSION, AmmoraPortableLifecyclePlanner, AmmoraV4LaunchCurveClient, DammV2Client,
  ammConcentratedPositionManagerV3Abi, ammoraLaunchFactoryV4Abi, buildCreateAmmoraV4Launch, buildClaimFeeVaultFor,
  createAmmoraDeploymentSource, feeVaultAbi, getAmmoraV4ConfigAtBlock,
  giwaSepoliaAtomicLaunchDeployment, giwaSepoliaAtomicLaunchTargets,
  giwaSepoliaAutoRoute, giwaSepoliaAutoRouteDeployment, giwaSepoliaAutoRoutePoolProfiles,
  resolveAmmoraFinalizedHead, verifyAmmoraPortableDeploymentAtBlock, verifyAmmoraV4CoreAtBlock,
  type AmmoraTransaction,
} from "@ammora-protocol/sdk";
import { encodeFunctionData, erc20Abi, zeroAddress, type Address, type Hex, type PublicClient } from "viem";
import { planCurveAtBlock } from "../launch/curve-plan.js";
import { planTeamAtomicFromCatalog } from "../launch/team/builtin-first-buy.js";
import { planTeamConfig } from "../launch/team/policy.js";
import { AgentJournal } from "./journal.js";
import { address, canonical, digest, invariant, parseIntent, publicJson, same, text, uint, validatePolicy } from "./schema.js";
import { reconcileCancellation, reconcileOperation, submitOperation } from "./executor.js";
import type { AgentOptions, AgentPolicy, AgentSigner, Intent, Operation, Plan, Requirement, Snapshot } from "./types.js";

export const deployment = giwaSepoliaAutoRouteDeployment;
const c = deployment.contracts.launch;
invariant(c.protocolVersion === 4, "V4_DEPLOYMENT_REQUIRED");
export const core = { configRegistry: c.configRegistry, launchFactory: c.factory, graduationAdapter: c.graduationAdapter, feePolicy: c.feePolicy };
export const clientOptions = { deploymentSource: createAmmoraDeploymentSource([deployment]), factoryProfiles: giwaSepoliaAutoRoutePoolProfiles };

/** SDK methods that select "latest" receive the same immutable planning snapshot. */
export function atBlock(client: PublicClient, number: bigint): PublicClient {
  const result = { ...client };
  for (const name of ["readContract", "call", "simulateContract", "getCode", "getBalance"] as const) {
    const original = client[name] as unknown as (p: object) => Promise<unknown>;
    Object.defineProperty(result, name, { value: (p: object) => {
      // Remove mutually exclusive block selectors rather than mixing latest/hash with a number.
      const { blockNumber: _number, blockTag: _tag, blockHash: _hash, requireCanonical: _canonical, ...args } = p as Record<string, unknown>;
      return original({ ...args, blockNumber: number });
    } });
  }
  Object.defineProperty(result, "getBlockNumber", { value: async () => number });
  Object.defineProperty(result, "getBlock", { value: () => client.getBlock({ blockNumber: number }) });
  return result;
}

/** No secret/env loading. The caller installs a trusted policy and optionally an isolated signer. */
export class AgentRuntime {
  readonly policy: AgentPolicy;
  readonly policyDigest: Hex;
  readonly journal: AgentJournal;
  readonly client: PublicClient;
  readonly signer?: AgentSigner;
  readonly authorizationMode: "per-operation" | "scoped-policy";
  constructor(options: AgentOptions) {
    this.policy = validatePolicy(options.policy); this.policyDigest = digest(this.policy);
    this.client = options.client; this.signer = options.signer;
    invariant(!this.signer || same(this.signer.address, this.policy.account), "SIGNER_ACCOUNT_MISMATCH");
    this.authorizationMode = options.authorizationMode ?? "per-operation";
    this.journal = new AgentJournal(options.journalDirectory, this.policy, this.policyDigest);
  }
  close() { this.journal.close(); }
  assertActive() { invariant(Date.now() / 1000 < this.policy.expiresAt, "SESSION_EXPIRED"); invariant(!this.journal.isRevoked(), "SESSION_REVOKED"); }
  /** Trusted host only; stops new authority, while reconciliation remains available. */
  revokeSession() { this.journal.revoke(); }
  async snapshot(): Promise<Snapshot> {
    this.assertActive(); invariant(await this.client.getChainId() === 91342, "WRONG_RPC_CHAIN");
    const number = await resolveAmmoraFinalizedHead([this.client], giwaSepoliaAutoRoute.finality);
    const b = await this.client.getBlock({ blockNumber: number }); invariant(b.hash, "MISSING_BLOCK_HASH");
    await verifyAmmoraV4CoreAtBlock(this.client, core, number);
    return { number: String(number), hash: b.hash, timestamp: String(b.timestamp) };
  }
  async config(id: string, blockNumber: bigint) {
    const entry = await getAmmoraV4ConfigAtBlock(this.client, core.configRegistry, BigInt(uint(id, true)), blockNumber);
    const expected = this.policy.configs.find(x => x.id === id)?.hash ?? this.journal.configHash(id);
    invariant(expected && same(expected, entry.configHash) && entry.enabled, "CONFIG_NOT_APPROVED_OR_DISABLED"); return entry;
  }
  async launch(curve: Address, blockNumber: bigint) {
    const sdk = new AmmoraV4LaunchCurveClient(this.client, address(curve), core), state = await sdk.getStateAtBlock(blockNumber);
    const token = await this.client.readContract({ address: core.launchFactory, abi: ammoraLaunchFactoryV4Abi, functionName: "tokenForCurve", args: [curve], blockNumber });
    invariant(token !== zeroAddress && same(token, state.baseToken) && same(state.feePolicy, core.feePolicy) && same(state.feePolicyVersion, AMMORA_FEE_POLICY_VERSION), "UNAUTHENTICATED_LAUNCH");
    const config = await this.config(String(state.configId), blockNumber); return { sdk, state, config };
  }
  pool(pool: Address, blockNumber: bigint) {
    return new DammV2Client(atBlock(this.client, blockNumber), pool, "concentrated", c.concentratedFactory, c.concentratedPositionManager, clientOptions);
  }
  payout(wanted?: Address) {
    const p = wanted ?? this.policy.account;
    invariant(this.policy.payouts.some(x => same(x, p)), "PAYOUT_NOT_APPROVED"); return p;
  }
  inputLimit(token: Address, amount: string, launchBase?: Address) {
    const rule = this.policy.assets.find(x => same(x.token, token)) ?? (launchBase && same(token, launchBase) ? this.policy.launchTokenLimit : undefined);
    invariant(rule && BigInt(amount) <= BigInt(rule.maxInputRaw), "ASSET_OR_AMOUNT_NOT_APPROVED");
    return { token, maximumRaw: amount, sessionLimitRaw: rule.maxSessionInputRaw };
  }
  async getContext() { return publicJson({ chainId: 91342, generation: "auto-route", sdkVersion: "0.3.8", account: this.policy.account, core, snapshot: await this.snapshot() }); }
  async getConfig(id: string) { const s = await this.snapshot(); return publicJson(await this.config(id, BigInt(s.number))); }
  async getLaunch(curve: Address) { const s = await this.snapshot(); const { state, config } = await this.launch(curve, BigInt(s.number)); return publicJson({ snapshot: s, state, config }); }
  async getBalances(tokens: readonly Address[]) {
    invariant(tokens.length <= 16, "TOO_MANY_ASSETS"); const snapshot = await this.snapshot(), bn = BigInt(snapshot.number);
    const balances = [];
    for (const raw of tokens) {
      const token = address(raw), balance = await this.client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [this.policy.account], blockNumber: bn });
      const decimals = await this.client.readContract({ address: token, abi: erc20Abi, functionName: "decimals", blockNumber: bn }); balances.push({ token, balanceRaw: String(balance), decimals });
    }
    return { snapshot, account: this.policy.account, nativeWei: String(await this.client.getBalance({ address: this.policy.account, blockNumber: bn })), balances };
  }
  async getClaimable(curve: Address) {
    const snapshot = await this.snapshot(), bn = BigInt(snapshot.number), { state } = await this.launch(curve, bn), amounts = [];
    for (const token of [state.baseToken, state.quoteToken]) amounts.push({ token, claimableRaw: String(await this.client.readContract({ address: state.feeVault, abi: feeVaultAbi, functionName: "claimable", args: [token, this.policy.account], blockNumber: bn })) });
    return { snapshot, beneficiary: this.policy.account, feeVault: state.feeVault, amounts, attribution: "Aggregate FeeVault credits; not per-launch revenue" };
  }
  async quoteTrade(raw: unknown) {
    const intent = parseIntent(raw); invariant(intent.action === "trade", "TRADE_INTENT_REQUIRED");
    invariant(intent.slippageBps <= this.policy.maxSlippageBps, "SLIPPAGE_NOT_APPROVED");
    const snapshot = await this.snapshot(), bn = BigInt(snapshot.number), { state, config, sdk } = await this.launch(intent.curve, bn);
    const tokenIn = intent.side === "buy" ? state.quoteToken : state.baseToken;
    this.inputLimit(tokenIn, intent.amountRaw, state.baseToken); this.payout(intent.payout);
    invariant(state.status === 1 || state.status === 3 && config.config.migrationMode === 0, "UNSUPPORTED_STAGE");
    const quote = state.status === 1 ? await sdk.quoteExactInputAtBlock(BigInt(intent.amountRaw), intent.side === "sell", bn)
      : await this.pool(state.canonicalPool, bn).quoteExactInput(tokenIn, BigInt(intent.amountRaw));
    return publicJson({ snapshot, stage: state.status, tokenIn, tokenOut: intent.side === "buy" ? state.baseToken : state.quoteToken, quote, executable: false, note: "Prepare a fresh plan; a quote is not authorization" });
  }
  /** Bounded caller-supplied managed NFT IDs. No unbounded ownership scan. */
  async getPositions(curve: Address, ids: readonly string[]) {
    invariant(ids.length <= 16, "TOO_MANY_POSITIONS"); const s = await this.snapshot(), bn = BigInt(s.number), { state } = await this.launch(curve, bn);
    invariant(state.status === 3, "NOT_GRADUATED"); const positions = [];
    for (const id of ids) {
      const tokenId = BigInt(uint(id)), position = await this.client.readContract({ address: c.concentratedPositionManager, abi: ammConcentratedPositionManagerV3Abi, functionName: "getPosition", args: [tokenId], blockNumber: bn });
      invariant(same(position.pool, state.canonicalPool), "POSITION_POOL_MISMATCH");
      const owner = await this.client.readContract({ address: c.concentratedPositionManager, abi: ammConcentratedPositionManagerV3Abi, functionName: "ownerOf", args: [tokenId], blockNumber: bn }); positions.push({ tokenId: id, owner, position });
    }
    return publicJson({ snapshot: s, pool: state.canonicalPool, manager: c.concentratedPositionManager, positions });
  }
  async prepare(raw: unknown, requestId: string, refreshId?: string): Promise<Plan> {
    const intent = parseIntent(raw), request = text(requestId, 128); return this.prepareInternal(intent, request, refreshId);
  }
  async refresh(id: string) {
    const op = this.journal.get(id); invariant(["PLANNED", "AUTHORIZED"].includes(op.phase), "ATTEMPT_EXISTS_RECONCILE");
    return this.prepareInternal(op.plan.intent, op.plan.requestId, id);
  }
  async prepareApproval(parentId: string, requestId: string, index = 0) {
    const op = this.journal.get(parentId); invariant(["PLANNED", "AUTHORIZED"].includes(op.phase), "ATTEMPT_EXISTS_RECONCILE");
    const r = op.plan.approvals[index]; invariant(r, "NO_APPROVAL_REQUIREMENT");
    const allowance = await this.client.readContract({ address: r.token, abi: erc20Abi, functionName: "allowance", args: [this.policy.account, r.spender] });
    invariant(allowance < BigInt(r.amountRaw), "ALLOWANCE_SUFFICIENT_REFRESH_PARENT");
    return this.prepareInternal({ action: "approval", parentId, requirementIndex: index, reset: allowance !== 0n }, text(requestId, 128));
  }
  private async prepareInternal(intent: Intent, requestId: string, refreshId?: string): Promise<Plan> {
    this.assertActive(); invariant(this.policy.actions.includes(intent.action), "ACTION_NOT_APPROVED");
    const intentDigest = digest(intent), previous = this.journal.byRequest(requestId);
    invariant(!previous || previous.plan.intentDigest === intentDigest, "IDEMPOTENCY_CONFLICT");
    if (previous && !refreshId) return previous.plan;
    invariant(!refreshId || previous?.plan.id === refreshId, "REFRESH_ID_MISMATCH");
    const snapshot = await this.snapshot(), bn = BigInt(snapshot.number), account = this.policy.account;
    const expiresAt = Math.min(Number(snapshot.timestamp) + this.policy.maxPlanAgeSeconds, this.policy.expiresAt);
    invariant(expiresAt > Date.now() / 1000 + 5, "SNAPSHOT_TOO_OLD");
    const plan: Plan = { version: 1, id: refreshId ?? this.journal.newId(), requestId, intent, intentDigest, policyDigest: this.policyDigest, digest: "0x", account, chainId: 91342, generation: "auto-route", snapshot, expiresAt, status: "READY", approvals: [], expected: {}, details: {} };
    const tx = (transaction: AmmoraTransaction) => { plan.transaction = { to: transaction.to, data: transaction.data, value: String(transaction.value ?? 0n) }; };
    const approvals = async (requirements: readonly { token: Address; spender: Address; amount: bigint }[]) => {
      for (const r of requirements) {
        const current = await this.client.readContract({ address: r.token, abi: erc20Abi, functionName: "allowance", args: [account, r.spender], blockNumber: bn });
        if (current < r.amount) plan.approvals.push({ token: r.token, spender: r.spender, amountRaw: String(r.amount), currentAllowanceRaw: String(current) });
      }
      if (plan.approvals.length) plan.status = "APPROVAL_REQUIRED";
    };
    switch (intent.action) {
      case "config": {
        invariant(same(intent.policy.configOwner, account), "CONFIG_OWNER_MUST_BE_SIGNER");
        for (const role of [intent.policy.partnerRecipient, intent.policy.liquidityPartner, intent.policy.leftoverReceiver]) this.payout(role);
        const template = await this.config(intent.policy.templateId, bn);
        const authored = planTeamConfig(template, intent.policy, { chainId: 91342, registry: core.configRegistry }, BigInt(intent.saleSupplyRaw), BigInt(intent.thresholdRaw));
        tx(authored.transaction); plan.details = authored; break;
      }
      case "launch": {
        const entry = await this.config(intent.configId, bn), cfg = entry.config;
        plan.expected = { configId: intent.configId, configHash: entry.configHash };
        const launch = { name: intent.name, symbol: intent.symbol, metadataURI: intent.metadataURI, creatorMetadataURI: intent.metadataURI, tokenDecimals: cfg.tokenDecimals };
        if (intent.firstBuyRaw) {
          plan.input = this.inputLimit(cfg.quoteToken, intent.firstBuyRaw);
          const ctx = await verifyAmmoraPortableDeploymentAtBlock(this.client, giwaSepoliaAtomicLaunchDeployment, bn);
          const atomic = await new AmmoraPortableLifecyclePlanner(ctx, giwaSepoliaAtomicLaunchTargets).planExistingConfigAtomicFirstBuy({ account, configId: BigInt(intent.configId), expectedConfigHash: entry.configHash, launch,
            firstBuys: [{ includedQuoteAmountRaw: BigInt(intent.firstBuyRaw), minimumBaseAmountOutRaw: BigInt(intent.minimumBaseRaw!), allowPartialFill: false, recipient: account }], deadline: BigInt(expiresAt), allowancePolicy: "prepare-approval", gas: { maxFeePerGasNativeRaw: BigInt(this.policy.maxFeePerGasWei), safetyMarginBps: 2000n } });
          plan.expected = { ...plan.expected, firstBuyRaw: intent.firstBuyRaw, minimumOutputRaw: intent.minimumBaseRaw, payout: account, tokenIn: cfg.quoteToken };
          plan.details = atomic;
          if (atomic.status === "APPROVAL_REQUIRED") {
            plan.status = "APPROVAL_REQUIRED"; await approvals(atomic.approvalRequirements.map(r => ({ token: r.token, spender: r.spender, amount: r.exactAmountRaw })));
          } else tx(atomic.transaction);
        } else tx({ to: core.launchFactory, ...buildCreateAmmoraV4Launch(launch, BigInt(intent.configId), cfg.poolCreationFee) });
        break;
      }
      case "config-first-buy": {
        const p = intent.policy;
        invariant(same(p.configOwner, account), "CONFIG_OWNER_MUST_BE_SIGNER");
        for (const a of [p.partnerRecipient, p.liquidityPartner, p.leftoverReceiver]) this.payout(a);
        await this.config(p.templateId, bn);
        const result = await planTeamAtomicFromCatalog(this.client, bn, p, { account, saleSupplyRaw: BigInt(intent.saleSupplyRaw), quoteThresholdRaw: BigInt(intent.thresholdRaw), name: intent.name, symbol: intent.symbol, metadataURI: intent.metadataURI,
          quoteRaw: BigInt(intent.firstBuyRaw), minimumBaseRaw: BigInt(intent.minimumBaseRaw), maxFeePerGasWei: BigInt(this.policy.maxFeePerGasWei), deadline: BigInt(expiresAt) });
        plan.input = this.inputLimit(result.deployment.quoteAsset.token, intent.firstBuyRaw);
        plan.expected = { tokenIn: result.deployment.quoteAsset.token, payout: account, firstBuyRaw: intent.firstBuyRaw, minimumOutputRaw: intent.minimumBaseRaw };
        plan.details = result.reviewed;
        if (result.plan.status === "APPROVAL_REQUIRED") { plan.status = "APPROVAL_REQUIRED"; await approvals(result.plan.approvalRequirements.map(r => ({ token: r.token, spender: r.spender, amount: r.exactAmountRaw }))); }
        else tx(result.plan.transaction);
        break;
      }
      case "approval": {
        const parent = this.journal.get(intent.parentId); invariant(["PLANNED", "AUTHORIZED"].includes(parent.phase) && parent.plan.policyDigest === this.policyDigest, "INVALID_APPROVAL_PARENT");
        const r = parent.plan.approvals[intent.requirementIndex]; invariant(r, "NO_APPROVAL_REQUIREMENT");
        const current = await this.client.readContract({ address: r.token, abi: erc20Abi, functionName: "allowance", args: [account, r.spender], blockNumber: bn });
        invariant(current < BigInt(r.amountRaw) && (intent.reset ? current > 0n : current === 0n), "ALLOWANCE_CHANGED_REPLAN_APPROVAL");
        tx({ to: r.token, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [r.spender, intent.reset ? 0n : BigInt(r.amountRaw)] }) }); plan.details = r; break;
      }
      default: {
        const { state, config, sdk } = await this.launch(intent.curve, bn);
        plan.expected = { curve: intent.curve, configId: String(state.configId), configHash: config.configHash, token: state.baseToken, stage: state.status };
        if (intent.action === "trade") {
          invariant(intent.slippageBps <= this.policy.maxSlippageBps, "SLIPPAGE_NOT_APPROVED");
          const tokenIn = intent.side === "buy" ? state.quoteToken : state.baseToken, tokenOut = intent.side === "buy" ? state.baseToken : state.quoteToken, payout = this.payout(intent.payout);
          plan.input = this.inputLimit(tokenIn, intent.amountRaw, state.baseToken);
          plan.expected = { ...plan.expected, tokenIn, tokenOut, payout, baseForQuote: intent.side === "sell" };
          if (state.status === 1) {
            const curve = await planCurveAtBlock(this.client, core, intent.curve, { blockNumber: bn, tokenIn, amountIn: BigInt(intent.amountRaw), recipient: payout, deadline: BigInt(expiresAt), slippageBps: intent.slippageBps, graduationBoundary: intent.graduationBoundary });
            tx(curve.transaction); await approvals(curve.approvalRequirements); plan.expected.minimumOutputRaw = String(curve.quote.minimumAmountOut); plan.details = curve.fill;
          } else {
            invariant(state.status === 3 && !intent.graduationBoundary && config.config.migrationMode === 0, "REPLAN_REQUIRED_UNSUPPORTED_STAGE");
            const pool = this.pool(state.canonicalPool, bn), swap = await pool.planSwapExactInput({ tokenIn, amountIn: BigInt(intent.amountRaw), recipient: payout, deadline: BigInt(expiresAt), slippageBps: intent.slippageBps });
            invariant(swap.quote.minimumAmountOut > 0n, "ZERO_MINIMUM_OUTPUT"); tx(swap.transaction); await approvals(swap.approvalRequirements);
            plan.expected.pool = state.canonicalPool; plan.expected.minimumOutputRaw = String(swap.quote.minimumAmountOut); plan.details = swap.quote;
          }
        } else if (intent.action === "migrate") {
          invariant(state.status === 2 && config.config.migrationMode === 0, "MIGRATION_REQUIRES_READY_CONCENTRATED"); tx((await sdk.planMigrateAtBlock(bn)).transaction);
        } else if (intent.action === "claim-launch") {
          const token = intent.asset === "base" ? state.baseToken : state.quoteToken, payout = this.payout(intent.payout);
          const owed = await this.client.readContract({ address: state.feeVault, abi: feeVaultAbi, functionName: "claimable", args: [token, account], blockNumber: bn });
          plan.expected = { ...plan.expected, token, payout, beneficiary: account };
          plan.details = { claimableRaw: String(owed), attribution: "Aggregate beneficiary/token credits, not per-launch" };
          if (owed === 0n) plan.status = "NO_CLAIMABLE_FEES";
          else tx({ to: state.feeVault, ...buildClaimFeeVaultFor(token, account, payout) });
        } else {
          invariant(state.status === 3 && config.config.migrationMode === 0, "NOT_GRADUATED_CONCENTRATED");
          const pool = this.pool(state.canonicalPool, bn), payout = this.payout(intent.payout);
          tx(await pool.planClaimManagedConcentratedFees(BigInt(intent.tokenId), payout, account));
          const { result } = await atBlock(this.client, bn).simulateContract({ address: c.concentratedPositionManager, abi: ammConcentratedPositionManagerV3Abi, functionName: "claimPositionFees", args: [BigInt(intent.tokenId), payout], account });
          const [base, quote] = result;
          plan.expected = { ...plan.expected, pool: state.canonicalPool, payout, tokenId: intent.tokenId };
          plan.details = { claimableBaseRaw: String(base), claimableQuoteRaw: String(quote), baseToken: state.baseToken, quoteToken: state.quoteToken };
          if (base === 0n && quote === 0n) { plan.status = "NO_CLAIMABLE_FEES"; delete plan.transaction; }
        }
      }
    }
    if (plan.transaction && plan.status === "READY") await this.client.call({ account, ...plan.transaction, value: BigInt(plan.transaction.value), blockNumber: bn });
    const canonicalBlock = await this.client.getBlock({ blockNumber: bn }); invariant(canonicalBlock.hash === snapshot.hash, "REORG_DURING_PLANNING");
    plan.details = publicJson(plan.details); plan.digest = digest({ ...plan, digest: undefined });
    if (refreshId) { invariant(previous && ["PLANNED", "AUTHORIZED"].includes(this.journal.get(refreshId).phase), "ATTEMPT_EXISTS_RECONCILE"); this.journal.replacePlan(plan, previous.plan.digest); }
    else this.journal.insert(plan);
    return publicJson(plan);
  }
  /** Host-only approval endpoint. Intentionally absent from agentTools(). */
  authorize(id: string, expectedDigest: Hex) { this.assertActive(); this.journal.authorize(id, expectedDigest); }
  submit(id: string, expectedDigest: Hex) { return submitOperation(this, id, expectedDigest); }
  reconcile(id: string) { return reconcileOperation(this, id); }
  /** Host-only receipt reconciliation. It never signs or sends a cancellation. */
  reconcileCancellation(id: string, cancellationHash: Hex) { return reconcileCancellation(this, id, cancellationHash); }
  operation(id: string): Operation { return this.journal.get(id); }
}
