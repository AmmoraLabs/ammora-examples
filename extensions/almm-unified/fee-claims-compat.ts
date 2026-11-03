// Source-qualified additive SDK adapter; not an export of public npm 0.3.8.
import { encodeFunctionData, isAddress, keccak256, parseAbi, zeroAddress, type Address, type Hex, type PublicClient } from "viem";
import { ALMMClient } from "@ammora-protocol/sdk";
import type { ALMMReadinessOptions } from "@ammora-protocol/sdk";

/** Additive ABI for the explicitly reviewed routing revision, not an upgrade of an old deployment. */
export const almmFeeClaimRoutingAbi = parseAbi([
  "function FEE_CLAIM_ROUTING_VERSION() view returns(uint16)",
  "function feeClaimDelegationEpoch(uint256) view returns(uint256)",
  "function feeClaimDelegate(uint256,address) view returns(address feeOwner,address recipient,uint64 expiresAt,uint64 positionEpoch,uint256 epoch,bool anyRecipient,bool active)",
  "function setFeeClaimDelegate(uint256,address,address,uint64)",
  "function setFeeClaimDelegateAnyRecipient(uint256,address,uint64)",
  "function revokeFeeClaimDelegate(uint256,address)",
  "function revokeAllFeeClaimDelegates(uint256)",
  "function claimPositionFeeTo(uint256,address) returns(uint256 baseAmount,uint256 quoteAmount)",
  "function claimPositionFeeToChunk(uint256,int24[],address) returns(uint256 baseAmount,uint256 quoteAmount)",
  "function previewPositionFee(uint256,int24[]) view returns(uint256 baseAmount,uint256 quoteAmount)",
  "function positionFeeBaseOwed(uint256) view returns(uint256)",
  "function positionFeeQuoteOwed(uint256) view returns(uint256)",
  "event FeeClaimDelegateUpdated(uint256 indexed tokenId,address indexed delegate,address indexed recipient,address feeOwner,uint64 expiresAt,uint64 positionEpoch,uint256 epoch,bool anyRecipient)",
  "event FeeClaimDelegationEpochUpdated(uint256 indexed tokenId,uint256 epoch)",
]);
const rolesAbi = parseAbi([
  "function factory() view returns(address)", "function positionManager() view returns(address)",
  "function tokenPolicyRegistry() view returns(address)", "function rewardManager() view returns(address)",
  "function isPool(address) view returns(bool)", "function getPositionBins(uint256) view returns(int24[])",
  "function baseToken() view returns(address)", "function quoteToken() view returns(address)",
  "function permissionlessOperationBits(uint256) view returns(uint8)",
  "function permissionEpoch(uint256) view returns(uint64)", "function feeClaimController() view returns(address)",
]);
export type ALMMFeeClaimOptions = Omit<ALMMReadinessOptions,"binding"> & {
  feeClaimRoutingVersion: 1;
  binding: ALMMReadinessOptions["binding"] & { feeClaimController:Address;feeClaimControllerCodeHash:Hex };
};
export type ALMMFeeClaimRequest = {
  pool: Address; tokenId: bigint; caller: Address; recipient: Address;
  /** Strictly increasing, at most64 bins. Required for positions above64 bins. */
  binIds?: readonly number[];
};
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
function address(a:Address,label:string) { if(!isAddress(a)||same(a,zeroAddress)) throw new RangeError("Invalid "+label); }
const view=async(c:PublicClient,to:Address,abi:typeof rolesAbi|typeof almmFeeClaimRoutingAbi,name:string,args:readonly unknown[]=[])=>
  c.readContract({address:to,abi,functionName:name,args} as never) as Promise<unknown>;

/** Reads at one canonical block, including named delegate authority and positive-fee preview.
 * No key, signature, transaction, principal permission or implicit capability fallback is used.
 */
