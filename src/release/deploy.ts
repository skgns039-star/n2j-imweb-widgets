/* ENG-031 캐시 무효화 포함. 승인 없이는 한 줄도 실행하지 않는다 (INV-8).
   배포 완료 선언 조건: 태그 푸시 + registry purge 반영 확인 + CDN 해시 재비교 통과 (INV-5). */
import { execFileSync } from "node:child_process";
import { p, manifest, gateBlock } from "./paths.ts";
import { writeRegistry } from "./registry.ts";
import { verify } from "./verify.ts";
import { assertApproved } from "./approval.ts";
import { emptyReport, writeReport, summarize, type ActionReport } from "./report.ts";

const git = (...args: string[]) => execFileSync("git", args, { cwd: p(), encoding: "utf8" }).trim();

/** registry 를 실제로 서빙하는 주소. manifest 가 정본이다 (OPEN-REG-01 결정 반영). */
export function registryUrl(): string {
  const m = manifest();
  return m.cdn.registry_url ?? `https://cdn.jsdelivr.net/gh/${m.cdn.owner}/${m.cdn.repo}@main/registry.json`;
}

async function purge(owner: string, repo: string): Promise<boolean> {
  if (manifest().cdn.registry_url) return true;   // jsDelivr 를 안 쓰면 purge 대상이 없다
  const url = `https://purge.jsdelivr.net/gh/${owner}/${repo}@main/registry.json`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

/** purge 후 CDN이 실제로 새 registry를 주는지 확인. 미반영이면 완료로 보고하지 않는다 (§18.5). */
async function confirmRegistry(_owner: string, _repo: string, expectedUpdatedAt: string, timeoutMs = 60_000): Promise<boolean> {
  const url = registryUrl();
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok && (await r.json())?.updated_at === expectedUpdatedAt) return true;
    } catch { /* 재시도 */ }
    await new Promise((res) => setTimeout(res, 5000));
  }
  return false;
}

/** registry.json 커밋 → purge → CDN 반영 확인. 확인되기 전에는 완료가 아니다 (§18.5). */
export async function publishRegistry(expectedUpdatedAt: string): Promise<boolean> {
  const m = manifest();
  git("add", "registry.json");
  try { git("commit", "-m", `registry ${expectedUpdatedAt}`); } catch { /* 변경 없음 */ }
  try { git("push", "origin", "HEAD"); } catch { return false; }
  if (!(await purge(m.cdn.owner, m.cdn.repo))) return false;
  return confirmRegistry(m.cdn.owner, m.cdn.repo, expectedUpdatedAt);
}

export async function deploy(widget_id: string, approvalId?: string): Promise<ActionReport> {
  const rep = emptyReport("deploy", widget_id);
  rep.approval.required = true;
  rep.approval.id = approvalId ?? "";

  try {
    const blocked = gateBlock("cdn_deploy");
    if (blocked) throw new Error(`BLOCKED: ${blocked}`);

    const a = assertApproved(approvalId, "cdn_deploy");
    rep.approval.status = a.status as "APPROVED";

    const m = manifest();
    const w = m.widgets.find((x) => x.widget_id === widget_id);
    if (!w) throw new Error(`BLOCKED: manifest 미등록 위젯 (${widget_id})`);
    rep.version_to = w.version;

    // 1. 로컬 무결성 (source == dist) 먼저. 여기서 막히면 네트워크를 건드리지 않는다.
    const local = await verify({ widget: widget_id, cdn: false });
    const localBad = local.filter((x) => !x.ok);
    if (localBad.length) throw new Error(`BLOCKED: 로컬 해시 불일치 ${localBad.length}건`);
    rep.integrity.source_sha256 = local.find((x) => x.point === "source")?.detail ?? "";
    rep.integrity.dist_sha256 = local.find((x) => x.point === "dist")?.detail ?? "";

    // 2. 불변 태그 푸시 (자산). 태그가 이미 있으면 재사용하지 않고 실패시킨다 — 같은 버전 = 같은 바이트.
    const tag = `w-${widget_id}-${w.version}`;
    git("add", "-A");
    try { git("commit", "-m", `build ${tag}`); } catch { /* 변경 없음 */ }
    const tags = git("tag", "--list", tag);
    if (tags) throw new Error(`BLOCKED: 태그 ${tag} 이미 존재. 버전을 올려라`);
    git("tag", tag);
    git("push", "origin", "HEAD");
    git("push", "origin", tag);

    // 3. registry 갱신 + purge + 반영 확인
    const reg = writeRegistry();
    if (!(await publishRegistry(reg.updated_at))) {
      throw new Error("BLOCKED: registry.json purge 실패 또는 CDN 반영 미확인 (60초)");
    }

    // 4. CDN 재fetch 해시 재비교 (4지점 확정)
    const all = await verify({ widget: widget_id });
    const bad = all.filter((x) => !x.ok);
    if (bad.length) throw new Error(`BLOCKED: CDN 해시 불일치 ${bad.length}건`);
    rep.integrity.cdn_sha256 = all.find((x) => x.point === "cdn")?.detail ?? "";
    rep.integrity.match = true;
    rep.next_user_action = [
      `실사이트에서 확인 후 manifest의 enabled를 true로 올려라`,
      `문제 시 enabled:false 또는 npm run rollback ${widget_id}`,
    ];
  } catch (e) {
    rep.result = String((e as Error).message).startsWith("BLOCKED") ? "BLOCKED" : "FAILED";
    rep.blocked_reason = (e as Error).message;
  }

  writeReport(rep);
  return rep;
}

if (import.meta.filename === process.argv[1]) {
  const [widget, approval] = process.argv.slice(2);
  if (!widget) { console.error("사용법: npm run deploy -- <widget_id> <approval_id>"); process.exit(1); }
  const rep = await deploy(widget, approval);
  console.log(summarize(rep));
  process.exit(rep.result === "OK" ? 0 : 1);
}
