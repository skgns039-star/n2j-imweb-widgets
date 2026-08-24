/* ENG-046 SEO 스킬 진입점. 이번 범위는 **M1 진단 전용** — 아임웹 쓰기 0건 (SKILL §18.2).
   산출물은 seo/<site_id>/ 안에서만 만든다. dist/·registry.json·loader/ 를 건드리지 않는다. */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { p, manifest } from "../release/paths.ts";
import { looksSecret } from "../release/secrets.ts";
import { resolveSiteId, engineStatusText, assertApplyAllowed } from "./gates.ts";
import { observe, infer, questionsFor, maskAnalytics, markerTypesFound, type PageSeo } from "./observe.ts";
import { checkField, cannibalization, gate, type Finding } from "./quality.ts";

export const SEO_DIRS = [
  "custom-code", "snapshots", "screenshots", "exports", "logs",
];

/** 산출물 경로. seo/<site_id>/ 밖으로 나가지 않는다. */
export function siteDir(site_id: string): string {
  if (!/^[a-z0-9-]+$/.test(site_id)) throw new Error(`잘못된 site_id: ${site_id}`);
  return p("seo", site_id);
}

export function scaffold(site_id: string): string {
  const dir = siteDir(site_id);
  for (const d of ["", ...SEO_DIRS]) mkdirSync(d ? `${dir}/${d}` : dir, { recursive: true });
  return dir;
}

export function writeReport(site_id: string, file: string, body: string): string {
  if (file.includes("..") || file.includes("/") || file.includes("\\")) throw new Error(`경로 이탈: ${file}`);
  scaffold(site_id);
  const out = `${siteDir(site_id)}/${file}`;
  writeFileSync(out, body);
  return out;
}

/** §16 첫 실행 출력 형식. 첫 작업은 항상 OBSERVE 다. */
export function startupReport(a: {
  site_id: string; keyword: string; url: string;
  inferred: { field: string; value: string; inferred: boolean }[];
  questions: string[]; pages: PageSeo[];
}): string {
  const tag = (i: { value: string; inferred: boolean }) => (i.inferred && i.value ? `${i.value} [추론]` : i.value || "확인 필요");
  const g = (f: string) => tag(a.inferred.find((x) => x.field === f) ?? { value: "", inferred: false });
  const ok = a.pages.filter((x) => x.ok).length;
  return [
    "[아임웹 SEO 자동화 시작 보고]  모드: OBSERVE",
    "",
    `메타 키워드:       ${a.keyword || "확인 필요"}`,
    `사이트:            ${a.site_id}   정식 도메인: ${g("정식 도메인")}`,
    `브랜드명:          ${g("브랜드명")}   쇼핑몰 여부: ${g("쇼핑몰 여부")}`,
    `공개 페이지 진단:  ${ok}/${a.pages.length} 페이지`,
    `디자인모드:        읽기 전용 고정 (INV-11)`,
    `GA4/GTM 상태:      ${g("GA4")}`,
    `SEO 마커:          ${markerTypesFound(a.pages).join(", ") || "없음"}`,
    "",
    "검색엔진 등록 가능:",
    engineStatusText(),
    "",
    "수정 금지 (고정):  디자인모드 본문·이미지·레이아웃·메뉴명·상품명",
    `입력 필요 (최대 4): ${a.questions.join(", ") || "없음"}`,
    "차단 게이트:       SEO 반영(9~11단계)은 M2. 이번 범위는 진단까지입니다.",
    "다음 단계:         1 공개 페이지 진단 → 2 sitemap/robots/llms → 6 초안",
  ].join("\n");
}