export async function getALMMFeeClaimReadiness(client:PublicClient,input:ALMMFeeClaimRequest,options:ALMMFeeClaimOptions) {
  if(options.feeClaimRoutingVersion!==1) throw new RangeError("Select an explicitly reviewed ALMM fee-routing deployment");
  address(input.pool,"pool");address(input.caller,"caller");address(input.recipient,"recipient");
  if(typeof input.tokenId!=="bigint"||input.tokenId<0n)throw new RangeError("Invalid tokenId");
  const b=options.binding;if(!b.positionManager||!b.rewardManager)throw new RangeError("Missing fee-routing manager roles");
  const chainId=await client.getChainId();if(chainId!==b.chainId||(client.chain&&client.chain.id!==chainId))throw new RangeError("Fee-routing chain mismatch");
  const head=await client.getBlockNumber(),number=options.blockNumber??(head>12n?head-12n:0n);
  if(number<0n||number>head)throw new RangeError("Invalid fee-routing block");
  const block=await client.getBlock({blockNumber:number});if(!block.hash)throw new RangeError("Missing canonical fee-routing block");
  const c=new Proxy(client,{get(target,k){const fn=Reflect.get(target,k);if(["readContract","getCode","getStorageAt","getBalance","call"].includes(String(k)))return(a:Record<string,unknown>)=>fn({...a,blockNumber:number,blockTag:undefined});if(k==="getBlockNumber")return async()=>number;if(k==="getBlock")return async()=>block;return fn;}})as PublicClient;
  for(const[a,h]of[[b.factory,b.factoryCodeHash],[b.registry,b.registryCodeHash],[b.positionManager,b.positionManagerCodeHash],[b.rewardManager,b.rewardManagerCodeHash],[b.feeClaimController,b.feeClaimControllerCodeHash]]as const){address(a,"bound role");if(!h||!/^0x[0-9a-f]{64}$/i.test(h))throw new RangeError("Missing fee-routing runtime pin");const code=await c.getCode({address:a});if(!code||code==="0x"||!same(keccak256(code),h))throw new RangeError("Fee-routing runtime changed");}
  const role=async(to:Address,name:string,args:readonly unknown[]=[])=>view(c,to,rolesAbi,name,args);
  for(const[to,name,want]of[[b.factory,"tokenPolicyRegistry",b.registry],[b.factory,"rewardManager",b.rewardManager],[b.positionManager,"factory",b.factory],[b.rewardManager,"factory",b.factory],[b.rewardManager,"positionManager",b.positionManager],[b.rewardManager,"tokenPolicyRegistry",b.registry],[input.pool,"factory",b.factory],[b.rewardManager,"feeClaimController",b.feeClaimController],[b.feeClaimController,"factory",b.factory],[b.feeClaimController,"positionManager",b.positionManager],[b.feeClaimController,"rewardManager",b.rewardManager],[b.feeClaimController,"tokenPolicyRegistry",b.registry]]as const)if(!same(String(await role(to,name)),want))throw new RangeError("Fee-routing role binding changed");
  if(!await role(b.factory,"isPool",[input.pool]))throw new RangeError("Unrecognized fee-routing pool");
  // An RPC/ABI failure propagates; it must not turn into a false supported/unsupported claim.
  const version=Number(await view(c,b.feeClaimController,almmFeeClaimRoutingAbi,"FEE_CLAIM_ROUTING_VERSION"));
  if(version!==1)throw new RangeError("Unsupported ALMM fee-routing revision");
  const position=await new ALMMClient(c,input.pool,b.positionManager,b.binLens,options).getPositionContext(input.tokenId,input.caller);
  if(!same(position.pool,input.pool))throw new RangeError("Position belongs to another pool");
  const forbidden=[zeroAddress,b.factory,b.registry,b.positionManager,b.rewardManager,b.feeClaimController,input.pool,String(await role(input.pool,"baseToken")),String(await role(input.pool,"quoteToken"))];
  if(forbidden.some(a=>same(a,input.recipient)))throw new RangeError("Unsafe fee recipient");
  const epoch=await view(c,b.feeClaimController,almmFeeClaimRoutingAbi,"feeClaimDelegationEpoch",[input.tokenId])as bigint;
  const positionEpoch=await role(b.positionManager,"permissionEpoch",[input.tokenId])as bigint;
  const grant=await view(c,b.feeClaimController,almmFeeClaimRoutingAbi,"feeClaimDelegate",[input.tokenId,input.caller])as readonly[Address,Address,bigint,bigint,bigint,boolean,boolean];
  const active=(grant[5]||grant[1]!==zeroAddress)&&same(grant[0],position.feeOwner)&&grant[3]===positionEpoch&&grant[4]===epoch&&(grant[2]===0n||block.timestamp<grant[2]);
  if(active!==grant[6])throw new RangeError("Inconsistent fee-routing delegate snapshot");
  const permissionless=Number(await role(b.rewardManager,"permissionlessOperationBits",[input.tokenId]));
  const canConfigure=same(position.feeOwner,input.caller);
  const fixedClaim=same(input.recipient,position.feeOwner)&&(same(position.owner,input.caller)||(permissionless&1)!==0);
  const canRouteFees=canConfigure||fixedClaim||(active&&(grant[5]||same(grant[1],input.recipient)));
  const blockers:string[]=[];let bins:readonly number[]=[];
  if(input.binIds){if(input.binIds.length<1||input.binIds.length>64||input.binIds.some((id,i)=>!Number.isInteger(id)||id<position.lowerBinId||id>position.upperBinId||(i>0&&id<=input.binIds![i-1]!)))throw new RangeError("Invalid fee claim chunk");bins=[...input.binIds];}
  else if(position.binCount>64n)blockers.push("CHUNK_REQUIRED");
  else bins=await role(b.positionManager,"getPositionBins",[input.tokenId])as readonly number[];
  let preview:readonly[bigint,bigint];
  if(bins.length)preview=await view(c,b.rewardManager,almmFeeClaimRoutingAbi,"previewPositionFee",[input.tokenId,bins])as readonly[bigint,bigint];
  else preview=[await view(c,b.rewardManager,almmFeeClaimRoutingAbi,"positionFeeBaseOwed",[input.tokenId])as bigint,await view(c,b.rewardManager,almmFeeClaimRoutingAbi,"positionFeeQuoteOwed",[input.tokenId])as bigint];
  if(!canRouteFees)blockers.push("FEE_CLAIM_NOT_AUTHORIZED_FOR_RECIPIENT");
  const positive=preview[0]>0n||preview[1]>0n;if(!positive)blockers.push("NO_POSITIVE_FEE_PAYOUT");
  if((await client.getBlock({blockNumber:number})).hash!==block.hash)throw new RangeError("Fee-routing snapshot reorganized");
  return {schemaVersion:1 as const,version:1 as const,block:{number,hash:block.hash,timestamp:block.timestamp},binding:b,position,positionEpoch,epoch,
    delegate:{feeOwner:grant[0],recipient:grant[1],expiresAt:grant[2],positionEpoch:grant[3],epoch:grant[4],recipientMode:grant[5]?"any"as const:"fixed"as const,active},permissionlessClaimFee:(permissionless&1)!==0,
    canConfigure,canRouteFees,readyForClaim:blockers.length===0,blockers,binIds:bins,feePreview:{base:preview[0],quote:preview[1],positive},
    recipient:input.recipient,keysLoaded:false as const,limitations:["Fee-only, no principal/reward/NFT/governance authority","Fixed payout by default; explicitly granted any-recipient mode stays fee-only; transfer/revoke/expiry invalidates both","Positive preview is not payment evidence; replan/simulate then reconcile actual receipt balances"]};
}

