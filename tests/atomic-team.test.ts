import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRegisterConfigAndCreateAmmoraV4Launch, ammoraLaunchFactoryV4Abi,
  encodeALCSegmentedV3FirstBuyCallback, type AmmoraV4Config, type AmmoraV4ConfigSnapshot } from "@ammora-protocol/sdk";
import { decodeFunctionData, zeroAddress, type Address } from "viem";
import { parseTeamRecipientPolicy } from "../src/launch/team/policy.js";
import { prepareTeamAtomicFirstBuy, assertAtomicReview, type TeamAtomicInput } from "../src/launch/team/atomic-policy.js";
const addr = (n: number) => `0x${String(n).repeat(40)}` as Address;
const policy = parseTeamRecipientPolicy({schemaVersion:1, chainId:91342, registry:addr(2), templateId:"6",
  templateHash:`0x${"ab".repeat(32)}`,configOwner:addr(3),partnerRecipient:addr(4),liquidityPartner:addr(5),leftoverReceiver:addr(6)});
const target = {chainId:91342, registry:addr(2),factory:addr(7),firstBuyExecutor:addr(8)};
const input: TeamAtomicInput = {account:addr(3),saleSupplyRaw:750_000_000_000_000_000n,quoteThresholdRaw:6_500_000_000_000_000_000n,
  name:"Partner Test",symbol:"PART",metadataURI:"data:application/json,{}",quoteRaw:1_000_000n,minimumBaseRaw:1n,maxFeePerGasWei:100_000_000n,deadline:2_000_000_000n};
const load = async () => ({configId:6n, configHash:policy.templateHash, enabled:true,
  config:JSON.parse(await readFile(new URL("./fixtures/synthetic-concentrated-template.json",import.meta.url),"utf8"),
    (_,v:unknown)=>typeof v==="string" && /^\d+$/.test(v)?BigInt(v):v) as AmmoraV4Config} as AmmoraV4ConfigSnapshot);

test("partner Config and first-buy inputs reach the public SDK atomic factory calldata",async()=>{
  const template=await load(),before=structuredClone(template);
  const result=prepareTeamAtomicFirstBuy(template,policy,target,input),p=result.parameters,buy=p.firstBuys[0]!;
  // The SDK V3-named encoder is the common FirstBuy tuple encoding used by the V4 executor.
  const callbackData=encodeALCSegmentedV3FirstBuyCallback([{includedQuoteAmount:buy.includedQuoteAmountRaw,
    minimumBaseAmountOut:buy.minimumBaseAmountOutRaw,allowPartialFill:buy.allowPartialFill,recipient:buy.recipient,referrer:zeroAddress}],p.deadline);
  const tx=buildRegisterConfigAndCreateAmmoraV4Launch(p.config,p.segments,{...p.launch,callback:target.firstBuyExecutor,callbackData});
  const decoded=decodeFunctionData({abi:ammoraLaunchFactoryV4Abi,data:tx.data});
  assert.equal(decoded.functionName,"registerConfigAndLaunch");
  if(decoded.functionName!=="registerConfigAndLaunch")throw new Error("wrong selector");
  assert.equal(decoded.args[0].partnerRecipient,addr(4));
  assert.equal(decoded.args[0].liquidityDistribution.partner,addr(5));
  assert.equal(decoded.args[0].leftoverReceiver,addr(6));
  assert.equal(decoded.args[0].liquidityDistribution.partnerPermanentLockedBps,6250);
  assert.equal(decoded.args[0].liquidityDistribution.creatorPermanentLockedBps,3750);
  assert.equal(decoded.args[2].callback,target.firstBuyExecutor);
  assert.equal(decoded.args[2].callbackData,callbackData);
  assert.equal(buy.recipient,input.account);assert.equal(result.roles.creator,input.account);
  assert.deepEqual(template,before);
});
test("Config owner cannot be silently replaced by a different caller/Creator",async()=>{
  const template = await load();
  assert.throws(()=>prepareTeamAtomicFirstBuy(template,policy,target,{...input,account:addr(9)}),/caller must be configOwner/);
});
test("review approval binds recipients, metadata, amounts, target and expiry",async()=>{
  const template=await load(),original=prepareTeamAtomicFirstBuy(template,policy,target,input);
  assert.doesNotThrow(()=>assertAtomicReview(original.reviewHash,original.reviewHash));
  assert.throws(()=>assertAtomicReview(undefined,original.reviewHash),/reviewHash mismatch/);
  for(const change of [{name:"Another"},{metadataURI:"ipfs://different"},{quoteRaw:2_000_000n},{minimumBaseRaw:2n},{maxFeePerGasWei:200_000_000n},{deadline:2_000_000_001n}]){
    const changed=prepareTeamAtomicFirstBuy(template,policy,target,{...input,...change});
    assert.throws(()=>assertAtomicReview(original.reviewHash,changed.reviewHash),/reviewHash mismatch/);
  }
  for(const field of ["partnerRecipient","liquidityPartner","leftoverReceiver"] as const){
    assert.notEqual(prepareTeamAtomicFirstBuy(template,{...policy,[field]:addr(9)},target,input).reviewHash,original.reviewHash);
  }
  assert.notEqual(prepareTeamAtomicFirstBuy(template,policy,{...target,firstBuyExecutor:addr(9)},input).reviewHash,original.reviewHash);
});
