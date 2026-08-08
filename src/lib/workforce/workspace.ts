import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const ROOT = resolve(process.env.AGENT_WORKSPACE_ROOT || "/tmp/telun-agent-workspaces");
function safeJobId(jobId: string) { if (!/^[a-zA-Z0-9_-]{5,80}$/.test(jobId)) throw new Error("INVALID_JOB_ID"); return jobId; }
function targetPath(jobId: string, relative: string) {
  if (!relative || relative.includes("\0") || relative.split(/[\\/]/).includes("..")) throw new Error("WORKSPACE_PATH_BLOCKED");
  const base = resolve(ROOT, safeJobId(jobId));
  const target = resolve(base, relative);
  if (target !== base && !target.startsWith(base + sep)) throw new Error("WORKSPACE_PATH_BLOCKED");
  return { base, target };
}
export async function writeJobFile(jobId: string, relative: string, content: string) {
  if (Buffer.byteLength(content) > 2_000_000) throw new Error("WORKSPACE_FILE_TOO_LARGE");
  const { base, target } = targetPath(jobId, relative); await mkdir(base, { recursive: true });
  const parent = target.slice(0, target.lastIndexOf(sep)); await mkdir(parent, { recursive: true });
  await writeFile(target, content, { encoding: "utf8", flag: "wx" }); return target;
}
export async function readJobFile(jobId: string, relative: string) {
  const { target } = targetPath(jobId, relative); const data = await readFile(target);
  if (data.byteLength > 2_000_000) throw new Error("WORKSPACE_FILE_TOO_LARGE"); return data.toString("utf8");
}
