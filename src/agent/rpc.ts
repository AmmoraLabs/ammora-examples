import { AsyncLocalStorage } from "node:async_hooks";
import { createPublicClient, custom, defineChain, http, type PublicClient, type Transport } from "viem";
import { giwaSepoliaAutoRouteDeployment } from "@ammora-protocol/sdk";
import { canonical, invariant } from "./schema.js";

/** Share one returned object across every tool. Counts actual RPC items, not HTTP envelopes. */
export function createAgentRpc(url = "https://sepolia-rpc.giwa.io", intervalMs = 600, baseTransport?: Transport) {
  invariant(Number.isSafeInteger(intervalMs) && intervalMs >= 0 && intervalMs <= 60000, "INVALID_RPC_INTERVAL");
  const scope = new AsyncLocalStorage<{ count: number; maximum: number; cache: Map<string, Promise<unknown>> }>();
  let tail: Promise<unknown> = Promise.resolve(), next = 0, dispatched = 0;
  const chain = defineChain({ id: 91342, name: "GIWA Sepolia", nativeCurrency: giwaSepoliaAutoRouteDeployment.chain.nativeCurrency, rpcUrls: { default: { http: [url] } } });
  const transport = (baseTransport ?? http(url, { retryCount: 0, timeout: 20000 }))({ chain });
  const client: PublicClient = createPublicClient({ chain, cacheTime: 0, transport: custom({ request(args) {
    const budget = scope.getStore();
    const params = "params" in args ? args.params : undefined;
    // Deduplicate only explicit block reads within this operation, never "latest" or sends.
    const pinned = Array.isArray(params) && params.some(p => typeof p === "string" && /^0x[0-9a-f]+$/i.test(p) && p.length < 18);
    const cacheable = pinned && ["eth_call", "eth_getCode", "eth_getBalance", "eth_getBlockByNumber"].includes(args.method);
    const key = canonical(args), found = cacheable ? budget?.cache.get(key) : undefined;
    if (found) return found as Promise<never>;
    if (budget) { invariant(budget.count < budget.maximum, "RPC_OPERATION_BUDGET"); budget.count++; }
    const result = tail.then(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, next - Date.now())));
      try { dispatched++; return await transport.request(args); } finally { next = Date.now() + intervalMs; }
    });
    tail = result.catch(() => undefined);
    if (cacheable && budget) { budget.cache.set(key, result); void result.catch(() => budget.cache.delete(key)); }
    return result as Promise<never>;
  } }, { retryCount: 0 }) });
  return { client, stats: () => ({ dispatchedRpcItems: dispatched }),
    bounded: <T>(work: () => Promise<T>, maximum = 240) => {
      invariant(Number.isSafeInteger(maximum) && maximum > 0 && maximum <= 1000, "INVALID_RPC_BUDGET");
      return scope.run({ count: 0, maximum, cache: new Map() }, work);
    } };
}
