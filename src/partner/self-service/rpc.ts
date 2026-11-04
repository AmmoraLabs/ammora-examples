import type { ProductReadOptions } from "@ammora-protocol/sdk/partner";
import type { SelfServiceProfile } from "./context.js";
/** One explicit operation: bounded reads, no signing/retries/fallback, exact-block cache only. */
export function createAdmissionReadPort(profile: Pick<SelfServiceProfile, "chainId" | "genesisHash">, settings: { url?: string; fetcher?: typeof fetch; intervalMs?: number; maximumLogicalReads?: number; maximumDispatches?: number } = {}) {
  const url = settings.url ?? process.env.AMMORA_RPC_URL ?? "https://sepolia-rpc.giwa.io", parsed = new URL(url);
  if (parsed.protocol !== "https:" || profile.chainId !== 91342) throw new Error("GIWA Sepolia HTTPS RPC required");
  const interval = settings.intervalMs ?? 100, maxLogical = settings.maximumLogicalReads ?? 256, maxDispatch = settings.maximumDispatches ?? 128;
  if (!Number.isSafeInteger(interval) || interval < 0 || interval > 1000 || !Number.isSafeInteger(maxLogical) || maxLogical < 4 || maxLogical > 512 || !Number.isSafeInteger(maxDispatch) || maxDispatch < 1 || maxDispatch > 256) throw new Error("Invalid bounded read budget");
  const fetcher = settings.fetcher ?? fetch, cache = new Map<string, unknown>(), failed = new Map<string, Error>(), blocks = new Map<string, string>();
  const allowed = new Set(["eth_chainId", "eth_getBlockByNumber", "eth_getCode", "eth_call", "eth_getStorageAt", "eth_getTransactionReceipt", "eth_getTransactionByHash", "eth_getBalance", "eth_getTransactionCount"]);
  let logical = 0, dispatched = 0, hits = 0, id = 0, tail: Promise<unknown> = Promise.resolve();
  const request: ProductReadOptions["request"] = (method, params, signal) => {
    if (!allowed.has(method)) return Promise.reject(new Error("Read-only RPC method required"));
    const job = tail.catch(() => undefined).then(async () => {
      signal.throwIfAborted(); const block = params.at(-1), canonical = typeof block === "string" && /^0x[0-9a-f]+$/i.test(block) ? blocks.get(block.toLowerCase()) : undefined;
      const key = canonical && ["eth_getCode", "eth_call", "eth_getStorageAt"].includes(method) ? JSON.stringify([method, params, canonical]) : undefined;
      if (key && failed.has(key)) throw failed.get(key);
      if (key && cache.has(key)) { hits++; return structuredClone(cache.get(key)); }
      if (dispatched >= maxDispatch) throw new Error("Transport dispatch budget exhausted");
      if (interval) await new Promise<void>(resolve => setTimeout(resolve, interval)); signal.throwIfAborted();
      dispatched++;
      try {
        const response = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }), signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
        const body = await response.json() as { id?: unknown; error?: { code?: number }; result?: unknown };
        if (body.id !== id || body.error || !("result" in body)) throw new Error(`RPC failed (${body.error?.code ?? "invalid response"})`);
        if (method === "eth_getBlockByNumber" && body.result) { const b = body.result as { number?: string; hash?: string }; if (b.number && b.hash) blocks.set(b.number.toLowerCase(), b.hash.toLowerCase()); }
        if (key) cache.set(key, structuredClone(body.result)); return body.result;
      } catch (e) { if (key) failed.set(key, e instanceof Error ? e : new Error("RPC failed")); throw e; }
    }); tail = job; return job;
  };
  const options: ProductReadOptions = { chainId: "91342", genesisHash: profile.genesisHash, tag: "latest", maxReads: 64, timeoutMs: 30000, maxHeadAgeSeconds: 120, request,
    beforeRead: async (_method, signal) => { signal.throwIfAborted(); if (++logical > maxLogical) throw new Error("Logical read budget exhausted"); } };
  return { options, stats: () => ({ logicalReads: logical, networkDispatchAttempts: dispatched, exactBlockCacheHits: hits, billingMeasured: false, retries: 0 }) };
}
