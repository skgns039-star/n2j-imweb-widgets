/* REQ-036·039 초기 셋업 점검.
   **값은 절대 출력하지 않는다.** 존재 여부·형식 일치 여부·불일치 사실만 낸다 (절대규칙 9).
   .env 를 읽거나 쓰지 않는다 — 값 주입은 사람이 환경변수로만 한다 (REQ-037). */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { p, manifest, yaml } from "../src/release/paths.ts";

export type Status = "OK" | "MISSING" | "WARN";
export type Row = { id: string; status: Status; note: string; hint?: string; blocks?: "boot" | "deploy" };
/** 봇 기동 자체를 막는 항목 (배포 준비와 구분한다). */
export const bootBlockers = (rows: Row[]) => rows.filter((r) => r.status === "MISSING" && r.blocks !== "deploy");

const TOKEN_SHAPE = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
const MIN_NODE = [22, 6, 0];

export type Env = Record<string, string | undefined>;
export type Probe = {
  repoPublic(owner: string, repo: string): Promise<boolean | null>;
  gitRemote(): string;
  chromium(): boolean;
  nodeVersion(): string;
};

export const defaultProbe: Probe = {
  async repoPublic(owner, repo) {
    try {
      const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { cache: "no-store" });
      if (r.status === 404) return false;
      if (!r.ok) return null;                       // 판정 불가 (레이트리밋 등)
      return ((await r.json()) as any)?.private === false;
    } catch {
      return null;
    }
  },
  gitRemote() {
    try { return execFileSync("git", ["remote", "get-url", "origin"], { cwd: p(), encoding: "utf8" }).trim(); }
    catch { return ""; }
  },
  chromium() {
    try {
      // 실행하지 않고 경로만 확인한다.
      const req = createRequire(import.meta.url);
      const pw = req("playwright");
      const path = pw.chromium.executablePath();
      return !!path && existsSync(path);
    } catch { return false; }
  },
  nodeVersion() { return process.versions.node; },
};

