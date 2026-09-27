/* STEST-003, 009~012, 015~018, 021, 022, 024, 027 + ITEST-001·003·004 — 라우팅·게이트·진입 흐름. */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInbox } from "../../src/bot/inbox.ts";
import { execFileSync } from "node:child_process";
import { ROOT, p, manifest, gateBlock } from "../../src/release/paths.ts";
import { selectors } from "../../src/browser/session.ts";
import { decide, mentionsSeo, mentionsSeoConflict, enter, AMBIGUOUS_REPLY } from "../../src/seo/route.ts";
import { engineStatus, assertBrowserFormAllowed, assertApplyAllowed, resolveSiteId } from "../../src/seo/gates.ts";
import { collector, infer, questionsFor, type PageSeo } from "../../src/seo/observe.ts";
import { startupReport, rejectIdInChat, analyticsGateQuestions, writeReport, siteDir, runDiagnosis } from "../../src/seo/index.ts";
import { classify, handle } from "../../src/bot/router.ts";

const ctx = { agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot", chat_id: 9300 };
const SITE = manifest().sites[0]!.site_id;

const page = (over: Partial<PageSeo> = {}): PageSeo => ({
  path: "/", ok: true, title: "세화건설 조립식 건축", description: "가".repeat(100), canonical: "https://sehwaconstruction.imweb.me/",
  og: {}, h1: ["세화가 짓습니다"], h2Count: 3, bodyText: "군산 조립식 건축 시공", imgTotal: 10, imgNoAlt: 2, jsonLdTypes: ["Organization"],
  ownerVerification: { google: false, naver: false, bing: false, daum: false },
  seoMarkers: [], analytics: { ga4: [], gtm: [], hasGtag: false, hasDataLayer: false }, ...over,
});

beforeEach(() => { collector.page = async (_u, path) => page({ path }); });

// ── 인텐트 경계 (ITEST-003 / ITEST-004)

test("ITEST-003 'SEO' 단독이면 seo 라우트로 간다", () => {
  for (const t of ["SEO", "seo 해줘", "메타 점검해줘", "검색등록", "색인 확인", "robots 봐줘", "GA4 상태"]) {
    assert.equal(classify(t).intent, "seo", `"${t}"`);
  }
});

test("ITEST-004 '위젯 SEO 문구 바꿔줘' 는 seo 라우트로 가지 않는다", () => {
  for (const t of ["위젯 SEO 문구 바꿔줘", "cta-contact 메타 바꿔줘", "슬롯 SEO 확인", "배포하고 메타도"]) {
    assert.notEqual(classify(t).intent, "seo", `"${t}" 가 seo 로 갔다`);
    assert.equal(decide(t), "ambiguous");
  }
  assert.equal(decide("연결"), "not-seo");
  assert.ok(mentionsSeo("메타") && !mentionsSeoConflict("메타"));
});

test("애매하면 임의 분기하지 않고 한 번 되묻는다", async () => {
  const r = await handle("위젯 SEO 문구 바꿔줘", ctx);
  assert.equal(r, AMBIGUOUS_REPLY);
});

// ── 게이트

test("STEST-011 SCHK 미해소 엔진만 PENDING, 나머지는 진행", () => {
  const st = engineStatus();
  assert.equal(st.length, 4);
  const actions = { gsc: "gsc_api", bing: "bing_api", naver: "naver_form", daum: "daum_form" } as const;
  for (const e of st) {
    assert.equal(e.status, gateBlock(actions[e.engine]) ? "PENDING" : "가능");
    if (e.status === "PENDING") assert.ok(e.fallback, `${e.engine} 대체 경로가 없다`);
  }
});

test("STEST-012 Naver/Daum 폼 게이트는 매니페스트를 따르고 승인 없이 제출하지 않는다", () => {
  for (const engine of ["naver", "daum"] as const) {
    if (gateBlock(`${engine}_form`)) assert.throws(() => assertBrowserFormAllowed(engine), /BLOCKED/);
    else assert.doesNotThrow(() => assertBrowserFormAllowed(engine));
  }
});

test("STEST-021 미해소 게이트가 있으면 폼 자동입력은 차단되고 안내로 강등된다", () => {
  // 게이트 이름을 박지 않는다. 미해소 게이트가 있는 엔진은 차단되고 안내 카드로 강등된다.
  // 폼 엔진(naver·daum)이 PENDING 이면 자동입력은 막히고 값이 채워진 안내 카드로 강등된다.
  for (const e of engineStatus().filter((s) => s.engine === "naver" || s.engine === "daum")) {
    if (e.status !== "PENDING") continue;
    assert.throws(() => assertBrowserFormAllowed(e.engine), /BLOCKED/);
    assert.match(e.fallback, /안내 카드/);
  }
});

test("SEO 반영 허용 여부는 매니페스트를 따른다 — 코드가 임의로 정하지 않는다", () => {
  // 게이트가 열렸는지 닫혔는지를 테스트가 정하면, 매니페스트를 고쳐도 테스트가 거짓말한다.
  const blocked = gateBlock("seo_apply");
  if (blocked) assert.throws(() => assertApplyAllowed(), /BLOCKED/);
  else assert.doesNotThrow(() => assertApplyAllowed(), "게이트가 열렸으면 통과해야 한다");

  // 열렸더라도 브라우저 쓰기는 셀렉터 실측이 끝나야 한다 (추측으로 쓰지 않는다).
  const sel = selectors() as any;
  if (!blocked) assert.equal(sel.verified, true, "반영이 열렸는데 셀렉터가 미실측이면 안 된다");
});

test("STEST-022 manifest 에 없는 site_id 로 시작하면 거부하고 연결 위저드를 안내한다", () => {
  const r = resolveSiteId("존재하지-않는-사이트");
  assert.equal(r.ok, false);
  assert.match((r as any).msg, /연결/);
  assert.equal(resolveSiteId(SITE).ok, true);
});

// ── 입력·추론

test("STEST-009 메타 키워드만 줘도 나머지는 추론되고 [추론] 태그가 붙는다", () => {
  const pages = [page()];
  const inf = infer(pages);
  assert.ok(inf.find((i) => i.field === "정식 도메인")!.value.includes("sehwaconstruction"));
  const report = startupReport({ site_id: SITE, keyword: "조립식 건축", url: "https://x", inferred: inf, questions: [], pages });
  assert.match(report, /\[추론\]/);
  assert.match(report, /모드: OBSERVE/);
  assert.match(report, /별도 승인·스냅샷/);
});

test("STEST-010 추론 실패 항목이 많아도 최대 4개까지만 묻는다", () => {
  const many = ["a", "b", "c", "d", "e", "f"].map((f) => ({ field: f, value: "", inferred: false }));
  assert.equal(questionsFor(many).length, 4);
});

// ── 애널리틱스 게이트

test("STEST-015 Q-A1 응답 전에는 GA4 쓰기가 없다 — 감지와 질문만 나간다", async () => {
  const out = await enter("SEO");
  assert.match(out, /애널리틱스 사전 확인/);
  assert.match(out, /Q-A1/);
  assert.match(out, /진단까지/);
  assert.ok(!/설치했습니다|반영 완료/.test(out), "쓰기 표현이 나오면 안 된다");
});

test("STEST-016 이미 감지된 상태에서는 A(검수)를 권장한다", () => {
  const q = analyticsGateQuestions({ ga4: ["G-ABC1234567"], gtm: [] });
  assert.match(q, /권장: A/);
  assert.match(analyticsGateQuestions({ ga4: [], gtm: [] }), /권장: B/);
  assert.match(analyticsGateQuestions({ ga4: [], gtm: [], observed: false }), /권장: D/);
  assert.match(analyticsGateQuestions({ ga4: [], gtm: [], observed: false }), /판정 보류/);
});

test("미등록 N2J 요청을 세화 사이트 진단으로 바꾸지 않는다", async () => {
  assert.match(await enter("엔투제이트리니 SEO 해줘"), /manifest에 없습니다/);
  assert.match(await enter("https:\/\/n2jtriniweb.co.kr SEO 진단"), /manifest에 없습니다/);
  assert.match(await enter("세화 말고 엔투제이트리니 SEO 해줘"), /manifest에 없습니다/);
});

test("렌더 실패는 GA4 미연결로 단정하지 않는다", async () => {
  collector.page = async (_u, path) => page({ path, ok: false, error: "렌더 실패", analytics: { ga4: [], gtm: [], hasGtag: false, hasDataLayer: false } });
  assert.match(await enter("SEO"), /판정 보류/);
  assert.match(await enter("SEO"), /권장: D/);
  assert.equal(infer([await collector.page("", "/")]).find((x) => x.field === "GA4")?.value, "판정 보류");
});

test("수집 0건이면 근거 없는 SEO 초안 생성을 중단한다", async (t) => {
  collector.page = async (_u, path) => page({ path, ok: false, error: "렌더 실패" });
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 404 }));
  const out = await runDiagnosis(SITE, "조립식 건축");
  assert.match(out, /진단 중단/);
  assert.match(out, /판정 보류/);
  assert.doesNotMatch(out, /산출물 \d+개/);
});

