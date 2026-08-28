/* SKILL §8 상품 SEO 보호 (INV-12).
   **기본값은 기존값 보존이다. 자동 덮어쓰기 없음.** 5가지로만 분류한다.
   분류 이름과 처리 방침은 SKILL.md §8 표가 정본이다 — 여기서 늘리거나 줄이지 않는다. */
import { FORBIDDEN } from "./quality.ts";
import type { PageSeo } from "./observe.ts";

export type Verdict = "기존값 유지" | "비어 있음" | "중복 의심" | "상품 정보 불일치" | "위험 표현 포함";

/** §8 표 그대로. 분류 → 처리. */
export const HANDLING: Record<Verdict, string> = {
  "기존값 유지": "수정 안 함",
  "비어 있음": "신규 입력 후보 작성 → 승인 후 반영",
  "중복 의심": "후보만 작성, 반영 보류, 질문",
  "상품 정보 불일치": "후보만 작성, 반영 보류, 질문",
  "위험 표현 포함": "후보만 작성, 반영 보류, 질문",
};

export type Product = { path: string; title: string; description: string; h1: string };
export type Classified = Product & { verdict: Verdict; reason: string };

/** 상품 페이지만 골라낸다. 아임웹 상품 상세는 /shop_view/<id>. */
export const productPages = (pages: PageSeo[]): Product[] =>
  pages.filter((p) => p.ok && /\/shop_view\//.test(p.path))
    .map((p) => ({ path: p.path, title: p.title, description: p.description, h1: p.h1[0] ?? "" }));

/** 상품명과 메타가 서로 다른 물건을 가리키는지. 겹치는 낱말이 하나도 없으면 불일치로 본다.
 *  판단이 애매하면 불일치라고 하지 않는다 — 오탐은 사용자에게 쓸데없는 질문을 만든다. */
function mismatched(p: Product): boolean {
  const words = (s: string) => new Set(s.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? []);
  const h1 = words(p.h1);
  if (h1.size < 2 || !p.title) return false;           // 근거 부족 → 판단 보류
  const t = words(p.title);
  for (const w of h1) if (t.has(w)) return false;
  return true;
}

/** 5분류. 순서가 곧 우선순위다 — 위험 표현이 있으면 그게 먼저다. */
export function classify(list: Product[]): Classified[] {
  const byTitle = new Map<string, number>();
  for (const p of list) if (p.title) byTitle.set(p.title, (byTitle.get(p.title) ?? 0) + 1);

  return list.map((p): Classified => {
    const hit = FORBIDDEN.filter((w) => `${p.title} ${p.description}`.includes(w));
    if (hit.length) return { ...p, verdict: "위험 표현 포함", reason: hit.join(", ") };
    if (!p.title.trim() || !p.description.trim()) {
      return { ...p, verdict: "비어 있음", reason: !p.title.trim() ? "메타 타이틀 없음" : "메타 디스크립션 없음" };
    }
    if ((byTitle.get(p.title) ?? 0) > 1) return { ...p, verdict: "중복 의심", reason: `동일 타이틀 ${byTitle.get(p.title)}건` };
    if (mismatched(p)) return { ...p, verdict: "상품 정보 불일치", reason: `상품명 "${p.h1}" 과 메타 타이틀이 겹치는 낱말 없음` };
    return { ...p, verdict: "기존값 유지", reason: "이상 없음" };
  });
}

/** §8 "질문 폭탄 방지" — 발견할 때마다 묻지 않고 **유형별로 묶어** 한 번에 보고한다. */
export function summarize(c: Classified[]): { verdict: Verdict; handling: string; count: number; paths: string[] }[] {
  return (Object.keys(HANDLING) as Verdict[])
    .map((v) => ({ verdict: v, handling: HANDLING[v], count: c.filter((x) => x.verdict === v).length,
                   paths: c.filter((x) => x.verdict === v).map((x) => x.path) }))
    .filter((g) => g.count > 0);
}
