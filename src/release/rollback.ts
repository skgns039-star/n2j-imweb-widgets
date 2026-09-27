/* 이전 불변 태그 자산을 검증하고 registry를 직접 되돌린다. 새 태그는 만들지 않는다. */
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { stringify } from "yaml";
import { p, manifest, gateBlock } from "./paths.ts";
import { assertApproved, consumeApproval, canonical } from "./approval.ts";
import { buildRegistry, writeRegistry } from "./registry.ts";
import { registryHash, publishRegistry, assertEmptyIndex } from "./deploy.ts";
import { sha256, sri } from "./hash.ts";
import { verify } from "./verify.ts";
import type { IntegrityRecord } from "./build.ts";
import { emptyReport, writeReport, summarize, type ActionReport } from "./report.ts";

function prepare(widget_id: string, to: string) {
  const m = manifest();
  const w = m.widgets.find((x) => x.widget_id === widget_id);
  if (!w || !/^[a-z0-9][a-z0-9-]*$/.test(widget_id) || !/^(off|\d+\.\d+\.\d+)$/.test(to)) throw new Error("BLOCKED: 잘못된 롤백 대상");
  const from = w.version;
  const files = new Map<string, Buffer>();
  const records: Record<string, IntegrityRecord> = {};
  if (to === "off") w.enabled = false;
  else {
    const tag = `w-${widget_id}-${to}`;
    const blob = (path: string) => execFileSync("git", ["show", `${tag}:${path}`], { cwd: p(), stdio: ["ignore", "pipe", "pipe"] });
    const raw = blob(`integrity/${widget_id}.json`);
    const rec = JSON.parse(raw.toString()) as IntegrityRecord;
    if (rec.widget_id !== widget_id || rec.version !== to || !rec.files?.length) throw new Error("BLOCKED: 이전 무결성 기록 불일치");
    for (const f of rec.files) {
      if (!/^[a-zA-Z0-9_./-]+$/.test(f.name) || f.name.includes("..") || f.name.startsWith("/")) throw new Error("BLOCKED: 자산 경로 이탈");
      const data = blob(`dist/${widget_id}/${to}/${f.name}`);
      const source = blob(`src/widgets/${widget_id}/${f.name}`);
      if (sha256(data) !== f.dist_sha256 || sha256(source) !== f.source_sha256 || f.dist_sha256 !== f.source_sha256 || sri(data) !== f.sri) {
        throw new Error("BLOCKED: 이전 태그 해시 불일치");
      }
      files.set(`dist/${widget_id}/${to}/${f.name}`, data);
      files.set(`src/widgets/${widget_id}/${f.name}`, source);
    }
    files.set(`integrity/${widget_id}.json`, raw);
    records[widget_id] = rec;
    w.version = to; w.enabled = true;
  }
  const registry = buildRegistry(m, records);
  files.set("manifest/widgets.yaml", Buffer.from(stringify(m)));
  return { files, registry, from, version: w.version };
}

export function rollbackPayload(widget_id: string, to: string): Record<string, unknown> {
  const plan = prepare(widget_id, to);
  return { widget_id, to, registry_sha256: registryHash(plan.registry),
    rollback_sha256: sha256(canonical({ current: manifest(), head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: p(), encoding: "utf8" }).trim(),
      files: [...plan.files].map(([file, data]) => [file, sha256(data)]) })) };
}

export async function rollback(widget_id: string, to: string, approvalId?: string, signal?: AbortSignal): Promise<ActionReport> {
  const rep = emptyReport("rollback", widget_id);
  rep.approval = { required: true, id: approvalId ?? "", status: "PENDING" };
  const backups = new Map<string, Buffer | null>();
  let publishing = false;
  try {
    signal?.throwIfAborted();
    const blocked = gateBlock("cdn_deploy");
    if (blocked) throw new Error(`BLOCKED: ${blocked}`);
    assertApproved(approvalId, "rollback", rollbackPayload(widget_id, to));
    assertEmptyIndex();
    const plan = prepare(widget_id, to);
    const permit = consumeApproval(approvalId, "rollback", rollbackPayload(widget_id, to));
    rep.approval.status = "APPROVED";
    rep.version_from = plan.from; rep.version_to = plan.version;
    for (const file of [...plan.files.keys(), "registry.json"]) backups.set(file, existsSync(p(file)) ? readFileSync(p(file)) : null);
    for (const [file, data] of plan.files) { mkdirSync(dirname(p(file)), { recursive: true }); writeFileSync(p(file), data); }
    const points = await verify({ signal });
    if (!points.length || points.some((x) => !x.ok)) throw new Error("BLOCKED: 롤백 자산 4지점 검증 실패");
    const reg = writeRegistry();
    publishing = true;
    if (!(await publishRegistry(reg.updated_at, permit, [...plan.files.keys(), "registry.json"], signal))) throw new Error("BLOCKED: 롤백 registry 공개 반영 미확인");
    rep.integrity.match = true;
    rep.integrity.source_sha256 = points.find((x) => x.point === "source")?.detail ?? "";
    rep.integrity.dist_sha256 = points.find((x) => x.point === "dist")?.detail ?? "";
    rep.integrity.cdn_sha256 = points.find((x) => x.point === "cdn")?.detail ?? "";
    rep.next_user_action = ["실사이트를 새로고침해 롤백 결과를 확인하세요."];
  } catch (e) {
    if (!publishing) for (const [file, data] of backups) {
      if (data === null) { if (existsSync(p(file))) unlinkSync(p(file)); }
      else writeFileSync(p(file), data);
    }
    rep.result = "BLOCKED";
    rep.blocked_reason = String((e as Error).message).split("\n")[0];
    if (publishing) rep.next_user_action = ["공개 반영 상태를 확인한 뒤 새 승인을 요청하세요. 같은 승인을 재사용하지 마세요."];
  }
  writeReport(rep);
  return rep;
}

if (import.meta.filename === process.argv[1]) {
  const [widget, to, approval] = process.argv.slice(2);
  if (!widget || !to) { console.error("사용법: npm run rollback -- <widget_id> <off|version> <approval_id>"); process.exit(1); }
  const rep = await rollback(widget, to, approval);
  console.log(summarize(rep));
  process.exitCode = rep.result === "OK" ? 0 : 1;
}
