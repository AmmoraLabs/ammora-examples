import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, lstatSync, mkdirSync, openSync, closeSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Hex } from "viem";
import { canonical, invariant } from "./schema.js";
import type { AgentPolicy, Operation, Plan } from "./types.js";

/** Local single-host store. All processes using this signer must share this directory. */
export class AgentJournal {
  private readonly db: DatabaseSync;
  constructor(directory: string, readonly policy: AgentPolicy, policyDigest: Hex) {
    const root = resolve(directory); mkdirSync(root, { recursive: true, mode: 0o700 });
    const dir = lstatSync(root); invariant(!dir.isSymbolicLink() && dir.isDirectory() && !(dir.mode & 0o077), "JOURNAL_DIRECTORY_MUST_BE_PRIVATE");
    const file = join(root, "agent.sqlite");
    if (!existsSync(file)) closeSync(openSync(file, "wx", 0o600));
    const stat = lstatSync(file); invariant(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o600, "JOURNAL_FILE_MUST_BE_PRIVATE");
    this.db = new DatabaseSync(file); this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, digest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revoked_sessions (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, session TEXT NOT NULL, request TEXT NOT NULL, intent TEXT NOT NULL, body TEXT NOT NULL, raw TEXT, UNIQUE(session,request));
      CREATE TABLE IF NOT EXISTS wallet_lock (wallet TEXT PRIMARY KEY, operation TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reservations (operation TEXT PRIMARY KEY, session TEXT NOT NULL, asset TEXT NOT NULL, amount TEXT NOT NULL, native TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS created_configs (session TEXT NOT NULL, id TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(session,id));`);
    const found = this.db.prepare("SELECT digest FROM sessions WHERE id=?").get(policy.sessionId) as { digest: string } | undefined;
    invariant(!found || found.digest === policyDigest, "SESSION_POLICY_CHANGED_USE_NEW_SESSION");
    this.db.prepare("INSERT OR IGNORE INTO sessions VALUES (?,?)").run(policy.sessionId, policyDigest);
    chmodSync(file, 0o600);
  }
  close() { this.db.close(); }
  revoke() { this.db.prepare("INSERT OR IGNORE INTO revoked_sessions VALUES (?)").run(this.policy.sessionId); }
  isRevoked() { return !!this.db.prepare("SELECT id FROM revoked_sessions WHERE id=?").get(this.policy.sessionId); }
  invalidate(op: Operation) {
    op.phase = "RECONCILIATION_REQUIRED"; op.errorCode = "CANONICAL_RECEIPT_CHANGED"; delete op.result;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.update(op); this.db.prepare("INSERT OR IGNORE INTO wallet_lock VALUES (?,?)").run(`91342:${op.plan.account.toLowerCase()}`, op.plan.id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  newId() { return randomUUID(); }
  get(id: string): Operation {
    const row = this.db.prepare("SELECT body FROM operations WHERE id=? AND session=?").get(id, this.policy.sessionId) as { body: string } | undefined;
    invariant(row, "OPERATION_NOT_FOUND"); return JSON.parse(row.body) as Operation;
  }
  byRequest(request: string): Operation | undefined {
    const row = this.db.prepare("SELECT body FROM operations WHERE session=? AND request=?").get(this.policy.sessionId, request) as { body: string } | undefined;
    return row ? JSON.parse(row.body) as Operation : undefined;
  }
  insert(plan: Plan): Operation {
    const op: Operation = { plan, phase: "PLANNED" };
    this.db.prepare("INSERT INTO operations(id,session,request,intent,body) VALUES (?,?,?,?,?)").run(plan.id, this.policy.sessionId, plan.requestId, plan.intentDigest, canonical(op)); return op;
  }
  update(op: Operation) {
    const result = this.db.prepare("UPDATE operations SET body=? WHERE id=? AND session=?").run(canonical(op), op.plan.id, this.policy.sessionId);
    invariant(result.changes === 1, "OPERATION_NOT_FOUND");
  }
  replacePlan(plan: Plan, previousDigest: Hex) {
    const result = this.db.prepare("UPDATE operations SET body=? WHERE id=? AND session=? AND json_extract(body,'$.plan.digest')=? AND json_extract(body,'$.phase') IN ('PLANNED','AUTHORIZED')")
      .run(canonical({ plan, phase: "PLANNED" }), plan.id, this.policy.sessionId, previousDigest);
    invariant(result.changes === 1, "ATTEMPT_EXISTS_RECONCILE");
  }
  configHash(id: string): Hex | undefined {
    const row = this.db.prepare("SELECT hash FROM created_configs WHERE session=? AND id=?").get(this.policy.sessionId, id) as { hash: Hex } | undefined;
    return row?.hash;
  }
  rememberConfig(id: string, hash: Hex) { this.db.prepare("INSERT OR IGNORE INTO created_configs VALUES (?,?,?)").run(this.policy.sessionId, id, hash); }
  authorize(id: string, digest: Hex) {
    const op = this.get(id); invariant(["PLANNED", "AUTHORIZED"].includes(op.phase) && op.plan.digest === digest, "AUTHORIZATION_PLAN_MISMATCH");
    invariant(op.plan.status === "READY", "PLAN_NOT_READY"); op.phase = "AUTHORIZED";
    const changed = this.db.prepare("UPDATE operations SET body=? WHERE id=? AND session=? AND json_extract(body,'$.plan.digest')=? AND json_extract(body,'$.phase') IN ('PLANNED','AUTHORIZED')")
      .run(canonical(op), id, this.policy.sessionId, digest);
    invariant(changed.changes === 1, "ATTEMPT_EXISTS_RECONCILE");
  }
  reserve(id: string, nonce: number, nativeMaximum: bigint) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const op = this.get(id), p = op.plan, wallet = `91342:${p.account.toLowerCase()}`;
      invariant(op.phase === "AUTHORIZED", "OPERATION_NOT_AUTHORIZED");
      invariant(!this.db.prepare("SELECT operation FROM wallet_lock WHERE wallet=?").get(wallet), "SIGNER_HAS_UNRESOLVED_OPERATION");
      const rows = this.db.prepare("SELECT asset,amount,native FROM reservations WHERE session=?").all(this.policy.sessionId) as { asset: string; amount: string; native: string }[];
      invariant(rows.length < this.policy.maxTransactions, "SESSION_TRANSACTION_CAP");
      invariant(nativeMaximum <= BigInt(this.policy.maxNativePerTransactionWei) && rows.reduce((n, r) => n + BigInt(r.native), 0n) + nativeMaximum <= BigInt(this.policy.maxNativeSessionWei), "SESSION_NATIVE_CAP");
      const asset = p.input?.token.toLowerCase() ?? "none", amount = BigInt(p.input?.maximumRaw ?? "0");
      invariant(!p.input || rows.filter(r => r.asset === asset).reduce((n, r) => n + BigInt(r.amount), 0n) + amount <= BigInt(p.input.sessionLimitRaw), "SESSION_ASSET_CAP");
      this.db.prepare("INSERT INTO wallet_lock VALUES (?,?)").run(wallet, id);
      this.db.prepare("INSERT INTO reservations VALUES (?,?,?,?,?)").run(id, this.policy.sessionId, asset, String(amount), String(nativeMaximum));
      op.phase = "SIGNING"; op.nonce = nonce; this.update(op); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  signed(id: string, raw: Hex, hash: Hex) {
    const op = this.get(id); invariant(op.phase === "SIGNING", "INVALID_SIGNING_PHASE"); op.phase = "SIGNED"; op.hash = hash;
    this.db.exec("BEGIN IMMEDIATE");
    try { this.update(op); this.db.prepare("UPDATE operations SET raw=? WHERE id=?").run(raw, id); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  finish(op: Operation) {
    invariant(["CONFIRMED", "REVERTED", "CANCELLED"].includes(op.phase), "UNRESOLVED_OPERATION");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.update(op); this.db.prepare("UPDATE operations SET raw=NULL WHERE id=?").run(op.plan.id);
      this.db.prepare("DELETE FROM wallet_lock WHERE operation=?").run(op.plan.id);
      const unresolved = this.db.prepare("SELECT id FROM operations WHERE lower(json_extract(body,'$.plan.account'))=? AND json_extract(body,'$.phase') IN ('SIGNING','SIGNED','SUBMITTED','RECONCILIATION_REQUIRED') LIMIT 1")
        .get(op.plan.account.toLowerCase()) as { id: string } | undefined;
      if (unresolved) this.db.prepare("INSERT OR IGNORE INTO wallet_lock VALUES (?,?)").run(`91342:${op.plan.account.toLowerCase()}`, unresolved.id);
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    // Reservations remain charged at conservative upper bounds, including failed gas.
  }
}
