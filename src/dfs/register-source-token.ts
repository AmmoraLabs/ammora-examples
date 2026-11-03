/** dfs:register-source-token -- <pool> <concentrated|compounding> <token> <probeRaw>.
 * Normal permissionless exact-transfer probe in the authenticated pool factory's registry.
 * Never changes an owner policy, registrar role, or aggregation admission. */
import { buildRegisterStandardToken } from "@ammora-protocol/sdk";
import { erc20Abi, parseAbi } from "viem";
import { arl, natural, execute } from "../shared/actions.js";
import { nonzero } from "../fees/policy.js";
import { main } from "../shared/run.js";
import { printJson } from "../shared/input.js";
const abi=parseAbi([
  "function tokenPolicyRegistry() view returns(address)",
  "function ownerPolicyConfigured(address) view returns(bool)",
  "function policy(address) view returns(uint8 kind,bool poolAllowed,bool routerAllowed,bool rewardAllowed)",
]);
main(async()=>{
  const [pool,kind,tokenArg,probeArg,...extra]=process.argv.slice(2);
  if(extra.length || !["concentrated","compounding"].includes(kind??""))throw new Error("usage: <pool> <concentrated|compounding> <token> <positiveProbeRaw>");
  const c=await arl(pool,kind as "concentrated"|"compounding"),token=nonzero(tokenArg,"token"),probe=natural(probeArg,"probeRaw",true);
  const provenance=await c.sdk.getPoolProvenance();
  const registry=await c.client.readContract({address:provenance.factory,abi,functionName:"tokenPolicyRegistry"});
  const policy=await c.client.readContract({address:registry,abi,functionName:"policy",args:[token]});
  const ownerConfigured=await c.client.readContract({address:registry,abi,functionName:"ownerPolicyConfigured",args:[token]});
  printJson({registry,token,policy,ownerConfigured,probe,warning:"Behavioral round trip only; does not prove immutable token behavior or grant aggregation admission"});
  if(ownerConfigured)throw new Error("Owner policy is sticky; never override it with a permissionless probe");
  if(policy[0]===1 && policy[1] && policy[2] && policy[3])return;
  if(policy[0]!==0)throw new Error("Only an unclassified token may use this example; preserve existing classifications");
  const balance=await c.client.readContract({address:token,abi:erc20Abi,functionName:"balanceOf",args:[c.caller]});
  if(balance<probe)throw new Error("Insufficient probe balance");
  await execute("register standard source token by exact round trip",{...c,allowedTargets:[registry]},
    {to:registry,...buildRegisterStandardToken(token,probe)},[{token,spender:registry,amount:probe}]);
});