const parseIds = (raw?: string) =>
  (raw ?? "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => Number.isFinite(n) && n !== 0);

export async function checkAll(env: Env = process.env, probe: Probe = defaultProbe): Promise<Row[]> {
  const rows: Row[] = [];
  const m = manifest();

  // 1. 봇 토큰 — 존재 여부와 형식만. 값은 보지도 남기지도 않는다.
  const tok = env.IMWEB_WIDGET_BOT_TOKEN ?? "";
  rows.push(tok
    ? TOKEN_SHAPE.test(tok)
      ? { id: "IMWEB_WIDGET_BOT_TOKEN", status: "OK", note: "설정됨 · 형식 일치" }
      : { id: "IMWEB_WIDGET_BOT_TOKEN", blocks: "boot", status: "MISSING", note: "설정됨 · 형식 불일치", hint: "@BotFather 가 준 토큰을 그대로 넣으세요 (숫자:35자)." }
    : { id: "IMWEB_WIDGET_BOT_TOKEN", blocks: "boot", status: "MISSING", note: "미설정", hint: "@BotFather 로 봇을 만들고 토큰을 .env 의 IMWEB_WIDGET_BOT_TOKEN 에 넣으세요." });

  // 2. 허용 chat — 비어 있으면 아무도 통과하지 못한다.
  const ids = parseIds(env.ALLOWED_CHAT_IDS);
  rows.push(ids.length
    ? { id: "ALLOWED_CHAT_IDS", status: "OK", note: `${ids.length}개 등록됨` }
    : { id: "ALLOWED_CHAT_IDS", blocks: "boot", status: "MISSING", note: "0개 — 아무도 통과하지 못하는 상태", hint: "봇에 아무 메시지나 보낸 뒤 logs/rejected.jsonl 의 chat_id 를 .env 의 ALLOWED_CHAT_IDS 에 넣으세요." });

  // 환경변수가 정본이다. yaml 과 다르면 **보고만** 한다 (자동 동기화 금지).
  if (ids.length) {
    const cfg = (yaml<any>("config/allowed_chats.yaml").allowed ?? []).map((c: any) => Number(c.chat_id)).filter((n: number) => n !== 0);
    const diff = ids.filter((i) => !cfg.includes(i)).length + cfg.filter((c: number) => !ids.includes(c)).length;
    if (diff) {
      rows.push({
        id: "ALLOWED_CHAT_IDS ↔ config", status: "WARN",
        note: `환경변수(${ids.length}개)와 config/allowed_chats.yaml(${cfg.length}개)이 다릅니다 — 런타임 정본은 환경변수입니다`,
        hint: "자동으로 맞추지 않습니다. 필요하면 사람이 직접 yaml 을 고치세요.",
      });
    }
  }

  // 3. CDN owner/repo — manifest 와의 불일치는 보고만 (INV-3: 자동 판단 금지)
  for (const [key, val, mval] of [["CDN_OWNER", env.CDN_OWNER, m.cdn.owner], ["CDN_REPO", env.CDN_REPO, m.cdn.repo]] as const) {
    if (!val) {
      rows.push({ id: key, blocks: "deploy", status: "MISSING", note: "미설정 (배포에만 필요)", hint: `GitHub public 저장소를 만들고 ${key} 를 .env 에 넣으세요.` });
      continue;
    }
    const placeholder = String(mval ?? "").startsWith("<");
    rows.push(placeholder || val === mval
      ? { id: key, status: "OK", note: placeholder ? "설정됨 (manifest는 아직 미설정)" : "설정됨 · manifest 일치" }
      : { id: key, status: "WARN", note: `환경변수와 manifest/widgets.yaml 이 다릅니다 (manifest: ${mval})`, hint: "자동으로 고치지 않습니다. '연결' 위저드 C 분기에서 승인 후 반영하거나 사람이 직접 맞추세요." });
  }

  // 4. git remote
  const remote = probe.gitRemote();
  rows.push(remote
    ? { id: "git remote origin", status: "OK", note: "설정됨" }
    : { id: "git remote origin", blocks: "deploy", status: "MISSING", note: "미설정 (배포에만 필요)", hint: `git remote add origin https://github.com/${env.CDN_OWNER ?? "<owner>"}/${env.CDN_REPO ?? "<repo>"}.git` });

  // 5. 저장소 public 접근 — jsDelivr 는 public 만 서빙한다
  if (env.CDN_OWNER && env.CDN_REPO) {
    const pub = await probe.repoPublic(env.CDN_OWNER, env.CDN_REPO);
    rows.push(pub === true
      ? { id: "저장소 public", status: "OK", note: "public 확인됨" }
      : pub === false
        ? { id: "저장소 public", blocks: "deploy", status: "MISSING", note: "public 이 아니거나 없음 — jsDelivr 배포 불가", hint: "public 으로 전환하거나 OPEN-REG-01(Cloudflare 대안)을 결정하세요." }
        : { id: "저장소 public", status: "WARN", note: "확인 불가 (네트워크·레이트리밋)", hint: "나중에 다시 확인하세요." });
  }

  // 6. Node 버전
  const ver = probe.nodeVersion();
  const nums = ver.split(".").map(Number);
  const okNode = nums[0]! > MIN_NODE[0]! || (nums[0] === MIN_NODE[0] && nums[1]! >= MIN_NODE[1]!);
  rows.push(okNode
    ? { id: "Node", status: "OK", note: `v${ver}` }
    : { id: "Node", blocks: "boot", status: "MISSING", note: `v${ver} — v${MIN_NODE.join(".")} 이상 필요`, hint: "Node를 올리세요. 타입 스트리핑과 node:sqlite 에 필요합니다." });

  // 7. Playwright chromium — A1(신규) 연결에는 불필요하므로 WARN
  rows.push(probe.chromium()
    ? { id: "Playwright chromium", status: "OK", note: "설치됨" }
    : { id: "Playwright chromium", status: "WARN", note: "미설치 — A2·A3(기존 사이트) 스캔 불가", hint: "npx playwright install chromium (A1 신규 연결에는 없어도 됩니다)" });

  return rows;
}

export const missing = (rows: Row[]) => rows.filter((r) => r.status === "MISSING");

export function render(rows: Row[]): string {
  const lines = rows.map((r) => `[${r.status.padEnd(7)}] ${r.id}: ${r.note}`);
  const todo = rows.filter((r) => r.status !== "OK");
  if (todo.length) {
    lines.push("", "남은 조치:");
    for (const r of todo) if (r.hint) lines.push(`  · ${r.id} — ${r.hint}`);
  }
  lines.push("", "값은 사람이 .env 에 직접 넣습니다. 에이전트는 .env 를 읽지도 쓰지도 않습니다.");
  return lines.join("\n");
}

if (import.meta.filename === process.argv[1]) {
  const rows = await checkAll();
  console.log(render(rows));
  if (missing(rows).length) {
    console.error(`\n셋업 미완 ${missing(rows).length}건 — 위 항목을 채운 뒤 다시 실행하세요.`);
    process.exit(1);
  }
  console.log("\n셋업 점검 통과.");
}
