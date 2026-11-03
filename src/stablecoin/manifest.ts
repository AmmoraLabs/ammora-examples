import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { getAddress, zeroAddress, type Address, type Hex } from "viem";

export const json = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === "bigint" ? String(x) : x, 2);
export const digest = (v: unknown): string => createHash("sha256").update(json(v)).digest("hex");
export const load = (p: string | undefined): unknown => {
  if (!p) throw new Error("Provide a JSON file; see STABLECOIN-PARTNER.md");
  return JSON.parse(readFileSync(p, "utf8"));
};
export const obj = (v: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Expected JSON object");
  const r = v as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!keys.includes(k)) throw new Error(`Unknown field: ${k}`);
  return r;
};
export const text = (v: unknown, label: string): string => {
  if (typeof v !== "string" || !v.trim() || v.length > 2048) throw new Error(`${label} must be nonempty text`);
  return v;
};
export const addr = (v: unknown): Address => {
  if (typeof v !== "string" || !/^0x[\da-fA-F]{40}$/.test(v)) throw new Error("Expected a nonzero address");
  const a = getAddress(v.toLowerCase()); if (a === zeroAddress) throw new Error("Zero address is unresolved"); return a;
};
export const hash = (v: unknown): Hex => {
  if (typeof v !== "string" || !/^0x[\da-fA-F]{64}$/.test(v)) throw new Error("Expected 32-byte code hash"); return v.toLowerCase() as Hex;
};
export const int = (v: unknown, lo: number, hi: number): number => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < lo || v > hi) throw new Error(`Expected integer ${lo}..${hi}`); return v;
};
/** Public SDK 0.3.7 validateDammV2FeeConfig requires a 25bp schedule floor. Never silently raise a request/cap. */
export function staticArlFee(value:unknown,cap:number):number {
  const fee=int(value,0,cap);if(fee<25)throw new Error("BLOCKED_ARL_FEE_FLOOR: SDK 0.3.7 fee schedule requires at least 25bp (0.25%); no automatic fee/cap increase. A low-fee deployment/SDK qualification is separate.");return fee;
}
export const raw = (v: unknown, positive = true): bigint => {
  if (typeof v !== "string" || !/^(0|[1-9]\d*)$/.test(v)) throw new Error("Use a decimal raw integer string");
  const n = BigInt(v); if (n >= 2n ** 256n || positive && n === 0n) throw new Error("Raw amount outside uint256 range"); return n;
};
export const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export type Asset = {
  label: string; address: Address | null; decimals: number | null; codeHash: Hex | null;
  proxy: { kind: "unreviewed" } | { kind: "immutable" } | { kind: "eip1967"; implementation: Address; implementationCodeHash: Hex; admin: Address | null };
  review: { status: "pending" | "reviewed"; evidence: string | null; controls: string | null; pausedGetter: boolean; blacklistGetter: boolean; authorities: Authority[] };
};
export type Authority = { kind:"owner";account:Address|null } | { kind:"role";role:Hex;account:Address;allowed:boolean };
export type Manifest = {
  schemaVersion: 1; chainId: 91342; generation: "auto-route"; id: string;
  origin: { kind: "native-issuer" | "synthetic-test"; issuer: string; status: "pending" | "reviewed"; evidence: string | null };
  deployment?: "almm-lowfee-test-v1"; model: "arl" | "almm"; base: Asset; quote: Asset;
  roles: { liquidityOwner: Address | null; payout: Address | null; feeDelegate: Address | null };
  policy: { maxBaseRaw: string; maxQuoteRaw: string; maxFeeBps: number; maxSlippageBps: number; maxPriceDeviationBps: number; maxQuoteCostBps: number; planTtlSeconds: number; maxGasWei: string };
  reference: { quotePerBase: string; observedAt: number; maxAgeSeconds: number; evidence: string };
};
function asset(value: unknown): Asset {
  const a=obj(value,["label","address","decimals","codeHash","proxy","review"]),p=obj(a.proxy,["kind","implementation","implementationCodeHash","admin"]),r=obj(a.review,["status","evidence","controls","pausedGetter","blacklistGetter","authorities"]);
  if (!["pending","reviewed"].includes(String(r.status)) || typeof r.pausedGetter!=="boolean" || typeof r.blacklistGetter!=="boolean") throw new Error("Invalid token review");
  if(!Array.isArray(r.authorities)||r.authorities.length>16)throw new Error("Review at most 16 known owner/role checks; empty does not certify absence of authority");
  const authorities:Authority[]=r.authorities.map(value=>{const t=obj(value,["kind","account","role","allowed"]);if(t.kind==="owner"){if(Object.keys(t).some(k=>!["kind","account"].includes(k)))throw new Error("Unexpected owner authority field");return{kind:"owner",account:t.account===null?null:addr(t.account)};}if(t.kind==="role"&&typeof t.allowed==="boolean")return{kind:"role",role:hash(t.role),account:addr(t.account),allowed:t.allowed};throw new Error("Use reviewed owner() or hasRole(bytes32,address) checks");});
  const proxy: Asset["proxy"] = p.kind === "unreviewed" ? {kind:"unreviewed"} : p.kind === "immutable" ? {kind:"immutable"} : p.kind === "eip1967" ? {kind:"eip1967",implementation:addr(p.implementation),implementationCodeHash:hash(p.implementationCodeHash),admin:p.admin===null?null:addr(p.admin)} : (()=>{throw new Error("Review proxy kind explicitly");})();
  if(p.kind!=="eip1967" && Object.keys(p).length!==1)throw new Error("Only EIP1967 review carries proxy fields");
  return {label:text(a.label,"asset label"),address:a.address===null?null:addr(a.address),decimals:a.decimals===null?null:int(a.decimals,0,18),codeHash:a.codeHash===null?null:hash(a.codeHash),proxy,
    review:{status:r.status as "pending"|"reviewed",evidence:r.evidence===null?null:text(r.evidence,"review evidence"),controls:r.controls===null?null:text(r.controls,"mint/pause/upgrade controls"),pausedGetter:r.pausedGetter,blacklistGetter:r.blacklistGetter,authorities}};
}
export function manifest(value: unknown): Manifest {
  const m=obj(value,["schemaVersion","chainId","generation","id","origin","model","base","quote","roles","policy","reference","deployment"]);
  if(m.schemaVersion!==1 || m.chainId!==91342 || m.generation!=="auto-route" || !["arl","almm"].includes(String(m.model)))throw new Error("P0 examples support GIWA Sepolia 91342 / auto-route / arl or almm only");
  const o=obj(m.origin,["kind","issuer","status","evidence"]),r=obj(m.roles,["liquidityOwner","payout","feeDelegate"]),p=obj(m.policy,["maxBaseRaw","maxQuoteRaw","maxFeeBps","maxSlippageBps","maxPriceDeviationBps","maxQuoteCostBps","planTtlSeconds","maxGasWei"]),ref=obj(m.reference,["quotePerBase","observedAt","maxAgeSeconds","evidence"]);
  if(!["native-issuer","synthetic-test"].includes(String(o.kind)) || !["pending","reviewed"].includes(String(o.status)))throw new Error("Native issuer or explicitly synthetic test provenance required");
  if(m.deployment!==undefined&&(m.deployment!=="almm-lowfee-test-v1"||m.model!=="almm"||o.kind!=="synthetic-test"))throw new Error("Isolated test deployment requires an explicitly synthetic ALMM manifest");
  const b=asset(m.base),q=asset(m.quote);if(b.address&&q.address&&same(b.address,q.address))throw new Error("Pair assets must differ");
  // ALMMFactory canonicalizes addresses (and negates activeId). Do not silently swap
  // reviewed raw budgets/decimals/reference prices underneath a partner manifest.
  if(m.model==="almm"&&b.address&&q.address&&b.address.toLowerCase()>q.address.toLowerCase())throw new Error("BLOCKED_ALMM_TOKEN_ORDER: set base to the lower token address, then review both decimals/raw budgets and the inverse quote-per-base reference before planning");
  raw(p.maxBaseRaw);raw(p.maxQuoteRaw);raw(p.maxGasWei);text(ref.quotePerBase,"reference price");
  if(!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(String(ref.quotePerBase)) || Number(ref.quotePerBase)<=0)throw new Error("Reference is a positive decimal quote-per-base price, at most 18 decimals");
  return {...(m.deployment===undefined?{}:{deployment:"almm-lowfee-test-v1" as const}),schemaVersion:1,chainId:91342,generation:"auto-route",id:text(m.id,"id"),model:m.model as Manifest["model"],base:b,quote:q,
    origin:{kind:o.kind as Manifest["origin"]["kind"],issuer:text(o.issuer,"issuer"),status:o.status as "pending"|"reviewed",evidence:o.evidence===null?null:text(o.evidence,"issuer evidence")},
    roles:{liquidityOwner:r.liquidityOwner===null?null:addr(r.liquidityOwner),payout:r.payout===null?null:addr(r.payout),feeDelegate:r.feeDelegate===null?null:addr(r.feeDelegate)},
    policy:{maxBaseRaw:p.maxBaseRaw as string,maxQuoteRaw:p.maxQuoteRaw as string,maxGasWei:p.maxGasWei as string,maxFeeBps:int(p.maxFeeBps,0,1000),maxSlippageBps:int(p.maxSlippageBps,0,500),maxPriceDeviationBps:int(p.maxPriceDeviationBps,1,5000),maxQuoteCostBps:int(p.maxQuoteCostBps,1,5000),planTtlSeconds:int(p.planTtlSeconds,60,3600)},
    reference:{quotePerBase:ref.quotePerBase as string,observedAt:int(ref.observedAt,0,Number.MAX_SAFE_INTEGER),maxAgeSeconds:int(ref.maxAgeSeconds,60,86400),evidence:text(ref.evidence,"independent reference evidence")}};
}
export const unresolved = (m: Manifest): string[] => [
  ...([m.origin.status!=="reviewed"||!m.origin.evidence?"issuer provenance review":null]),
  ...(["base","quote"]as const).flatMap(k=>{const a=m[k];return [!a.address?`${k} address`:null,a.decimals===null?`${k} decimals`:null,!a.codeHash?`${k} runtime hash`:null,a.proxy.kind==="unreviewed"?`${k} proxy review`:null,a.review.status!=="reviewed"||!a.review.evidence||!a.review.controls?`${k} token/control review`:null];}),
  !m.roles.liquidityOwner?"liquidity owner":null,!m.roles.payout?"payout":null,
].filter((x):x is string=>x!==null);
export function requireResolved(m: Manifest): void { const missing=unresolved(m);if(missing.length)throw new Error("BLOCKED_UNRESOLVED: "+missing.join(", ")); }
