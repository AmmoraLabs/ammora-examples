/** launch:config-enabled -- <configId> true|false. Only the Config owner; existing launches retain their immutable Config. */
import { buildSetAmmoraV4ConfigEnabled, getAmmoraV4ConfigAtBlock } from "@ammora-protocol/sdk";
import { readBlock, reader, v4Deployment } from "../shared/env.js";
import { caller, natural, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const [id, enabled, ...extra] = process.argv.slice(2);
  if (extra.length || !["true", "false"].includes(enabled ?? "")) throw new Error("usage: <configId> true|false");
  const account=caller(), client=await reader(), c=v4Deployment().contracts.launch, block=await readBlock(client), configId=natural(id,"configId",true);
  const config=await getAmmoraV4ConfigAtBlock(client,c.configRegistry,configId,block.number);
  if (config.identity.owner.toLowerCase()!==account.toLowerCase()) throw new Error("Only Config owner can change enabled");
  await execute("set Config enabled",{client,caller:account,allowedTargets:[c.configRegistry]},buildSetAmmoraV4ConfigEnabled(c.configRegistry,configId,enabled==="true"));
});
