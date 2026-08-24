/* AC-021 / TEST-021 / TEST-060. 저장소·로그·스캔 산출물에 자격증명이 남아 있으면 실패시킨다.
   패턴 정본은 src/release/secrets.ts 하나다 (중복 정의 금지). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ROOT } from "../src/release/paths.ts";
import { SECRET_PATTERNS } from "../src/release/secrets.ts";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);
// state/ 는 원칙적으로 제외하되, 스캔 산출물은 외부 스크립트 URL에 키가 섞일 수 있어 검사 대상이다 (§24.3).
const SKIP_PATHS = ["state"];
const INCLUDE_PATHS = [join("state", "site_scans")];
const EXEMPT = [join("checks", "secret_scan.ts"), join("src", "release", "secrets.ts")];

const norm = (rel: string) => rel.split(/[\\/]/).join(sep);
const under = (rel: string, base: string) => rel === base || rel.startsWith(base + sep);

export function scanRepo(root = ROOT): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      if (SKIP_DIRS.has(f)) continue;
      const full = join(dir, f);
      const rel = relative(root, full);
      const isDir = statSync(full).isDirectory();
      const skipped = SKIP_PATHS.some((s) => under(rel, norm(s)));
      const included = INCLUDE_PATHS.some((s) => under(rel, norm(s)) || under(norm(s), rel));
      if (skipped && !included) continue;
      if (isDir) { walk(full); continue; }
      if (EXEMPT.some((e) => rel === norm(e))) continue;   // 패턴 정의 자신은 대상이 아니다
      if (/\.(png|jpg|jpeg|gif|ico|sqlite3|zip)$/i.test(f)) continue;
      const txt = readFileSync(full, "utf8");
      for (const [name, re] of SECRET_PATTERNS) if (re.test(txt)) hits.push(`${rel}: ${name}`);
    }
  };
  walk(root);
  return hits;
}

/** `.env` 는 gitignore 된 격리 위치다 — 값이 거기 있는 것은 정상이고 유출이 아니다. */
export const isEnvFile = (hit: string) => hit.startsWith(".env:");
export const leaks = (hits: string[]) => hits.filter((h) => !isEnvFile(h));

if (import.meta.filename === process.argv[1]) {
  const hits = scanRepo();
  for (const h of hits.filter(isEnvFile)) console.log("격리됨(정상) " + h);
  const leaked = leaks(hits);
  if (leaked.length) {
    console.error("시크릿 유출 의심 " + leaked.length + "건\n" + leaked.join("\n"));
    process.exit(1);
  }
  console.log(`secret scan: 유출 0건${hits.length ? ` (.env 내 ${hits.length}건은 격리 위치)` : ""}`);
}
