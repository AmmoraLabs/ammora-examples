import type { AgentRuntime } from "./agent.js";
import { address, integer, invariant, object, text, uint } from "./schema.js";
import type { Hex } from "viem";

/** Framework-neutral local tools. Register only these handlers with the model. */
export function agentTools(agent: AgentRuntime) {
  return {
    agent_get_context: async (raw: unknown) => { object(raw, []); return agent.getContext(); },
    agent_get_config: async (raw: unknown) => { const o = object(raw, ["configId"]); return agent.getConfig(uint(o.configId, true)); },
    agent_get_launch: async (raw: unknown) => { const o = object(raw, ["curve"]); return agent.getLaunch(address(o.curve)); },
    agent_get_balances: async (raw: unknown) => {
      const o = object(raw, ["tokens"]); invariant(Array.isArray(o.tokens) && o.tokens.length <= 16, "INVALID_ASSET_LIST"); return agent.getBalances(o.tokens.map(address));
    },
    agent_get_claimable: async (raw: unknown) => { const o = object(raw, ["curve"]); return agent.getClaimable(address(o.curve)); },
    agent_get_positions: async (raw: unknown) => {
      const o = object(raw, ["curve", "tokenIds"]); invariant(Array.isArray(o.tokenIds) && o.tokenIds.length <= 16, "INVALID_POSITION_LIST");
      return agent.getPositions(address(o.curve), o.tokenIds.map(x => uint(x)));
    },
    agent_quote_trade: (raw: unknown) => agent.quoteTrade(raw),
    agent_prepare: async (raw: unknown) => { const o = object(raw, ["requestId", "intent"]); return agent.prepare(o.intent, text(o.requestId, 128)); },
    agent_prepare_approval: async (raw: unknown) => {
      const o = object(raw, ["operationId", "requestId"], ["requirementIndex"]);
      return agent.prepareApproval(text(o.operationId, 128), text(o.requestId, 128), o.requirementIndex === undefined ? 0 : integer(o.requirementIndex, 0, 8));
    },
    agent_refresh: async (raw: unknown) => { const o = object(raw, ["operationId"]); return agent.refresh(text(o.operationId, 128)); },
    agent_submit: async (raw: unknown) => {
      const o = object(raw, ["operationId", "expectedDigest"]); invariant(typeof o.expectedDigest === "string" && /^0x[0-9a-f]{64}$/.test(o.expectedDigest), "INVALID_DIGEST");
      return agent.submit(text(o.operationId, 128), o.expectedDigest as Hex);
    },
    agent_reconcile: async (raw: unknown) => { const o = object(raw, ["operationId"]); return agent.reconcile(text(o.operationId, 128)); },
  };
}

export const toolDescriptions = {
  agent_get_context: "Read reviewed GIWA chain, generation, public caller and confirmed snapshot. No signer.",
  agent_get_config: "Read an approved Config by raw decimal-string configId. No signer.",
  agent_get_launch: "Read authenticated token, curve, stage and graduated pool using curve address.",
  agent_get_balances: "Read native ETH and at most 16 ERC20 tokens; ETH and WETH are separate.",
  agent_get_claimable: "Read aggregate own FeeVault entitlements for the launch's two assets.",
  agent_get_positions: "Inspect at most 16 managed NFT tokenIds bound to the launch's graduated pool.",
  agent_quote_trade: "Read an exact-input buy/sell quote. This does not approve, sign or submit.",
  agent_prepare: "Create an unsigned plan from a strict typed intent and unique requestId; inspect status and digest.",
  agent_prepare_approval: "Plan the exact allowance or zero-reset prerequisite of an existing plan; never an arbitrary spender.",
  agent_refresh: "Refresh an unattempted plan after approval. Its digest changes and needs fresh authority.",
  agent_submit: "Submit a READY stored plan after host approval or installed scoped policy. Cannot grant approval itself.",
  agent_reconcile: "Reconcile original hash/nonce/receipt and payments. Never resubmits an operation.",
} as const;

/** A remote transport should authenticate the user before selecting this fixed agent instance. */
export async function dispatchTool(agent: AgentRuntime, raw: unknown) {
  try {
    const o = object(raw, ["tool", "arguments"]), tools = agentTools(agent);
    invariant(typeof o.tool === "string" && Object.hasOwn(tools, o.tool), "UNKNOWN_TOOL");
    return { ok: true, result: await tools[o.tool as keyof typeof tools](o.arguments) };
  } catch (error) {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message) ? error.message : "OPERATION_INCOMPLETE";
    return { ok: false, error: { code, instruction: "Inspect the stored operation; reconcile any attempted submission before another action." } };
  }
}