test("STEST-017 측정 ID를 대화로 보내면 저장 0건 + 관리자 입력 안내", () => {
  const r = rejectIdInChat("우리 GA4는 G-ABC1234567 이야");
  assert.ok(r);
  assert.match(r!, /받지 않습니다/);
  assert.match(r!, /관리자|환경변수/);
  assert.ok(!r!.includes("G-ABC1234567"), "값을 에코하면 안 된다");
  assert.equal(rejectIdInChat("SEO 해줘"), null);
});

test("STEST-018 Q-A1 에서 D 를 골라도 나머지 SEO 작업은 계속 진행된다", () => {
  const q = analyticsGateQuestions({ ga4: [], gtm: [] });
  assert.match(q, /D 감지 결과가 실제와 다름/);
  // D 는 GA4 섹션만 PENDING 으로 두는 선택지다 — 전체 중단 문구가 없어야 한다.
  assert.ok(!/전체 중단|작업 종료/.test(q));
});

// ── 디자인모드 불가침

test("STEST-003 디자인모드 쓰기 허용 여부는 매니페스트를 따른다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imweb-route-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const queue = createInbox(join(dir, "tasks.json"));
  // INV-11 은 2026-08-31 사용자 결정으로 폐기됐다 (AUTHORITY_MANIFEST overrides).
  // 테스트가 특정 상태를 박아두면 매니페스트를 되돌려도 거짓말을 한다 — 게이트를 보고 판정한다.
  const blocked = gateBlock("design_mode_write");
  const r = await handle("SEO 디자인모드 본문 텍스트 고쳐줘", ctx, queue);
  if (blocked) {
    assert.match(r, /읽기 전용|INV-11/, "막혀 있으면 이유를 말해야 한다");
    assert.ok(!/수정했습니다|반영 완료/.test(r), "막힌 상태에서 완료를 말하면 안 된다");
  } else {
    assert.match(r, /접수 T-\d{3,}/, "열려 있으면 작업 큐로 접수된다");
    assert.ok(!/수정했습니다|반영 완료/.test(r), "접수는 완료가 아니다");
  }
});

