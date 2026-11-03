import { makePlan } from "./plans.js";
import { load,json } from "./manifest.js";
import { main } from "../shared/run.js";
main(async()=>{const[file,input,...extra]=process.argv.slice(2);if(!file||!input||extra.length)throw new Error("usage: <manifest.json> <swap-request.json>");const p=await makePlan("swap",file,load(input));console.log(json({block:p.snapshot,quote:p.summary,minimumOutput:p.expectation.minimumOutput,recipient:p.expectation.recipient,signing:false,note:"Inspect only. Generate a saved swap plan separately for review/execution."}));});
