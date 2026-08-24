/* ENG-019 + ENG-039. 정본 → dist. SHA-256 · SRI · 성능 예산 · CSS 스코프 검사.
   예산 초과·린트 위반은 경고가 아니라 빌드 실패다 (§22.3). */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { p, manifest } from "./paths.ts";
import { sha256, sri, gzipSize } from "./hash.ts";
import { lintCss, lintJs } from "./css_scope_lint.ts";
import { writeRegistry } from "./registry.ts";

const BUDGET = { widget: 30 * 1024, total: 100 * 1024, loader: 5 * 1024 };

export type IntegrityFile = {
  name: string; bytes: number; gzip: number;
  source_sha256: string; dist_sha256: string; sri: string;
};
export type IntegrityRecord = { widget_id: string; version: string; built_at: string; files: IntegrityFile[] };

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? walk(full, base) : [full.slice(base.length + 1).replace(/\\/g, "/")];
  });
}

export function build(): IntegrityRecord[] {
  const m = manifest();
  const errs: string[] = [];
  const records: IntegrityRecord[] = [];
  let total = 0;

  const loader = readFileSync(p("loader", "loader.js"));
  if (gzipSize(loader) > BUDGET.loader) errs.push(`loader.js gzip ${gzipSize(loader)}B > ${BUDGET.loader}B`);

  // §24.2. 로더가 스스로 밝히는 버전과 삽입 스니펫의 태그가 어긋나면 C2/C3 판정이 무너진다.
  const selfVer = loader.toString("utf8").match(/ns\.loader\s*=\s*\{\s*version:\s*"(\d+\.\d+\.\d+)"/)?.[1];
  const tagVer = readFileSync(p("loader", "LOADER_SNIPPET.md"), "utf8").match(/@loader-(\d+\.\d+\.\d+)/)?.[1];
  if (!selfVer) errs.push("loader.js에 자기식별 버전(ns.loader.version)이 없다 (§24.2)");
  else if (selfVer !== tagVer) errs.push(`로더 버전 불일치: loader.js ${selfVer} != LOADER_SNIPPET.md @loader-${tagVer}`);

  for (const w of m.widgets) {
    const srcDir = p("src", "widgets", w.widget_id);
    if (!existsSync(srcDir)) { errs.push(`${w.widget_id}: 정본 디렉터리 없음`); continue; }
    const outDir = p("dist", w.widget_id, w.version);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    const rec: IntegrityRecord = {
      widget_id: w.widget_id, version: w.version,
      built_at: new Date().toISOString(), files: [],
    };
    let wsize = 0;

    for (const rel of walk(srcDir)) {
      if (rel === "widget.json") continue;
      const buf = readFileSync(join(srcDir, rel));
      const txt = buf.toString("utf8");
      if (rel.endsWith(".css")) errs.push(...lintCss(txt, `${w.widget_id}/${rel}`));
      if (rel.endsWith(".js")) errs.push(...lintJs(txt, `${w.widget_id}/${rel}`));

      const out = join(outDir, rel);
      mkdirSync(join(out, ".."), { recursive: true });
      writeFileSync(out, buf); // 번들러 없음: 정본 바이트를 그대로 옮긴다 (INV-3)
      const gz = gzipSize(buf);
      wsize += gz;
      rec.files.push({
        name: rel, bytes: buf.length, gzip: gz,
        source_sha256: sha256(buf), dist_sha256: sha256(readFileSync(out)), sri: sri(buf),
      });
    }

    if (wsize > BUDGET.widget) errs.push(`${w.widget_id}: gzip ${wsize}B > ${BUDGET.widget}B`);
    if (w.enabled) total += wsize;
    records.push(rec);
    writeFileSync(p("integrity", `${w.widget_id}.json`), JSON.stringify(rec, null, 2) + "\n");
  }

  if (total > BUDGET.total) errs.push(`사이트 총합 gzip ${total}B > ${BUDGET.total}B`);
  if (errs.length) throw new BuildFailed(errs);
  return records;
}

/** 위반 목록을 들고 다니는 실패. 호출자가 보고만 하고 **자동 수정하지 않는다**. */
export class BuildFailed extends Error {
  errors: string[];
  constructor(errors: string[]) { super("BUILD FAILED\n" + errors.join("\n")); this.errors = errors; }
}

if (import.meta.filename === process.argv[1]) {
  try {
    const recs = build();
    writeRegistry();
    for (const r of recs) console.log(`built ${r.widget_id}@${r.version} (${r.files.length} files)`);
    console.log("registry.json 갱신 완료");
  } catch (e) {
    if (e instanceof BuildFailed) { console.error(e.message); process.exit(1); }
    throw e;
  }
}
