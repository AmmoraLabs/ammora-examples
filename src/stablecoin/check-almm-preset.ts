import { context } from "./context.js";
import { inspectPreset } from "./almm-readiness.js";
import { load,json } from "./manifest.js";
import { main } from "../shared/run.js";
main(async()=>{const[m,r,...extra]=process.argv.slice(2);if(!m||!r||extra.length)throw new Error("usage: <manifest.json> <preset-request.json>");const c=await context(m);console.log(json({...await inspectPreset(c,load(r)),signing:false}));});
