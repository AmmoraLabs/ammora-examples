import { parseAbi, parseEventLogs, erc20Abi, zeroAddress, type Hash, type PublicClient } from "viem";
import { hashALMMPreset } from "./almm-readiness-compat.js";
import { almmRewardManagerAbi,almmFactoryAbi,almmBinPoolAbi } from "@ammora-protocol/sdk";
import { transferDelta } from "../shared/fee-payment.js";
import { same,digest } from "./manifest.js";
import type { Plan } from "./plans.js";

export async function receiptProof(c:PublicClient,hash:Hash,plan:Plan,index:number,nonce:number) {
  const r=await c.getTransactionReceipt({hash}),tx=await c.getTransaction({hash}),b=await c.getBlock({blockNumber:r.blockNumber}),expected=plan.transactions[index]!;
  if(r.status!=="success"||!same(tx.from,plan.caller)||!tx.to||!same(tx.to,expected.to)||tx.input!==expected.data||tx.value!==BigInt(expected.value??0)||tx.nonce!==nonce||b.hash!==r.blockHash||tx.blockHash!==r.blockHash)throw new Error("Receipt/caller/calldata/nonce/canonical identity mismatch; never resend");
  const e=plan.expectation,credits=[];
  const watched=e.kind==="claim"||e.kind==="remove"?[plan.assets.base,plan.assets.quote]:[e.outputToken,e.token].filter((a):a is `0x${string}`=>!!a);
  for(const token of [...new Set(watched)]){
    const who=e.recipient!;const[before,after,logs]=await Promise.all([c.readContract({address:token,abi:erc20Abi,functionName:"balanceOf",args:[who],blockNumber:r.blockNumber-1n}),c.readContract({address:token,abi:erc20Abi,functionName:"balanceOf",args:[who],blockNumber:r.blockNumber}),c.getLogs({address:token,blockHash:r.blockHash})]);
    const receiptDelta=transferDelta(r.logs,token,who),blockDelta=transferDelta(logs,token,who);
    if(after-before!==blockDelta||logs.some(l=>l.removed||l.blockHash!==r.blockHash))throw new Error("Exact-block balances/logs mismatch");
    for(const l of r.logs.filter(l=>same(l.address,token)))if(!logs.some(x=>x.transactionHash===hash&&x.logIndex===l.logIndex&&x.data===l.data&&x.topics.join()===l.topics.join()))throw new Error("Incomplete block logs");
    if(e.kind==="swap"&&receiptDelta<BigInt(e.minimumOutput!))throw new Error("Swap minimum output not received");if(e.kind==="probe"&&receiptDelta!==0n)throw new Error("Probe did not return exact funds");credits.push({token,recipient:who,receiptDelta,before,after,blockDelta,balanceIncreased:after>before});
    if(e.kind==="remove"&&receiptDelta<BigInt(same(token,plan.assets.base)?e.minimumBase!:e.minimumQuote!))throw new Error("LP removal refund below reviewed floor");
  }
  const minted=parseEventLogs({abi:parseAbi(["event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)"]),eventName:"Transfer",logs:r.logs.filter(l=>e.collection&&same(l.address,e.collection))}).filter(l=>l.args.from===zeroAddress&&e.recipient&&same(l.args.to,e.recipient)).map(l=>({collection:l.address,tokenId:String(l.args.tokenId),owner:l.args.to}));
  if(e.kind==="mint-position"&&minted.length!==1)throw new Error("Expected one authenticated LP NFT mint");
  if(e.kind==="create-pool"){const code=await c.getCode({address:e.pool!,blockNumber:r.blockNumber});if(!code||code==="0x")throw new Error("Expected pool not deployed");
    if(e.presetId){
      const preset=await c.readContract({address:expected.to,abi:almmFactoryAbi,functionName:"getPreset",args:[e.presetId],blockNumber:r.blockNumber});
      if(hashALMMPreset(preset)!==e.presetHash||!await c.readContract({address:expected.to,abi:almmFactoryAbi,functionName:"isPool",args:[e.pool!],blockNumber:r.blockNumber}))throw new Error("Preset review or canonical pool membership changed");
      for(const name of["binStepBps","feeBps","protocolFeeShareBps","concreteFunctionType","collectFeeMode"]as const){const actual=await c.readContract({address:e.pool!,abi:almmBinPoolAbi,functionName:name,blockNumber:r.blockNumber});if(actual!==preset[name])throw new Error("Created pool economics differ from reviewed preset: "+name);}
      const dynamic=await c.readContract({address:e.pool!,abi:almmBinPoolAbi,functionName:"dynamicFeeConfig",blockNumber:r.blockNumber});
      if(digest(dynamic)!==digest(Object.values(preset.dynamicFee)))throw new Error("Created pool dynamic fee differs from reviewed preset");
    }
  }
  if(e.kind==="delegate"){
    const abi=parseAbi(["function positionDelegate(uint256) view returns(address)","function delegatePermission(uint256) view returns(uint8)"]);
    const delegate=await c.readContract({address:e.collection!,abi,functionName:"positionDelegate",args:[BigInt(e.tokenId!)],blockNumber:r.blockNumber}),permission=await c.readContract({address:e.collection!,abi,functionName:"delegatePermission",args:[BigInt(e.tokenId!)],blockNumber:r.blockNumber});
    if(!same(delegate,e.delegate!)||permission!==e.permission)throw new Error("Delegate receipt state differs");
  }
  let payoutVerified=false;
  if(e.kind==="claim"){
    const logs=r.logs.filter(l=>same(l.address,expected.to)),events=plan.assets.model==="arl"?parseEventLogs({abi:parseAbi(["event PositionFeesClaimed(uint256 indexed tokenId,address indexed recipient,uint256 baseAmount,uint256 quoteAmount)"]),eventName:"PositionFeesClaimed",logs}):parseEventLogs({abi:almmRewardManagerAbi,eventName:"ALMMPositionFeeClaimed",logs});
    const event=events[0]?.args;if(events.length!==1||!event||String(event.tokenId)!==e.tokenId||!same(event.recipient,e.recipient!))throw new Error("LP fee event identity mismatch");
    const base=credits.find(x=>same(x.token,plan.assets.base))!,quote=credits.find(x=>same(x.token,plan.assets.quote))!;
    if(base.receiptDelta!==event.baseAmount||quote.receiptDelta!==event.quoteAmount)throw new Error("Fee events and actual token credits differ");
    payoutVerified=credits.some(x=>x.receiptDelta>0n&&x.balanceIncreased);
  }
  return {hash,blockNumber:r.blockNumber,blockHash:r.blockHash,nonce,minted,credits,executionConfirmed:true,payoutVerified,zeroFeeNoop:e.kind==="claim"&&!payoutVerified};
}
