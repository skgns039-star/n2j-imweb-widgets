/* ENG-041/044/045 — 연결 위저드 · 락 · 인텐트 경계.
   TEST-039~047, TEST-053, TEST-056~059 / PTEST-038, PTEST-041, PTEST-042. */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { p, json } from "../src/release/paths.ts";
import { handle, classify, mentionsConnect, mentionsEntity } from "../src/bot/router.ts";
import { WIZARDS, loadState, cancel, acquireLock, holdsLock, saveState, expire } from "../src/bot/onboarding.ts";
import { net, browser, type PageFacts } from "../src/bot/scan.ts";
import { request, load, type Approval } from "../src/release/approval.ts";
import { db } from "../src/bot/threads.ts";

const ctx = (chat = 9001) => ({
  agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot", chat_id: chat,
});

const MANIFEST = readFileSync(p("manifest", "widgets.yaml"), "utf8");
const restoreManifest = () => writeFileSync(p("manifest", "widgets.yaml"), MANIFEST);

/** 렌더 결과를 주입한다. 실제 브라우저·네트워크는 쓰지 않는다. */
function stubFacts(over: Partial<PageFacts> = {}) {
  browser.collect = async (_url, path) => ({
    path, ok: true, loaderTags: [], loaderRuntime: null, scripts: [], slots: [],
    ddakClasses: [], hasDdakNs: false, libs: [], hostDdakCss: [], maxZIndex: null, ...over,
  });
}
const LOADER_TAG = { src: "https://cdn.jsdelivr.net/gh/o/r@loader-1.1.0/loader/loader.js", site: "s", registry: "https://cdn/registry.json" };

beforeEach(() => {
  db.exec("DELETE FROM onboarding; DELETE FROM connect_locks;");
  net.status = async () => 200;
  stubFacts();
  restoreManifest();
});

// ── 인텐트 경계 (§24.8 / PTEST-042)

test("TEST-039 '연결'만 입력하면 소유권 확인부터 물어본다", async () => {
  const r = await handle("연결", ctx());
  assert.match(r, /직접 소유·관리/);
  assert.match(r, /A 본인 계정/);
  const menu = await handle("A", ctx());
  for (const opt of ["A 아임웹 사이트", "B 실행 엔진", "C GitHub", "D 텔레그램"]) assert.ok(menu.includes(opt), `${opt} 누락`);
});

test("TEST-058 '이 위젯을 슬롯에 연결해줘'는 connect로 가지 않는다", () => {
  assert.equal(classify("이 위젯을 슬롯에 연결해줘").intent, "unclear");
  assert.equal(classify("hello-badge를 content 슬롯에 붙여줘").intent, "unclear");
  assert.equal(classify("연결").intent, "connect");
  assert.equal(classify("사이트 연동해줘").intent, "connect");
  assert.ok(mentionsConnect("연동") && !mentionsEntity("연동"));
});

test("PTEST-042 애매하면 임의 분기하지 않고 한 번 되묻는다", async () => {
  const r = await handle("이 위젯을 슬롯에 연결해줘", ctx());
  assert.match(r, /한 번만 확인/);
  assert.equal(loadState(ctx()), null, "되묻는 동안 위저드를 시작하면 안 된다");
});

test("TEST-059 소유권 C를 고르면 위저드가 종료된다", async () => {
  await handle("연결", ctx());
  const r = await handle("C", ctx());
  assert.match(r, /연결을 종료/);
  assert.equal(loadState(ctx()), null);
});

// ── 비밀값 (REQ-027 / PTEST-038)

test("TEST-042 봇 토큰 형식 문자열은 저장·로그 0건 + 재발급 권고", async () => {
  const fake = "1234567890:AAH" + "z".repeat(32);
  const before = readdirSync(p("logs", "approvals")).length;
  const r = await handle(fake, ctx());
  assert.match(r, /받지 않습니다/);
  assert.match(r, /재발급/, "재발급 권고가 반드시 포함돼야 한다");
  assert.ok(!r.includes(fake), "값을 에코하면 안 된다");
  assert.equal(loadState(ctx()), null, "상태로 저장되면 안 된다");
  assert.equal(readdirSync(p("logs", "approvals")).length, before, "승인 기록이 생기면 안 된다");
  const dump = JSON.stringify(db.prepare("SELECT * FROM onboarding").all());
  assert.ok(!dump.includes(fake), "DB에 값이 남으면 안 된다");
});

test("PTEST-038 위저드는 비밀값 입력을 요구하는 질문을 만들지 않는다", () => {
  const ASK_SECRET = /(토큰|시크릿|secret|password|비밀번호|api ?key)[^\n]{0,20}(입력|보내|알려|붙여넣)/i;
  const seen: string[] = [];
  for (const w of new Set(Object.values(WIZARDS))) {
    for (const [name, step] of Object.entries(w.steps)) {
      let text = "";
      try { text = step.ask({ url: "https://x.test", site_id: "s", branch: "A", engine: "dry_run", scan: { loaders: {} } }, ctx() as any); }
      catch { continue; }
      seen.push(`${w.type}.${name}`);
      assert.ok(!ASK_SECRET.test(text), `${w.type}.${name} 이 비밀값 입력을 요구한다: ${text.slice(0, 80)}`);
    }
  }
  assert.ok(seen.length >= 8, "검사된 질문이 너무 적다");
});

