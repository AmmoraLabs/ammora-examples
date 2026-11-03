import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";

// Export a fresh, keyless project. Never copy node_modules, .env or journals.
const root = process.cwd();
const destination = process.argv[2];
if (!destination || process.argv.length !== 3) throw new Error("usage: node scripts/package-agent.mjs <new-directory>");
const out = path.resolve(destination);
if (fs.existsSync(out)) throw new Error("Destination already exists; preserve it and choose a new directory");
const files = new Set();
function visit(relative) {
  if (files.has(relative)) return;
  if (!relative.startsWith("src/") || relative.includes("..") || !relative.endsWith(".ts")) throw new Error("Unexpected source dependency");
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  if (/import\s+["']dotenv|from\s+["'][^"']*(?:env|signer-store)["']/.test(source)) throw new Error("Unexpected environment/signer dependency");
  files.add(relative);
  const parsed = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true);
  for (const node of parsed.statements) {
    if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const specifier = node.moduleSpecifier.text;
    if (specifier.startsWith(".")) visit(path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier.replace(/\.js$/, ".ts"))));
  }
}
for (const file of ["src/agent/index.ts", "src/agent/cli.ts", "src/agent/list-tools.ts"]) visit(file);
for (const file of [...files, "src/agent/policy.example.json", "LICENSE", ".nvmrc"]) {
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const version = name => lock.packages[`node_modules/${name}`].version;
const pkg = {
  name: "ammora-agent-starter", version: "1.0.0", private: true, type: "module", engines: { node: ">=24.18.0 <25" },
  scripts: { typecheck: "tsc --noEmit", "agent:tools": "node --import tsx src/agent/list-tools.ts", "agent:tool": "node --import tsx src/agent/cli.ts" },
  dependencies: { "@ammora-protocol/sdk": "0.3.8", viem: version("viem") },
  devDependencies: { "@types/node": version("@types/node"), tsx: version("tsx"), typescript: version("typescript") },
};
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
const config = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
config.include = ["src"];
fs.writeFileSync(path.join(out, "tsconfig.json"), JSON.stringify(config, null, 2) + "\n");
fs.writeFileSync(path.join(out, ".gitignore"), "node_modules/\n.agent-state/\n*.local.json\n*.sqlite*\n.env*\n");
fs.writeFileSync(path.join(out, "README.md"), `# Ammora agent starter

Public SDK 0.3.8, GIWA Sepolia 91342, direct contracts. No Ammora API or
individual Config approval is required for the supported WETH launch path.
New quote assets/custom callbacks remain subject to deployed protocol policy.

Use Node 24.18.0. Install with \`npm install --ignore-scripts --no-audit --no-fund\`
(or \`npm ci\` with the validated accompanying lockfile), then run
\`npm run typecheck\` and \`npm run --silent agent:tools\`.

Import \`connectAgent\`, \`toolDefinitions\`, \`createLaunchpadConfig\`,
\`createToken\`, \`createTokenAndFirstBuy\`, \`createConfigAndFirstBuy\`,
\`buy\`, \`sell\`, \`finalFill\`, \`graduate\`, \`claimLaunchFees\` and
\`claimLpFees\` from \`./src/agent/index.js\` in your TypeScript application.
The files under \`src/agent/examples/\` show the host integration.

Copy \`src/agent/policy.example.json\` to \`agent.policy.local.json\` and replace
the public address placeholders, session expiry, Config identity and economic
limits. Read the chosen template, explicitly set your own Config owner and
Partner/LP/leftover recipients, then save the canonical created Config ID/hash.
The word approval in the agent policy means your wallet owner's consent, not
an Ammora onboarding request. Never use validation wallets as your recipients.

Provide your own gas ETH and separate WETH balance. Inject your wallet signer
only into trusted host code. No signer, credential, environment file, signed
transaction or journal is included. Register only the tools with the model;
owner authorization stays in the host. Reconcile uncertain attempts rather
than signing again. A single wallet requires a shared private journal.

The CLI is keyless. It can read/plan/reconcile but cannot send transactions.
The full lifecycle and qualification report are in the accompanying source
repository's AGENT-LAUNCHPAD.md; GitHub access currently requires an invitation.
Existing public non-agent examples are available at
https://docs.ammora.org/guides/launchpad . This archive is not a public-site deployment.
`);
const entries = [...files].sort().map(file => ({ file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(out, file))).digest("hex") }));
fs.writeFileSync(path.join(out, "SOURCE-MANIFEST.json"), JSON.stringify({ sdk: "0.3.8", files: entries }, null, 2) + "\n");
console.log(JSON.stringify({ destination: out, sourceFiles: entries.length, sdk: "0.3.8", keysIncluded: false }));
