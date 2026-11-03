/** Copy/import these small functions into your agent application; they never load keys. */
import type { Address } from "viem";
import type { AgentRuntime, Intent } from "../index.js";

export const readLaunch = (agent: AgentRuntime, curve: Address) => agent.getLaunch(curve);
export const createLaunchpadConfig = (agent: AgentRuntime, requestId: string, config: Omit<Extract<Intent, { action: "config" }>, "action">) => agent.prepare({ action: "config", ...config }, requestId);
export const createToken = (agent: AgentRuntime, requestId: string, launch: Omit<Extract<Intent, { action: "launch" }>, "action">) => agent.prepare({ action: "launch", ...launch }, requestId);
export const createTokenAndFirstBuy = (agent: AgentRuntime, requestId: string, launch: Omit<Extract<Intent, { action: "launch" }>, "action"> & { firstBuyRaw: string; minimumBaseRaw: string }) => createToken(agent, requestId, launch);
export const createConfigAndFirstBuy = (agent: AgentRuntime, requestId: string, launch: Omit<Extract<Intent, { action: "config-first-buy" }>, "action">) => agent.prepare({ action: "config-first-buy", ...launch }, requestId);
export const buy = (agent: AgentRuntime, requestId: string, curve: Address, amountRaw: string, slippageBps = 50) => agent.prepare({ action: "trade", curve, side: "buy", amountRaw, slippageBps }, requestId);
export const sell = (agent: AgentRuntime, requestId: string, curve: Address, amountRaw: string, slippageBps = 50) => agent.prepare({ action: "trade", curve, side: "sell", amountRaw, slippageBps }, requestId);
export const finalFill = (agent: AgentRuntime, requestId: string, curve: Address, maximumQuoteRaw: string) => agent.prepare({ action: "trade", curve, side: "buy", amountRaw: maximumQuoteRaw, slippageBps: 50, graduationBoundary: true }, requestId);
export const graduate = (agent: AgentRuntime, requestId: string, curve: Address) => agent.prepare({ action: "migrate", curve }, requestId);
// buy/sell choose the authenticated concentrated pool after graduation; no new pool creation.
export const claimLaunchFees = (agent: AgentRuntime, requestId: string, curve: Address, asset: "base" | "quote", payout?: Address) => agent.prepare({ action: "claim-launch", curve, asset, ...(payout ? { payout } : {}) }, requestId);
export const claimLpFees = (agent: AgentRuntime, requestId: string, curve: Address, tokenId: string, payout?: Address) => agent.prepare({ action: "claim-lp", curve, tokenId, ...(payout ? { payout } : {}) }, requestId);
export const resumeOperation = (agent: AgentRuntime, operationId: string) => agent.reconcile(operationId);