// ── 진행·중단·재개 (REQ-028)

async function toSiteId(c = ctx()) {
  await handle("연결", c); await handle("A", c); await handle("A", c); await handle("A2", c);
}

test("TEST-040 잘못된 URL은 재질문하고 다음 단계로 넘어가지 않는다", async () => {
  await toSiteId(); await handle("my-site", ctx());
  const bad = await handle("htp:/broken", ctx());
  assert.match(bad, /https:\/\/ 로 시작/);
  assert.equal(loadState(ctx())!.step, "url", "단계가 진행되면 안 된다");

  net.status = async () => 404;
  const notFound = await handle("https://nope.test", ctx());
  assert.match(notFound, /200을 주지 않습니다/);
  assert.equal(loadState(ctx())!.step, "url");
});

test("TEST-043 취소 후 재시작하면 처음부터, 락도 풀린다", async () => {
  await toSiteId(); await handle("my-site", ctx());
  assert.ok(holdsLock("my-site", ctx() as any));
  const c = await handle("취소", ctx());
  assert.match(c, /취소했습니다/);
  assert.ok(!holdsLock("my-site", ctx() as any), "락이 풀려야 한다");
  const again = await handle("연결", ctx());
  assert.match(again, /직접 소유·관리/, "처음부터 다시 시작해야 한다");
});

test("TEST-044 끊고 '이어서'라고 하면 마지막 단계부터", async () => {
  await toSiteId(); await handle("my-site", ctx());
  const step = loadState(ctx())!.step;
  const resumed = await handle("이어서", ctx());
  assert.equal(loadState(ctx())!.step, step);
  assert.match(resumed, /공개 URL/);
});

test("TEST-057 위저드가 만료되면 대기 중 승인도 함께 무효화된다", async () => {
  const a = request("cdn_deploy", "t@0.0.1", { widget_id: "t" }, 9001);
  saveState(ctx(), { wizard_type: "site", step: "url", answers: {} });
  assert.equal(load(a.id)!.status, "PENDING");
  expire(ctx());
  assert.equal((load(a.id) as Approval).status, "EXPIRED", "orphan 승인을 남기면 안 된다");
  assert.equal(loadState(ctx()), null);
});

// ── 락 (§24.6 / PTEST-041)

test("TEST-056 두 대화가 같은 site_id를 동시에 연결하면 두 번째는 거부된다", async () => {
  const c1 = ctx(1), c2 = ctx(2);
  assert.equal(acquireLock("dup-site", c1 as any), true);
  assert.equal(acquireLock("dup-site", c2 as any), false);
  cancel(c1 as any);
  assert.equal(acquireLock("dup-site", c2 as any), true);
});

test("PTEST-041 락을 잃으면 manifest를 커밋하지 않는다", async () => {
  await toSiteId(); await handle("my-site", ctx());
  db.exec("DELETE FROM connect_locks");                       // 락 강제 소실
  const st = loadState(ctx())!;
  saveState(ctx(), { ...st, step: "commit" });
  const r = await handle("승인 요청", ctx());
  assert.match(r, /락을 잃었습니다/);
  assert.equal(readFileSync(p("manifest", "widgets.yaml"), "utf8"), MANIFEST, "manifest가 변경되면 안 된다");
});

// ── 스캔 판정 (C1~C4)

async function runScan(c = ctx()) {
  await toSiteId(c); await handle("my-site", c); await handle("https://x.test", c);
  await handle("예", c); await handle("/product/1", c);
  return await handle("스캔", c);
}

test("TEST-046 로더 2개면 BLOCKED이고 자동 제거가 없다", async () => {
  stubFacts({ loaderTags: [LOADER_TAG, { ...LOADER_TAG }] });
  const r = await runScan();
  assert.match(r, /C4/);
  assert.match(r, /자동으로 제거하지 않습니다/);
  assert.equal(loadState(ctx()), null, "연결 실패로 종료돼야 한다");
});

test("TEST-047 로더 1개 최신이면 삽입 안내 0건, '이미 연결됨'", async () => {
  stubFacts({ loaderTags: [LOADER_TAG], loaderRuntime: { version: "1.1.0", site: "my-site", bootAt: 1 } });
  const r = await runScan();
  assert.match(r, /이미 연결됨/);
  assert.ok(!r.includes("삽입 위치"), "삽입 안내를 내면 안 된다");
  assert.equal(loadState(ctx())!.step, "commit");
});

