import { getALMMPresetReadiness,getALMMPositionReadiness,type ALMMReadinessOptions } from "./almm-readiness-compat.js";
import { type Context } from "./context.js";
import { addr,hash,int,obj } from "./manifest.js";
import { zeroAddress,type Hex } from "viem";
export function readinessOptions(c:Context):ALMMReadinessOptions {
 const pin=(a:string)=>hash(c.pins[a.toLowerCase()]??c.pins[a]);
 return{...c.options,blockNumber:c.block.number,binding:{chainId:91342,factory:c.factory,factoryCodeHash:pin(c.factory),registry:c.registry,registryCodeHash:pin(c.registry),registryAggregation:c.tokenStates.every(t=>t.aggregation===null)?"unavailable":"separate",positionManager:c.manager,positionManagerCodeHash:pin(c.manager),rewardManager:c.rewardManager,rewardManagerCodeHash:pin(c.rewardManager),binLens:c.d.contracts.liquidityMarketMaker.binLens}};
}
export function presetRequest(value:unknown){const r=obj(value,["presetId","expectedPresetHash","activeId","maxProtocolFeeShareBps"]);return{presetId:hash(r.presetId),expectedPresetHash:hash(r.expectedPresetHash),activeId:int(r.activeId,-8388607,8388607),maxProtocolFeeShareBps:int(r.maxProtocolFeeShareBps,0,2500)};}
export function inspectPreset(c:Context,value:unknown){if(c.m.model!=="almm")throw new Error("Select ALMM");const r=presetRequest(value);return getALMMPresetReadiness(c.client,{baseToken:c.m.base.address!,quoteToken:c.m.quote.address!,creator:c.caller,presetId:r.presetId,expectedPresetHash:r.expectedPresetHash,maxTotalFeeBps:c.m.policy.maxFeeBps,maxProtocolFeeShareBps:r.maxProtocolFeeShareBps,config:{activeId:r.activeId,pairType:3,activationType:0,activationPoint:0n,preActivationDuration:0n,preActivationSwapAddress:zeroAddress,creatorPoolOnOffControl:false,salt:`0x${"00".repeat(32)}` as Hex}},readinessOptions(c));}
export function inspectPosition(c:Context,tokenId:bigint,recipient=c.m.roles.payout!){if(!c.pool||c.m.model!=="almm")throw new Error("Select ALMM pool");return getALMMPositionReadiness(c.client,{pool:c.pool,tokenId,caller:c.caller,recipient:addr(recipient)},readinessOptions(c));}
