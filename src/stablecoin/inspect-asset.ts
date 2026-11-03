import { manifest,load,unresolved,json } from "./manifest.js";
import { context } from "./context.js";
import { main } from "../shared/run.js";
main(async()=>{
  const[file,...extra]=process.argv.slice(2);if(!file||extra.length)throw new Error("usage: <manifest.json>");const m=manifest(load(file)),missing=unresolved(m);
  if(missing.length){console.log(json({classification:"BLOCKED",id:m.id,missing,signing:false,rpc:false,note:"Issuer/address review remains unresolved; no fixture substitution"}));return;}
  const c=await context(file);console.log(json({classification:"PASSED_THIS_RUN",scope:"Manifest/runtime/decimals/proxy/configured risk reads only; not issuer approval or reserve attestation",origin:m.origin,assets:[m.base,m.quote],tokenStates:c.tokenStates,blockNumber:c.block.number,blockHash:c.block.hash,nativeGasBalance:await c.c.getBalance({address:c.caller}),tokenBalances:await Promise.all(c.tokenStates.map(async s=>({token:s.token,balance:await c.c.readContract({address:s.token,abi:(await import("viem")).erc20Abi,functionName:"balanceOf",args:[c.caller]})}))),signing:false}));
});