export function auditFindings(pages: PageSeo[], siteType = "일반"): Finding[] {
  const out: Finding[] = [];
  for (const pg of pages) {
    if (!pg.ok) continue;
    out.push({ ...checkField("메타 타이틀", pg.title, siteType), field: `${pg.path} 메타 타이틀` });
    out.push({ ...checkField("메타 디스크립션", pg.description, siteType), field: `${pg.path} 메타 디스크립션` });
    if (pg.imgNoAlt > 0) out.push({ field: `${pg.path} ALT 누락`, verdict: "조정 후보", reason: `${pg.imgNoAlt}/${pg.imgTotal}` });
    if (!pg.canonical) out.push({ field: `${pg.path} canonical`, verdict: "조정 후보", reason: "없음" });
    if (!pg.jsonLdTypes.length) out.push({ field: `${pg.path} JSON-LD`, verdict: "조정 후보", reason: "없음" });
  }
  out.push(...cannibalization(pages.filter((x) => x.ok).map((x) => ({ url: x.path, title: x.title }))));
  return out;
}

/** 진단 1회 실행. 아임웹에 아무것도 쓰지 않는다. */
export async function runDiagnosis(site_id: string, keyword: string, paths: string[] = []): Promise<string> {
  const site = manifest().sites.find((s) => s.site_id === site_id);
  if (!site?.url) return `${site_id} 에 url 이 없습니다. '연결' 위저드로 사이트 정보를 먼저 등록하세요.`;

  const pages = await observe(site.url, paths.length ? paths : [site.test_path ?? "/"]);
  const inferred = infer(pages);
  const questions = questionsFor(inferred);
  const head = startupReport({ site_id, keyword, url: site.url, inferred, questions, pages });

  const findings = auditFindings(pages);
  const g = gate(findings);
  const body = [
    head, "", "── 진단 결과 ──",
    ...g.warn.map((f) => `  [조정 후보] ${f.field}: ${f.reason}`),
    ...g.blocked.map((f) => `  [차단] ${f.field}: ${f.reason}`),
    g.warn.length + g.blocked.length ? "" : "  지적사항 없음",
    "",
    `애널리틱스(마스킹): ${JSON.stringify(maskAnalytics(pages.find((x) => x.ok)?.analytics ?? { ga4: [], gtm: [], hasGtag: false, hasDataLayer: false }))}`,
  ].join("\n");

  writeReport(site_id, "03_public-audit.md", body + "\n");
  return body;
}

/** §1.4 애널리틱스 사전 질문. 감지 없이 묻지 않고, 질문 없이 설치하지 않는다. */
export function analyticsGateQuestions(detected: { ga4: string[]; gtm: string[] }): string {
  const found = detected.ga4.length || detected.gtm.length;
  return [
    "[애널리틱스 사전 확인]  모드: OBSERVE",
    `자동 감지 결과: GA4 ${detected.ga4.join(", ") || "없음"} / GTM ${detected.gtm.join(", ") || "없음"}`,
    "",
    "Q-A1  애널리틱스를 어떻게 할까요?",
    "  A 이미 연결됨 → 검수만 (설치 안 함)",
    "  B 미연결 → 이번에 설치 (승인 후 진행)",
    "  C 이번 작업에서 제외",
    "  D 감지 결과가 실제와 다름 → 관리자 확인 후 재판정",
    `  · 권장: ${found ? "A" : "B"}`,
    "",
    "Q-A2  (B 선택 시만) 어디에 붙일까요?  A 아임웹 데이터 연결(권장) / B GTM / C Header Code",
    "Q-A3  (쇼핑몰일 때만) 전자상거래 추적이 필요한가요?  A 필요 / B 불필요",
    "",
    "측정 ID를 대화로 보내지 마세요. 존재 여부만 확인합니다.",
  ].join("\n");
}

/** 사용자가 측정 ID를 대화로 보내면 저장하지 않고 거부한다 (STEST-017). */
export function rejectIdInChat(text: string): string | null {
  if (looksSecret(text)) return "비밀값은 받지 않습니다. 저장하지 않았습니다.";
  if (/\b(G-[A-Z0-9]{6,}|GTM-[A-Z0-9]{4,}|UA-\d{4,})\b/.test(text)) {
    return [
      "측정 ID를 대화로 받지 않습니다. 저장하지 않았습니다.",
      "아임웹 관리자에 직접 입력하시거나 환경변수에 넣어주세요. 저는 존재 여부만 확인합니다.",
    ].join("\n");
  }
  return null;
}

export { assertApplyAllowed, resolveSiteId, existsSync };
