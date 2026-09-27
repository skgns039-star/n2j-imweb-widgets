/* 봇 명령 → 코드 위젯 수정·신규 생성 → 검증 → 빌드 → 승인 요청까지 자동화 (2026-09-28 사용자 요구).
   원칙
   - LLM 은 임시 폴더에서만 만든다. 운영 저장소에는 관문을 모두 통과한 결과만 들어온다.
   - 관문은 규칙이다(policy.ts·render_check.ts): 범위·규격·위험 API·화면 노출·요청 누락·빌드·무결성.
   - 공개 배포는 여기서 하지 않는다. 승인 요청까지만 만든다 (INV-8: 1회 승인은 완화하지 않는다).
   - 새 위젯은 enabled:false 로 등록한다. 슬롯도 아직 사이트에 없으므로 방문자에게 보이지 않는다. */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { p, manifest, yaml } from "../release/paths.ts";
import { sha256 } from "../release/hash.ts";
import { build, BuildFailed } from "../release/build.ts";
import { verify } from "../release/verify.ts";
import { request, payloadText, canonical } from "../release/approval.ts";
import { deploymentPayload } from "../release/deploy.ts";
import { WIDGET_ID, ALLOWED_FILES, checkWidget, scopeViolations, coverageErrors } from "./policy.ts";
import { renderCheck, type RenderReport } from "./render_check.ts";
import { claudeGenerator, type Generator, type Mode, type GenSummary } from "./generate.ts";

export type ChangeRequest = { mode: Mode; widget_id: string; request: string; chat_id?: number };
export type ChangeResult = {
  ok: boolean; stage: string; errors: string[];
  summary?: GenSummary; render?: RenderReport; diff?: string; version?: string; approvalId?: string; report: string;
};

/** 변질 감시 대상. 생성 중에 이 중 하나라도 바뀌면(생성기가 폴더 밖을 건드리면) 전체를 버린다. */
const WATCH = ["src", "dist", "loader", "integrity", "manifest", "config", "contracts", "checks", "prompts", "registry.json", "package.json", "AGENTS.md"];

function hashTree(root: string, entries = WATCH): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (rel: string) => {
    const full = join(root, rel);
    if (!existsSync(full)) return;
    if (statSync(full).isDirectory()) { for (const f of readdirSync(full)) if (!f.startsWith("._") && f !== ".DS_Store") walk(join(rel, f)); return; }
    out[rel.split("\\").join("/")] = sha256(readFileSync(full));
  };
  for (const e of entries) walk(e);
  return out;
}

const readDir = (dir: string) => Object.fromEntries(readdirSync(dir).filter((f) => !f.startsWith("._") && f !== ".DS_Store")
  .map((f) => [f, statSync(join(dir, f)).isDirectory() ? "\0dir" : readFileSync(join(dir, f), "utf8")]));

