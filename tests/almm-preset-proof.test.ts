import test from "node:test";
import assert from "node:assert/strict";
import {zeroAddress} from "viem";
import {receiptProof} from "../src/stablecoin/proof.js";
import {hashALMMPreset} from "../src/stablecoin/almm-readiness-compat.js";
const caller="0x"+"1".repeat(40),factory="0x"+"2".repeat(40),pool="0x"+"3".repeat(40),h="0x"+"a".repeat(64);
const preset={enabled:true,binStepBps:1,feeBps:1,protocolFeeShareBps:1000,concreteFunctionType:0,collectFeeMode:0,dynamicFee:{enabled:false,maxVolatilityAccumulator:0,variableFeeControl:0,filterPeriod:0,decayPeriod:0,reductionFactorBps:0,maxVariableFeeBps:0}};
function setup(change:Record<string,unknown>={}){const state={getPreset:preset,isPool:true,dynamicFeeConfig:Object.values(preset.dynamicFee),...preset,...change};const c={getTransactionReceipt:async()=>({status:"success",blockNumber:10n,blockHash:h,logs:[]}),getTransaction:async()=>({from:caller,to:factory,input:"0x1234",value:0n,nonce:1,blockHash:h}),getBlock:async()=>({hash:h}),getCode:async()=>"0x12",readContract:async({functionName}:any)=>state[functionName as keyof typeof state]};const plan={caller,transactions:[{to:factory,data:"0x1234"}],assets:{model:"almm",base:zeroAddress,quote:zeroAddress},expectation:{kind:"create-pool",pool,presetId:h,presetHash:hashALMMPreset(preset)}};return{c,plan};}
test("preset pool proof binds all actual economics before any seed",async()=>{const{c,plan}=setup();assert.equal((await receiptProof(c as any,h as any,plan as any,0,1)).executionConfirmed,true);});
test("successful receipt alone cannot qualify a different fee, mode, dynamic cap or membership",async()=>{
 for(const change of[{feeBps:30},{protocolFeeShareBps:2000},{collectFeeMode:1},{concreteFunctionType:1},{binStepBps:2},{isPool:false},{dynamicFeeConfig:[true,1,1,1,2,0,5]},{getPreset:{...preset,enabled:false}}]){const{c,plan}=setup(change);await assert.rejects(()=>receiptProof(c as any,h as any,plan as any,0,1));}
});
