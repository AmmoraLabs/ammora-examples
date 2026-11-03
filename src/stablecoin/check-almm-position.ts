import { context } from "./context.js";
import { inspectPosition } from "./almm-readiness.js";
import { addr,raw,json } from "./manifest.js";
import { main } from "../shared/run.js";
main(async()=>{const[m,p,id,...extra]=process.argv.slice(2);if(!m||!p||!id||extra.length)throw new Error("usage: <manifest.json> <pool> <tokenId>");const c=await context(m,false,addr(p));console.log(json({...await inspectPosition(c,raw(id,false)),signing:false}));});
