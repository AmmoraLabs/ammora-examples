/** JSON Lines read/plan/reconcile adapter. This CLI deliberately never creates a signer. */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { AgentRuntime, createAgentRpc, dispatchTool, canonical, type AgentPolicy } from "./index.js";
const [policyPath, directory, ...extra] = process.argv.slice(2);
if (!policyPath || !directory || extra.length) throw new Error("usage: agent:tool -- <trusted-policy.json> <private-state-directory>");
const rpc = createAgentRpc(), agent = new AgentRuntime({ policy: JSON.parse(readFileSync(policyPath, "utf8")) as AgentPolicy, client: rpc.client, journalDirectory: directory });
try {
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    let result;
    try {
      if (Buffer.byteLength(line) > 16384) throw new Error("INPUT_TOO_LARGE");
      result = await rpc.bounded(() => dispatchTool(agent, JSON.parse(line)));
    } catch { result = { ok: false, error: { code: "INVALID_OR_INCOMPLETE_REQUEST" } }; }
    process.stdout.write(canonical(result) + "\n");
  }
} finally { agent.close(); }
