/* ENG-029. 새 코드 추가 = registry 항목 추가 (INV-4). 아임웹은 영원히 그대로다. */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { p, manifest, json } from "./paths.ts";
import type { IntegrityRecord } from "./build.ts";

export type Registry = {
  schema_version: 1;
  global_enabled: boolean;
  updated_at: string;
  sites: Record<string, { enabled: boolean }>;
  modules: {
    widget_id: string; version: string; enabled: boolean;
    match: { site: string; path_glob: string[] };
    mount: Record<string, unknown>;
    assets: { type: "js" | "css"; url: string; integrity: string }[];
  }[];
};

export function assetUrl(owner: string, repo: string, id: string, version: string, file: string) {
  // 불변 태그 고정 (§18.4). 태그가 불변이므로 자산은 캐시돼도 무해하다.
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@w-${id}-${version}/dist/${id}/${version}/${file}`;
}

export function buildRegistry(): Registry {
  const m = manifest();
  const killed = existsSync(p("config", "kill_switch"));
  return {
    schema_version: 1,
    global_enabled: !killed,
    updated_at: new Date().toISOString(),
    sites: Object.fromEntries(m.sites.map((s) => [s.site_id, { enabled: s.enabled }])),
    modules: m.widgets.map((w) => {
      const rec = json<IntegrityRecord>(`integrity/${w.widget_id}.json`);
      if (rec.version !== w.version) {
        throw new Error(`${w.widget_id}: integrity(${rec.version}) != manifest(${w.version}) — 빌드 먼저`);
      }
      if (w.mount.type === "new-slot") {
        throw new Error(`${w.widget_id}: new-slot은 아임웹 1회 수정이 필요하다. 승인 없이 진행하지 않는다 (§18.3)`);
      }
      return {
        widget_id: w.widget_id,
        version: w.version,
        enabled: w.enabled,
        match: { site: w.site, path_glob: w.match?.path_glob ?? ["/*"] },
        mount: w.mount as Record<string, unknown>,
        assets: rec.files
          .filter((f) => f.name.endsWith(".js") || f.name.endsWith(".css"))
          .map((f) => ({
            type: (f.name.endsWith(".css") ? "css" : "js") as "js" | "css",
            url: assetUrl(m.cdn.owner, m.cdn.repo, w.widget_id, w.version, f.name),
            integrity: f.sri,
          })),
      };
    }),
  };
}

export function writeRegistry(): Registry {
  const reg = buildRegistry();
  writeFileSync(p("registry.json"), JSON.stringify(reg, null, 2) + "\n");
  return reg;
}

export const readRegistry = (): Registry => JSON.parse(readFileSync(p("registry.json"), "utf8"));

if (import.meta.filename === process.argv[1]) console.log(JSON.stringify(writeRegistry(), null, 2));
