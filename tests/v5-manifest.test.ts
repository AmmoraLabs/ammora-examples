import test from "node:test";
import assert from "node:assert/strict";
import { parseV5Manifest } from "../src/arl-v5/manifest.js";
const address = "0x1111111111111111111111111111111111111111";
const hash = `0x${"12".repeat(32)}`;
const fixture = (startBlock: unknown) => JSON.stringify({schemaVersion:1,abiVersion:"arl-public-v5.1",chainId:91342,revision:"json-input",contracts:Object.fromEntries(["factory","implementation","controller","vault","tokenPolicy","feePolicy"].map((role,index)=>[role,{address:`0x${String(index+1).padStart(40,"0")}`,runtimeCodeHash:hash,startBlock}])),capabilities:{version:1,revision:"read-only",mode:"read-only",actions:[],reason:"fixture"}});
test("V5 manifest converts JSON decimal blocks before published SDK validation", () => {
 assert.equal(parseV5Manifest(fixture("36388500")).contracts.factory.startBlock,36388500n);
 assert.equal(parseV5Manifest(fixture(36388500)).contracts.factory.startBlock,36388500n);
});
test("V5 manifest rejects unsafe, signed, fractional or ambiguous block inputs", () => {
 for (const value of ["-1","1e6","01","1.5",9007199254740992,-1,null]) assert.throws(()=>parseV5Manifest(fixture(value)));
 assert.throws(()=>parseV5Manifest("{broken"));
 const duplicate=JSON.parse(fixture("1"));duplicate.contracts.vault.address=duplicate.contracts.factory.address;assert.throws(()=>parseV5Manifest(JSON.stringify(duplicate)),/conflicting/);
 const bad=JSON.parse(fixture("1"));bad.contracts.factory.runtimeCodeHash="0x12";
 assert.throws(()=>parseV5Manifest(JSON.stringify(bad)));
});