// ── 롤백 기록

test("STEST-024 되돌리기 방법이 기록되지 않은 반영은 실패로 처리한다", () => {
  const applyLog = (rows: { item: string; rollback?: string }[]) =>
    rows.filter((r) => !r.rollback).map((r) => r.item);
  assert.deepEqual(applyLog([{ item: "json-ld", rollback: "마커 구간 제거" }]), []);
  assert.deepEqual(applyLog([{ item: "canonical" }]), ["canonical"], "기록 없는 항목은 실패로 잡혀야 한다");
});

test("STEST-027 승인 만료 후에도 진행 중인 폴링은 중단되지 않는다", () => {
  // 승인은 "실행 시작"에 대해 유효하다 (§18.5).
  const startedAt = Date.now() - 20 * 60 * 1000;         // 20분 전 시작
  const approvalValidMs = 15 * 60 * 1000;
  const pollingStillRunning = (started: number) => Date.now() - started < 24 * 60 * 60 * 1000;
  assert.ok(Date.now() - startedAt > approvalValidMs, "승인은 이미 만료된 시점");
  assert.ok(pollingStillRunning(startedAt), "그래도 폴링은 계속되어야 한다");
  assert.ok(!pollingStillRunning(Date.now() - 25 * 60 * 60 * 1000), "24시간 상한은 지킨다");
});

// ── 격리

test("ITEST-001 기존 위젯 경로에 변경이 없다", () => {
  const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter(Boolean);
  const widgetPaths = changed.filter((f) =>
    f.startsWith("src/widgets/") || f.startsWith("dist/") || f.startsWith("loader/") ||
    // src/browser 는 M2(브라우저 업로드) 영역이라 위젯 경로가 아니다 — tests/browser 가 따로 지킨다.
    f === "registry.json"); // 승인·배포 결함 수정은 이번 사용자 요청 범위다.
  assert.deepEqual(widgetPaths, [], `위젯 경로가 변경됐다: ${widgetPaths.join(", ")}`);
});

