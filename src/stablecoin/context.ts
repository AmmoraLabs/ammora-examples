import { readFileSync } from "node:fs";
import { ALMMClient, DammV2Client, getALMMPriceX128FromBinId,giwaSepoliaPermissionless } from "@ammora-protocol/sdk";
import { erc20Abi, parseAbi, keccak256, parseUnits, stringToHex, toHex, zeroAddress, type Address, type PublicClient } from "viem";
import { deployment, clientOptions, reader, readBlock } from "../shared/env.js";
import { almmDeployment } from "./almm-deployment.js";
import { manifest, load, requireResolved, same, hash, raw, type Manifest, type Asset } from "./manifest.js";

export const policyAbi=parseAbi(["function tokenPolicyRegistry() view returns(address)","function policy(address) view returns(uint8 kind,bool poolAllowed,bool routerAllowed,bool rewardAllowed)","function ownerPolicyConfigured(address) view returns(bool)","function aggregationRouterAllowed(address) view returns(bool)","function defaultFeeBps() view returns(uint16)"]);
const riskAbi=parseAbi(["function paused() view returns(bool)","function isBlacklisted(address) view returns(bool)"]);
const authorityAbi=parseAbi(["function owner() view returns(address)","function hasRole(bytes32,address) view returns(bool)"]);
export async function checkAuthorities(c:PublicClient,a:Asset) {
  const observed=[];for(const t of a.review.authorities){
    if(t.kind==="owner"){const actual=await c.readContract({address:a.address!,abi:authorityAbi,functionName:"owner"});if(!same(actual,t.account??zeroAddress))throw new Error("BLOCKED_AUTHORITY_CHANGED: token owner differs from review");observed.push({...t,actual});}
    else{const actual=await c.readContract({address:a.address!,abi:authorityAbi,functionName:"hasRole",args:[t.role,t.account]});if(actual!==t.allowed)throw new Error("BLOCKED_AUTHORITY_CHANGED: configured token role differs from review");observed.push({...t,actual});}
  }return observed;
}
/** SDK read paths use a single immutable block; no trust/provenance escape hatches. */
export function atBlock(c: PublicClient, n: bigint): PublicClient {
  return new Proxy(c,{get(target,k){const fn=Reflect.get(target,k);if(["readContract","getCode","getStorageAt","getBalance","call"].includes(String(k)))return (a:Record<string,unknown>)=>fn({...a,blockNumber:n,blockTag:undefined});
    if(k==="getBlock")return (a:Record<string,unknown>={})=>fn(a.blockHash||a.blockNumber? a:{blockNumber:n});return fn;}}) as PublicClient;
}
export const wad=(s:string)=>parseUnits(s,18);
export function deviation(price:bigint,reference:bigint): bigint {return (price>reference?price-reference:reference-price)*10000n/reference;}
export function referenceGuard(m:Manifest, now:number): void {
  if(m.reference.observedAt>now || now-m.reference.observedAt>m.reference.maxAgeSeconds)throw new Error("BLOCKED_STALE_REFERENCE: review a fresh independent price/exit reference; pool spot cannot certify its own peg");
}
export function priceGuard(m:Manifest,price:bigint): void {if(deviation(price,wad(m.reference.quotePerBase))>BigInt(m.policy.maxPriceDeviationBps))throw new Error("BLOCKED_PRICE_DEVIATION: stop new exposure; removal and claims remain available");}
export function budget(m:Manifest,base:bigint,quote:bigint): void {if(base<0n||quote<0n||base>raw(m.policy.maxBaseRaw)||quote>raw(m.policy.maxQuoteRaw))throw new Error("Token budget exceeded");}
/** Selected public SDK 0.3.7 concentrated revision requires liquidity < pool total. */
export function withdrawalBoundary(total:bigint,available:bigint) {
  if(total<0n||available<0n||available>total)throw new Error("Invalid withdrawal liquidity state");
  const poolMaximum=total>1n?total-1n:0n,maximum=available<poolMaximum?available:poolMaximum;
  return {totalPoolLiquidityRaw:String(total),availablePositionLiquidityRaw:String(available),maximumWithdrawalLiquidityRaw:String(maximum),positionRemainderIfMaximumRaw:String(available-maximum),minimumPoolLiquidityRaw:"1",fullPoolCloseSupported:false,warning:"One raw liquidity unit is retained, not one token. A minimum-only pool cannot reliably be refilled in this revision; no silent full-close or refill promise."};
}
export function quoteFloor(m:Manifest,baseIn:boolean,input:bigint,output:bigint): bigint {
  const p=wad(m.reference.quotePerBase),unitB=10n**BigInt(m.base.decimals!),unitQ=10n**BigInt(m.quote.decimals!);
  const expected=baseIn?input*p*unitQ/(unitB*10n**18n):input*unitB*10n**18n/(p*unitQ);
  if(expected===0n||output===0n||output*10000n<expected*BigInt(10000-m.policy.maxQuoteCostBps))throw new Error("BLOCKED_NET_COST_OR_DEPTH: output including fees exceeds reviewed reference cost limit");return expected;
}
export async function context(path:string|undefined, exposure=false, pool?:Address) {
  const m=manifest(load(path));requireResolved(m);
  if(process.env.AMMORA_CHAIN_ID!=="91342"||process.env.AMMORA_GIWA_GENERATION!=="auto-route"||process.env.AMMORA_READ_RECEIPT?.trim())throw new Error("Set GIWA 91342 / auto-route and explicitly empty AMMORA_READ_RECEIPT for new plans");
  const selected=almmDeployment(m),d=selected.deployment,options=selected.options,client=await reader(),block=await readBlock(client),c=atBlock(client,block.number),now=Number(block.timestamp);
  const caller=process.env.AMMORA_ACCOUNT ? (await import("./manifest.js")).addr(process.env.AMMORA_ACCOUNT) : m.roles.liquidityOwner!;
  if(![m.roles.liquidityOwner,m.roles.feeDelegate].some(a=>a&&same(a,caller)))throw new Error("Caller must be the reviewed owner or fee delegate");
  const factory=m.model==="arl"?d.contracts.launch.concentratedFactory:d.contracts.liquidityMarketMaker.factory,manager=m.model==="arl"?d.contracts.launch.concentratedPositionManager:d.contracts.liquidityMarketMaker.positionManager;
  const pinDoc=JSON.parse(readFileSync(new URL("../quickstart/runtime-pins.giwa.json",import.meta.url),"utf8")),profile=pinDoc.deployments["auto-route"];
  if(pinDoc.chainId!=="91342"||profile.slot!==d.slot||profile.sourceCommit!==d.sourceCommit)throw new Error("Reviewed runtime pins differ from SDK deployment");
  const pins:Record<string,string>={...profile.runtimeCodeHashes,...(selected.fixture?.runtimeCodeHashes??{})};
  const verify=async(a:Address)=>{const expected=pins[a.toLowerCase()]??pins[a];if(!expected)throw new Error("Missing reviewed protocol runtime pin "+a);const code=await c.getCode({address:a});if(!code||keccak256(code)!==hash(expected))throw new Error("Protocol runtime mismatch "+a);};
  const rewardManager=d.contracts.liquidityMarketMaker.rewardManager;
  await verify(factory);await verify(manager);if(m.model==="almm"){await verify(d.contracts.liquidityMarketMaker.binLens);await verify(rewardManager);}
  const registry=await c.readContract({address:factory,abi:policyAbi,functionName:"tokenPolicyRegistry"});
  // Auto-route keeps the original ALMM factory/registry; its Launch registry differs.
  // Reuse only that exact role's existing pin after BOTH catalog bindings match.
  if(m.model==="almm"&&!pins[registry.toLowerCase()]){
    const legacy=pinDoc.deployments.legacy,old=giwaSepoliaPermissionless;
    if(legacy?.slot!==old.slot||legacy?.sourceCommit!==old.sourceCommit||!same(factory,old.contracts.liquidityMarketMaker.factory)||!same(registry,old.contracts.policy.tokenPolicyRegistry))throw new Error("Unreviewed shared ALMM registry binding");
    const pinned=legacy.runtimeCodeHashes[registry.toLowerCase()];if(!pinned)throw new Error("Missing original ALMM registry pin");pins[registry.toLowerCase()]=hash(pinned);
  }
  await verify(registry);
  const oldAlmm=giwaSepoliaPermissionless,legacyRegistryPin=pinDoc.deployments.legacy.runtimeCodeHashes[registry.toLowerCase()];
  const legacyRegistry=m.model==="almm"&&(same(factory,oldAlmm.contracts.liquidityMarketMaker.factory)||Boolean(selected.fixture))&&same(registry,oldAlmm.contracts.policy.tokenPolicyRegistry)&&pins[registry.toLowerCase()]===legacyRegistryPin;
  const tokenStates=[];
  if([factory,manager,registry,m.base.address!,m.quote.address!,...(pool?[pool]:[])].some(a=>same(a,m.roles.payout!)))throw new Error("Payout must be outside the pool/protocol/token contracts");
  for(const a of[m.base,m.quote]){
    const token=a.address!,code=await c.getCode({address:token});if(!code||keccak256(code)!==a.codeHash)throw new Error("Token runtime review invalidated: "+a.label);
    const decimals=await c.readContract({address:token,abi:erc20Abi,functionName:"decimals"});if(decimals!==a.decimals)throw new Error("Token decimals mismatch");
    for(const slotName of a.proxy.kind==="immutable"?["implementation","admin","beacon"]:["beacon"]){const slot=toHex(BigInt(keccak256(stringToHex("eip1967.proxy."+slotName)))-1n,{size:32}),value=await c.getStorageAt({address:token,slot});if(value&&BigInt(value)!==0n)throw new Error("Unreviewed EIP1967 "+slotName+"; immutable/beacon assumption invalidated");}
    if(a.proxy.kind==="eip1967"){
      for(const [slotName,expected]of[["implementation",a.proxy.implementation],["admin",a.proxy.admin??zeroAddress]]as const){const slot=toHex(BigInt(keccak256(stringToHex("eip1967.proxy."+slotName)))-1n,{size:32}),value=await c.getStorageAt({address:token,slot});if(!value||!same("0x"+value.slice(-40),expected))throw new Error("Proxy "+slotName+" review invalidated");}
      const impl=await c.getCode({address:a.proxy.implementation});if(!impl||keccak256(impl)!==a.proxy.implementationCodeHash)throw new Error("Implementation review invalidated");
    }
    if(a.review.pausedGetter&&await c.readContract({address:token,abi:riskAbi,functionName:"paused"}))throw new Error("BLOCKED_ISSUER_PAUSED");
    if(a.review.blacklistGetter)for(const who of[caller,m.roles.liquidityOwner!,m.roles.payout!,factory,manager,...(pool?[pool]:[])])if(await c.readContract({address:token,abi:riskAbi,functionName:"isBlacklisted",args:[who]}))throw new Error("BLOCKED_ISSUER_BLACKLIST");
    const observedAuthorities=await checkAuthorities(c,a);
    const policy=await c.readContract({address:registry,abi:policyAbi,functionName:"policy",args:[token]}),ownerConfigured=await c.readContract({address:registry,abi:policyAbi,functionName:"ownerPolicyConfigured",args:[token]}),aggregation=legacyRegistry?null:await c.readContract({address:registry,abi:policyAbi,functionName:"aggregationRouterAllowed",args:[token]});
    tokenStates.push({token,decimals,observedAuthorities,policy,ownerConfigured,aggregation,aggregationCapability:legacyRegistry?"NOT_SUPPORTED_BY_PINNED_LEGACY_REGISTRY":"SEPARATE_ADMISSION"});
  }
  if(exposure)referenceGuard(m,now);
  const sdk=m.model==="arl"?new DammV2Client(c,pool??factory,"concentrated",factory,manager,{...options,blockNumber:block.number}):new ALMMClient(c,pool??factory,manager,d.contracts.liquidityMarketMaker.binLens,options);
  let state: Awaited<ReturnType<ALMMClient["getPoolState"]>>|Awaited<ReturnType<DammV2Client["getPoolState"]>>|undefined,price:bigint|undefined;
  if(pool){
    if(sdk instanceof DammV2Client)await sdk.getPoolProvenance();
    // ALMM planners authenticate too; read the catalog factory's membership before a read-only quote.
    if(sdk instanceof ALMMClient && !await c.readContract({address:factory,abi:parseAbi(["function isPool(address) view returns(bool)"]),functionName:"isPool",args:[pool]}))throw new Error("Not a canonical ALMM pool");
    state=await sdk.getPoolState();if(!same(state.baseToken,m.base.address!)||!same(state.quoteToken,m.quote.address!))throw new Error("Pool pair/order differs from manifest");
    price=("sqrtPrice"in state?state.sqrtPrice**2n:getALMMPriceX128FromBinId(state.activeId,state.binStepBps))*10n**BigInt(m.base.decimals!)*10n**18n/(2n**128n*10n**BigInt(m.quote.decimals!));
    if(exposure){priceGuard(m,price);if(state.currentFeeBps>m.policy.maxFeeBps)throw new Error("Pool fee exceeds reviewed cap");}
  }
  return {m,client,c,block,now,caller,factory,manager,rewardManager,registry,tokenStates,sdk,state,price,pool,pins,options,d,fixture:selected.fixture};
}
export type Context=Awaited<ReturnType<typeof context>>;
