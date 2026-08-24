import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const p = (...s: string[]) => join(ROOT, ...s);

export function yaml<T = any>(rel: string): T {
  return parse(readFileSync(p(rel), "utf8")) as T;
}

export function json<T = any>(rel: string, fallback?: T): T {
  if (!existsSync(p(rel))) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing file: ${rel}`);
  }
  return JSON.parse(readFileSync(p(rel), "utf8")) as T;
}

export type Manifest = {
  schema_version: number;
  cdn: { provider: string; owner: string; repo: string; registry_url?: string; registry_note?: string };
  sites: {
    site_id: string; enabled: boolean; label?: string; slots?: string[];
    // 연결 위저드(ENG-041)가 채우는 필드. 비밀값은 들어가지 않는다.
    url?: string; test_path?: string; common_code?: "yes" | "no" | "unknown";
    connected_at?: string; last_scan?: string;
  }[];
  widgets: {
    widget_id: string; version: string; enabled: boolean; site: string;
    match?: { path_glob?: string[] };
    mount: { type: "none" | "slot" | "selector" | "new-slot"; slot?: string; selector?: string };
  }[];
};

export const manifest = () => yaml<Manifest>("manifest/widgets.yaml");

/** 미해소 차단 게이트 확인 (§23.6). 해당 행동이 게이트에 걸려 있으면 사유를 반환한다. */
export function gateBlock(action: string): string | null {
  const m = yaml<any>("contracts/AUTHORITY_MANIFEST.yaml");
  for (const [id, g] of Object.entries<any>(m.blocking_gates ?? {})) {
    if (g?.status === "OPEN" && (g.blocks ?? []).includes(action)) return `${id} 미해소 (${action})`;
  }
  return null;
}
