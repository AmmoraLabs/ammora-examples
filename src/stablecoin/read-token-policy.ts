import { context } from "./context.js";
import { json } from "./manifest.js";
import { main } from "../shared/run.js";
main(async()=>{const[file,...extra]=process.argv.slice(2);if(!file||extra.length)throw new Error("usage: <manifest.json>");const c=await context(file);console.log(json({factory:c.factory,registry:c.registry,blockNumber:c.block.number,blockHash:c.block.hash,assets:c.tokenStates,note:"pool/router/reward and aggregation are separate admissions; a probe does not verify issuer provenance",signing:false}));});
