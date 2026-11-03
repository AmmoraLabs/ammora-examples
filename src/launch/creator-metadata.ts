/** launch:creator-metadata -- <curve> <metadataURI>. Only the recorded launch creator. */
import { AmmoraV4LaunchCurveClient, buildSetAmmoraV4CreatorMetadataURI } from "@ammora-protocol/sdk";
import { address, readBlock, reader, v4Deployment } from "../shared/env.js";
import { caller, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const [curveArg, metadataURI, ...extra]=process.argv.slice(2);
  if (!metadataURI || extra.length) throw new Error("usage: <curve> <metadataURI>");
  const curve=address("CURVE",curveArg), account=caller(), client=await reader(), c=v4Deployment().contracts.launch, block=await readBlock(client);
  const state=await new AmmoraV4LaunchCurveClient(client,curve,{launchFactory:c.factory,feePolicy:c.feePolicy}).getStateAtBlock(block.number);
  if(state.creator.toLowerCase()!==account.toLowerCase()) throw new Error("Only launch creator can update metadata");
  await execute("set creator metadata",{client,caller:account,allowedTargets:[c.factory]},buildSetAmmoraV4CreatorMetadataURI(c.factory,curve,metadataURI));
});
