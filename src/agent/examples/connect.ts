import type { AgentPolicy, AgentSigner } from "../index.js";
import { AgentRuntime, createAgentRpc, agentTools } from "../index.js";

/** The authenticated host selects the account/policy/state directory, not the model. */
export function connectAgent(policy: AgentPolicy, privateStateDirectory: string, signer?: AgentSigner) {
  const rpc = createAgentRpc();
  const agent = new AgentRuntime({ policy, journalDirectory: privateStateDirectory, client: rpc.client, signer });
  const tools = agentTools(agent);
  for (const name of Object.keys(tools) as (keyof typeof tools)[]) {
    const handler = tools[name] as (raw: unknown) => Promise<unknown>;
    Object.defineProperty(tools, name, { value: (raw: unknown) => rpc.bounded(() => handler(raw)) });
  }
  return { agent, tools, bounded: rpc.bounded, close: () => agent.close() };
}
