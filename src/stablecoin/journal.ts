import { openSync, closeSync, writeSync, fsyncSync, renameSync, mkdirSync, unlinkSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Address } from "viem";
import { json } from "./manifest.js";

export type Journal={schemaVersion:1;chainId:91342;caller:Address;reviewHash:string;operation:string;status:string;entries:{to:Address;data:`0x${string}`;value:string;phase:string;actionIndex?:number;nonce?:number;hash?:`0x${string}`;blockNumber?:string;blockHash?:`0x${string}`}[]};
export function durable(file:string,value:unknown):void {
  const tmp=file+"."+randomUUID()+".tmp",fd=openSync(tmp,"wx",0o600);
  try{writeSync(fd,json(value)+"\n");fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(tmp,file);const dir=openSync(resolve(file,".."),"r");try{fsyncSync(dir);}finally{closeSync(dir);}
}
/** All processes for an account MUST share this local directory; multi-host senders need a CAS store. */
export function reserve(directory:string,caller:Address,reviewHash:string,operation:string) {
  if(!/^0x[\da-fA-F]{40}$/.test(caller)||!/^[a-f0-9]{64}$/.test(reviewHash))throw new Error("Invalid journal identity");
  const root=resolve(directory);mkdirSync(root,{recursive:true,mode:0o700});
  const lock=join(root,"91342-"+caller.toLowerCase()+".lock"),file=join(root,reviewHash+".json"),fd=openSync(lock,"wx",0o600);
  try{writeSync(fd,json({chainId:91342,caller,reviewHash,file})+"\n");fsyncSync(fd);}finally{closeSync(fd);}
  try{const f=openSync(file,"wx",0o600);fsyncSync(f);closeSync(f);}catch(error){unlinkSync(lock);throw error;}
  const value:Journal={schemaVersion:1,chainId:91342,caller,reviewHash,operation,status:"RESERVED",entries:[]};durable(file,value);
  return {file,value,save:()=>durable(file,value),complete:()=>{if(value.entries.some(e=>e.phase!=="CONFIRMED"))throw new Error("Cannot release unknown/pending journal");value.status="COMPLETE";durable(file,value);unlinkSync(lock);}};
}
export function readJournal(file:string):Journal {return JSON.parse(readFileSync(file,"utf8")) as Journal;}
