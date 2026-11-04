import ts from "typescript";
import * as sdk from "@ammora-protocol/sdk";
import * as integrate from "@ammora-protocol/sdk/integrate";
import * as partner from "@ammora-protocol/sdk/partner";
import * as adapters from "@ammora-protocol/sdk/partner-adapters";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { createHash } from "node:crypto";

const walk = (root) => readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(root, entry.name)) : [join(root, entry.name)]);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const sdkVersion = "0.3.9";
const sdkIntegrity = "sha512-+0zBuXCNpa62oy5hmGx4w/jGnqxIedPTCuIrICWcpWfjVUAAGluo78MSHHxh6pORpkpc4gowtjOn4TIgepCY3Q==";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const installed = JSON.parse(readFileSync("node_modules/@ammora-protocol/sdk/package.json", "utf8"));
const math = JSON.parse(readFileSync("node_modules/@ammora-protocol/math/package.json", "utf8"));
const lockedSdk = lock.packages["node_modules/@ammora-protocol/sdk"];
if (pkg.dependencies["@ammora-protocol/sdk"] !== sdkVersion
  || lock.packages[""].dependencies["@ammora-protocol/sdk"] !== sdkVersion
  || lockedSdk.version !== sdkVersion || lockedSdk.integrity !== sdkIntegrity
  || lockedSdk.resolved !== `https://registry.npmjs.org/@ammora-protocol/sdk/-/sdk-${sdkVersion}.tgz`
  || installed.version !== sdkVersion || installed.dependencies["@ammora-protocol/math"] !== "0.3.0"
  || lock.packages["node_modules/@ammora-protocol/math"].version !== "0.3.0" || math.version !== "0.3.0") {
  throw new Error("SDK dependency, registry lock integrity and installed SDK/math must match reviewed SDK 0.3.9 / math 0.3.0");
}
const manifest = JSON.parse(readFileSync("node_modules/@ammora-protocol/sdk/dist/build-manifest.json", "utf8"));
for (const [file, expected] of Object.entries(manifest.distributionSha256)) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(file)
    || createHash("sha256").update(readFileSync(`node_modules/@ammora-protocol/sdk/dist/${file}`)).digest("hex") !== expected) {
    throw new Error(`Installed SDK distribution integrity failed: ${file}`);
  }
}
const entries = new Map(Object.entries(pkg.scripts).flatMap(([command, script]) => script.startsWith("tsx src/") ? [[script.slice(4), command]] : []));
const imported = new Set();
const rows = [];
for (const path of walk("src").filter((path) => path.endsWith(".ts")).sort()) {
  const text = readFileSync(path, "utf8");
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const imports = [];
  for (const node of file.statements) {
    if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const specifier = node.moduleSpecifier.text;
    if (specifier.startsWith(".")) {
      const target = normalize(join(dirname(path), specifier.replace(/\.js$/, ".ts")));
      if (!existsSync(target)) throw new Error(`${path} imports missing ${target}`);
      imported.add(target);
    }
    if (specifier in { "@ammora-protocol/sdk": sdk, "@ammora-protocol/sdk/integrate": integrate, "@ammora-protocol/sdk/partner": partner, "@ammora-protocol/sdk/partner-adapters": adapters }) {
      const runtime = ({ "@ammora-protocol/sdk": sdk, "@ammora-protocol/sdk/integrate": integrate, "@ammora-protocol/sdk/partner": partner, "@ammora-protocol/sdk/partner-adapters": adapters })[specifier];
      if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        for (const binding of node.importClause.namedBindings.elements) {
          const name = (binding.propertyName ?? binding.name).text;
          imports.push(name);
          if (!node.importClause.isTypeOnly && !binding.isTypeOnly && !(name in runtime)) throw new Error(`${path} imports unpublished runtime export ${name}`);
        }
      }
    }
    if (path.startsWith("src/quickstart/") && specifier.startsWith(".")) throw new Error(`${path} must remain copyable without local helpers`);
  }
  rows.push({ file: path, command: entries.get(path) ?? null, sdkImports: imports, sha256: createHash("sha256").update(text).digest("hex"), status: "PASSED_THIS_RUN", scope: "Published exports, local imports, command registration; type safety is a separate gate" });
}
for (const [path] of entries) if (!existsSync(path)) throw new Error(`Missing command target ${path}`);
for (const row of rows) if (!row.command && !imported.has(row.file)) throw new Error(`Unreachable example/helper ${row.file}`);
mkdirSync(".validation", { recursive: true });
writeFileSync(".validation/file-audit.json", `${JSON.stringify(rows, null, 2)}\n`);
console.log(`Audited ${rows.length} TypeScript files and ${entries.size} registered example commands against npm SDK ${pkg.dependencies["@ammora-protocol/sdk"]}.`);
