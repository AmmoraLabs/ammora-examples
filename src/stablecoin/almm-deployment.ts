import { readFileSync } from "node:fs";
import { createAmmoraDeploymentSource, type AmmoraDeployment } from "@ammora-protocol/sdk";
import { deployment,clientOptions } from "../shared/env.js";
import { same,hash,addr,type Manifest } from "./manifest.js";
/** Opt-in, fixed reviewed synthetic fixture. Never selected for native issuer assets or by an arbitrary address env var. */
export function almmDeployment(m:Manifest){
  const catalog=deployment();
  if(!m.deployment)return{deployment:catalog,options:clientOptions(),fixture:undefined};
  const f=JSON.parse(readFileSync(new URL("./fixtures/almm-lowfee-giwa-v1.json",import.meta.url),"utf8"));
  if(m.deployment!==f.id||m.model!=="almm"||m.origin.kind!=="synthetic-test"||m.id!==f.id||!same(m.roles.liquidityOwner??"",f.owner)||!same(m.base.address??"",f.baseToken)||!same(m.quote.address??"",f.quoteToken))throw new Error("Manifest does not match the isolated synthetic fixture; canonical catalog remains the default");
  for(const[a,h]of Object.entries(f.runtimeCodeHashes)){addr(a);hash(h);}
  const selected:AmmoraDeployment={...catalog,contracts:{...catalog.contracts,liquidityMarketMaker:{...catalog.contracts.liquidityMarketMaker,deployer:addr(f.deployer),factory:addr(f.factory),positionManager:addr(f.manager),rewardManager:addr(f.reward),binLens:addr(f.binLens)},policy:{tokenPolicyRegistry:addr(f.registry)}},security:{runtimeCodeHashes:f.runtimeCodeHashes}};
  return{deployment:selected,options:{deploymentSource:createAmmoraDeploymentSource([selected])},fixture:f};
}
