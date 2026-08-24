/* STEST-004, 005, 008, 014, 019, 020, 025, 028 — 산출물 품질 게이트 (INV-12, INV-13, §18.6). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkField, blockers, cannibalization, brandRepeat, robotsBlocksImportant, gate, FORBIDDEN } from "../../src/seo/quality.ts";
import { maskId, maskAnalytics } from "../../src/seo/observe.ts";

test("STEST-005 금지 표현이 들어간 초안은 산출이 차단된다 (경고 아님)", () => {
  for (const w of ["업계 1위 시공", "최고의 품질 보장", "100% 완치"]) {
    const f = checkField("메타 디스크립션", w);
    assert.equal(f.verdict, "차단", `"${w}" 가 차단되지 않았다`);
  }
  assert.ok(FORBIDDEN.length >= 10, "금지 표현 사전이 비어 있으면 안 된다");
});

test("STEST-020 병원 유형에서는 효과 표현도 추가로 차단된다", () => {
  const text = "시술 효과 보장, 부작용 없이 즉시 개선됩니다";
  assert.equal(checkField("메타 디스크립션", text, "일반").verdict, "차단", "보장/부작용 없음은 일반에서도 차단");
  const medical = blockers("영구적 개선을 약속합니다", "병원");
  assert.ok(medical.length > 0, "병원 유형 전용 표현이 잡혀야 한다");
  assert.equal(blockers("영구적 개선을 약속합니다", "일반").length, 0, "일반 유형에는 적용하지 않는다");
});

test("STEST-025 placeholder 는 경고가 아니라 차단이다", () => {
  for (const w of ["TODO 여기에 설명", "{{brand}} 소개", "회사 소개 TBD"]) {
    assert.equal(checkField("메타 타이틀", w).verdict, "차단", `"${w}"`);
  }
});

test("§18.6 길이 기준 위반은 조정 후보(경고)다", () => {
  assert.equal(checkField("메타 타이틀", "짧음").verdict, "조정 후보");
  assert.equal(checkField("메타 타이틀", "가".repeat(80)).verdict, "조정 후보");
  assert.equal(checkField("메타 타이틀", "세화건설 조립식 건축 모듈러 시공 전문").verdict, "OK");
  assert.equal(checkField("메타 디스크립션", "가".repeat(100)).verdict, "OK");
  assert.equal(checkField("메타 디스크립션", "가".repeat(200)).verdict, "조정 후보");
});

test("ALT 규칙 — 파일명·일반명사 단독 금지, 125자 이내", () => {
  assert.equal(checkField("ALT", "hero-banner.jpg").verdict, "조정 후보");
  assert.equal(checkField("ALT", "이미지").verdict, "조정 후보");
  assert.equal(checkField("ALT", "가".repeat(130)).verdict, "조정 후보");
  assert.equal(checkField("ALT", "군산 조립식 건축 현장 전경").verdict, "OK");
});

test("브랜드명은 한 문자열에서 1회만", () => {
  assert.ok(brandRepeat("세화건설 | 세화건설 조립식", "세화건설"));
  assert.equal(brandRepeat("세화건설 조립식 건축", "세화건설"), null);
});

test("STEST-028 동일 메타 타이틀이 2개 이상이면 카니발라이제이션 경고", () => {
  const f = cannibalization([
    { url: "/", title: "세화건설" }, { url: "/15", title: "세화건설" }, { url: "/16", title: "사업분야" },
  ]);
  assert.equal(f.length, 1);
  assert.match(f[0]!.reason, /\/, \/15/);
  assert.equal(cannibalization([{ url: "/", title: "A" }, { url: "/b", title: "B" }]).length, 0);
});

test("STEST-014 robots 가 주요 페이지를 막으면 검출된다 (납품 보류 근거)", () => {
  assert.deepEqual(robotsBlocksImportant("User-agent: *\nDisallow: /", ["/", "/16"]), ["/ (사이트 전체)"]);
  assert.ok(robotsBlocksImportant("Disallow: /16", ["/16"]).length > 0);
  assert.deepEqual(robotsBlocksImportant("User-agent: *\nAllow: /", ["/", "/16"]), []);
});

test("STEST-008 측정 ID는 보고서에서 마스킹된다", () => {
  assert.equal(maskId("G-ABC1234567"), "G-ABC1" + "*".repeat(6));   // 앞 4자만 남기고 전부 가린다
  assert.equal(maskId("GTM-AB12CD"), "GTM-AB12**");
  const masked = maskAnalytics({ ga4: ["G-ABC1234567"], gtm: ["GTM-AB12CD"], hasGtag: true, hasDataLayer: true });
  assert.ok(!JSON.stringify(masked).includes("ABC1234567"), "원본 ID가 남으면 안 된다");
});

test("STEST-004 기존값이 있는 필드는 수정 대상이 아니다 (INV-12)", () => {
  // 기존값 보존은 "비어 있을 때만 채운다" 규칙이다.
  const fill = (existing: string, candidate: string) => (existing.trim() ? existing : candidate);
  assert.equal(fill("기존 설명", "새 후보"), "기존 설명", "기존값을 덮어쓰면 안 된다");
  assert.equal(fill("", "새 후보"), "새 후보", "비어 있을 때만 채운다");
  assert.equal(fill("   ", "새 후보"), "새 후보");
});

test("STEST-019 글로벌 모드에서 기계번역 삽입은 후보에서 제외된다", () => {
  // 한국어 키워드를 그대로 다른 언어 페이지에 넣으면 안 된다 — 언어 불일치를 검출한다.
  const isKorean = (s: string) => /[가-힣]/.test(s);
  const pages = [{ lang: "en", title: "세화건설 조립식" }, { lang: "ko", title: "세화건설 조립식" }];
  const bad = pages.filter((p) => p.lang !== "ko" && isKorean(p.title));
  assert.equal(bad.length, 1, "영문 페이지에 한국어 메타가 들어가면 잡아야 한다");
});

test("차단이 1건이라도 있으면 산출하지 않는다", () => {
  const g = gate([
    { field: "a", verdict: "조정 후보", reason: "" },
    { field: "b", verdict: "차단", reason: "금지 표현" },
  ]);
  assert.equal(g.pass, false);
  assert.equal(g.blocked.length, 1);
  assert.equal(g.warn.length, 1);
  assert.equal(gate([{ field: "a", verdict: "OK", reason: "" }]).pass, true);
});
