/* 위젯 변경 자동화의 결정적 관문. LLM 이 만든 코드는 여기를 통과해야만 저장소에 들어온다.
   판정은 규칙으로만 한다 — 같은 입력이면 매번 같은 결과가 나와야 한다 (2026-09-28 사용자 요구:
   "누락 없이, 코드가 변질되지 않게, 봇이 활성화돼도 화면에 시각화되지 않게"). */
import { lintCss, lintJs } from "../release/css_scope_lint.ts";

export const WIDGET_ID = /^[a-z][a-z0-9-]{2,39}$/;
/** 위젯 폴더에 둘 수 있는 파일. 이 밖의 파일(이미지·하위 폴더·스크립트 추가)은 자동 경로에서 받지 않는다. */
export const ALLOWED_FILES = ["index.js", "style.css", "widget.json"] as const;

export type WidgetMeta = {
  widget_id: string; title: string; purpose: string;
  collects_personal_data: false; network: string;
  /** 검증·테스트용 위젯. true 면 어떤 경로로도 켤 수 없다 (hello-badge 사고 재발 방지). */
  internal?: boolean;
};

/** 방문자 화면에 떠 있는 요소·전역 삽입·외부 통신을 만드는 코드. 자동 경로에서는 전부 거부한다. */
const FORBIDDEN_JS: [RegExp, string][] = [
  [/\bfetch\s*\(/, "네트워크 요청(fetch) 금지"],
  [/XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon/, "네트워크 요청 금지"],
  [/\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/, "문자열 코드 실행 금지"],
  [/document\.write/, "document.write 금지"],
  [/\bimport\s*\(/, "동적 import 금지"],
  [/localStorage|sessionStorage|document\.cookie|indexedDB/, "저장소·쿠키 접근 금지"],
  [/document\.(body|documentElement)\s*\.\s*(append|appendChild|prepend|insertBefore|insertAdjacent\w*|replaceChildren)\s*\(/,
    "body/html 에 직접 삽입 금지 — 자기 슬롯 안에만 그린다 (화면 노출 방지)"],
  [/\.style\.position\s*=\s*["'`](fixed|sticky)/, "떠 있는 요소(position fixed/sticky) 금지 (화면 노출 방지)"],
  [/["'`]\s*https?:\/\//, "외부 절대 URL 금지 — 사이트 안 상대 경로만"],
];

const FORBIDDEN_CSS: [RegExp, string][] = [
  [/position\s*:\s*(fixed|sticky)/, "떠 있는 요소(position fixed/sticky) 금지 (화면 노출 방지)"],
  [/url\s*\(\s*["']?\s*(https?:)?\/\//, "외부 리소스 url() 금지"],
];

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

export function parseMeta(id: string, raw: string): { meta?: WidgetMeta; errors: string[] } {
  let meta: any;
  try { meta = JSON.parse(raw); } catch { return { errors: ["widget.json: JSON 형식 오류"] }; }
  const errors: string[] = [];
  if (meta?.widget_id !== id) errors.push(`widget.json: widget_id 가 폴더 이름(${id})과 다름`);
  for (const k of ["title", "purpose", "network"]) if (typeof meta?.[k] !== "string" || !meta[k].trim()) errors.push(`widget.json: ${k} 누락`);
  if (meta?.collects_personal_data !== false) errors.push("widget.json: collects_personal_data 는 false 여야 함 (개인정보 수집 위젯은 자동 경로 불가)");
  if (meta?.internal !== undefined && typeof meta.internal !== "boolean") errors.push("widget.json: internal 은 true/false");
  return { meta: errors.length ? undefined : meta, errors };
}

/** 한 위젯 폴더의 파일 내용 전체를 규칙으로 검사한다. files: 파일 이름 → 내용 */
export function checkWidget(id: string, files: Record<string, string>): string[] {
  const errs: string[] = [];
  if (!WIDGET_ID.test(id)) errs.push(`위젯 ID 형식 오류: ${id} (영소문자·숫자·하이픈 3~40자)`);
  for (const name of Object.keys(files)) if (!(ALLOWED_FILES as readonly string[]).includes(name)) errs.push(`허용되지 않은 파일: ${name}`);
  for (const need of ALLOWED_FILES) if (!(need in files)) errs.push(`필수 파일 없음: ${need}`);
  if (errs.length) return errs;

  errs.push(...parseMeta(id, files["widget.json"]!).errors);
  const js = files["index.js"]!, css = files["style.css"]!;
  const code = stripComments(js);
  errs.push(...lintJs(js, `${id}/index.js`), ...lintCss(css, `${id}/style.css`));
  for (const [re, why] of FORBIDDEN_JS) if (re.test(code)) errs.push(`${id}/index.js: ${why}`);
  for (const [re, why] of FORBIDDEN_CSS) if (re.test(stripComments(css))) errs.push(`${id}/style.css: ${why}`);
  // 자기 슬롯에만 붙는다 — 슬롯이 없으면 아무것도 그리지 않는다 (슬롯 = 사람이 승인해 심은 자리).
  if (!code.includes(`[data-ddak-slot="${id}"]`)) errs.push(`${id}/index.js: 자기 슬롯 [data-ddak-slot="${id}"] 에만 마운트해야 함`);
  if (!/^\s*\(function\s*\(\)\s*\{/.test(code.trimStart()) && !/^\s*"use strict";?\s*\(function/.test(code.trimStart())) {
    errs.push(`${id}/index.js: 즉시실행함수 (function () { … })(); 형태여야 함`);
  }
  return errs;
}

/** 변경 범위. 허용 폴더 밖이 한 바이트라도 바뀌면 전체를 거부한다. before/after: 경로 → sha256 */
export function scopeViolations(before: Record<string, string>, after: Record<string, string>, allowedPrefix: string): string[] {
  const out: string[] = [];
  for (const f of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[f] === after[f]) continue;
    if (!f.startsWith(allowedPrefix)) out.push(f);
  }
  return out.sort();
}

/** 요청 누락 판정. 생성기가 요청을 항목으로 나눠 스스로 대조한 결과를 받되, 판정은 규칙으로 한다. */
export function coverageErrors(summary: unknown): string[] {
  const s = summary as { requested?: unknown; done?: unknown; notDone?: unknown } | null;
  if (!s || !Array.isArray(s.requested) || !Array.isArray(s.done) || !Array.isArray(s.notDone)) return ["변경 요약(requested/done/notDone)이 없음 — 누락 여부를 판정할 수 없음"];
  if (!s.requested.length) return ["요청 항목이 비어 있음"];
  if (s.notDone.length) return s.notDone.map((x) => `처리하지 못한 요청: ${String(x).slice(0, 120)}`);
  if (s.done.length < s.requested.length) return [`요청 ${s.requested.length}개 중 ${s.done.length}개만 처리됨`];
  return [];
}
