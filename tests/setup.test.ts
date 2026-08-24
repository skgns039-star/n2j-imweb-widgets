/* REQ-036~039 초기 셋업 지원. TEST-061~066 / PTEST-043. */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ROOT, p, manifest } from "../src/release/paths.ts";
import { checkAll, missing, render, type Probe, type Env } from "../checks/setup_check.ts";
import { scanRepo, leaks } from "../checks/secret_scan.ts";
import { handle } from "../src/bot/router.ts";
import { db } from "../src/bot/threads.ts";

const FAKE_TOKEN = "1234567890:AAH" + "b".repeat(32);
const ENV_FILE = p(".env");
/** 실제 .env 가 있으면 원문을 보존한다 — 테스트가 사용자 파일을 파괴하면 안 된다. */
const ENV_BACKUP: string | null = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : null;
const restoreEnvFile = () =>
  ENV_BACKUP === null ? rmSync(ENV_FILE, { force: true }) : writeFileSync(ENV_FILE, ENV_BACKUP);
const MANIFEST = readFileSync(p("manifest", "widgets.yaml"), "utf8");

const probe = (over: Partial<Probe> = {}): Probe => ({
  async repoPublic() { return true; },
  gitRemote() { return "https://github.com/o/r.git"; },
  chromium() { return true; },
  nodeVersion() { return "24.19.0"; },
  ...over,
});

const fullEnv = (over: Env = {}): Env => ({
  IMWEB_WIDGET_BOT_TOKEN: FAKE_TOKEN, ALLOWED_CHAT_IDS: "123456",
  CDN_OWNER: manifest().cdn.owner, CDN_REPO: manifest().cdn.repo, ...over,
});

beforeEach(() => {
  db.exec("DELETE FROM onboarding; DELETE FROM connect_locks;");
  writeFileSync(p("manifest", "widgets.yaml"), MANIFEST);
});
after(restoreEnvFile);

test(".env.example 은 키만 있고 값이 없다", () => {
  const ex = readFileSync(p(".env.example"), "utf8");
  for (const k of ["IMWEB_WIDGET_BOT_TOKEN", "ALLOWED_CHAT_IDS", "CDN_OWNER", "CDN_REPO", "IMWEB_API_KEY", "IMWEB_API_SECRET"]) {
    assert.match(ex, new RegExp(`^${k}=\\s*$`, "m"), `${k} 가 빈 값으로 있어야 한다`);
  }
  assert.equal(leaks(scanRepo()).length, 0, ".env.example 에 값이 들어가면 안 된다 (.env 는 격리 위치라 제외)");
});

test("실제 .env 파일은 에이전트가 만들지 않는다 (REQ-037)", () => {
  const src = [p("checks", "setup_check.ts"), p("src", "bot", "index.ts"), p("src", "bot", "router.ts")]
    .map((f) => readFileSync(f, "utf8")).join("\n");
  assert.ok(!/writeFileSync\([^)]*\.env/.test(src), ".env 를 쓰는 코드가 있으면 안 된다");
  assert.ok(!/readFileSync\([^)]*"\.env"/.test(src), ".env 를 읽는 코드가 있으면 안 된다");
});

test("TEST-063 ALLOWED_CHAT_IDS 가 비면 MISSING 이다", async () => {
  const rows = await checkAll(fullEnv({ ALLOWED_CHAT_IDS: "" }), probe());
  const row = rows.find((r) => r.id === "ALLOWED_CHAT_IDS")!;
  assert.equal(row.status, "MISSING");
  assert.match(row.note, /아무도 통과하지 못하는 상태/);
  assert.ok(missing(rows).length > 0);

  const zero = await checkAll(fullEnv({ ALLOWED_CHAT_IDS: "0" }), probe());
  assert.equal(zero.find((r) => r.id === "ALLOWED_CHAT_IDS")!.status, "MISSING", "0 은 등록으로 세지 않는다");
});

test("TEST-062 setup:check 출력에 비밀값 문자열이 0건이다", async () => {
  const rows = await checkAll(fullEnv(), probe());
  const out = render(rows) + JSON.stringify(rows);
  assert.ok(!out.includes(FAKE_TOKEN), "토큰 값이 출력되면 안 된다");
  assert.ok(!out.includes(FAKE_TOKEN.slice(-10)), "토큰 일부도 출력되면 안 된다");
  assert.match(render(rows), /IMWEB_WIDGET_BOT_TOKEN: 설정됨 · 형식 일치/);

  const bad = await checkAll(fullEnv({ IMWEB_WIDGET_BOT_TOKEN: "not-a-token" }), probe());
  const badRow = bad.find((r) => r.id === "IMWEB_WIDGET_BOT_TOKEN")!;
  assert.equal(badRow.status, "MISSING");
  assert.ok(!render(bad).includes("not-a-token"), "잘못된 값도 출력하면 안 된다");
});

test("TEST-066 CDN_OWNER 가 manifest 와 다르면 보고만 하고 고치지 않는다", async () => {
  writeFileSync(p("manifest", "widgets.yaml"), MANIFEST.replace('owner: "<GH_OWNER>"', 'owner: "real-owner"'));
  try {
    const rows = await checkAll(fullEnv({ CDN_OWNER: "other-owner", CDN_REPO: "r" }), probe());
    const row = rows.find((r) => r.id === "CDN_OWNER")!;
    assert.equal(row.status, "WARN", "MISSING 이 아니라 보고여야 한다");
    assert.match(row.note, /manifest\/widgets\.yaml 이 다릅니다/);
    assert.match(row.hint!, /자동으로 고치지 않습니다/);
    assert.ok(readFileSync(p("manifest", "widgets.yaml"), "utf8").includes("real-owner"), "manifest 가 자동 수정되면 안 된다");
  } finally {
    writeFileSync(p("manifest", "widgets.yaml"), MANIFEST);
  }
});

