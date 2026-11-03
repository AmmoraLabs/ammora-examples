import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import type { AmmoraDeployment } from "@ammora-protocol/sdk";
import { giwaSepoliaPermissionless, giwaSepoliaAutoRouteDeployment, giwaSepoliaAutoRouteRuntimeHashes } from "@ammora-protocol/sdk";

type Decoder = (snapshot: unknown, target: AmmoraDeployment, generation: string) => Record<string, string>;
const names = ["verify-deployment", "create-launch", "safe-swap"];
const snapshot = JSON.parse(await readFile(new URL("../src/quickstart/runtime-pins.giwa.json", import.meta.url), "utf8"));
const decoders: Decoder[] = await Promise.all(names.map(async name => {
  // Exercise the standalone decoders without running a CLI or constructing a signer.
  const path = `src/quickstart/${name}.ts`;
  const source = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(d => d.name.getText(source) === "readRuntimePins"));
  assert.ok(declaration, `${name} needs a standalone local pin decoder`);
  const compiled = ts.transpileModule(declaration.getText(source).replace(/^export\s+/, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(`${compiled}\nreturn readRuntimePins;`)() as Decoder;
}));

test("each standalone contract example covers 29 legacy and 30 auto-route runtimes including the reviewed first-buy helper from local reviewed data", () => {
  for (const decode of decoders) {
    assert.equal(Object.keys(decode(snapshot, giwaSepoliaPermissionless, "legacy")).length, 29);
    const pins = decode(snapshot, giwaSepoliaAutoRouteDeployment, "auto-route");
    assert.equal(Object.keys(pins).length, 30);
    for (const [address, expected] of Object.entries(giwaSepoliaAutoRouteRuntimeHashes)) {
      if (pins[address.toLowerCase()]) assert.equal(pins[address.toLowerCase()], expected);
    }
  }
});

test("local pin input cannot cross chain/generation/source identity or silently omit a runtime", () => {
  for (const decode of decoders) {
    assert.throws(() => decode(snapshot, giwaSepoliaPermissionless, "auto-route"), /snapshot/);
    assert.throws(() => decode({ ...snapshot, chainId: "1" }, giwaSepoliaPermissionless, "legacy"), /snapshot/);
    const changed = structuredClone(snapshot);
    changed.deployments.legacy.sourceCommit = "unreviewed";
    assert.throws(() => decode(changed, giwaSepoliaPermissionless, "legacy"), /snapshot/);
    const missing = structuredClone(snapshot);
    delete missing.deployments.legacy.runtimeCodeHashes[giwaSepoliaPermissionless.contracts.launch.factory.toLowerCase()];
    assert.throws(() => decode(missing, giwaSepoliaPermissionless, "legacy"), /Missing reviewed runtime pin/);
  }
});

test("malformed or conflicting case aliases fail before RPC instead of accepting a weaker pin map", () => {
  for (const decode of decoders) {
    const malformed = structuredClone(snapshot);
    malformed.deployments.legacy.runtimeCodeHashes[giwaSepoliaPermissionless.contracts.launch.factory.toLowerCase()] = "0x00";
    assert.throws(() => decode(malformed, giwaSepoliaPermissionless, "legacy"), /Malformed/);
    const conflict = structuredClone(snapshot);
    const address = giwaSepoliaPermissionless.contracts.launch.factory;
    conflict.deployments.legacy.runtimeCodeHashes["0x" + address.slice(2).toUpperCase()] = "0x" + "f".repeat(64);
    assert.throws(() => decode(conflict, giwaSepoliaPermissionless, "legacy"), /Conflicting/);
  }
});
