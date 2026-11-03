import { ALMMClient, DammV2Client } from "@ammora-protocol/sdk";
import { context,withdrawalBoundary } from "./context.js";
import { addr,raw,json } from "./manifest.js";
import { main } from "../shared/run.js";
main(async()=>{const[file,pool,id,namespace,...extra]=process.argv.slice(2);if(!file||!pool||!id||extra.length)throw new Error("usage: <manifest.json> <pool> <tokenId> <managed|raw|almm>");const c=await context(file,false,addr(pool)),tokenId=raw(id,false);
  const position=c.sdk instanceof ALMMClient&&namespace==="almm"?await c.sdk.getPositionContext(tokenId,c.caller):c.sdk instanceof DammV2Client&&namespace==="managed"?await c.sdk.getManagedConcentratedPosition(tokenId):c.sdk instanceof DammV2Client&&namespace==="raw"?await c.sdk.getPosition(tokenId):(()=>{throw new Error("Model/NFT namespace mismatch");})();
  let withdrawal;
  if(c.sdk instanceof DammV2Client&&c.state&&"totalLiquidity"in c.state){
    if(!position||typeof position!=="object")throw new Error("Missing SDK position state");
    const p=position as Record<string,unknown>,available=p.unlockedLiquidity??p.liquidity,total=c.state.totalLiquidity;
    if(typeof total!=="bigint"||typeof available!=="bigint")throw new Error("Missing SDK liquidity fields");
    withdrawal=withdrawalBoundary(total,available);
  }
  console.log(json({blockNumber:c.block.number,blockHash:c.block.hash,pool,namespace,collection:namespace==="raw"?pool:c.manager,tokenId,position,withdrawal,signing:false}));});
