/* SKILL §18.6 산출물 품질 게이트 + INV-13.
   기준 초과는 **경고**, 금지 표현·placeholder 는 **차단**이다. 둘을 섞지 않는다. */

/** vocabulary §2 금지 표현 사전. 근거 미확인 상태에서 산출물에 들어가면 차단한다. */
export const FORBIDDEN = [
  "1위", "최고", "최상", "보장", "100%", "완치", "부작용 없음", "업계 유일", "국내 최초", "공식 인증",
];

/** 병원·의원 유형에서 추가로 차단하는 효과 표현 (의료광고 규제). */
export const MEDICAL_FORBIDDEN = ["효과 보장", "완벽", "부작용 없이", "즉시 개선", "영구적"];

const PLACEHOLDER = /(TODO|TBD|FIXME|placeholder|여기에|OOO|XXX|<[^>]*입력[^>]*>|\{\{[^}]*\}\})/i;

export type Verdict = "OK" | "조정 후보" | "차단";
export type Finding = { field: string; verdict: Verdict; reason: string };

const len = (s: string) => [...s.trim()].length;   // 한글 기준 글자 수

const LIMITS: Record<string, [number, number]> = {
  "메타 타이틀": [15, 60],
  "메타 디스크립션": [70, 160],
  "OG 타이틀": [1, 60],
  "OG 디스크립션": [1, 200],
  ALT: [1, 125],
};

/** 금지 표현·placeholder 는 경고가 아니라 산출 차단이다 (STEST-005, STEST-020, STEST-025). */
export function blockers(text: string, siteType = "일반"): string[] {
  const out: string[] = [];
  const dict = siteType === "병원" || siteType === "의원" ? [...FORBIDDEN, ...MEDICAL_FORBIDDEN] : FORBIDDEN;
  for (const w of dict) if (text.includes(w)) out.push(`금지 표현 "${w}"`);
  const ph = text.match(PLACEHOLDER);
  if (ph) out.push(`placeholder "${ph[0]}"`);
  return out;
}

export function checkField(field: string, text: string, siteType = "일반"): Finding {
  const hard = blockers(text, siteType);
  if (hard.length) return { field, verdict: "차단", reason: hard.join(", ") };

  const limit = LIMITS[field];
  if (limit) {
    const n = len(text);
    if (n < limit[0]) return { field, verdict: "조정 후보", reason: `${n}자 — 최소 ${limit[0]}자` };
    if (n > limit[1]) return { field, verdict: "조정 후보", reason: `${n}자 — 최대 ${limit[1]}자` };
  }
  if (field === "ALT") {
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(text.trim())) return { field, verdict: "조정 후보", reason: "파일명을 ALT로 쓸 수 없다" };
    if (/^(이미지|image|사진)$/i.test(text.trim())) return { field, verdict: "조정 후보", reason: "일반명사 단독 ALT" };
  }
  return { field, verdict: "OK", reason: "" };
}

/** 브랜드명은 한 문자열 안에서 1회만 (§18.6). */
export function brandRepeat(text: string, brand: string): Finding | null {
  if (!brand) return null;
  const n = text.split(brand).length - 1;
  return n > 1 ? { field: "브랜드명 반복", verdict: "조정 후보", reason: `${n}회 — 1회로 줄인다` } : null;
}

/** 동일 메타 타이틀이 2개 이상 페이지에 있으면 카니발라이제이션 경고 (STEST-028). */
export function cannibalization(titles: { url: string; title: string }[]): Finding[] {
  const byTitle = new Map<string, string[]>();
  for (const t of titles) {
    const k = t.title.trim();
    if (!k) continue;
    byTitle.set(k, [...(byTitle.get(k) ?? []), t.url]);
  }
  return [...byTitle.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([title, urls]) => ({ field: "동일 메타 타이틀", verdict: "조정 후보" as Verdict, reason: `"${title}" — ${urls.join(", ")}` }));
}

/** robots 초안이 주요 페이지를 막으면 납품 보류다 (STEST-014). */
export function robotsBlocksImportant(robots: string, importantPaths: string[]): string[] {
  const disallows = [...robots.matchAll(/^\s*Disallow:\s*(\S+)/gim)].map((m) => m[1]!);
  const hits: string[] = [];
  for (const d of disallows) {
    if (d === "/") { hits.push("/ (사이트 전체)"); continue; }
    for (const p of importantPaths) if (p.startsWith(d)) hits.push(`${p} (Disallow ${d})`);
  }
  return [...new Set(hits)];
}

/** 산출 가능 여부 최종 판정. 차단이 1건이라도 있으면 내보내지 않는다. */
export function gate(findings: Finding[]): { pass: boolean; blocked: Finding[]; warn: Finding[] } {
  const blocked = findings.filter((f) => f.verdict === "차단");
  const warn = findings.filter((f) => f.verdict === "조정 후보");
  return { pass: blocked.length === 0, blocked, warn };
}
