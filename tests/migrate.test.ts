/* ENG-042/043 — 스캔 · 이관. TEST-050~052, TEST-055, TEST-060 / PTEST-039, PTEST-040. */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { p, manifest } from "../src/release/paths.ts";
import { handle } from "../src/bot/router.ts";
import { loadState } from "../src/bot/onboarding.ts";
import { net, browser, scanSite, verdict, sampleNotice, type PageFacts } from "../src/bot/scan.ts";
import { io, snapshotOriginal, lintStaged, hoursSinceDeploy, requestOriginalRemoval } from "../src/bot/migrate.ts";
import { scanRepo, leaks } from "../checks/secret_scan.ts";
import { db } from "../src/bot/threads.ts";

const ctx = (chat = 9100) => ({
  agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot", chat_id: chat,
});
const MANIFEST = readFileSync(p("manifest", "widgets.yaml"), "utf8");
const STAGED = p("src", "widgets", "legacy-banner");
const SITE = manifest().sites[0]!.site_id;

const facts = (over: Partial<PageFacts> = {}): PageFacts => ({
  path: "/", ok: true, loaderTags: [], loaderRuntime: null, scripts: [], slots: [],
  ddakClasses: [], hasDdakNs: false, libs: [], hostDdakCss: [], maxZIndex: null, ...over,
});

beforeEach(() => {
  db.exec("DELETE FROM onboarding; DELETE FROM connect_locks;");
  net.status = async () => 200;
  browser.collect = async (_u, path) => facts({ path });
  writeFileSync(p("manifest", "widgets.yaml"), MANIFEST);
  io.write = (path, data) => writeFileSync(path, data);
  rmSync(STAGED, { recursive: true, force: true });
});
after(() => rmSync(STAGED, { recursive: true, force: true }));

// ── 스캔 (§24.3)

test("TEST-055 정적 HTML엔 없고 렌더 후에만 있는 로더도 탐지한다", async () => {
  // 정적 본문은 비어 있고, 렌더 결과에만 로더가 존재하는 상황
  browser.collect = async (_u, path) => facts({
    path,
    loaderTags: [{ src: "https://cdn/loader/loader.js", site: "s", registry: null }],
    loaderRuntime: { version: "1.1.0", site: "s", bootAt: 1 },
  });
  const scan = await scanSite("render-only", "https://x.test", ["/"]);
  assert.equal(scan.loaders.count, 1);
  assert.equal(scan.loaders.runtime, true);
  assert.equal(verdict(scan).code, "C2");
});

