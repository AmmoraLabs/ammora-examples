/** Prepare three new valueless test-asset/dependency deployments; never signs or sends. */
import { prepareSelfServiceTestAssets } from "./test-source.js";
import { cli, required, address, loadSelfServiceProfile } from "./context.js";
cli(import.meta.url, () => {
  const family = Number(process.argv[4] ?? "0");
  if (family !== 0 && family !== 1) throw new Error("Family must be0 or1");
  return prepareSelfServiceTestAssets(loadSelfServiceProfile(required(2, "profile.json")), address(required(3, "controller")), family);
});
