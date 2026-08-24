/* ENG-040 / REQ-020·REQ-021. 위반은 경고가 아니라 빌드 실패다. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { p } from "./paths.ts";

const FORBIDDEN_AT = /@import\b|@font-face\b/;
const GLOBAL_SEL = /^(\*|html|body|:root)\b/;

export function lintCss(css: string, file: string): string[] {
  const errs: string[] = [];
  if (FORBIDDEN_AT.test(css)) errs.push(`${file}: @import / @font-face 금지 (외부 폰트·리셋 주입 금지)`);
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of body.split("}")) {
    const sel = block.split("{")[0]?.trim();
    if (!sel || sel.startsWith("@")) continue;
    for (const one of sel.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (GLOBAL_SEL.test(one)) errs.push(`${file}: 전역 셀렉터 금지 → "${one}"`);
      else if (!/\.ddak-|--ddak-|\[data-ddak/.test(one)) errs.push(`${file}: ddak- 네임스페이스 없음 → "${one}"`);
    }
  }
  for (const m of body.matchAll(/z-index\s*:\s*(\d+)/g)) {
    if (Number(m[1]) > 9000) errs.push(`${file}: z-index 상한 9000 초과 (${m[1]})`);
  }
  return errs;
}

export function lintJs(js: string, file: string): string[] {
  const errs: string[] = [];
  for (const m of js.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) {
    if (m[1] !== "__ddak") errs.push(`${file}: 전역 오염 금지 → window.${m[1]} (window.__ddak만 허용)`);
  }
  if (/fonts\.googleapis|fonts\.gstatic|@font-face/.test(js)) errs.push(`${file}: 외부 웹폰트 로드 금지 (REQ-021)`);
  return errs;
}

export function lintWidgetDir(dir: string): string[] {
  const errs: string[] = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) { errs.push(...lintWidgetDir(full)); continue; }
    const txt = readFileSync(full, "utf8");
    if (f.endsWith(".css")) errs.push(...lintCss(txt, f));
    if (f.endsWith(".js")) errs.push(...lintJs(txt, f));
  }
  return errs;
}

if (import.meta.filename === process.argv[1]) {
  const base = p("src", "widgets");
  const errs = readdirSync(base).flatMap((w) => lintWidgetDir(join(base, w)).map((e) => `${w}/${e}`));
  if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
  console.log("css/js scope lint: OK");
}
