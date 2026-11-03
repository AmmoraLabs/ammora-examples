/** Connect the guide in one reviewed session. Funds/signers are supplied only by the host. */
import { getAddress, isAddress, type Address } from "viem";
import { core, type Intent } from "../index.js";
import { executeReviewedStep, type ExecutionHost, type StepOptions, type StepResult } from "./execute-step.js";

export interface WalkthroughInput {
  /** Stable across restarts of this same owner policy/session. A new ID starts new work. */
  requestPrefix: string;
  config: Omit<Extract<Intent, { action: "config" }>, "action">;
  launch: { name: string; symbol: string; metadataURI: string };
  curveBuyRaw: string;
  curveSellRaw: string;
  finalBuyMaximumRaw: string;
  poolBuyRaw: string;
  poolSellRaw: string;
  slippageBps: number;
  payout?: Address;
}
export interface WalkthroughResult {
  status: "COMPLETE" | "INCOMPLETE";
  steps: { name: string; result: StepResult }[];
  config?: { id: string; hash: string };
  launch?: { token: Address; curve: Address };
  pool?: Address;
  lpTokenId?: string;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MISSING_CONFIRMED_RESULT");
  return value as Record<string, unknown>;
}
function address(value: unknown): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new Error("INVALID_CONFIRMED_ADDRESS");
  return getAddress(value);
}

/** Not a model tool: every actual plan still goes through the host's authenticated approval. */
export async function runLaunchpadWalkthrough(host: ExecutionHost, input: WalkthroughInput, options: StepOptions): Promise<WalkthroughResult> {
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(input.requestPrefix)) throw new Error("INVALID_WALKTHROUGH_ID");
  if (input.config.policy.registry.toLowerCase() !== core.configRegistry.toLowerCase()) throw new Error("WRONG_CONFIG_REGISTRY");
  const output: WalkthroughResult = { status: "INCOMPLETE", steps: [] };
  async function step(name: string, intent: Intent) {
    const result = await executeReviewedStep(host, input.requestPrefix + ":" + name, intent, options);
    output.steps.push({ name, result });
    return result;
  }
  const config = await step("config", { action: "config", ...input.config });
  if (config.status !== "CONFIRMED") return output;
  const createdConfig = record(record(config.operation.result).config);
  output.config = { id: String(createdConfig.configId), hash: String(createdConfig.configHash) };
  const issuance = await step("launch", { action: "launch", configId: output.config.id, ...input.launch });
  if (issuance.status !== "CONFIRMED") return output;
  const created = record(record(issuance.operation.result).launch);
  output.launch = { token: address(created.token), curve: address(created.curve) };
  const curve = output.launch.curve;
  for (const [name, side, amountRaw, graduationBoundary] of [
    ["curve-buy", "buy", input.curveBuyRaw, false],
    ["curve-sell", "sell", input.curveSellRaw, false],
    ["final-fill", "buy", input.finalBuyMaximumRaw, true],
  ] as const) {
    if ((await step(name, { action: "trade", curve, side, amountRaw, slippageBps: input.slippageBps, graduationBoundary })).status !== "CONFIRMED") return output;
  }
  const migration = await step("migrate", { action: "migrate", curve });
  if (migration.status !== "CONFIRMED") return output;
  const proof = record(migration.operation.result);
  output.pool = address(record(proof.migration).canonicalPool);
  const positions = record(proof.positions).positions;
  if (!Array.isArray(positions)) throw new Error("MISSING_MIGRATION_NFTS");
  const owned = positions.map(record).find(p => typeof p.owner === "string" && p.owner.toLowerCase() === host.agent.policy.account.toLowerCase() && BigInt(String(p.liquidity)) > 1n);
  if (!owned) throw new Error("NO_OWNED_MIGRATION_NFT");
  output.lpTokenId = String(owned.tokenId);
  for (const [name, side, amountRaw] of [["pool-buy", "buy", input.poolBuyRaw], ["pool-sell", "sell", input.poolSellRaw]] as const) {
    if ((await step(name, { action: "trade", curve, side, amountRaw, slippageBps: input.slippageBps })).status !== "CONFIRMED") return output;
  }
  for (const asset of ["quote", "base"] as const) {
    const result = await step("claim-own-" + asset, { action: "claim-launch", curve, asset, ...(input.payout ? { payout: input.payout } : {}) });
    if (result.status === "INCOMPLETE") return output;
  }
  const lp = await step("claim-lp", { action: "claim-lp", curve, tokenId: output.lpTokenId, ...(input.payout ? { payout: input.payout } : {}) });
  if (lp.status === "INCOMPLETE") return output;
  output.status = "COMPLETE";
  return output;
}
