import test from "node:test";
import assert from "node:assert/strict";
import type { Abi, PublicClient } from "viem";
import { ammConcentratedPoolV3Abi } from "@ammora-protocol/sdk";
import { withRevenueReadCompatibility } from "../src/revenue/read-compatibility.js";
const target = "0x1111111111111111111111111111111111111111" as const;
test("revenue reader adds only missing creator view without mutating published ABI", async () => {
  const before = JSON.stringify(ammConcentratedPoolV3Abi);
  const calls: unknown[] = [];
  const client = { readContract: async (parameters: { abi: readonly {type:string;name?:string}[]; functionName:string }) => {
    calls.push(parameters);
    assert(parameters.abi.some(item=>item.type==="function"&&item.name==="creator")); return target;
  } } as unknown as PublicClient;
  const compatible = withRevenueReadCompatibility(client);
  // Published SDK internally requests this undeclared view; this is the ABI edge under test.
  const result = await compatible.readContract({ address:target, abi:[] as Abi, functionName:"creator" });
  assert.equal(result,target); assert.equal(calls.length,1);
  assert.equal(JSON.stringify(ammConcentratedPoolV3Abi),before);
});
test("revenue reader preserves provenance/treasury/transaction boundaries and existing declarations", async () => {
  const calls: unknown[] = [];
  const client = { readContract: async (parameters: unknown) => { calls.push(parameters); return true; } } as unknown as PublicClient;
  const compatible = withRevenueReadCompatibility(client);
  for (const functionName of ["isPool","protocolFee2Route","claimable","unsupportedView"] as const) {
    const parameters={address:target,abi:[] as Abi,functionName};
    await compatible.readContract(parameters); assert.equal(calls.at(-1),parameters);
  }
  const existing={address:target,abi:[{type:"function",name:"creator",stateMutability:"view",inputs:[],outputs:[{type:"address"}]}] as const,functionName:"creator" as const};
  await compatible.readContract(existing); assert.equal(calls.at(-1),existing);
});