export async function planSetALMMFeeClaimDelegate(client:PublicClient,input:ALMMFeeClaimRequest&{delegate:Address;expiresAt:bigint;recipientMode?:"fixed"|"any"},options:ALMMFeeClaimOptions) {
  address(input.delegate,"delegate");if(typeof input.expiresAt!=="bigint"||input.expiresAt<0n||input.expiresAt>2n**64n-1n)throw new RangeError("Invalid delegate expiry");
  const readiness=await getALMMFeeClaimReadiness(client,input,options);
  if(!readiness.canConfigure||same(input.delegate,readiness.position.feeOwner))throw new RangeError("Only the fee owner may grant a distinct fee-only delegate");
  if(input.expiresAt!==0n&&input.expiresAt<=readiness.block.timestamp)throw new RangeError("Delegate expiry is not in the future");
  const mode=input.recipientMode??"fixed";
  if(mode!=="fixed"&&mode!=="any")throw new RangeError("Explicitly select fixed or any fee recipient policy");
  const data=mode==="any"?encodeFunctionData({abi:almmFeeClaimRoutingAbi,functionName:"setFeeClaimDelegateAnyRecipient",args:[input.tokenId,input.delegate,input.expiresAt]}):encodeFunctionData({abi:almmFeeClaimRoutingAbi,functionName:"setFeeClaimDelegate",args:[input.tokenId,input.delegate,input.recipient,input.expiresAt]});
  return {readiness,recipientMode:mode,authority:mode==="any"?"Explicit broad fee-only payout choice; no principal/reward/NFT rights":"Fee-only execution to the exact reviewed payout",transaction:{to:options.binding.feeClaimController,data,value:0n},approvalRequirements:[]};
}
export async function planRevokeALMMFeeClaimDelegate(client:PublicClient,input:ALMMFeeClaimRequest&{delegate?:Address},options:ALMMFeeClaimOptions) {
  if(input.delegate)address(input.delegate,"delegate");const readiness=await getALMMFeeClaimReadiness(client,input,options);
  if(!readiness.canConfigure)throw new RangeError("Only the fee owner may revoke fee-only delegates");
  const data=input.delegate?encodeFunctionData({abi:almmFeeClaimRoutingAbi,functionName:"revokeFeeClaimDelegate",args:[input.tokenId,input.delegate]}):encodeFunctionData({abi:almmFeeClaimRoutingAbi,functionName:"revokeAllFeeClaimDelegates",args:[input.tokenId]});
  return {readiness,transaction:{to:options.binding.feeClaimController,data,value:0n},approvalRequirements:[]};
}
export async function planClaimALMMPositionFeesTo(client:PublicClient,input:ALMMFeeClaimRequest,options:ALMMFeeClaimOptions) {
  const readiness=await getALMMFeeClaimReadiness(client,input,options);if(!readiness.readyForClaim)throw new RangeError(readiness.blockers.join("; "));
  const data=input.binIds?encodeFunctionData({abi:almmFeeClaimRoutingAbi,functionName:"claimPositionFeeToChunk",args:[input.tokenId,readiness.binIds,input.recipient]}):encodeFunctionData({abi:almmFeeClaimRoutingAbi,functionName:"claimPositionFeeTo",args:[input.tokenId,input.recipient]});
  return {readiness,transactions:[{to:options.binding.rewardManager!,data,value:0n}],approvalRequirements:[],expectation:{pool:input.pool,tokenId:input.tokenId,recipient:input.recipient,positivePayoutRequired:true as const}};
}
