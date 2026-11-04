import { inspectPreset } from "./almm-readiness.js";
import { writeFileSync } from "node:fs";
import { ALMMClient, ALMMFactoryClient, DammV2Client, AmmConcentratedV3PositionDelegatePermission as Permission, buildRegisterStandardToken, dammV2StaticFeeConfig, sqrtPriceX64FromHumanPrice, getALMMBinIdFromPriceX128, getALMMPriceX128FromBinId, type AmmoraTransaction, type ERC20ApprovalRequirement } from "@ammora-protocol/sdk";
import { erc20Abi, parseAbi, parseUnits, zeroAddress, type Address, type Hex } from "viem";
import { clientOptions } from "../shared/env.js";
import { main } from "../shared/run.js";
import { context, budget, priceGuard, quoteFloor, wad, policyAbi, type Context } from "./context.js";
import { addr, digest, hash, int, json, load, obj, raw, same, text,staticArlFee } from "./manifest.js";

export type Expectation = { kind: string; pool?: Address; collection?: Address; tokenId?: string; recipient?: Address; minimumBase?: string; minimumQuote?: string; outputToken?: Address; minimumOutput?: string; delegate?: Address; permission?: number; presetId?: Hex; presetHash?: Hex; token?: Address };
export type Built={c:Context;transactions:readonly AmmoraTransaction[];approvals:readonly ERC20ApprovalRequirement[];expectation:Expectation;summary:unknown};
export type Builder=(file:string,request:unknown,expiresAt?:number)=>Promise<Built>;
export type Plan={schemaVersion:1;operation:string;manifestDigest:string;caller:Address;createdAt:number;expiresAt:number;snapshot:{number:string;hash:Hex};sdkVersion:"0.3.7" | "0.3.8" | "0.3.9";assets:{base:Address;quote:Address;model:"arl"|"almm"};request:unknown;transactions:readonly AmmoraTransaction[];approvals:readonly ERC20ApprovalRequirement[];expectation:Expectation;summary:unknown;reviewHash:string};
const expiry=(c:Context,n?:number)=>{const e=n??c.now+c.m.policy.planTtlSeconds;if(e<=c.now||e>c.now+c.m.policy.planTtlSeconds)throw new Error("Plan deadline expired or exceeds reviewed TTL");return BigInt(e);};
const owner=(c:Context)=>{if(!same(c.caller,c.m.roles.liquidityOwner!))throw new Error("Only reviewed liquidity owner may change principal or permissions");};
const poolRequest=(r:Record<string,unknown>)=>addr(r.pool);
const amounts=(c:Context,r:Record<string,unknown>)=>{const b=raw(r.maximumBaseRaw,false),q=raw(r.maximumQuoteRaw,false);budget(c.m,b,q);if(b+q===0n)throw new Error("Provide positive liquidity");return {b,q};};
const slip=(c:Context,v:unknown)=>int(v,0,c.m.policy.maxSlippageBps);
export const probeToken:Builder=async(file,value)=>{
  const r=obj(value,["asset","probeRaw"]),c=await context(file);owner(c);if(!["base","quote"].includes(String(r.asset)))throw new Error("asset must be base or quote");
  const k=r.asset as "base"|"quote",a=c.m[k],s=c.tokenStates[k==="base"?0:1]!,amount=raw(r.probeRaw);budget(c.m,k==="base"?amount:0n,k==="quote"?amount:0n);
  if(s.ownerConfigured||s.policy[0]!==0)throw new Error("BLOCKED_EXISTING_TOKEN_POLICY: preserve classified/owner policy; no registrar or policy override");
  const balance=await c.c.readContract({address:a.address!,abi:erc20Abi,functionName:"balanceOf",args:[c.caller]});if(balance<amount)throw new Error("Insufficient probe balance");
  return {c,transactions:[{to:c.registry,...buildRegisterStandardToken(a.address!,amount)}],approvals:[{token:a.address!,spender:c.registry,amount}],expectation:{kind:"probe",token:a.address!,recipient:c.caller},summary:{registry:c.registry,amount,warning:"Behavioral round trip only; not issuer, redemption, future safety or aggregation approval"}};
};
export const createArlPool:Builder=async(file,value)=>{
  const r=obj(value,["maximumBaseRaw","maximumQuoteRaw","minPrice","maxPrice","feeBps","activationPoint","userSalt"]),c=await context(file,true);owner(c);if(!(c.sdk instanceof DammV2Client))throw new Error("Use an arl manifest");
  const {b,q}=amounts(c,r),feeBps=staticArlFee(r.feeBps,c.m.policy.maxFeeBps),activationPoint=int(r.activationPoint,1,c.now+3600),price=(v:unknown)=>sqrtPriceX64FromHumanPrice(parseUnits(text(v,"price"),18),18,c.m.base.decimals!,c.m.quote.decimals!);
  const prepared=await c.sdk.preparePoolCreationBalanced({baseToken:c.m.base.address!,quoteToken:c.m.quote.address!,creator:c.caller,feeBps,sqrtMinPrice:price(r.minPrice),sqrtMaxPrice:price(r.maxPrice),activationType:0,activationPoint,collectFeeMode:0,userSalt:hash(r.userSalt),maximumBaseAmount:b,maximumQuoteAmount:q});
  const initial=prepared.parameters.sqrtPrice**2n*10n**BigInt(c.m.base.decimals!)*10n**18n/(2n**128n*10n**BigInt(c.m.quote.decimals!));priceGuard(c.m,initial);
  const plan=await c.sdk.planCreatePool(prepared.parameters,{feeConfig:dammV2StaticFeeConfig(feeBps,activationPoint)});
  return {c,transactions:[plan.transaction],approvals:plan.approvalRequirements,expectation:{kind:"create-pool",pool:prepared.predictedPool,collection:prepared.predictedPool,recipient:c.caller},summary:{prepared,creation:plan.prepared,feeBps,initialHumanPriceWad:initial,initialPosition:"RAW_POOL NFT; unlocked. No permanent lock or launch issuance."}};
};
export const createAlmmPool:Builder=async(file,value)=>{
  const r=obj(value,["binStepBps","activeId","feeBps"]),c=await context(file,true);owner(c);if(!(c.sdk instanceof ALMMClient))throw new Error("Use an almm manifest");
  const binStepBps=int(r.binStepBps,1,400),activeId=int(r.activeId,-8388608,8388607),feeBps=int(r.feeBps,0,c.m.policy.maxFeeBps),actual=await c.c.readContract({address:c.factory,abi:policyAbi,functionName:"defaultFeeBps"});
  if(actual!==feeBps)throw new Error("BLOCKED_ALMM_FEE_CONFIG: requested fee differs from factory default; select/review an existing preset separately, never change governance here");
  priceGuard(c.m,getALMMPriceX128FromBinId(activeId,binStepBps)*10n**BigInt(c.m.base.decimals!)*10n**18n/(2n**128n*10n**BigInt(c.m.quote.decimals!)));
  const factory=new ALMMFactoryClient(c.c,c.factory,clientOptions()),plan=await factory.planCreatePool({baseToken:c.m.base.address!,quoteToken:c.m.quote.address!,binStepBps,activeId});if(!plan.ready)throw new Error(plan.issues.join("; "));
  return {c,transactions:[plan.transaction],approvals:[],expectation:{kind:"create-pool",pool:plan.predictedPool},summary:{...plan,feeBps,liquidity:"Empty pool; seed separately. No pool creation is a stablecoin mint."}};
};
export const createAlmmPreset:Builder=async(file,value)=>{
  const c=await context(file,true);owner(c);const r=await inspectPreset(c,value);
  if(!r.readyForPlanning)throw new Error(r.blockers.map(b=>b.code+": "+b.message).join("; "));
  const preset=r.preflight.preset as {binStepBps:number};
  priceGuard(c.m,getALMMPriceX128FromBinId(r.preflight.canonicalConfig.activeId,preset.binStepBps)*10n**BigInt(c.m.base.decimals!)*10n**18n/(2n**128n*10n**BigInt(c.m.quote.decimals!)));
  return{c,transactions:[r.preflight.transaction],approvals:[],expectation:{kind:"create-pool",pool:r.preflight.predictedPool,presetId:(value as {presetId:Hex}).presetId,presetHash:r.presetHash!},summary:{readiness:r,warning:"Empty preset pool; inspect actual deployed economics/address before seed. No issuer mint, default fee or governance update."}};
};
export const seedAlmm:Builder=async(file,value,e)=>{
  const r=obj(value,["pool","maximumBaseRaw","maximumQuoteRaw","lowerBinId","upperBinId","slippageBps","maxActiveBinSlippage"]),c=await context(file,true,poolRequest(r));owner(c);if(!(c.sdk instanceof ALMMClient))throw new Error("Use an almm manifest");const{b,q}=amounts(c,r);
  const lowerBinId=int(r.lowerBinId,-8388608,8388607),upperBinId=int(r.upperBinId,lowerBinId,Math.min(8388607,lowerBinId+63));
  const plan=await c.sdk.planCreateStrategyPosition({lowerBinId,upperBinId,totalBaseAmount:b,totalQuoteAmount:q,strategy:0,shareSlippageBps:slip(c,r.slippageBps),maxActiveBinSlippage:int(r.maxActiveBinSlippage,0,5),recipient:c.caller,deadline:expiry(c,e)});
  return {c,transactions:[plan.transaction],approvals:plan.approvalRequirements,expectation:{kind:"mint-position",pool:c.pool,collection:c.manager,recipient:c.caller},summary:{quote:plan.quote,lock:"No bootstrap/permanent lock; owner retains withdrawal authority"}};
};
export const addLiquidity:Builder=async(file,value,e)=>{
  const r=obj(value,["pool","tokenId","maximumBaseRaw","maximumQuoteRaw","slippageBps"]),c=await context(file,true,poolRequest(r));owner(c);const{b,q}=amounts(c,r),slippageBps=slip(c,r.slippageBps),deadline=expiry(c,e);
  if(c.sdk instanceof DammV2Client){const plan=r.tokenId===null?await c.sdk.planCreateAndAddManagedConcentratedPosition({maximumBaseAmount:b,maximumQuoteAmount:q,slippageBps,recipient:c.caller,deadline}):await c.sdk.planAddLiquidityToManagedConcentratedPosition({tokenId:raw(r.tokenId,false),caller:c.caller,maximumBaseAmount:b,maximumQuoteAmount:q,slippageBps,deadline});
    return {c,transactions:[plan.transaction],approvals:plan.approvalRequirements,expectation:{kind:r.tokenId===null?"mint-position":"add",pool:c.pool,collection:c.manager,recipient:c.caller,...(r.tokenId===null?{}:{tokenId:String(r.tokenId)})},summary:plan.quote};}
  const id=raw(r.tokenId,false),position=await c.sdk.getPositionContext(id,c.caller);if(!same(position.owner,c.caller)||position.binCount>64n)throw new Error("Owner and at most 64 bins required");
  const bins=await c.c.readContract({address:c.manager,abi:parseAbi(["function getPositionBins(uint256) view returns(int24[])"]),functionName:"getPositionBins",args:[id]});if(!bins.length)throw new Error("Use seed-almm for a new position");
  const plan=await c.sdk.planAddLiquidityByWeight({tokenId:id,caller:c.caller,totalBaseAmount:b,totalQuoteAmount:q,weights:bins.map(binId=>({binId,baseWeight:1n,quoteWeight:1n})),shareSlippageBps:slippageBps,deadline});
  return {c,transactions:[plan.transaction],approvals:plan.approvalRequirements,expectation:{kind:"add",pool:c.pool,tokenId:String(id),collection:c.manager,recipient:c.caller},summary:plan.deposits};
};
export const removeLiquidity:Builder=async(file,value,e)=>{
  const r=obj(value,["pool","tokenId","namespace","liquidityRaw","shareBps","slippageBps"]),c=await context(file,false,poolRequest(r));owner(c);const id=raw(r.tokenId,false),slippageBps=slip(c,r.slippageBps),deadline=expiry(c,e);
  if(c.sdk instanceof DammV2Client){if(r.namespace!=="managed"&&r.namespace!=="raw")throw new Error("ARL namespace must be managed or raw");if(r.shareBps!==null)throw new Error("ARL uses liquidityRaw, not shareBps");
    const plan=r.namespace==="raw"?await c.sdk.planRemoveLiquidity({tokenId:id,liquidity:raw(r.liquidityRaw),slippageBps,caller:c.caller,recipient:c.caller,deadline}):await c.sdk.planRemoveManagedConcentratedLiquidity({tokenId:id,liquidity:raw(r.liquidityRaw),slippageBps,caller:c.caller,recipient:c.caller,deadline});
    return {c,transactions:[plan.transaction],approvals:[],expectation:{kind:"remove",pool:c.pool,tokenId:String(id),recipient:c.caller,minimumBase:String(plan.quote.minimumBaseAmount),minimumQuote:String(plan.quote.minimumQuoteAmount)},summary:plan.quote};}
  if(r.namespace!=="almm"||r.liquidityRaw!==null)throw new Error("ALMM uses namespace almm and shareBps");const shareBps=int(r.shareBps,1,10000),position=await c.sdk.getPositionContext(id,c.caller);if(!same(position.owner,c.caller)||position.binCount>64n)throw new Error("Owner and at most 64 bins required");
  const abi=parseAbi(["function getPositionBins(uint256) view returns(int24[])","function positionShares(uint256,int24) view returns(uint256)"]),bins=await c.c.readContract({address:c.manager,abi,functionName:"getPositionBins",args:[id]}),withdrawals=[];
  for(const binId of bins){const owned=await c.c.readContract({address:c.manager,abi,functionName:"positionShares",args:[id,binId]}),shares=owned*BigInt(shareBps)/10000n;if(shares>0n)withdrawals.push({binId,shares});}
  // Withdrawal-only rebalance provides on-chain minimum refunds; legacy removeLiquidity has no token floors.
  const plan=await c.sdk.planRebalancePosition({tokenId:id,caller:c.caller,withdrawals,deposits:[],slippageBps,maxActiveBinSlippage:0,recipient:c.caller,deadline});
  return {c,transactions:[plan.transaction],approvals:plan.approvalRequirements,expectation:{kind:"remove",pool:c.pool,tokenId:String(id),recipient:c.caller,minimumBase:String(plan.quote.minimumBaseRefund),minimumQuote:String(plan.quote.minimumQuoteRefund)},summary:plan.quote};
};
export const swap:Builder=async(file,value,e)=>{
  const r=obj(value,["pool","tokenIn","amountInRaw","slippageBps"]),c=await context(file,true,poolRequest(r)),tokenIn=addr(r.tokenIn),baseIn=same(tokenIn,c.m.base.address!);if(!baseIn&&!same(tokenIn,c.m.quote.address!))throw new Error("Input token outside pair");const amount=raw(r.amountInRaw);budget(c.m,baseIn?amount:0n,baseIn?0n:amount);
  for(const t of c.tokenStates)if(!t.policy[2])throw new Error("BLOCKED_ROUTER_TOKEN_POLICY");
  const p=c.sdk instanceof DammV2Client?await c.sdk.planSwapExactInput({tokenIn,amountIn:amount,slippageBps:slip(c,r.slippageBps),recipient:c.m.roles.payout!,deadline:expiry(c,e)}):await c.sdk.planSwapExactInput({includedAmountIn:amount,baseForQuote:baseIn,allowPartialFill:false,slippageBps:slip(c,r.slippageBps),recipient:c.m.roles.payout!,deadline:expiry(c,e)});
  const expectedReferenceOutput=quoteFloor(c.m,baseIn,amount,p.quote.minimumAmountOut);
  return {c,transactions:[p.transaction],approvals:p.approvalRequirements,expectation:{kind:"swap",pool:c.pool,recipient:c.m.roles.payout!,outputToken:baseIn?c.m.quote.address!:c.m.base.address!,minimumOutput:String(p.quote.minimumAmountOut)},summary:{quote:p.quote,expectedReferenceOutput,note:"Direct pool only; no aggregation admission or issuer redemption implied"}};
};
export const feeDelegate:Builder=async(file,value)=>{
  const r=obj(value,["pool","tokenId","mode"]),c=await context(file,false,poolRequest(r));owner(c);if(!(c.sdk instanceof DammV2Client))throw new Error("BLOCKED_ALMM_FEE_DELEGATE: no ARL fee-only permission mask is applied to ALMM principal permissions");
  if(!["claim-fee","claim-fee-to-owner","revoke"].includes(String(r.mode)))throw new Error("Select claim-fee, claim-fee-to-owner or revoke");const id=raw(r.tokenId,false),delegate=r.mode==="revoke"?zeroAddress:c.m.roles.feeDelegate;if(!delegate||same(delegate,c.caller))throw new Error("Review a distinct fee delegate in the manifest");
  const abi=parseAbi(["function positionDelegate(uint256) view returns(address)"]),old=await c.c.readContract({address:c.manager,abi,functionName:"positionDelegate",args:[id]});if(old!==zeroAddress&&!same(old,c.m.roles.feeDelegate??zeroAddress))throw new Error("Existing different delegate must be reviewed; no silent replacement");
  const permission=r.mode==="revoke"?0:r.mode==="claim-fee"?Permission.ClaimFee:Permission.ClaimFeeToOwner,transaction=await c.sdk.planUpdateDelegatePermission(id,delegate,permission,c.caller);
  return {c,transactions:[transaction],approvals:[],expectation:{kind:"delegate",pool:c.pool,tokenId:String(id),collection:c.manager,delegate,permission},summary:{warning:"Managed NFT fee-only permission; no principal authority. Single delegate slot."}};
};
export const claimLpFees:Builder=async(file,value)=>{
  const r=obj(value,["pool","tokenId","namespace"]),c=await context(file,false,poolRequest(r)),id=raw(r.tokenId,false);
  if(c.sdk instanceof DammV2Client){if(r.namespace!=="managed"&&r.namespace!=="raw")throw new Error("Choose managed or raw ARL NFT namespace");if(r.namespace==="raw"&&!same(c.caller,c.m.roles.liquidityOwner!))throw new Error("Raw NFT delegation is not granted here");
    const tx=r.namespace==="managed"?await c.sdk.planClaimManagedConcentratedFees(id,c.m.roles.payout!,c.caller):c.sdk.planClaimPositionFees(id,c.m.roles.payout!);
    return {c,transactions:[tx],approvals:[],expectation:{kind:"claim",pool:c.pool,tokenId:String(id),collection:r.namespace==="managed"?c.manager:c.pool,recipient:c.m.roles.payout!},summary:{namespace:r.namespace,zeroFee:"No-op is not positive payout evidence"}};}
  if(r.namespace!=="almm")throw new Error("Use ALMM namespace");const p=await c.sdk.planClaimPositionFees({tokenId:id,caller:c.caller});
  if(!same(p.context.owner,c.m.roles.liquidityOwner!)||!same(p.context.feeOwner,c.m.roles.payout!))throw new Error("ALMM pays its existing feeOwner; P0 does not redirect that entitlement");
  return {c,transactions:p.transactions,approvals:[],expectation:{kind:"claim",pool:c.pool,tokenId:String(id),collection:c.manager,recipient:p.context.feeOwner},summary:{namespace:"almm",context:p.context}};
};
export const closeAlmm:Builder=async(file,value)=>{const r=obj(value,["pool","tokenId"]),c=await context(file,false,poolRequest(r));owner(c);if(!(c.sdk instanceof ALMMClient))throw new Error("Only empty ALMM position");const id=raw(r.tokenId,false),p=await c.sdk.planCloseEmptyPosition({tokenId:id,caller:c.caller});return {c,transactions:[p.transaction],approvals:[],expectation:{kind:"close",pool:c.pool,collection:c.manager,tokenId:String(id)},summary:p.context};};
export const builders:Record<string,Builder>={probe:probeToken,"create-arl":createArlPool,"create-almm":createAlmmPool,"create-almm-preset":createAlmmPreset,"seed-almm":seedAlmm,add:addLiquidity,remove:removeLiquidity,swap,"fee-delegate":feeDelegate,"claim-lp-fees":claimLpFees,"close-almm":closeAlmm};
export async function makePlan(operation:string,file:string,request:unknown,expiresAt?:number):Promise<Plan>{
  const builder=builders[operation];if(!builder)throw new Error("Unknown stablecoin operation");const b=await builder(file,request,expiresAt),e=Number(expiry(b.c,expiresAt));
  const payload={schemaVersion:1 as const,operation,manifestDigest:digest(b.c.m),caller:b.c.caller,createdAt:b.c.now,expiresAt:e,snapshot:{number:String(b.c.block.number),hash:b.c.block.hash},sdkVersion:"0.3.9"as const,assets:{base:b.c.m.base.address!,quote:b.c.m.quote.address!,model:b.c.m.model},request,transactions:b.transactions,approvals:b.approvals,expectation:b.expectation,summary:b.summary};
  return {...payload,reviewHash:digest(payload)};
}
export function planMain(operation:string):void {main(async()=>{const[file,input,out,...extra]=process.argv.slice(2);if(!file||!input||!out||extra.length)throw new Error("usage: <manifest.json> <request.json> <NEW-plan.json>; planning never loads a signer");const p=await makePlan(operation,file,load(input));writeFileSync(out,json(p)+"\n",{flag:"wx",mode:0o600});console.log(json({plan:out,reviewHash:p.reviewHash,summary:p.summary,signing:false}));});}
