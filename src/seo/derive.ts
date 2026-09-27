/* SKILL §1.3 — 메타 키워드 **하나**에서 12종을 파생한다.
   §1.2 규칙: 키워드를 임의로 교체하지 않는다. 브랜드명이 없으면 결합하고, 이미 있으면 중복 결합하지 않는다.
   INV-13: 확인되지 않은 것은 만들지 않는다. 부족하면 `정보 부족`으로 남긴다. */
import { checkField, gate, brandRepeat, type Finding } from "./quality.ts";
import { fillTemplate, robotsTemplate, llmsTemplate, jsonLdTemplate, unverifiableFields } from "./references.ts";

export type Facts = {
  keyword: string;
  brand: string;
  domain: string;
  siteType: string;
  summary: string;      // 페이지에서 실제로 확인된 설명. 없으면 "" — 지어내지 않는다.
  brandFirst?: boolean; // 메타 타이틀을 "브랜드 | 키워드" 순서로 낼지
};

/** 문장 경계에서 자른다.
 *  낱말 중간에서 끊기면 그것부터가 기계 티고, 문장 뒤에 남은 조각은 대개 메뉴 텍스트다.
 *  ("… 실현합니다. 사업분야 안내" 처럼 내비게이션이 본문 스크랩에 딸려 온다.) */
export function trimTo(s: string, max: number): string {
  const t = s.trim();
  const chars = [...t];
  const cut = chars.length <= max ? t : chars.slice(0, max).join("");
  // 마지막 문장 끝까지만 남긴다. 길이가 남아도 문장이 아닌 꼬리는 버린다.
  const end = Math.max(cut.lastIndexOf("다."), cut.lastIndexOf("."), cut.lastIndexOf("요."));
  // 기준은 max 가 아니라 **실제 글 길이**다. max 로 재면 짧은 글은 손도 못 댄다.
  if (end > 0 && end >= cut.length * 0.5) return cut.slice(0, end + 1).trim();
  if (chars.length <= max) return t;
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut).trim();
}

/** §1.2 브랜드 결합. 이미 브랜드명이 들어 있으면 붙이지 않는다.
 *  `brandFirst` 는 "브랜드 | 키워드" 순서 — 브랜드 인지도가 있을 때 쓴다. */
export function joinBrand(text: string, brand: string, brandFirst = false): string {
  if (!brand) return text;
  if (text.includes(brand)) return text;
  return brandFirst ? `${brand} | ${text}` : `${text} | ${brand}`;
}

export type Derived = {
  key: string;
  value: string;
  status: "작성" | "정보 부족";
  note?: string;
};

/** 히어로 장식 문구를 걷어낸다. 아임웹 템플릿은 본문 맨 앞에 영문 태그라인
 *  ("BUILT FOR EXCELLENCE", "SELECTED WORKS")을 두는데, 검색 스니펫 첫머리로는 최악이다.
 *  **지우기만 한다 — 없는 말을 채워 넣지 않는다** (INV-13). */
