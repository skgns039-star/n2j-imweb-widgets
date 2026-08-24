/* SKILL §4 SCHK 게이트 + §18.1/§18.2 마일스톤 경계.
   스킬이 상위 마일스톤을 앞당기지 않는다. 이번 범위는 **M1 진단 전용**이며 아임웹 쓰기 0건이다. */
import { gateBlock, manifest } from "../release/paths.ts";

export type Engine = "gsc" | "bing" | "naver" | "daum";

const ENGINE_ACTION: Record<Engine, string> = {
  gsc: "gsc_api",
  bing: "bing_api",
  naver: "naver_form",
  daum: "daum_form",
};

export type EngineStatus = { engine: Engine; status: "가능" | "PENDING"; reason: string; fallback: string };

/** 하나라도 미해소면 **해당 엔진만** PENDING이고 나머지는 진행한다. 전부 멈추지 않는다 (STEST-011). */
export function engineStatus(): EngineStatus[] {
  const fallback: Record<Engine, string> = {
    gsc: "수동 등록 안내로 강등",
    bing: "GSC 가져오기 경로로 대체",
    naver: "값이 채워진 등록 안내 카드 전송 → 사람이 직접 등록",
    daum: "값이 채워진 등록 안내 카드 전송 → 사람이 직접 등록",
  };
  return (Object.keys(ENGINE_ACTION) as Engine[]).map((e) => {
    const blocked = gateBlock(ENGINE_ACTION[e]);
    return blocked
      ? { engine: e, status: "PENDING" as const, reason: blocked, fallback: fallback[e] }
      : { engine: e, status: "가능" as const, reason: "", fallback: "" };
  });
}

/** §18.1 — Naver·Daum 폼 자동입력은 브라우저 쓰기다. M2 + OPEN-BRW-* 해소 전에는 차단 (STEST-021). */
export function assertBrowserFormAllowed(engine: Engine): void {
  const m2 = gateBlock("seo_browser_form");
  if (m2) throw new Error(`BLOCKED: ${engine} 폼 자동입력은 M2 범위다 (${m2}). 등록 안내 카드로 대체한다.`);
  const brw = gateBlock("browser_upload");
  if (brw) throw new Error(`BLOCKED: ${engine} 폼 자동입력은 브라우저 쓰기다 (${brw}).`);
  const own = gateBlock(ENGINE_ACTION[engine]);
  if (own) throw new Error(`BLOCKED: ${engine} (${own}).`);
}

/** §18.2 — 9~11단계(반영)는 M2다. M1에서는 어떤 아임웹 쓰기도 시작하지 않는다. */
export function assertApplyAllowed(): void {
  const blocked = gateBlock("seo_apply");
  if (blocked) throw new Error(`BLOCKED: SEO 반영(9~11단계)은 M2 범위다 (${blocked}). 이번 범위는 진단까지다.`);
}

/** §18.3 — site_id 정본은 manifest다. 새로 만들지 않는다 (STEST-022). */
export function resolveSiteId(input: string): { ok: true; site_id: string } | { ok: false; msg: string } {
  const sites = manifest().sites;
  const hit = sites.find((s) => s.site_id === input.trim());
  if (hit) return { ok: true, site_id: hit.site_id };
  return {
    ok: false,
    msg: [
      `manifest에 없는 site_id 입니다: "${input.trim()}"`,
      `등록된 사이트: ${sites.map((s) => s.site_id).join(", ") || "없음"}`,
      "SEO는 manifest의 site_id를 정본으로 씁니다. 먼저 '연결'로 사이트를 등록하세요.",
    ].join("\n"),
  };
}

/** 4개 엔진 상태를 사람이 읽을 형태로. */
export const engineStatusText = () =>
  engineStatus()
    .map((e) => `  ${e.engine.toUpperCase().padEnd(5)} ${e.status}${e.status === "PENDING" ? ` — ${e.reason} → ${e.fallback}` : ""}`)
    .join("\n");
