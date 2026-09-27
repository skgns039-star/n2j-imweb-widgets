/* SKILL §17 — 참조 파일이 정본이다. 규칙을 코드에 베껴 쓰면 문서와 갈라진다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { p } from "../../src/release/paths.ts";
import * as R from "../../src/seo/references.ts";
import { FORBIDDEN } from "../../src/seo/quality.ts";
import { derive, technicalDrafts, joinBrand } from "../../src/seo/derive.ts";
import { FILES, buildAll, seoStatus, written } from "../../src/seo/artifacts.ts";

test("참조 4종이 모두 로드된다 — 하나라도 없으면 중단", () => {
  assert.doesNotThrow(() => R.assertReferencesLoadable());
  for (const n of ["audit-checklists", "templates-and-forms", "vocabulary-and-site-types", "source-priority-and-code-origin"] as const) {
    assert.ok(R.ref(n).length > 1000, `${n} 이 비었다`);
  }
});

test("금지 표현 사전은 코드가 아니라 참조 파일에서 온다", () => {
  const fromRef = R.forbiddenPhrases();
  assert.ok(fromRef.includes("1위") && fromRef.includes("보장"), "사전 파싱 실패");
  assert.ok(!fromRef.includes("STEST-005"), "뒤 문단의 코드까지 딸려오면 안 된다");
  assert.deepEqual(FORBIDDEN, fromRef, "quality.ts 가 참조 파일과 같아야 한다 (하드코딩 금지)");
  const src = readFileSync(p("src", "seo", "quality.ts"), "utf8");
  assert.ok(!/"1위"|"최고"|"보장"/.test(src), "금지 표현이 코드에 하드코딩되면 안 된다");
});

test("ALT 대상·제외 목록이 참조 파일에서 온다 (audit §B-4)", () => {
  const a = R.altScope();
  assert.ok(a.include.some((x) => x.includes("HTML 위젯")), "코드 위젯 img 태그가 대상에 있어야 한다");
  assert.ok(a.exclude.includes("상품 대표 이미지"), "제외 목록 파싱 실패");
  assert.ok(a.include.length >= 5 && a.exclude.length >= 4);
});

test("자리표시자와 HTML 태그를 구분한다 — 값 없는 줄만 지운다", () => {
  const f = R.fillTemplate(R.ownerVerificationTemplate(), { GSC: "g1", NAVER: "n1" });
  assert.match(f.filled, /DDAK-SEO:START/, "마커는 남아야 한다");
  assert.match(f.filled, /DDAK-SEO:END/);
  assert.match(f.filled, /content="g1"/);
  assert.ok(!f.filled.includes("msvalidate"), "값 없는 엔진 줄은 지운다");
  assert.deepEqual(f.dropped.sort(), ["BING", "DAUM"]);
});

test("§1.2 브랜드 결합 — 이미 있으면 중복 결합하지 않는다", () => {
  assert.equal(joinBrand("조립식 건축", "세화건설"), "조립식 건축 | 세화건설");
  assert.equal(joinBrand("세화건설 조립식", "세화건설"), "세화건설 조립식");
  assert.equal(joinBrand("조립식", ""), "조립식");
});

test("§1.3 근거가 없으면 문구를 지어내지 않는다 (INV-13)", () => {
  const none = derive({ keyword: "조립식 건축", brand: "세화", domain: "https://x", siteType: "일반", summary: "" });
  assert.equal(none.length, 12, "12종이어야 한다");
  assert.equal(none.find((d) => d.key === "메타 디스크립션")!.status, "정보 부족");
  assert.equal(none.find((d) => d.key === "FAQ 후보")!.status, "정보 부족");
  const withFacts = derive({ keyword: "조립식 건축", brand: "세화", domain: "https://x", siteType: "일반", summary: "군산 모듈러 시공" });
  assert.equal(withFacts.find((d) => d.key === "메타 디스크립션")!.status, "작성");
});

test("기술 적용안은 참조 템플릿을 쓰고, 미확인이면 최소본만", () => {
  const t = technicalDrafts({ keyword: "k", brand: "", domain: "", siteType: "일반", summary: "" });
  const jsonld = t.find((x) => x.name === "json-ld")!;
  assert.ok(jsonld.dropped.length > 0, "도메인·브랜드 미확인이면 제외 항목이 있어야 한다");
  assert.match(jsonld.note, /최소 버전만 가능/);
  const robots = t.find((x) => x.name === "robots.txt")!;
  assert.match(robots.note, /Header Code 아님/);
});

test("§6 산출물 — 표 셀의 | 가 표를 깨뜨리지 않는다", () => {
  const files = buildAll({
    site_id: "sehwa", label: "세화건설", url: "https://x", keyword: "조립식 건축",
    brand: "Sehwa | Construction", domain: "https://x", siteType: "일반", summary: "", pages: [], findings: [],
  });
  assert.ok(files.length >= 13, "산출물이 13개 이상이어야 한다");
  const draft = readFileSync(files.find((f) => f.file === "09_seo-draft.md")!.path, "utf8");
  for (const line of draft.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("|---"))) {
    // 이스케이프된 \| 는 셀 구분자가 아니다 — 먼저 제거하고 센다
    const cells = line.split("\\|").join("").split("|").length - 2;
    assert.ok(cells <= 4, `표 셀이 쪼개졌다: ${line.slice(0, 60)}`);
  }
});

test("고객사별 SEO 현황이 조회된다", () => {
  const s = seoStatus();
  assert.match(s, /고객사별/);
  assert.match(s, /sehwa/);
  assert.ok(written("sehwa").length > 0);
  assert.equal(FILES.length, 17);   // §6 15종 + 15_search-console + 16_paste-ready
});

test("Q-A3 답변을 메타 키워드로 삼키지 않는다", async () => {
  const { lateAnalyticsAnswer } = await import("../../src/seo/route.ts");
  const ec = lateAnalyticsAnswer("추적불필요");
  assert.equal(ec?.ecommerce, "불필요", "'추적불필요' 가 키워드로 저장되면 안 된다");
  assert.equal(lateAnalyticsAnswer("추적 필요")?.ecommerce, "필요");
  assert.equal(lateAnalyticsAnswer("GTM 에 붙여줘")?.place, "GTM");
  // 진짜 키워드는 통과해야 한다
  assert.equal(lateAnalyticsAnswer("국내 건설 회사 순위"), null);
  assert.equal(lateAnalyticsAnswer("조립식 건축"), null);
  // 키워드가 함께 오면 키워드가 우선
  assert.equal(lateAnalyticsAnswer("추적불필요, 메타키워드: 조립식 건축"), null);
});

test("본문이 있으면 메타 디스크립션이 비어도 근거로 쓴다 (§4-1)", () => {
  const withBody = derive({ keyword: "국내 건설 회사 순위", brand: "세화", domain: "https://x", siteType: "일반", summary: "군산 조립식 건축 시공" });
  assert.equal(withBody.find((d) => d.key === "AEO 상단 요약문")!.status, "작성");
});

test("§8 상품 SEO 5분류 — 기본값은 기존값 보존 (INV-12)", async () => {
  const { classify, summarize, HANDLING } = await import("../../src/seo/product.ts");
  assert.deepEqual(Object.keys(HANDLING),
    ["기존값 유지", "비어 있음", "중복 의심", "상품 정보 불일치", "위험 표현 포함"],
    "SKILL §8 표의 5분류에서 늘리거나 줄이면 안 된다");

  const c = classify([
    { path: "/shop_view/1", title: "조립식 주택 모듈러", description: "가".repeat(100), h1: "조립식 주택" },
    { path: "/shop_view/2", title: "", description: "가".repeat(100), h1: "창고형 건물" },
    { path: "/shop_view/3", title: "같은 제목", description: "가".repeat(100), h1: "같은 제목 상품" },
    { path: "/shop_view/4", title: "같은 제목", description: "가".repeat(100), h1: "같은 제목 상품" },
    { path: "/shop_view/5", title: "업계 1위 보장", description: "가".repeat(100), h1: "업계 1위 보장 상품" },
    { path: "/shop_view/6", title: "냉장고 판매", description: "가".repeat(100), h1: "조립식 창고 건물" },
  ]);
  const v = (p: string) => c.find((x) => x.path === p)!.verdict;
  assert.equal(v("/shop_view/1"), "기존값 유지");
  assert.equal(v("/shop_view/2"), "비어 있음");
  assert.equal(v("/shop_view/3"), "중복 의심");
  assert.equal(v("/shop_view/5"), "위험 표현 포함", "위험 표현이 다른 분류보다 우선한다");
  assert.equal(v("/shop_view/6"), "상품 정보 불일치");

  // 근거가 약하면 불일치라고 하지 않는다 — 오탐은 질문 폭탄이 된다
  const weak = classify([{ path: "/shop_view/9", title: "제품", description: "가".repeat(100), h1: "A" }]);
  assert.equal(weak[0]!.verdict, "기존값 유지");

  // 유형별로 묶어서 한 번에 보고한다 (§8 질문 폭탄 방지)
  const g = summarize(c);
  assert.ok(g.every((x) => x.count > 0), "0건 분류는 보고하지 않는다");
  assert.equal(g.reduce((s, x) => s + x.count, 0), c.length);
});

test("§1.2 사용자가 준 키워드를 산출물이 교체하지 않는다", () => {
  const KW = "국내 건설 회사 순위";
  const files = buildAll({
    site_id: "sehwa", label: "세화건설", url: "https://x", keyword: KW,
    brand: "세화건설산업", domain: "https://x", siteType: "일반",
    summary: "조립식 건축의 미래", pages: [], findings: [],
  });
  const paste = readFileSync(files.find((f) => f.file === "16_paste-ready.md")!.path, "utf8");
  assert.ok(paste.includes(KW), "복붙용 값에 사용자 키워드가 그대로 있어야 한다");
  assert.ok(paste.includes(`${KW} | 세화건설산업`), "제목은 키워드 + 브랜드 결합이어야 한다");
  // 손으로 지어낸 대체 키워드가 끼어들면 안 된다
  for (const invented of ["종합건설", "토목", "인테리어", "사후관리"]) {
    assert.ok(!paste.includes(invented), `근거 없는 표현이 들어갔다: ${invented}`);
  }
});

test("히어로 장식 문구만 걷어내고 없는 말을 채우지 않는다", async () => {
  const { stripHeroTagline } = await import("../../src/seo/derive.ts");
  assert.equal(stripHeroTagline("BUILT FOR EXCELLENCE 조립식 건축의 미래, 세화가 짓습니다 25년"),
    "조립식 건축의 미래, 세화가 짓습니다 25년");
  assert.equal(stripHeroTagline("SELECTED WORKS 건축의 본질을 세우는 세화의 포트폴리오"),
    "건축의 본질을 세우는 세화의 포트폴리오");
  // 한글로 시작하면 손대지 않는다
  assert.equal(stripHeroTagline("조립식 건축 전문 시공사입니다"), "조립식 건축 전문 시공사입니다");
  // 다 지워질 만큼 짧으면 원문 유지 — 빈 문자열을 만들지 않는다
  assert.equal(stripHeroTagline("BUILT FOR EXCELLENCE"), "BUILT FOR EXCELLENCE");
  assert.equal(stripHeroTagline(""), "");
});

test("AI 글티 검출 — Horoscope Test 와 상투구", async () => {
  const { slopCheck, horoscope } = await import("../../src/seo/slop.ts");
  const rules = (t: string) => slopCheck(t).map((h) => h.rule);

  // 예전에 우리가 실제로 뱉었던 꼬리
  assert.ok(rules("국내 건설 회사 순위 관련 정보를 확인하실 수 있습니다.").includes("상투구"));
  assert.ok(rules("혁신적인 기술과 차별화된 노하우로 최적의 서비스를 제공합니다").includes("수식어 과다"));
  assert.ok(rules("고객 만족을 최우선으로 함께합니다").includes("상투구"));

  // Horoscope — 숫자도 고유명사도 없으면 아무 회사에나 붙는다
  assert.equal(horoscope("좋은 품질의 제품을 만듭니다"), true);
  assert.equal(horoscope("1999년 설립한 건설사입니다"), false, "연도가 있으면 통과");
  assert.equal(horoscope("군산시에 자리한 건설사입니다"), false, "지명이 있으면 통과");

  // 근거가 실린 실제 문장은 걸리지 않아야 한다
  assert.deepEqual(slopCheck("조립식 건축의 미래, 세화가 짓습니다 25년의 축적된 기술력과 모듈러 시스템"), []);
  assert.deepEqual(slopCheck(""), []);
});

test("메타 문구가 상투구 꼬리 없이 나온다", async () => {
  const { derive, trimTo, joinBrand } = await import("../../src/seo/derive.ts");
  const { slopCheck } = await import("../../src/seo/slop.ts");

  assert.equal(joinBrand("국내 건설 회사 순위", "세화건설산업", true), "세화건설산업 | 국내 건설 회사 순위");
  assert.equal(joinBrand("국내 건설 회사 순위", "세화건설산업"), "국내 건설 회사 순위 | 세화건설산업");

  const d = derive({ keyword: "국내 건설 회사 순위", brand: "세화건설산업", domain: "https://x",
    siteType: "일반", brandFirst: true, summary: "조립식 건축의 미래, 세화가 짓습니다 25년의 축적된 기술력과 모듈러 시스템으로 공간의 가치를 실현합니다." });
  const desc = d.find((x) => x.key === "메타 디스크립션")!;
  assert.ok(!desc.value.includes("관련 정보를 확인"), "상투구 꼬리를 붙이면 안 된다");
  assert.deepEqual(slopCheck(desc.value), [], "설명문이 글티 검사를 통과해야 한다");
  assert.equal(d.find((x) => x.key === "메타 타이틀")!.value, "세화건설산업 | 국내 건설 회사 순위");

  // 낱말 중간에서 끊지 않는다
  assert.ok(!trimTo("가나다 라마바 사아자", 8).endsWith("사"));
});

test("글티 검사 오탐 방지 — 브랜드명은 고유명사, 제목은 Horoscope 대상 아님", async () => {
  const { slopCheck } = await import("../../src/seo/slop.ts");
  const title = "세화건설산업 | 국내 건설 회사 순위";
  assert.deepEqual(slopCheck(title, { brand: "세화건설산업", prose: false }), [], "제목에 문단 검사를 걸면 안 된다");
  assert.deepEqual(slopCheck(title, { brand: "세화건설산업" }), [], "브랜드명이 있으면 고유명사로 본다");
  // 브랜드도 숫자도 없으면 여전히 걸려야 한다
  assert.ok(slopCheck("좋은 품질의 제품을 만듭니다").some((h) => h.rule === "Horoscope"));
});

test("설명문 꼬리에 메뉴 텍스트가 남지 않는다", async () => {
  const { trimTo } = await import("../../src/seo/derive.ts");
  assert.equal(trimTo("조립식 건축의 미래를 세화가 짓습니다. 사업분야 안내", 155),
    "조립식 건축의 미래를 세화가 짓습니다.", "문장 뒤 조각은 버린다");
  assert.equal(trimTo("짧은 문장입니다.", 155), "짧은 문장입니다.");
  // 문장 부호가 아예 없으면 낱말 경계로 자르되 내용을 잃지 않는다
  assert.equal(trimTo("문장 부호 없는 본문", 155), "문장 부호 없는 본문");
});

test("Header Code 정본 조립 — 값 없는 엔진 줄은 넣지 않는다", async () => {
  const { compose, verificationBlock } = await import("../../src/seo/header_code.ts");
  assert.equal(verificationBlock({}), null, "값이 하나도 없으면 블록 자체를 만들지 않는다");

  const v = verificationBlock({ gsc: "g1", naver: " n1 " })!;
  assert.match(v, /google-site-verification" content="g1"/);
  assert.match(v, /naver-site-verification" content="n1"/, "앞뒤 공백은 정리한다");
  assert.ok(!v.includes("msvalidate"), "값 없는 엔진 줄이 들어가면 확인이 실패한다");
  assert.ok(!/content=""/.test(v), "빈 content 는 절대 나오면 안 된다");

  const full = compose({ jsonLd: '<script type="application/ld+json">{}</script>', verification: { gsc: "g1" } });
  assert.ok(full.indexOf("owner-verification") < full.indexOf("json-ld-org"), "소유확인이 앞에 온다");
  assert.equal((full.match(/DDAK-SEO:START/g) ?? []).length, 2);
  assert.equal((full.match(/DDAK-SEO:END/g) ?? []).length, 2);

  // 같은 입력이면 같은 바이트가 나와야 한다 — 아니면 매번 저장이 일어난다
  assert.equal(compose({ jsonLd: "x", verification: { gsc: "g1" } }), compose({ jsonLd: "x", verification: { gsc: "g1" } }));
  assert.equal(compose({}), "");
});

test("브랜드는 모든 제목에 공통인 조각이다 — 순서를 바꿔도 안 뒤집힌다", async () => {
  const { brandOf } = await import("../../src/seo/observe.ts");
  const pg = (title: string) => ({ ok: true, title } as any);

  // 브랜드가 앞: 예전 방식(마지막 조각)이면 "국내 건설 회사 순위" 를 브랜드로 집었다
  assert.equal(brandOf([
    pg("세화건설산업 | 국내 건설 회사 순위"),
    pg("세화건설산업 | 주거 건축 모듈러 시공"),
    pg("세화건설산업 | 시공 문의·상담"),
  ]), "세화건설산업");

  // 브랜드가 뒤여도 같은 답이 나와야 한다
  assert.equal(brandOf([
    pg("국내 건설 회사 순위 | 세화건설산업"),
    pg("주거 건축 모듈러 시공 | 세화건설산업"),
  ]), "세화건설산업");

  // 페이지가 하나뿐이면 공통이라는 근거가 없다 → 마지막 조각으로 물러선다
  assert.equal(brandOf([pg("조립식 건축 | 세화건설산업")]), "세화건설산업");
  assert.equal(brandOf([]), "");
});

test("근거가 약한 쇼핑몰 판정은 밀어붙이지 않고 묻는다", async () => {
  const { shopVerdict, questionsFor, weakPoints } = await import("../../src/seo/observe.ts");
  const pg = (path: string, h1?: string) => ({ ok: true, path, canonical: "", h1: h1 ? [h1] : [] } as any);

  // 세화 사례: 아임웹 템플릿 샘플 상품 2건 때문에 쇼핑몰로 판정됐다
  const weak = shopVerdict([pg("/shop_view/1", "shine water cup"), pg("/shop_view/2", "round dot cup")]);
  assert.equal(weak.value, "예", "규칙 자체는 SKILL 대로 유지한다");
  assert.equal(weak.weak, true, "근거가 약하면 표시해야 한다");
  assert.match(weak.why, /템플릿 샘플/);

  // 한글 상품명이 여럿이면 진짜 쇼핑몰로 본다
  const real = shopVerdict(["조립식 창고", "모듈러 주택", "컨테이너", "패널"].map((n, i) => pg(`/shop_view/${i}`, n)));
  assert.equal(real.weak, false);

  assert.equal(shopVerdict([pg("/introduction")]).value, "아니오");

  // 약한 항목은 질문 목록에 들어간다 — 값이 있어도 조용히 통과시키지 않는다
  const inferred = [{ field: "쇼핑몰 여부", value: "예", inferred: true, weak: true, why: "템플릿 샘플일 수 있다" }];
  assert.deepEqual(questionsFor(inferred), ["쇼핑몰 여부"]);
  assert.equal(weakPoints(inferred).length, 1);
  // 근거가 확실하면 묻지 않는다
  assert.deepEqual(questionsFor([{ field: "쇼핑몰 여부", value: "예", inferred: true }]), []);
});

test("SEO 작업 지시는 일반 작업 경로로 분류된다", async () => {
  const { classify } = await import("../../src/bot/router.ts");
  assert.equal(classify("세화 메뉴 SEO 나머지 채워줘").intent, "agent");
  assert.equal(classify("메타 디스크립션 수정해줘").intent, "agent");
  assert.equal(classify("세화 SEO 시작").intent, "seo");
  assert.equal(classify("SEO 현황").intent, "seo");
  assert.equal(classify("SEO 진단해줘").intent, "seo");
});
