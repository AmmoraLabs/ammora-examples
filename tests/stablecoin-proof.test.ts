import test from "node:test";
import assert from "node:assert/strict";
import { encodeEventTopics,encodeAbiParameters,erc20Abi,parseAbi,type PublicClient } from "viem";
import { receiptProof } from "../src/stablecoin/proof.js";
import type { Plan } from "../src/stablecoin/plans.js";
const pool="0x1111111111111111111111111111111111111111",token="0x2222222222222222222222222222222222222222",payout="0x3333333333333333333333333333333333333333",caller="0x4444444444444444444444444444444444444444",base="0x5555555555555555555555555555555555555555",hash=`0x${"a".repeat(64)}`as const,blockHash=`0x${"b".repeat(64)}`as const;
function fixture(fee=false,amount=100n){
  const log=(address:string,topics:readonly unknown[],data:string,index:number)=>{assert(topics.every(t=>typeof t==="string"));return{address,topics,data,logIndex:index,blockNumber:2n,blockHash,transactionHash:hash,transactionIndex:0,removed:false};};
  const logs=amount===0n?[]:[log(token,encodeEventTopics({abi:erc20Abi,eventName:"Transfer",args:{from:pool,to:payout}}),encodeAbiParameters([{type:"uint256"}],[amount]),0)];
  if(fee)logs.push(log(pool,encodeEventTopics({abi:parseAbi(["event PositionFeesClaimed(uint256 indexed tokenId,address indexed recipient,uint256 baseAmount,uint256 quoteAmount)"]),eventName:"PositionFeesClaimed",args:{tokenId:42n,recipient:payout}}),encodeAbiParameters([{type:"uint256"},{type:"uint256"}],[0n,amount]),1));
  const p:Plan={schemaVersion:1,operation:fee?"claim-lp-fees":"swap",manifestDigest:"fixture",caller,createdAt:1,expiresAt:100,snapshot:{number:"1",hash:blockHash},sdkVersion:"0.3.7",request:{},approvals:[],summary:{testOnly:true},reviewHash:"fixture",assets:{base,quote:token,model:"arl"},transactions:[{to:pool,data:"0x1234"}],expectation:fee?{kind:"claim",tokenId:"42",recipient:payout,collection:pool}:{kind:"swap",recipient:payout,outputToken:token,minimumOutput:"100"}};
  const client={getTransactionReceipt:async()=>({transactionHash:hash,status:"success",blockNumber:2n,blockHash,logs}),getTransaction:async()=>({from:caller,to:pool,input:"0x1234",value:0n,nonce:7,blockHash}),getBlock:async()=>({hash:blockHash}),readContract:async(a:any)=>a.address===base?1000n:a.blockNumber===1n?1000n:1000n+amount,getLogs:async(a:any)=>logs.filter(l=>l.address===a.address)};
  return {p,client:client as unknown as PublicClient,mutable:client};
}
test("swap proof binds calldata/nonce and reconciles whole-block balances rather than receipt status alone",async()=>{
  const{p,client,mutable}=fixture();const r=await receiptProof(client,hash,p,0,7);assert.equal(r.credits[0]!.receiptDelta,100n);assert.equal(r.credits[0]!.balanceIncreased,true);
  await assert.rejects(()=>receiptProof(client,hash,p,0,8),/identity/);
  mutable.readContract=async(a:any)=>a.blockNumber===1n?1000n:1500n;await assert.rejects(()=>receiptProof(client,hash,p,0,7),/balances\/logs/);
});
test("LP fee event, actual credit and net balance increase are required; zero fees stay no-op",async()=>{
  const a=fixture(true);assert.equal((await receiptProof(a.client,hash,a.p,0,7)).payoutVerified,true);
  const zero=fixture(true,0n);const z=await receiptProof(zero.client,hash,zero.p,0,7);assert.equal(z.payoutVerified,false);assert.equal(z.zeroFeeNoop,true);
});
