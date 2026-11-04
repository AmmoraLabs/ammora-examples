/** List admitted standards without invitation, wallet or platform approval. */
import { fromProfileFile, cli, required } from "./context.js";
export const listSelfServiceStandards = (client: ReturnType<typeof fromProfileFile>["admission"], offset = 0) => client.listStandards(offset, 8);
cli(import.meta.url, async () => { const c = fromProfileFile(required(2, "profile.json")), offset = Number(process.argv[3] ?? 0); if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Offset must be a nonnegative integer"); return { ...await listSelfServiceStandards(c.admission, offset), stats: c.stats(), executionApproved: false }; });
