/* ENG-031 캐시 무효화 포함. 승인 없이는 한 줄도 실행하지 않는다 (INV-8).
   배포 완료 선언 조건: 태그 푸시 + registry purge 반영 확인 + CDN 해시 재비교 통과 (INV-5). */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { sha256 } from "./hash.ts";
import { p, manifest, gateBlock, json } from "./paths.ts";
import { writeRegistry, buildRegistry, readRegistry, type Registry } from "./registry.ts";
import { verify } from "./verify.ts";
import { assertApproved, consumeApproval, useConsumedApproval, canonical, type Approval } from "./approval.ts";
import { emptyReport, writeReport, summarize, type ActionReport } from "./report.ts";

const git = (...args: string[]) => {
  try { return execFileSync("git", args, { cwd: p(), encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch { throw new Error(`BLOCKED: Git ${args[0]} 실패 — 원격/로컬 상태를 확인하세요`); }
};

/** registry 를 실제로 서빙하는 주소. manifest 가 정본이다 (OPEN-REG-01 결정 반영). */
export function registryUrl(): string {
  const m = manifest();
  return m.cdn.registry_url ?? `https://cdn.jsdelivr.net/gh/${m.cdn.owner}/${m.cdn.repo}@main/registry.json`;
}

async function purge(owner: string, repo: string, signal?: AbortSignal): Promise<boolean> {
  if (manifest().cdn.registry_url) return true;   // jsDelivr 를 안 쓰면 purge 대상이 없다
  const url = `https://purge.jsdelivr.net/gh/${owner}/${repo}@main/registry.json`;
  try {
    const r = await fetch(url, { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
    return r.ok;
  } catch {
    return false;
  }
}

/** purge 후 CDN이 실제로 새 registry를 주는지 확인. 미반영이면 완료로 보고하지 않는다 (§18.5). */
/** 반영 대기 상한. 호스트의 캐시 수명에 맞춘다 —
 *  raw.githubusercontent 는 max-age=300 이고 실측 반영이 약 200초였다. 60초는 거짓 BLOCKED 를 만든다. */
const CONFIRM_TIMEOUT_MS = 360_000;

async function confirmRegistry(_owner: string, _repo: string, expectedUpdatedAt: string, expectedHash: string, timeoutMs = CONFIRM_TIMEOUT_MS, signal?: AbortSignal): Promise<boolean> {
  const url = registryUrl();
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    signal?.throwIfAborted();
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        const served = await r.json();
        if (served?.updated_at === expectedUpdatedAt) return registryHash(served) === expectedHash;
      }
    } catch { /* 재시도 */ }
    await new Promise((res) => setTimeout(res, 5000));
  }
  return false;
}

/** registry.json 커밋 → purge → CDN 반영 확인. 확인되기 전에는 완료가 아니다 (§18.5). */
export async function publishRegistry(expectedUpdatedAt: string, approval?: Approval, files = ["registry.json"], signal?: AbortSignal): Promise<boolean> {
  const m = manifest();
  signal?.throwIfAborted();
  const current = readRegistry();
  if (current.updated_at !== expectedUpdatedAt) throw new Error("BLOCKED: registry 시각 불일치");
  assertEmptyIndex();
  if (approval) {
    const id = String(approval.payload.widget_id ?? "");
    const valid = (file: string) => file === "registry.json" || (approval.action === "rollback" &&
      (file === "manifest/widgets.yaml" || file === `integrity/${id}.json` || file.startsWith(`src/widgets/${id}/`) || file.startsWith(`dist/${id}/`)));
    if (files.some((file) => !valid(file) || file.includes(".."))) throw new Error("BLOCKED: 승인 범위 밖 커밋 파일");
    useConsumedApproval(approval, ["cdn_deploy", "rollback", "registry_resume"], { registry_sha256: registryHash(current) });
  } else {
    // 승인 없는 예외는 Git 정본의 전역 정지 1비트뿐이다.
    const previous = JSON.parse(git("show", "HEAD:registry.json"));
    if (current.global_enabled !== false || files.length !== 1 || files[0] !== "registry.json" ||
        registryHash(current) !== registryHash({ ...previous, global_enabled: false })) {
      throw new Error("BLOCKED: 승인 없이 registry 내용을 바꿀 수 없음");
    }
  }
  signal?.throwIfAborted();
  // push 는 HEAD 전체를 올린다. 승인된 공개에는 검토되지 않은 로컬 커밋이 공개 저장소로 섞여 나가지 않게 막는다.
  // 승인 없는 전역 정지는 사고 대응이라 막지 않는다 (§22.1).
  if (approval) assertOnlyReleaseCommitsAhead();
  commitFiles(files, 'registry ' + expectedUpdatedAt);
  try { git("push", "origin", "HEAD"); } catch { return false; }
  if (!(await purge(m.cdn.owner, m.cdn.repo, signal))) return false;
  return confirmRegistry(m.cdn.owner, m.cdn.repo, expectedUpdatedAt, registryHash(current), CONFIRM_TIMEOUT_MS, signal);
}

export async function deploy(widget_id: string, approvalId?: string, signal?: AbortSignal): Promise<ActionReport> {
  const rep = emptyReport("deploy", widget_id);
  rep.approval.required = true;
  rep.approval.id = approvalId ?? "";

  try {
    signal?.throwIfAborted();
    const blocked = gateBlock("cdn_deploy");
    if (blocked) throw new Error(`BLOCKED: ${blocked}`);

    const expected = deploymentPayload(widget_id);
    const a = assertApproved(approvalId, "cdn_deploy", expected);
    assertEmptyIndex();
    rep.approval.status = a.status as "APPROVED";

    const m = manifest();
    const w = m.widgets.find((x) => x.widget_id === widget_id);
    if (!w) throw new Error(`BLOCKED: manifest 미등록 위젯 (${widget_id})`);
    rep.version_to = w.version;

    // 1. 로컬 무결성 (source == dist) 먼저. 여기서 막히면 네트워크를 건드리지 않는다.
    const local = await verify({ cdn: false, signal });
    const localBad = local.filter((x) => !x.ok);
    if (!local.length || localBad.length) throw new Error(`BLOCKED: 로컬 해시 불일치 ${localBad.length}건`);
    rep.integrity.source_sha256 = local.find((x) => x.widget_id === widget_id && x.point === "source")?.detail ?? "";
    rep.integrity.dist_sha256 = local.find((x) => x.widget_id === widget_id && x.point === "dist")?.detail ?? "";

    // 2. 불변 태그 푸시 (자산). 태그가 이미 있으면 재사용하지 않고 실패시킨다 — 같은 버전 = 같은 바이트.
    const tag = `w-${widget_id}-${w.version}`;
    const tags = git("tag", "--list", tag);
    if (tags) throw new Error(`BLOCKED: 태그 ${tag} 이미 존재. 버전을 올려라`);
    signal?.throwIfAborted();
    const permit = consumeApproval(approvalId, "cdn_deploy", deploymentPayload(widget_id));
    const record = json<any>(`integrity/${widget_id}.json`);
    commitFiles([`src/widgets/${widget_id}/widget.json`, ...record.files.flatMap((f: any) => [`src/widgets/${widget_id}/${f.name}`, `dist/${widget_id}/${w.version}/${f.name}`]), `integrity/${widget_id}.json`, "manifest/widgets.yaml"], `build ${tag}`);
    git("tag", tag);
    git("push", "origin", "HEAD");
    git("push", "origin", tag);

    // 자산 검증이 끝나기 전에는 새 registry를 공개하지 않는다.
    const all = await verify({ signal });
    const bad = all.filter((x) => !x.ok);
    if (!all.length || bad.length) throw new Error(`BLOCKED: CDN 해시 불일치 ${bad.length}건`);
    const reg = writeRegistry();
    if (!(await publishRegistry(reg.updated_at, permit, undefined, signal))) {
      throw new Error("BLOCKED: registry purge 실패 또는 CDN 반영 미확인 (상한 360초)");
    }
    rep.integrity.cdn_sha256 = all.find((x) => x.widget_id === widget_id && x.point === "cdn")?.detail ?? "";
    rep.integrity.match = true;
    rep.next_user_action = [
      `실사이트에서 확인 후 manifest의 enabled를 true로 올려라`,
      `문제 시 enabled:false 또는 npm run rollback ${widget_id}`,
    ];
  } catch (e) {
    rep.result = signal?.aborted || String((e as Error).message).startsWith("BLOCKED") ? "BLOCKED" : "FAILED";
    rep.blocked_reason = (e as Error).message;
  }

  writeReport(rep);
  return rep;
}


export function registryHash(reg: Registry): string {
  const { updated_at: _time, ...content } = reg;
  return sha256(canonical(content));
}

export function assertEmptyIndex(): void {
  if (git("diff", "--cached", "--name-only")) throw new Error("BLOCKED: 기존 staged 변경이 있음 — 별도로 검토·정리하세요");
}

/** origin/main 이후 커밋이 전부 배포 경로(build·registry)가 만든 것이고 위젯 경로만 건드렸는지 확인한다.
 *  2026-09-27: 로컬 main 이 공개 origin 보다 검토 안 된 커밋 4개 앞서 있어, registry 공개가 그것까지 올릴 뻔했다. */
export function assertOnlyReleaseCommitsAhead(): void {
  git("fetch", "origin", "main");
  const subjects = git("log", "--format=%s", "origin/main..HEAD").split("\n").filter(Boolean);
  const files = git("diff", "--name-only", "origin/main", "HEAD").split("\n").filter(Boolean);
  const releaseFile = (f: string) => f === "registry.json" || f === "manifest/widgets.yaml" ||
    f.startsWith("integrity/") || f.startsWith("src/widgets/") || f.startsWith("dist/");
  const foreignCommits = subjects.filter((s) => !/^(registry |build w-)/.test(s));
  const foreignFiles = files.filter((f) => !releaseFile(f));
  if (foreignCommits.length || foreignFiles.length) {
    throw new Error(`BLOCKED: 검토되지 않은 로컬 커밋 ${foreignCommits.length}개·배포 밖 파일 ${foreignFiles.length}개가 공개 저장소로 함께 올라간다 — 먼저 검토·정리하세요`);
  }
}

export function commitFiles(files: string[], message: string): void {
  assertEmptyIndex();
  git("add", "--", ...files);
  if (git("diff", "--cached", "--name-only")) git("commit", "-m", message, "--", ...files);
}

export function deploymentPayload(widget_id: string): Record<string, unknown> {
  const m = manifest();
  const w = m.widgets.find((w) => w.widget_id === widget_id);
  if (!w || !/^[a-z0-9][a-z0-9-]*$/.test(widget_id)) throw new Error("BLOCKED: 미등록 위젯");
  const rec = json<any>(`integrity/${widget_id}.json`);
  const inventory = (dir: string, prefix = ""): string[] => readdirSync(p(dir, prefix)).flatMap((name) => {
    if (name === ".DS_Store" || name.startsWith("._")) return [];
    const rel = prefix + name, stat = lstatSync(p(dir, rel));
    if (stat.isSymbolicLink()) throw new Error("BLOCKED: 자산 심볼릭 링크 금지");
    return stat.isDirectory() ? inventory(dir, rel + "/") : [rel];
  }).sort();
  const names = rec.files.map((f: any) => f.name).sort();
  if (canonical(inventory(`src/widgets/${widget_id}`)) !== canonical([...names, "widget.json"].sort()) ||
      canonical(inventory(`dist/${widget_id}/${w.version}`)) !== canonical(names)) {
    throw new Error("BLOCKED: 정본/산출물 파일 목록 불일치 — 빌드·승인을 다시 준비하세요");
  }
  const widgetMetadata = sha256(readFileSync(p("src", "widgets", widget_id, "widget.json")));
  const content = rec.files.map((f: any) => {
    if (!/^[a-zA-Z0-9_./-]+$/.test(f.name) || f.name.includes("..") || f.name.startsWith("/")) throw new Error("BLOCKED: 잘못된 자산 경로");
    return [f.name, sha256(readFileSync(p("src", "widgets", widget_id, f.name))), sha256(readFileSync(p("dist", widget_id, w.version, f.name)))];
  });
  return { widget_id, version: w.version, release_sha256: sha256(canonical({ m, rec, content, widgetMetadata, head: git("rev-parse", "HEAD") })), registry_sha256: registryHash(buildRegistry()) };
}

if (import.meta.filename === process.argv[1]) {
  const [widget, approval] = process.argv.slice(2);
  if (!widget) { console.error("사용법: npm run deploy -- <widget_id> <approval_id>"); process.exit(1); }
  const rep = await deploy(widget, approval);
  console.log(summarize(rep));
  process.exit(rep.result === "OK" ? 0 : 1);
}
