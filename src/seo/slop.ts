/* AI 글티 검출. 외부 SEO 스킬(inhouseseo/superseo-skills anti-slop-ruleset)의 규칙을
   한국어 메타 문구에 맞게 옮겼다. 원본은 영문 장문 콘텐츠용이라 낱말 목록은 그대로 못 쓴다.

   가져온 규칙은 셋이다.
   1) Horoscope Test — "누구나, 아무에게나, 아무거나에 대해 쓸 수 있는 문장인가?"
      통과하면 문구 검사를 다 통과해도 실격이다. 언어와 무관하게 성립한다.
   2) 의미 없는 수식어 제거 — 근거 없는 최상급·상투어
   3) 모호한 출처 금지 — "다양한", "많은" 대신 실제 수치

   점수제는 쓰지 않는다. 메타 문구는 한두 줄이라 점수를 매길 표본이 안 된다.
   대신 걸린 항목을 그대로 보고한다. */

export type SlopHit = { rule: string; found: string; why: string };

/** 1순위 — 있으면 그 자체로 AI 글티. 메타 설명 꼬리에 붙는 상투구가 대부분이다. */
const TIER1: [RegExp, string][] = [
  [/관련\s*정보를?\s*(확인|제공|안내)/, "내용이 없는 안내 상투구"],
  [/에\s*대해\s*(알아보|살펴보)/, "블로그 도입부 상투구"],
  [/만나\s*보세요|지금\s*바로/, "광고 문구 — 페이지 내용이 아니다"],
  [/최선을?\s*다하(고|겠)|최우선으로/, "근거 없는 다짐"],
  [/함께\s*합니다|함께\s*하겠습니다/, "내용 없는 맺음말"],
  [/다양한\s*(서비스|솔루션|경험|니즈)/, "숫자로 바꿀 수 있는 모호한 수식"],
  [/한\s*차원\s*높은|새로운\s*패러다임|미래를\s*열어/, "의미 없는 과장"],
];

/** 2순위 — 하나면 넘어가고, 여럿이 몰리면 글티다. 원본의 Tier 2 "flag when clustered". */
const TIER2 = [
  "혁신적인", "차별화된", "최적의", "완벽한", "체계적인", "전문적인",
  "고객 만족", "믿을 수 있는", "합리적인", "풍부한 경험", "노하우",
];

/** Horoscope Test — 이 문구만의 것이 하나라도 있는가.
 *  숫자·연도·고유명사·지명 중 하나도 없으면 아무 회사에나 붙는 문장이다. */
export function horoscope(text: string, brand = ""): boolean {
  const hasNumber = /\d/.test(text);
  // 한글 고유명사 판별. `\b` 는 한글에 안 먹는다 — 조사·구두점·끝을 경계로 쓴다.
  const place = /[가-힣]{2,}(시|군|구|읍|면|동|도)(?=[에의를이가로와과,.\s]|$)/;
  const hasBrand = brand.length >= 2 && text.includes(brand);
  const hasProper = hasBrand || place.test(text) || /[A-Z][a-zA-Z]{2,}/.test(text);
  return !hasNumber && !hasProper;
}

/** 메타 문구 한 줄을 검사한다. 걸린 게 없으면 빈 배열.
 *  `brand` 를 주면 브랜드명을 고유명사로 인정한다 — 안 그러면 제목이 전부 오탐이다.
 *  Horoscope Test 는 원본에서 **문단** 단위 검사다. 제목처럼 짧은 건 대상이 아니다. */
export function slopCheck(text: string, opts: { brand?: string; prose?: boolean } = {}): SlopHit[] {
  const { brand = "", prose = true } = opts;
  const t = (text ?? "").trim();
  if (!t) return [];
  const hits: SlopHit[] = [];

  for (const [re, why] of TIER1) {
    const m = t.match(re);
    if (m) hits.push({ rule: "상투구", found: m[0], why });
  }

  const cluster = TIER2.filter((w) => t.includes(w));
  if (cluster.length >= 2) {
    hits.push({ rule: "수식어 과다", found: cluster.join(", "), why: "근거 없는 수식어가 몰려 있다 (2개 이상)" });
  }

  if (prose && horoscope(t, brand)) {
    hits.push({ rule: "Horoscope", found: t.slice(0, 40), why: "숫자도 고유명사도 없다 — 아무 회사에나 붙는 문장이다" });
  }

  // 원본 규칙 10번. 한국어 메타에서 em dash 는 거의 항상 기계가 붙인 것이다.
  const dashes = (t.match(/—/g) ?? []).length;
  if (dashes > 1) hits.push({ rule: "em dash 과다", found: `${dashes}개`, why: "구분자는 하나면 족하다" });

  return hits;
}

/** 보고용 한 줄 요약. */
export const slopReport = (hits: SlopHit[]) =>
  hits.length ? hits.map((h) => `${h.rule}: "${h.found}" — ${h.why}`).join(" / ") : "이상 없음";