const git = (...args: string[]) => execFileSync("git", args, { cwd: p(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function diffDirs(a: string, b: string): string {
  const r = spawnSync("git", ["diff", "--no-index", "--no-color", "--", a, b], { encoding: "utf8" });
  return (r.stdout || "").split(a).join("a").split(b).join("b");
}

/** manifest 에서 이 위젯 블록만 바꾼다. 다른 위젯·사이트·CDN 설정은 텍스트 그대로 둔다. */
function updateManifest(mode: Mode, id: string, site: string): string {
  const file = p("manifest", "widgets.yaml");
  let text = readFileSync(file, "utf8");
  if (mode === "edit") {
    const re = new RegExp(`(  - widget_id: ${id}\\n    version: )(\\d+)\\.(\\d+)\\.(\\d+)`);
    const m = re.exec(text);
    if (!m) throw new Error(`manifest 에서 ${id} 버전 줄을 찾지 못함`);
    const next = `${m[2]}.${m[3]}.${Number(m[4]) + 1}`;
    text = text.replace(re, `$1${next}`);
    writeFileSync(file, text);
    return next;
  }
  text = text.replace(/\n*$/, "\n") + [
    `  - widget_id: ${id}`, `    version: 0.1.0`, `    enabled: false`, `    site: ${site}`,
    `    match:`, `      path_glob:`, `        - /*`, `    mount:`, `      type: slot`, `      slot: ${id}`, ``,
  ].join("\n");
  writeFileSync(file, text);
  return "0.1.0";
}

function manifestOthersUnchanged(before: any, after: any, id: string): string[] {
  const errs: string[] = [];
  const strip = (m: any) => ({ ...m, widgets: m.widgets.filter((w: any) => w.widget_id !== id) });
  if (canonical(strip(before)) !== canonical(strip(after))) errs.push("manifest 의 다른 위젯·사이트·CDN 설정이 바뀜");
  return errs;
}

export async function runWidgetChange(req: ChangeRequest, deps: { generator?: Generator; signal?: AbortSignal } = {}): Promise<ChangeResult> {
  const { mode, widget_id: id } = req;
  const fail = (stage: string, errors: string[], extra: Partial<ChangeResult> = {}): ChangeResult =>
    ({ ok: false, stage, errors, ...extra, report: [`[위젯 ${mode === "edit" ? "수정" : "신규"}] ${id} — 중단 (${stage})`, ...errors.map((e) => `· ${e}`), "운영 저장소는 바뀌지 않았습니다."].join("\n") });

  // 0. 입력·대상 확인
  if (!WIDGET_ID.test(id)) return fail("입력", [`위젯 ID 형식 오류: ${id} (영소문자로 시작, 영소문자·숫자·하이픈 3~40자)`]);
  const m = manifest();
  const existing = m.widgets.find((w) => w.widget_id === id);
  if (mode === "edit" && !existing) return fail("입력", [`등록되지 않은 위젯: ${id}`]);
  if (mode === "new" && (existing || existsSync(p("src", "widgets", id)))) return fail("입력", [`이미 있는 위젯 ID: ${id}`]);
  const srcDir = p("src", "widgets", id);
  if (mode === "edit" && JSON.parse(readFileSync(join(srcDir, "widget.json"), "utf8")).internal === true) return fail("입력", [`${id} 는 검증용(internal) 위젯이라 자동 수정 대상이 아님`]);
  const site = existing?.site ?? (m.sites.length === 1 ? m.sites[0]!.site_id : "");
  if (!site) return fail("입력", ["대상 사이트를 정할 수 없음 (사이트가 여러 개)"]);
  const dirty = git("status", "--porcelain", "--", "src/widgets", "dist", "integrity", "manifest", "registry.json", "loader").trim();
  if (dirty) return fail("사전 확인", ["위젯 경로에 커밋되지 않은 변경이 있음 — 섞이지 않게 먼저 정리해야 함", ...dirty.split("\n").slice(0, 5)]);

  // 1. 격리 작업 폴더
  const before = hashTree(p());
  const manifestBefore = yaml<any>("manifest/widgets.yaml");
  const work = mkdtempSync(join(tmpdir(), `widget-${id}-`));
  const workWidget = join(work, "widget");
  try {
    mkdirSync(workWidget);
    if (mode === "edit") for (const f of ALLOWED_FILES) cpSync(join(srcDir, f), join(workWidget, f));
    const ref = m.widgets.find((w) => w.widget_id !== id && existsSync(p("src", "widgets", w.widget_id, "widget.json")) &&
      JSON.parse(readFileSync(p("src", "widgets", w.widget_id, "widget.json"), "utf8")).internal !== true);
    if (ref) cpSync(p("src", "widgets", ref.widget_id), join(work, "reference"), { recursive: true });
    const original = mode === "edit" ? readDir(workWidget) : {};

    // 2. 생성
    let summary: GenSummary;
    try { summary = await (deps.generator ?? claudeGenerator)({ mode, widget_id: id, request: req.request, workdir: work }, deps.signal); }
    catch (e) { return fail("생성", [`생성기 실패: ${(e as Error).message.slice(0, 200)}`]); }

    // 3. 생성 중 운영 저장소 변질 감시
    const tampered = scopeViolations(before, hashTree(p()), "\0");
    if (tampered.length) return fail("변질 감시", [`생성 중 운영 저장소가 바뀜: ${tampered.slice(0, 5).join(", ")}`]);

    // 4. 규칙 관문
    const files = readDir(workWidget);
    const errors = [...checkWidget(id, files), ...coverageErrors(summary)];
    if (mode === "edit") {
      if (canonical(files) === canonical(original)) errors.push("변경 사항이 없음");
      if (files["widget.json"] && JSON.parse(files["widget.json"]).widget_id !== id) errors.push("widget_id 를 바꿀 수 없음");
    }
    if (errors.length) return fail("규칙 검사", errors, { summary });

    // 5. 렌더 관문 (화면 노출·오류·외부 요청)
    const render = await renderCheck(id, files["index.js"]!, files["style.css"]!);
    if (!render.ok) return fail("렌더 검사", render.errors, { summary, render });

    // 6. 적용 → 대상만 빌드 → 무결성
    if (mode === "edit") { mkdirSync(join(work, "original"), { recursive: true }); for (const [f, c] of Object.entries(original)) writeFileSync(join(work, "original", f), c); }
    const fullDiff = mode === "edit" ? diffDirs(join(work, "original"), workWidget) : "";
    const backup = { manifest: readFileSync(p("manifest", "widgets.yaml")) };
    let bumpedVersion = "";
    const restore = () => {
      writeFileSync(p("manifest", "widgets.yaml"), backup.manifest);
      if (mode === "new") { rmSync(srcDir, { recursive: true, force: true }); rmSync(p("dist", id), { recursive: true, force: true }); rmSync(p("integrity", `${id}.json`), { force: true }); }
      else git("checkout", "--", `src/widgets/${id}`, `integrity/${id}.json`);
      if (mode === "edit") rmSync(p("dist", id, bumpedVersion), { recursive: true, force: true });
    };
    try {
      mkdirSync(srcDir, { recursive: true });
      for (const f of ALLOWED_FILES) writeFileSync(join(srcDir, f), files[f]!);
      bumpedVersion = updateManifest(mode, id, site);
      build({ only: id });
      const pts = await verify({ cdn: false, widget: id });
      if (!pts.length || pts.some((x) => !x.ok)) throw new Error(`로컬 무결성 불일치 ${pts.filter((x) => !x.ok).length}건`);
      const after = hashTree(p());
      const allowed = (f: string) => f.startsWith(`src/widgets/${id}/`) || f.startsWith(`dist/${id}/`) || f === `integrity/${id}.json` || f === "manifest/widgets.yaml";
      const outside = scopeViolations(before, after, "\0").filter((f) => !allowed(f));
      const manErr = manifestOthersUnchanged(manifestBefore, yaml<any>("manifest/widgets.yaml"), id);
      if (outside.length || manErr.length) throw new Error(`허용 범위 밖 변경: ${[...outside, ...manErr].slice(0, 5).join(", ")}`);
    } catch (e) {
      restore();
      const msg = e instanceof BuildFailed ? e.errors : [(e as Error).message];
      return fail("적용·빌드", msg, { summary, render });
    }

    // 7. 기록 + 승인 요청 (배포는 승인 뒤 기존 경로가 한다)
    const rec = JSON.parse(readFileSync(p("integrity", `${id}.json`), "utf8"));
    const a = request("cdn_deploy", `${id}@${bumpedVersion}`, {
      ...deploymentPayload(id), widget_id: id, files: rec.files.map((f: any) => f.name), sha256: rec.files[0]?.dist_sha256 ?? "",
      site, rollback: mode === "new" ? `manifest 에서 ${id} 삭제 후 재배포 (enabled:false 라 화면 영향 없음)` : `npm run rollback -- ${id} ${existing!.version}`,
    }, req.chat_id);
    const logDir = p("state", "widget-changes");
    mkdirSync(logDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(logDir, `${stamp}_${id}.json`), JSON.stringify({ at: new Date().toISOString(), mode, widget_id: id, version: bumpedVersion, request: req.request, summary, render, approvalId: a.id }, null, 2) + "\n");
    if (fullDiff) writeFileSync(join(logDir, `${stamp}_${id}.diff`), fullDiff);
    const diffLines = fullDiff.split("\n").filter((l) => /^[-+][^-+]/.test(l));
    return {
      ok: true, stage: "승인 대기", errors: [], summary, render, diff: fullDiff, version: bumpedVersion, approvalId: a.id,
      report: [
        `[위젯 ${mode === "edit" ? "수정" : "신규"}] ${id}@${bumpedVersion} — 검증 통과, 승인 대기`,
        `요청 ${summary.requested.length}건 모두 반영: ${summary.done.map((d) => d.slice(0, 40)).join(" / ")}`,
        mode === "edit" ? `바뀐 줄 ${diffLines.length}개 (다른 위젯·로더·registry 변경 0)` : `새 위젯은 꺼진 상태(enabled:false)로 등록 — 슬롯도 아직 없어 방문자에게 보이지 않음`,
        `화면 검사: 슬롯 안에만 렌더 · 떠 있는 요소 0 · 슬롯 없으면 표시 0 · 오류 0`,
        ...(diffLines.length ? ["변경 줄:", ...diffLines.slice(0, 12)] : []),
        "",
        payloadText(a),
      ].join("\n"),
    };
  } finally { rmSync(work, { recursive: true, force: true }); }
}
