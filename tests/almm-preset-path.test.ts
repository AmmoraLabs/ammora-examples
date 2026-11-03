import test, { before, after } from "node:test";
const previousChain=process.env.AMMORA_CHAIN_ID, previousGeneration=process.env.AMMORA_GIWA_GENERATION;
before(()=>{process.env.AMMORA_CHAIN_ID="91342";process.env.AMMORA_GIWA_GENERATION="auto-route";});
after(()=>{if(previousChain===undefined)delete process.env.AMMORA_CHAIN_ID;else process.env.AMMORA_CHAIN_ID=previousChain;if(previousGeneration===undefined)delete process.env.AMMORA_GIWA_GENERATION;else process.env.AMMORA_GIWA_GENERATION=previousGeneration;});
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {manifest} from "../src/stablecoin/manifest.js";
import {almmDeployment} from "../src/stablecoin/almm-deployment.js";
import {presetRequest} from "../src/stablecoin/almm-readiness.js";
const fixture=()=>JSON.parse(readFileSync(new URL("../src/stablecoin/manifests/almm-lowfee.synthetic.json",import.meta.url),"utf8"));
test("isolated fixture is explicit; catalog/default behavior remains unchanged",()=>{
 const m=fixture(),f=almmDeployment(manifest(m));assert.equal(f.fixture.id,"almm-lowfee-test-v1");assert.notEqual(f.deployment.contracts.liquidityMarketMaker.factory,"0x63c9f1cab865d708a49df5304b59e91474860bde");
 delete m.deployment;const normal=almmDeployment(manifest(m));assert.equal(normal.fixture,undefined);assert.equal(normal.deployment.contracts.liquidityMarketMaker.factory.toLowerCase(),"0x63c9f1cab865d708a49df5304b59e91474860bde");
});
test("native issuer assets, arbitrary factory IDs, recipients or assets cannot select the synthetic fixture",()=>{
 for(const change of[(m:any)=>m.origin.kind="native-issuer",(m:any)=>m.deployment="unreviewed",(m:any)=>m.roles.liquidityOwner=m.quote.address,(m:any)=>m.id="native-pilot",(m:any)=>m.quote.address="0x"+"6".repeat(40)]){const m=fixture();change(m);assert.throws(()=>almmDeployment(manifest(m)));}
});
test("preset planner requires full hash and explicit share cap without changing governance",()=>{
 const r=JSON.parse(readFileSync(new URL("../src/stablecoin/fixtures/almm-lowfee-preset-request.json",import.meta.url),"utf8"));assert.equal(presetRequest(r).maxProtocolFeeShareBps,1000);
 for(const change of[(p:any)=>p.expectedPresetHash="0x",(p:any)=>p.maxProtocolFeeShareBps=2501,(p:any)=>p.activeId=-8388608,(p:any)=>p.configurePreset=true]){const p={...r};change(p);assert.throws(()=>presetRequest(p));}
 const source=readFileSync(new URL("../src/stablecoin/almm-readiness.ts",import.meta.url),"utf8");assert(!source.includes('functionName:"configurePreset"'));assert(source.includes("pairType:3"));
});

test("ALMM readiness uses the public SDK implementation", async () => {
 const local = await import("../src/stablecoin/almm-readiness-compat.js");
 const sdk = await import("@ammora-protocol/sdk");
 assert.equal(local.getALMMPresetReadiness, sdk.getALMMPresetReadiness);
 assert.equal(local.getALMMPositionReadiness, sdk.getALMMPositionReadiness);
});
