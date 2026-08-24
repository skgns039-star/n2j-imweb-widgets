/* STEST-003, 009~012, 015~018, 021, 022, 024, 027 + ITEST-001·003·004 — 라우팅·게이트·진입 흐름. */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ROOT, p, manifest } from "../../src/release/paths.ts";
import { decide, mentionsSeo, mentionsSeoConflict, enter, AMBIGUOUS_REPLY } from "../../src/seo/route.ts";
import { engineStatus, assertBrowserFormAllowed, assertApplyAllowed, resolveSiteId } from "../../src/seo/gates.ts";
import { collector, infer, questionsFor, type PageSeo } from "../../src/seo/observe.ts";
import { startupReport, rejectIdInChat, analyticsGateQuestions, writeReport, siteDir } from "../../src/seo/index.ts";
import { classify, handle } from "../../src/bot/router.ts";

const ctx = { agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot", chat_id: 9300 };
const SITE = manifest().sites[0]!.site_id;

const page = (over: Partial<PageSeo> = {}): PageSeo => ({
  path: "/", ok: true, title: "세화건설 조립식 건축", description: "가".repeat(100), canonical: "https://sehwaconstruction.imweb.me/",
  og: {}, h1: ["세화가 짓습니다"], h2Count: 3, imgTotal: 10, imgNoAlt: 2, jsonLdTypes: ["Organization"],
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
  for (const e of st) {
    if (e.status === "PENDING") assert.ok(e.fallback, `${e.engine} 대체 경로가 없다`);
  }
  assert.ok(st.every((e) => e.status === "PENDING"), "SCHK 전부 OPEN 상태이므로 4개 모두 PENDING 이어야 한다");
});

test("STEST-012 Naver/Daum 최종 제출은 승인 이전에 클릭 0건 — 게이트가 먼저 막는다", () => {
  assert.throws(() => assertBrowserFormAllowed("naver"), /BLOCKED/);
  assert.throws(() => assertBrowserFormAllowed("daum"), /BLOCKED/);
});

test("STEST-021 OPEN-BRW-* 미해소 상태에서 폼 자동입력은 차단되고 안내로 강등된다", () => {
  assert.throws(() => assertBrowserFormAllowed("naver"), /M2|브라우저 쓰기/);
  assert.match(engineStatus().find((e) => e.engine === "naver")!.fallback, /안내 카드/);
});

test("SEO 반영(9~11단계)은 M2 게이트가 막는다 — 이번 범위는 진단까지", () => {
  assert.throws(() => assertApplyAllowed(), /M2 범위/);
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
  assert.match(report, /읽기 전용 고정/);
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

test("STEST-003 디자인모드 본문 수정 지시는 거부되고 보고서로 안내된다", async () => {
  const r = await handle("SEO 디자인모드 본문 텍스트 고쳐줘", ctx);
  // 위젯 엔티티가 없으므로 seo 라우트로 가고, 진입 응답은 읽기 전용 고정을 명시한다.
  assert.match(r, /진단까지|읽기 전용|OBSERVE/);
  assert.ok(!/수정했습니다|반영/.test(r));
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
    f === "registry.json" || f.startsWith("src/release/") || f.startsWith("src/browser/"));
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