test("TEST-048 구버전 로더는 승인 없이 교체되지 않는다", async () => {
  stubFacts({ loaderTags: [LOADER_TAG], loaderRuntime: { version: "1.0.0", site: "my-site", bootAt: 1 } });
  const r = await runScan();
  assert.match(r, /C3/);
  assert.match(r, /명시 승인이 필요/);
  assert.equal(loadState(ctx())!.step, "replace_approve");
  const payload = await handle("승인 요청", ctx());
  assert.match(payload, /승인 요청 AP-/);
  assert.match(payload, /사람이 직접 교체/, "에이전트가 교체를 실행하면 안 된다");
});

test("TEST-049 기존 커스텀 코드는 이관 제안 없이 보고만 한다", async () => {
  stubFacts({ scripts: [{ src: "https://host.test/custom.js", inline: false }, { src: null, inline: true }] });
  const r = await runScan();
  assert.match(r, /그대로 둡니다/);
  assert.match(r, /정리·개선을 먼저 제안하지 않습니다/);
  assert.ok(!/이관을 진행|이관할까요/.test(r), "이관을 먼저 제안하면 안 된다");
});

test("E1·E2·E4 충돌은 연결 실패다 (경고 강등 불가)", async () => {
  stubFacts({ slots: ["content", "content"], hostDdakCss: ["ddak-badge"] });
  const r = await runScan();
  assert.match(r, /연결 실패로 처리/);
  assert.match(r, /E1 slot 이름 중복/);
  assert.match(r, /E2 호스트 CSS/);
  assert.equal(loadState(ctx()), null);
});

test("TEST-041 로더 미삽입 상태에서 '삽입했어'라고 하면 검증 실패로 보고한다", async () => {
  await toSiteId(); await handle("my-site", ctx()); await handle("https://x.test", ctx());
  await handle("예", ctx()); await handle("/product/1", ctx());
  await handle("스캔", ctx());                    // C1 → slots
  await handle("아니오", ctx());                  // 슬롯 미사용 → snippet
  assert.equal(loadState(ctx())!.step, "snippet");
  const r = await handle("삽입했어", ctx());
  assert.match(r, /확인 실패/);
  assert.equal(loadState(ctx())!.step, "snippet", "검증 실패 시 다음 단계로 가면 안 된다");
});

test("TEST-053 A3 재연결에서 차이가 없으면 커밋 0건", async () => {
  const c = ctx();
  await handle("연결", c); await handle("A", c); await handle("A", c); await handle("A3", c);
  await handle("test-site", c);                   // manifest에 이미 있는 site_id
  await handle("https://x.test", c); await handle("예", c); await handle("/product/1", c);
  stubFacts({ loaderTags: [LOADER_TAG], loaderRuntime: { version: "1.1.0", site: "test-site", bootAt: 1 },
    slots: ["header", "content", "footer"] });                 // manifest와 동일 → 차이 없음
  const r = await handle("스캔", c);
  assert.match(r, /변경 없음/);
  assert.equal(readFileSync(p("manifest", "widgets.yaml"), "utf8"), MANIFEST);
  assert.equal(loadState(c), null);
});

test("스캔 결과가 정본 판정을 Git 기준으로 낸다 (§24.5) — 어느 쪽이 정본이냐고 묻지 않는다", async () => {
  stubFacts({ slots: ["hero"], loaderTags: [LOADER_TAG], loaderRuntime: { version: "1.1.0", site: "my-site", bootAt: 1 } });
  const r = await runScan();
  assert.match(r, /정본은 Git입니다/);
  assert.match(r, /드리프트/);
  assert.ok(!/어느 쪽이 정본/.test(r));
});

// ── 엔진 (TEST-045)

/** 엔진 분기 진입. 이미 연결돼 있으면 "변경할까요?"를 한 번 더 지나야 한다. */
async function toEngineWizard(c = ctx()) {
  await handle("연결", c); await handle("A", c);
  const after = await handle("B", c);
  if (/변경할까요/.test(after)) await handle("예", c);
}

test("TEST-045 두 엔진 동시 활성화는 거부된다", async () => {
  const c = ctx();
  await toEngineWizard(c);
  const r = await handle("codex_sdk 랑 claude_agent_sdk 둘 다", c);
  assert.match(r, /동시 활성화는 거부/);
  assert.equal(loadState(c)!.step, "choose", "진행되면 안 된다");
  const okr = await handle("codex_sdk", c);
  assert.match(okr, /codex-sdk/);
  assert.equal(loadState(c)!.step, "auth");
});

test("승인 없이는 설정이 파일에 반영되지 않는다 (INV-8)", async () => {
  const c = ctx();
  const before = readFileSync(p("config", "agent_registry.yaml"), "utf8");
  const other = before.includes("runtime_engine: dry_run") ? "codex_sdk" : "dry_run";
  await toEngineWizard(c);
  await handle(other, c); await handle("확인", c);
  const pending = readdirSync(p("logs", "approvals"))
    .map((f) => json<Approval>(`logs/approvals/${f}`)).filter((a) => a.action === "engine_switch" && a.status === "PENDING");
  assert.ok(pending.length > 0, "승인 페이로드가 있어야 한다");
  assert.equal(readFileSync(p("config", "agent_registry.yaml"), "utf8"), before, "승인 전에는 config 무변경");
});