export function stripHeroTagline(s: string): string {
  const out = s.replace(/^(?:[A-Z][A-Z0-9&'’.-]*\s+){1,4}/, "").trim();
  return out.length >= 20 ? out : s.trim();   // 다 지워지면 원문을 쓴다
}

/** 12종 파생. 근거가 없으면 문구를 만들지 않고 `정보 부족`으로 표시한다. */
export function derive(raw: Facts): Derived[] {
  const f: Facts = { ...raw, summary: stripHeroTagline(raw.summary) };
  const out: Derived[] = [];
  const add = (key: string, value: string, note?: string) =>
    out.push(value ? { key, value, status: "작성", note } : { key, value: "", status: "정보 부족", note });

  const title = joinBrand(f.keyword, f.brand, f.brandFirst ?? false);
  add("메타 타이틀", title);
  // 실제 페이지 내용이 없으면 디스크립션을 지어내지 않는다 (§4-1 "실제 페이지 내용 기준").
  // 예전엔 "~ 관련 정보를 확인하실 수 있습니다" 를 붙였다. 아무 회사에나 붙는 문장이라 뺐다
  // (Horoscope Test 실패). 본문에 없는 말로 길이를 채우지 않는다.
  add("메타 디스크립션", f.summary ? trimTo(f.summary, 155) : "",
    !f.summary ? "페이지 본문 요약이 확인되지 않아 작성하지 않음"
    : !f.summary.includes(f.keyword) ? "본문에 키워드 표현이 없어 넣지 않았다 — 억지로 끼우면 글티가 난다" : undefined);
  add("OG 타이틀", title);
  add("OG 디스크립션", f.summary || "", f.summary ? undefined : "본문 요약 미확인");
  add("페이지별 SEO 문구", f.summary ? `${f.keyword} — ${f.summary}` : "", "페이지마다 다르게 쓴다. 공통 문구를 전 페이지에 반복하지 않는다");
  add("상품 제목/설명 후보", f.siteType === "쇼핑몰" ? `${f.keyword}` : "",
    f.siteType === "쇼핑몰" ? "상품별로 개별 검토 필요" : "쇼핑몰이 아니므로 해당 없음");
  add("본문 보강안", "", "공개 페이지 근거 부족 — 별도 디자인모드 검토에서 작성");
  add("FAQ 후보", "", "실제 본문과 일치하는 질문만 만든다. 확인된 FAQ가 없어 작성하지 않음");
  add("CTA 개선안", "", "현재 진단에서 사용자 흐름 근거 부족 — 별도 검토 필요");
  add("AEO 상단 요약문", f.summary || "", "2~3문장. 본문과 일치해야 한다");
  add("JSON-LD description", f.summary || "", f.summary ? undefined : "미확인 정보를 넣지 않는다 (INV-13)");
  add("llms.txt 브랜드 설명문", f.brand && f.summary ? `${f.brand} — ${f.summary}` : "", "브랜드·설명 둘 다 확인돼야 작성");
  return out;
}

/** 파생 결과를 품질 게이트에 태운다. 차단이 하나라도 있으면 내보내지 않는다 (§18.6). */
export function checkDerived(d: Derived[], f: Facts): { findings: Finding[]; pass: boolean } {
  const findings: Finding[] = [];
  for (const x of d) {
    if (x.status !== "작성") continue;
    findings.push(checkField(x.key, x.value, f.siteType));
    const b = brandRepeat(x.value, f.brand);
    if (b) findings.push({ ...b, field: `${x.key} 브랜드 반복` });
  }
  return { findings, pass: gate(findings).pass };
}

/** §7 기술 적용안 — robots·llms·JSON-LD. 템플릿은 참조 파일이 정본이다. */
export function technicalDrafts(f: Facts): { name: string; body: string; dropped: string[]; note: string }[] {
  const vals = { "정식도메인": f.domain, "도메인": f.domain, "브랜드명": f.brand, "사이트 설명": f.summary };
  const robots = fillTemplate(robotsTemplate(), vals);
  const llms = fillTemplate(llmsTemplate(), vals);
  const jsonld = fillTemplate(jsonLdTemplate(), vals);
  return [
    { name: "robots.txt", body: robots.filled, dropped: robots.dropped, note: "실제 도메인으로 교체 전에는 반영하지 않는다. 아임웹 SEO 설정 영역에서 관리한다 (Header Code 아님)" },
    { name: "llms.txt", body: llms.filled, dropped: llms.dropped, note: "상세형은 직접 반영이 가능할 때만" },
    { name: "json-ld", body: jsonld.filled, dropped: jsonld.dropped, note: jsonld.dropped.length ? `미확인으로 제외: ${jsonld.dropped.join(", ")} → 최소 버전만 가능` : "Organization + WebSite 최소본" },
  ];
}

/** INV-13 — 확인되지 않은 항목을 산출물에 넣지 않았는지 최종 확인. */
export function unverifiedGuard(text: string): string[] {
  return unverifiableFields().filter((f) => f.length >= 2 && text.includes(f));
}
