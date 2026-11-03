import { getALMMBinIdFromPriceX128, getALMMPriceX128FromBinId, planConcentratedSeed, sqrtPriceX64FromHumanPrice } from "@ammora-protocol/sdk";
import { parseUnits } from "viem";
import { context,budget,priceGuard,wad } from "./context.js";
import { load,obj,raw,int,text,json,hash,staticArlFee } from "./manifest.js";
import { main } from "../shared/run.js";
main(async()=>{
  const[file,input,...extra]=process.argv.slice(2);if(!file||!input||extra.length)throw new Error("usage: <manifest.json> <liquidity-policy.json>");
  const r=obj(load(input),["maximumBaseRaw","maximumQuoteRaw","feeBps","minPrice","maxPrice","binStepBps","width","userSalt"]),c=await context(file,true),b=raw(r.maximumBaseRaw),q=raw(r.maximumQuoteRaw);budget(c.m,b,q);const feeBps=int(r.feeBps,0,c.m.policy.maxFeeBps);
  if(c.m.model==="arl"){
    staticArlFee(feeBps,c.m.policy.maxFeeBps);
    const price=(v:unknown)=>sqrtPriceX64FromHumanPrice(parseUnits(text(v,"price"),18),18,c.m.base.decimals!,c.m.quote.decimals!),seed=planConcentratedSeed(b,q,price(r.minPrice),price(r.maxPrice));
    priceGuard(c.m,seed.sqrtPriceX64**2n*10n**BigInt(c.m.base.decimals!)*10n**18n/(2n**128n*10n**BigInt(c.m.quote.decimals!)));
    console.log(json({model:"arl",seed,request:{maximumBaseRaw:String(b),maximumQuoteRaw:String(q),minPrice:r.minPrice,maxPrice:r.maxPrice,feeBps,activationPoint:c.now,userSalt:hash(r.userSalt)},position:"Initial RAW_POOL NFT, unlocked",signing:false}));
  }else{
    const binStepBps=int(r.binStepBps,1,400),width=int(r.width,0,31),rawPrice=wad(c.m.reference.quotePerBase)*2n**128n*10n**BigInt(c.m.quote.decimals!)/(10n**18n*10n**BigInt(c.m.base.decimals!)),activeId=getALMMBinIdFromPriceX128(rawPrice,binStepBps);
    priceGuard(c.m,getALMMPriceX128FromBinId(activeId,binStepBps)*10n**BigInt(c.m.base.decimals!)*10n**18n/(2n**128n*10n**BigInt(c.m.quote.decimals!)));
    console.log(json({model:"almm",createRequest:{binStepBps,activeId,feeBps},seedRequest:{pool:"REPLACE_WITH_CONFIRMED_POOL",maximumBaseRaw:String(b),maximumQuoteRaw:String(q),lowerBinId:activeId-width,upperBinId:activeId+width,slippageBps:c.m.policy.maxSlippageBps,maxActiveBinSlippage:0},note:"Raw ratio includes both decimals. Factory default fee must equal requested fee; no governance write.",signing:false}));
  }
});
