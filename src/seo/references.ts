/* SKILL §17 — 참조 파일이 **정본**이다. 규칙을 코드에 베껴 쓰지 않는다.
   금지 표현·사이트 유형·템플릿을 코드와 문서 양쪽에 두면 언젠가 갈라진다. 여기서 한 번만 읽는다. */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { p } from "../release/paths.ts";

const NAMES = ["audit-checklists", "templates-and-forms", "vocabulary-and-site-types", "source-priority-and-code-origin"] as const;
export type RefName = (typeof NAMES)[number];

/** 스킬 정본은 한 벌이지만 배치 위치는 구축자마다 다르다 (REQ-006). */
export function refPath(name: RefName): string {
  const candidates = [
    p(".claude", "skills", "imweb-seo", "references", `${name}.md`),
    join(homedir(), ".codex", "skills", "imweb-seo", "references", `${name}.md`),
  ];
  const hit = candidates.find(existsSync);
  if (!hit) throw new Error(`BLOCKED: 참조 파일을 찾지 못했다 — references/${name}.md (§17 축약 금지)`);
  return hit;
}

const cache = new Map<RefName, string>();
export function ref(name: RefName): string {
  if (!cache.has(name)) cache.set(name, readFileSync(refPath(name), "utf8"));
  return cache.get(name)!;
}

/** 진단 시 4종이 모두 로드 가능해야 한다. 하나라도 없으면 중단이다 (§17). */
export function assertReferencesLoadable(): void {
  for (const n of NAMES) ref(n);
}

// ── 사전·목록 추출 ────────────────────────────────────────────

const backticked = (line: string) => [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);

/** vocabulary §2 금지 표현 사전. 코드에 하드코딩하지 않는다. */
export function forbiddenPhrases(): string[] {
  const v = ref("vocabulary-and-site-types");
  const i = v.indexOf("금지 표현 사전 검출 대상");
  if (i < 0) throw new Error("BLOCKED: 금지 표현 사전을 참조 파일에서 찾지 못했다");
  // 사전은 **바로 다음 한 줄**이다. 더 읽으면 뒤 문단의 STEST-005 같은 코드까지 딸려온다.
  const line = v.slice(i).split("\n").slice(1).find((l) => l.includes("`")) ?? "";
  return backticked(line);
}

/** vocabulary §2 추정 금지 목록 — 확인되지 않으면 어떤 산출물에도 넣지 않는다 (INV-13). */
export function unverifiableFields(): string[] {
  const v = ref("vocabulary-and-site-types");
  const i = v.indexOf("아래는 확인되지 않으면");
  if (i < 0) return [];
  // 문장 다음의 첫 목록 줄이 항목이다.
  const line = v.slice(i).split("\n").slice(1).find((l) => l.includes("·")) ?? "";
  return line.split("·").map((x) => x.trim()).filter(Boolean);
}

/** vocabulary §3 사이트 유형별 대체 입력값. 쇼핑몰이 아니면 상품 URL을 요구하지 않는다. */
export function siteTypeInputs(): Record<string, string[]> {
  const v = ref("vocabulary-and-site-types");
  const out: Record<string, string[]> = {};
  for (const m of v.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|$/gm)) {
    const key = m[1]!.replace(/\s/g, "");
    if (/URL|입력값|유형/.test(m[2]!) || m[2]!.includes("·")) out[key] = m[2]!.split("·").map((s) => s.trim());
  }
  return out;
}

/** audit §A 공개 페이지 수집 30항목. 출력표 컬럼을 임의로 줄이지 않는다 (§17). */
export function publicAuditItems(): string[] {
  const a = ref("audit-checklists");
  const i = a.indexOf("## A.");
  const line = a.slice(i).split("\n").find((l) => l.includes("·") && l.length > 80);
  return (line ?? "").split("·").map((s) => s.trim()).filter(Boolean);
}

/** audit §B-4 ALT 대상/제외. "전체 이미지 일괄 적용"을 가정하지 않는다. */
export function altScope(): { include: string[]; exclude: string[] } {
  const a = ref("audit-checklists");
  const pick = (label: string) => {
    const i = a.indexOf(label);
    if (i < 0) return [];
    const line = a.slice(i).split("\n").slice(1).find((l) => l.trim().length > 0) ?? "";
    return line.split("·").map((s) => s.trim()).filter(Boolean);
  };
  return { include: pick("**ALT 작성 가능 대상**"), exclude: pick("**ALT 작성 제외 대상**") };
}

// ── 템플릿 ────────────────────────────────────────────────────

function codeBlockAfter(text: string, heading: string): string {
  const i = text.indexOf(heading);
  if (i < 0) throw new Error(`BLOCKED: 템플릿을 찾지 못했다 — ${heading}`);
  const start = text.indexOf("```", i);
  const bodyStart = text.indexOf("\n", start) + 1;
  return text.slice(bodyStart, text.indexOf("```", bodyStart)).trimEnd();
}

export const robotsTemplate = () => codeBlockAfter(ref("templates-and-forms"), "## 1. robots.txt");
export const llmsTemplate = () => codeBlockAfter(ref("templates-and-forms"), "## 2. llms.txt");
export const jsonLdTemplate = () => codeBlockAfter(ref("templates-and-forms"), "## 3. JSON-LD");
export const ownerVerificationTemplate = () => codeBlockAfter(ref("templates-and-forms"), "## 4. 소유확인 태그");

/** 자리표시자만 고른다. HTML 태그(`<meta …>`, `<!-- … -->`)와 구분해야 한다 —
 *  자리표시자는 속성도 슬래시도 없는 짧은 이름이다: `<GSC>` `<도메인>` `<사이트 설명>` */
const PLACEHOLDER = /<([^<>="'\/!]{1,20})>/g;

/** 자리표시자를 실제 값으로 채운다. 값이 없으면 **그 줄을 지운다** — 빈 채로 두지 않는다. */
export function fillTemplate(tpl: string, values: Record<string, string>): { filled: string; dropped: string[] } {
  const dropped: string[] = [];
  const lines = tpl.split("\n").filter((line) => {
    const ph = [...line.matchAll(PLACEHOLDER)].map((m) => m[1]!);
    const missing = ph.filter((k) => !values[k]);
    if (missing.length) { dropped.push(...missing); return false; }
    return true;
  });
  let out = lines.join("\n");
  for (const [k, v] of Object.entries(values)) out = out.split(`<${k}>`).join(v);
  return { filled: out, dropped: [...new Set(dropped)] };
}