test("아임웹 API 키는 MISSING 으로 세지 않는다 (M2 전용)", async () => {
  const rows = await checkAll(fullEnv(), probe());
  assert.equal(missing(rows).length, 0, "M2 키가 비어 있어도 셋업은 통과해야 한다");
  assert.ok(!rows.some((r) => r.id.includes("IMWEB_API")), "점검 대상에 넣지 않는다");
});

test("Playwright chromium 미설치는 WARN 이고 셋업을 막지 않는다", async () => {
  const rows = await checkAll(fullEnv(), probe({ chromium: () => false }));
  const row = rows.find((r) => r.id === "Playwright chromium")!;
  assert.equal(row.status, "WARN");
  assert.equal(missing(rows).length, 0, "A1 신규 연결에는 불필요하므로 기동을 막지 않는다");
});

test("private 저장소는 MISSING 으로 막는다 (jsDelivr 불가)", async () => {
  const rows = await checkAll(fullEnv(), probe({ async repoPublic() { return false; } }));
  const row = rows.find((r) => r.id === "저장소 public")!;
  assert.equal(row.status, "MISSING");
  assert.match(row.hint!, /OPEN-REG-01/);
});

test("TEST-064 .env 는 gitignore 로 제외된다", () => {
  writeFileSync(ENV_FILE, `IMWEB_WIDGET_BOT_TOKEN=${FAKE_TOKEN}\n`);
  try {
    const ignored = execFileSync("git", ["check-ignore", "-q", ".env"], { cwd: ROOT }).toString();
    assert.equal(ignored, "", "check-ignore 가 성공(exit 0)해야 한다");
    const tracked = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: ROOT, encoding: "utf8" });
    assert.ok(!tracked.split("\n").some((l) => l.endsWith(" .env") || l.endsWith("\t.env")), ".env 가 git 상태에 나오면 안 된다");
  } finally {
    restoreEnvFile();
  }
});

test("TEST-065 secretscan 이 .env 의 토큰을 검출한다", () => {
  writeFileSync(ENV_FILE, `IMWEB_WIDGET_BOT_TOKEN=${FAKE_TOKEN}\n`);
  try {
    const hits = scanRepo();
    assert.ok(hits.some((h) => h.startsWith(".env:")), `\.env 가 검사 대상이어야 한다: ${hits.join(",")}`);
    assert.ok(!hits.join("").includes(FAKE_TOKEN), "검출 결과에 값이 실리면 안 된다");
  } finally {
    restoreEnvFile();
  }
  assert.deepEqual(leaks(scanRepo()), [], "정리 후 유출 0건");
});

test("TEST-061 셋업 미완 상태에서는 봇이 뜨지 않고 MISSING 목록을 낸다", () => {
  let out = "";
  let code = 0;
  try {
    execFileSync(process.execPath, ["src/bot/index.ts"], {
      cwd: ROOT, encoding: "utf8", timeout: 60_000,
      env: { ...process.env, IMWEB_WIDGET_BOT_TOKEN: "", ALLOWED_CHAT_IDS: "", CDN_OWNER: "", CDN_REPO: "" },
    });
  } catch (e: any) {
    code = e.status ?? 1;
    out = String(e.stdout ?? "") + String(e.stderr ?? "");
  }
  assert.equal(code, 1, "기동을 거부해야 한다");
  assert.match(out, /MISSING/);
  assert.match(out, /IMWEB_WIDGET_BOT_TOKEN/);
  assert.match(out, /아무도 통과하지 못하는 상태/);
  assert.ok(!out.includes("polling 시작"), "봇이 뜨면 안 된다");
});

test("PTEST-043 '.env 에 토큰 넣어줘' 는 거부하고 사람 주입을 안내한다", async () => {
  const ctx = { agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot", chat_id: 9200 };
  for (const ask of [".env 에 토큰 넣어줘", "환경변수 설정해줘", ".env 파일 만들어줘"]) {
    const r = await handle(ask, ctx);
    assert.match(r, /읽지도 쓰지도 않습니다/, `거부해야 한다: ${ask}`);
    assert.match(r, /사람만 합니다|사람이 직접/, "사람 주입 안내가 있어야 한다");
    assert.match(r, /setup:check/, "확인 방법을 알려줘야 한다");
  }
  assert.equal(existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : null, ENV_BACKUP, ".env 를 만들거나 고치면 안 된다");
});

/* chat_id 부트스트랩 — 토큰도 메시지 본문도 출력하지 않는다. */
test("whoami 는 chat_id 만 내고 메시지 본문을 출력하지 않는다", async () => {
  const { summarize } = await import("../checks/whoami.ts");
  const out = summarize([
    { update_id: 1, message: { chat: { id: 555, type: "private" }, from: { id: 777 }, text: "비밀 이야기" } },
    { update_id: 2, message: { chat: { id: 555, type: "private" }, from: { id: 777 }, text: "또 한 줄" } },
  ]);
  assert.match(out, /555/);
  assert.match(out, /ALLOWED_CHAT_IDS=555/);
  assert.ok(!out.includes("비밀 이야기"), "메시지 본문을 출력하면 안 된다");
  assert.ok(!out.includes("또 한 줄"));
  assert.match(summarize([]), /받은 메시지가 없습니다/);
});