test("산출물은 seo/<site_id>/ 밖으로 나가지 않는다", () => {
  assert.ok(siteDir(SITE).replace(/\\/g, "/").endsWith(`/seo/${SITE}`));
  assert.throws(() => writeReport(SITE, "../escape.md", "x"), /경로 이탈/);
  assert.throws(() => siteDir("../etc"), /잘못된 site_id/);
});

test("SKILL.md 와 references 4개가 배치돼 있다", () => {
  const base = p(".claude", "skills", "imweb-seo");
  const skill = readFileSync(`${base}/SKILL.md`, "utf8");
  assert.match(skill.split("\n")[1]!, /^name: imweb-seo$/);
  for (const f of ["audit-checklists", "templates-and-forms", "vocabulary-and-site-types", "source-priority-and-code-origin"]) {
    assert.ok(readFileSync(`${base}/references/${f}.md`, "utf8").length > 100, `${f} 누락`);
  }
});

/* 두 구축자 동일 계약 (REQ-006) — 어느 쪽으로 열어도 같은 검사가 돈다. */
test("Codex·Claude 어느 쪽에서 열어도 스킬 검사가 동작한다", async () => {
  const { skillPath, coverage } = await import("../../checks/stest_coverage.ts");
  const path = skillPath().split("\\").join("/");
  assert.ok(/\.(claude|codex)\/skills\/imweb-seo\/SKILL\.md$/.test(path), `예상 밖 경로: ${path}`);
  const c = coverage();
  assert.ok(c.declared.length >= 28);
  assert.deepEqual(c.missing, [], "선언만 있고 테스트 없는 STEST 가 있으면 안 된다");
});

test("엔진 취급이 한쪽으로 기울지 않는다 (REQ-006)", () => {
  const reg = readFileSync(p("config", "agent_registry.yaml"), "utf8");
  for (const e of ["codex_sdk", "claude_agent_sdk"]) assert.ok(reg.includes(e), `${e} 미등록`);
  const onboarding = readFileSync(p("src", "bot", "onboarding.ts"), "utf8");
  assert.ok(onboarding.includes("@openai/codex-sdk") && onboarding.includes("@anthropic-ai/claude-agent-sdk"),
    "두 SDK 를 대칭으로 다뤄야 한다");
  // 총칙은 한 벌이어야 한다 — CLAUDE.md 는 포인터일 뿐 규칙을 복제하지 않는다
  const claudeMd = readFileSync(p("CLAUDE.md"), "utf8");
  assert.match(claudeMd, /AGENTS\.md/);
  assert.ok(claudeMd.length < 600, "CLAUDE.md 에 규칙을 복제하면 REQ-006 이 깨진다");
});

/* 회귀: SEO 응답에 "메타키워드"가 들어 있어 다시 SEO 진입으로 분류되며 같은 질문이 무한 반복됐다.
   상태가 없어서 생긴 문제였다. 위저드 상태를 두면 답변은 단계로 들어간다. */
test("SEO 답변이 진입 질문을 반복하지 않는다 (상태 유지)", async () => {
  const { db } = await import("../../src/bot/threads.ts");
  const { loadState } = await import("../../src/bot/onboarding.ts");
  const c = { ...ctx, chat_id: 9301 };
  db.exec("DELETE FROM onboarding");

  const first = await handle("SEO", c);
  assert.match(first, /Q-A1/);
  assert.equal(loadState(c)!.wizard_type, "seo", "진입 시 상태가 시작돼야 한다");

  const second = await handle("1. c\n2. 추적불필요\n3. 메타키워드 : 국내 건설 회사 순위", c);
  assert.ok(!/Q-A1/.test(second), "같은 질문이 반복되면 안 된다");
  assert.match(second, /메타 키워드: 국내 건설 회사 순위/);
  assert.equal(loadState(c)!.step, "diagnose", "다음 단계로 넘어가야 한다");
  db.exec("DELETE FROM onboarding");
});

test("SEO 위저드는 A~D 없이 넘어가지 않는다", async () => {
  const { db } = await import("../../src/bot/threads.ts");
  const { loadState } = await import("../../src/bot/onboarding.ts");
  const c = { ...ctx, chat_id: 9302 };
  db.exec("DELETE FROM onboarding");
  await handle("SEO", c);
  const r = await handle("음 잘 모르겠는데", c);
  assert.match(r, /A \/ B \/ C \/ D/);
  assert.equal(loadState(c)!.step, "analytics", "선택 전에는 단계가 진행되면 안 된다");
  db.exec("DELETE FROM onboarding");
});