test("스캐너는 정적 HTML fetch로 판정하지 않는다 (§24.3)", () => {
  const src = readFileSync(p("src", "bot", "scan.ts"), "utf8");
  const scanFn = src.slice(src.indexOf("export async function scanSite"));
  const pageCollection = scanFn.slice(0, scanFn.indexOf("const regUrl"));  // registry(JSON) 조회는 별개다
  assert.ok(/browser\.collect/.test(pageCollection), "페이지 사실은 렌더 결과에서 와야 한다");
  assert.ok(!/fetch\(|net\.status/.test(pageCollection), "페이지 판정에 정적 fetch를 쓰면 안 된다");
});

test("스캔은 아임웹에 쓰지 않는다 — 쓰기 API가 존재하지 않는다", () => {
  const src = readFileSync(p("src", "bot", "scan.ts"), "utf8");
  for (const forbidden of [".click(", ".fill(", ".type(", "method: \"POST\"", "method: 'POST'"]) {
    assert.ok(!src.includes(forbidden), `스캐너에 쓰기 동작이 있다: ${forbidden}`);
  }
});

test("표본 한계 고지가 결과 첫 줄에 고정 출력된다 (REQ-034)", async () => {
  const scan = await scanSite("notice", "https://x.test", ["/a", "/b"]);
  const { summarize } = await import("../src/bot/scan.ts");
  assert.equal(summarize(scan).split("\n")[0], sampleNotice(scan.paths.length));
  assert.match(sampleNotice(3), /표본 3개 기준이며 미검사 페이지에 코드가 있을 수 있습니다/);
});

test("TEST-060 스캔 산출물에 키 문자열이 있으면 secretscan이 검출한다", () => {
  const dir = p("state", "site_scans");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const probe = p("state", "site_scans", "__probe.json");
  try {
    writeFileSync(probe, JSON.stringify({ src: ["https://x.test/a.js?key=ghp_" + "a".repeat(36)] }));
    const hits = scanRepo();
    assert.ok(hits.some((h) => h.includes("__probe.json")), `스캔 산출물이 검사 대상이어야 한다: ${hits.join(",")}`);
  } finally {
    rmSync(probe, { force: true });
  }
  assert.deepEqual(leaks(scanRepo()), [], "정리 후에는 유출 0건이어야 한다");
});

test("PTEST-039 A2는 스캔을 건너뛸 수 없다", async () => {
  const c = ctx();
  await handle("연결", c); await handle("A", c);
  const after = await handle("A", c);
  if (/변경할까요/.test(after)) await handle("예", c);
  await handle("A2", c);
  await handle("my-site2", c); await handle("https://x.test", c); await handle("예", c);
  await handle("/p", c);
  assert.equal(loadState(c)!.step, "scan", "A2는 경로 입력 후 곧바로 스캔 단계여야 한다");
  const skip = await handle("슬롯 그냥 심어줘", c);
  assert.match(skip, /'스캔' 이라고 답해주세요/);
  assert.equal(loadState(c)!.step, "scan", "스캔을 건너뛰면 안 된다");
});

// ── 이관 (D1~D6)

test("TEST-050 스냅샷 저장이 실패하면 이관을 착수하지 않는다 (INV-6)", async () => {
  io.write = () => { throw new Error("디스크 오류"); };
  assert.throws(() => snapshotOriginal("s", "console.log(1)"), /디스크 오류/);

  const c = ctx();
  await handle("이관", c); await handle(SITE, c); await handle("legacy-banner", c);
  const r = await handle("(function(){ window.__ddak = window.__ddak || {}; })();", c);
  assert.match(r, /D1 스냅샷 저장 실패/);
  assert.match(r, /착수하지 않습니다/);
  assert.ok(!existsSync(STAGED), "정본 디렉터리를 만들면 안 된다");
});

test("TEST-051 전역 셀렉터를 쓰는 기존 코드는 린트 실패를 보고하고 자동 수정하지 않는다", async () => {
  const legacy = `window.myWidget = {};\n<style>body { margin: 0 } .promo { color: red }</style>\n`;
  const errs = lintStaged("legacy-banner", legacy);
  assert.ok(errs.some((e) => e.includes("전역 오염")), "window 전역 할당을 잡아야 한다");
  assert.ok(errs.some((e) => e.includes("전역 셀렉터")), "body 셀렉터를 잡아야 한다");

  const c = ctx();
  await handle("이관", c); await handle(SITE, c); await handle("legacy-banner", c);
  const r = await handle(legacy + "// padding to reach minimum length", c);
  assert.match(r, /D3 중단/);
  assert.match(r, /자동으로 고치지 않습니다/);
  const staged = readFileSync(p("src", "widgets", "legacy-banner", "index.js"), "utf8");
  assert.ok(staged.includes("window.myWidget"), "원본 코드를 고쳐 저장하면 안 된다");
  assert.ok(!staged.includes("ddak-my"), "ddak- 를 자동으로 붙이면 안 된다");
});

test("TEST-052 D3에서 중단해도 아임웹 원본은 그대로다", async () => {
  const c = ctx();
  const before = readdirSync(p("state", "imweb_snapshots")).length;
  await handle("이관", c); await handle(SITE, c); await handle("legacy-banner", c);
  await handle("window.bad = 1; // 전역 오염으로 D3에서 멈춘다", c);
  assert.equal(readFileSync(p("manifest", "widgets.yaml"), "utf8"), MANIFEST, "manifest는 변경되지 않는다");
  assert.equal(readdirSync(p("state", "imweb_snapshots")).length, before + 1, "스냅샷은 남아 있어야 한다");
  const src = readFileSync(p("src", "bot", "migrate.ts"), "utf8");
  for (const forbidden of ["fetch(", ".click(", ".fill(", "POST", "playwright"]) {
    assert.ok(!src.includes(forbidden), `이관 모듈에 외부 쓰기 수단이 있다: ${forbidden}`);
  }
});

test("PTEST-040 D4는 enabled:false 로만 등록하고, 승인 없이는 manifest가 바뀌지 않는다", async () => {
  const c = ctx();
  await handle("이관", c); await handle(SITE, c); await handle("legacy-banner", c);
  const ok = await handle("(function(){ var el = document.createElement('div'); el.className = 'ddak-legacy'; })();", c);
  assert.match(ok, /D1~D3 통과/);
  const payload = await handle("승인 요청", c);
  assert.match(payload, /승인 요청 AP-/);
  assert.match(payload, /72시간/, "D6 관찰 기간을 안내해야 한다");
  assert.equal(readFileSync(p("manifest", "widgets.yaml"), "utf8"), MANIFEST, "승인 전에는 manifest 무변경");
});

test("D6 원본 제거는 72시간 관찰 전에는 제안되지 않는다 (§24.9)", () => {
  // 실제 배포 이력이 있든 없든 결론은 같아야 한다 — 72시간을 못 채웠으면 제안하지 않는다.
  const hrs = hoursSinceDeploy("hello-badge");
  assert.ok(hrs === null || hrs < 72, "이 검사는 관찰 기간 미달 상태를 전제로 한다");
  const r = requestOriginalRemoval("hello-badge", ctx() as any);
  assert.match(r, /72시간/);
  assert.ok(!r.includes("승인 요청 AP-"), "승인 페이로드를 만들면 안 된다");
});

/* 수집 코드가 IIFE가 아니면 모든 항목이 빈 값으로 잡혀 "깨끗한 사이트"로 오판한다.
   실제로 스크립트 109개인 사이트를 0개로 보고한 사고가 있었다. */
test("수집 코드는 즉시 실행 식이어야 한다", async () => {
  const { COLLECT_JS } = await import("../src/bot/scan.ts");
  assert.ok(COLLECT_JS.trimStart().startsWith("(()"), "화살표 함수만 넘기면 호출되지 않는다");
  assert.ok(COLLECT_JS.trimEnd().endsWith("})()"), "즉시 실행 괄호가 있어야 한다");
  // 브라우저 없이 셰임 DOM으로 실제 수집 결과를 확인한다.
  const { runInNewContext } = await import("node:vm");
  const el = (attrs: Record<string, string> = {}, src = "") => ({
    src, textContent: "x", classList: [], dataset: {},
    getAttribute: (k: string) => attrs[k] ?? null,
  });
  const nodes = [el({}, "https://host/a.js"), el({}, "https://host/b.js")];
  const facts: any = runInNewContext(COLLECT_JS, {
    document: {
      querySelectorAll: (sel: string) => (sel === "script" ? nodes : []),
      styleSheets: [],
    },
    window: {}, getComputedStyle: () => ({ zIndex: "auto" }),
    Array, Set, Math, parseInt, isNaN,
  });
  assert.equal(facts.scripts.length, 2, "스크립트를 실제로 세야 한다");
  assert.equal(facts.loaderTags.length, 0);
});
