/* ENG-019 무결성 가드. 4지점 검증: source -> dist -> cdn -> browser(SRI).
   1건이라도 불일치면 FAIL. 재시도 없이 즉시 중단한다 (§7.5, INV-5). */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { p, manifest, json } from "./paths.ts";
import { sha256, sri } from "./hash.ts";
import type { IntegrityRecord } from "./build.ts";
import { assetUrl } from "./registry.ts";

export type Point = { widget_id: string; file: string; point: "source" | "dist" | "cdn" | "sri"; ok: boolean; detail: string };

async function fetchBuf(url: string, tries = 3): Promise<Buffer | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch { /* 네트워크 실패는 backoff 재시도 (§13) */ }
    await new Promise((res) => setTimeout(res, 500 * 2 ** i));
  }
  return null;
}

export async function verify(opts: { widget?: string; cdn?: boolean } = {}): Promise<Point[]> {
  const m = manifest();
  const out: Point[] = [];

  for (const w of m.widgets) {
    if (opts.widget && opts.widget !== w.widget_id) continue;
    const recPath = `integrity/${w.widget_id}.json`;
    if (!existsSync(p(recPath))) {
      out.push({ widget_id: w.widget_id, file: "-", point: "source", ok: false, detail: "무결성 기록 없음 — 빌드 먼저" });
      continue;
    }
    const rec = json<IntegrityRecord>(recPath);

    for (const f of rec.files) {
      const srcFile = join(p("src", "widgets", w.widget_id), f.name);
      const distFile = join(p("dist", w.widget_id, w.version), f.name);

      const srcOk = existsSync(srcFile) && sha256(readFileSync(srcFile)) === f.source_sha256;
      out.push({ widget_id: w.widget_id, file: f.name, point: "source", ok: srcOk, detail: f.source_sha256.slice(0, 12) });

      const distOk = existsSync(distFile) && sha256(readFileSync(distFile)) === f.dist_sha256 && f.dist_sha256 === f.source_sha256;
      out.push({ widget_id: w.widget_id, file: f.name, point: "dist", ok: distOk, detail: f.dist_sha256.slice(0, 12) });

      if (opts.cdn === false) continue;
      const url = assetUrl(m.cdn.owner, m.cdn.repo, w.widget_id, w.version, f.name);
      const buf = await fetchBuf(url);
      if (!buf) {
        out.push({ widget_id: w.widget_id, file: f.name, point: "cdn", ok: false, detail: `CDN 미도달 (미배포이거나 태그 없음): ${url}` });
        continue;
      }
      out.push({ widget_id: w.widget_id, file: f.name, point: "cdn", ok: sha256(buf) === f.dist_sha256, detail: sha256(buf).slice(0, 12) });
      out.push({ widget_id: w.widget_id, file: f.name, point: "sri", ok: sri(buf) === f.sri, detail: f.sri.slice(0, 18) });
    }
  }
  return out;
}

if (import.meta.filename === process.argv[1]) {
  const localOnly = process.argv.includes("--local");
  const points = await verify({ cdn: !localOnly });
  for (const pt of points) console.log(`${pt.ok ? "OK  " : "FAIL"} ${pt.widget_id} ${pt.file} [${pt.point}] ${pt.detail}`);
  const bad = points.filter((x) => !x.ok);
  if (!points.length) { console.error("검증 대상 없음"); process.exit(1); }
  if (bad.length) { console.error(`무결성 불일치 ${bad.length}건 — BLOCKED`); process.exit(1); }
  console.log(`무결성 ${points.length}지점 전부 일치`);
}
