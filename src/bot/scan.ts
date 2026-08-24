/* ENG-042 사이트 상태 스캐너 (REQ-031, REQ-034, §24.3).
   **읽기 전용이다.** 로그인하지 않고 공개 페이지만 연다. 클릭·입력·저장이 없다.
   이 파일에 아임웹 쓰기 코드가 1줄이라도 생기면 설계 위반이다 (§24.13).
   판정은 정적 HTML이 아니라 **렌더링 후 DOM**으로만 한다 (정적 fetch 단독 금지). */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { p, manifest } from "../release/paths.ts";

export const MAX_SAMPLE = 5;

/** 표본 한계를 숨기지 않는다 (§24.3 고지 문구, 결과 첫 줄 고정). */
export const sampleNotice = (n: number) =>
  `표본 ${n}개 기준이며 미검사 페이지에 코드가 있을 수 있습니다. 공통 코드 삽입은 전 페이지 공통이지만 코드 위젯은 페이지별이라 전수 보장이 불가능합니다.`;

export type PageFacts = {
  path: string;
  ok: boolean;
  error?: string;
  loaderTags: { src: string; site: string | null; registry: string | null }[];
  loaderRuntime: { version: string; site: string; bootAt: number } | null;
  scripts: { src: string | null; inline: boolean }[];
  slots: string[];
  ddakClasses: string[];
  hasDdakNs: boolean;
  libs: { name: string; version: string | null }[];
  hostDdakCss: string[];
  maxZIndex: number | null;
};

/** 도달 확인 전용. **판정에는 쓰지 않는다** — 판정은 렌더 후 DOM만 본다 (§24.3). */
export const net = {
  async status(url: string): Promise<number> {
    try { return (await fetch(url, { redirect: "follow", cache: "no-store" })).status; } catch { return 0; }
  },
};

/** 페이지 사실 수집은 이 한 곳에서만 나간다 (테스트에서 교체 가능). */
export const browser = {
  /** Playwright 렌더 후 DOM. 브라우저를 못 띄우면 **정적 fetch로 대체하지 않고 실패**한다 (fail-closed). */
  async collect(url: string, path: string): Promise<PageFacts> {
    const base: PageFacts = {
      path, ok: false, loaderTags: [], loaderRuntime: null, scripts: [], slots: [],
      ddakClasses: [], hasDdakNs: false, libs: [], hostDdakCss: [], maxZIndex: null,
    };
    let pw: any;
    try {
      pw = await import("playwright");
    } catch {
      return { ...base, error: "playwright 미설치 — 스캔 불가. npm i playwright && npx playwright install chromium" };
    }
    let b: any;
    try {
      b = await pw.chromium.launch({ headless: true });
      const ctx = await b.newContext();            // 세션·자격증명 없음
      const page = await ctx.newPage();
      const res = await page.goto(url + path, { waitUntil: "networkidle", timeout: 30_000 });
      if (!res || res.status() !== 200) return { ...base, error: `HTTP ${res?.status() ?? "요청 실패"}` };
      const facts = await page.evaluate(COLLECT_JS);
      return { ...base, ...facts, path, ok: true };
    } catch (e) {
      return { ...base, error: `렌더 실패: ${(e as Error).message}` };
    } finally {
      try { await b?.close(); } catch { /* ignore */ }
    }
  },
};

/** 브라우저 안에서 실행되는 수집 코드. 읽기만 한다. */
const COLLECT_JS = `() => {
  const isLoader = (s) => /loader\\/loader\\.js/.test(s.src || "") || (s.dataset && s.dataset.registry && s.dataset.site);
  const all = Array.from(document.querySelectorAll("script"));
  const loaderTags = all.filter(isLoader).map((s) => ({ src: s.src || "(inline)", site: s.getAttribute("data-site"), registry: s.getAttribute("data-registry") }));
  const scripts = all.filter((s) => !isLoader(s)).map((s) => ({ src: s.src || null, inline: !s.src && !!s.textContent.trim() }));
  const slots = Array.from(document.querySelectorAll("[data-ddak-slot]")).map((e) => e.getAttribute("data-ddak-slot"));
  const ddakClasses = [...new Set(Array.from(document.querySelectorAll('[class*="ddak-"]')).flatMap((e) => Array.from(e.classList).filter((c) => c.startsWith("ddak-"))))];
  const ns = window.__ddak || null;
  const libs = [];
  if (window.jQuery) libs.push({ name: "jquery", version: (window.jQuery.fn && window.jQuery.fn.jquery) || null });
  if (window.bootstrap) libs.push({ name: "bootstrap", version: window.bootstrap.Version || null });
  const hostDdakCss = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules = [];
    try { rules = Array.from(sheet.cssRules || []); } catch (e) { continue; }
    const ours = (sheet.href || "").indexOf("cdn.jsdelivr.net") >= 0;
    if (ours) continue;
    for (const r of rules) {
      const sel = r.selectorText || "";
      const m = sel.match(/\\.(ddak-[\\w-]+)/g);
      if (m) for (const c of m) if (hostDdakCss.indexOf(c.slice(1)) < 0) hostDdakCss.push(c.slice(1));
    }
  }
  let maxZIndex = null;
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const z = parseInt(getComputedStyle(el).zIndex, 10);
    if (!isNaN(z)) maxZIndex = maxZIndex === null ? z : Math.max(maxZIndex, z);
  }
  return {
    loaderTags, scripts, slots, ddakClasses,
    hasDdakNs: !!ns,
    loaderRuntime: ns && ns.loader ? { version: ns.loader.version, site: ns.loader.site, bootAt: ns.loader.bootAt } : null,
    libs, hostDdakCss, maxZIndex,
  };
}`;

export type ScanResult = {
  site_id: string; url: string; paths: string[]; scanned_at: string;
  pages: PageFacts[];
  loaders: { count: number; version: string | null; runtime: boolean };   // S1
  foreign: { src: string[]; inline: number };                             // S2
  slots: { name: string; count: number }[];                               // S3
  traces: { windowNs: boolean; classes: string[] };                       // S4
  libs: { name: string; version: string | null }[];                       // S5
  registry: { url: string; status: number; valid: boolean } | null;       // S6
  observedMaxZIndex: number | null;                                       // §24.10 보고 전용
  hostDdakCss: string[];
  errors: string[];
};

/** 설치 스니펫의 태그가 로더 버전 정본이다 (문자열을 두 곳에 두지 않는다). */
export function currentLoaderVersion(): string {
  return readFileSync(p("loader", "LOADER_SNIPPET.md"), "utf8").match(/@loader-(\d+\.\d+\.\d+)/)?.[1] ?? "1.0.0";
}

export async function scanSite(site_id: string, url: string, paths: string[]): Promise<ScanResult> {
  const sample = [...new Set(["/", ...paths])].slice(0, MAX_SAMPLE);
  const base = url.replace(/\/+$/, "");
  const pages: PageFacts[] = [];
  for (const path of sample) pages.push(await browser.collect(base, path));

  const acc: ScanResult = {
    site_id, url: base, paths: sample, scanned_at: new Date().toISOString(), pages,
    loaders: { count: 0, version: null, runtime: false },
    foreign: { src: [], inline: 0 }, slots: [], traces: { windowNs: false, classes: [] },
    libs: [], registry: null, observedMaxZIndex: null, hostDdakCss: [],
    errors: pages.filter((x) => !x.ok).map((x) => `${x.path}: ${x.error}`),
  };

  for (const pg of pages) {
    if (!pg.ok) continue;
    acc.loaders.count = Math.max(acc.loaders.count, pg.loaderTags.length);
    if (pg.loaderRuntime) {
      acc.loaders.runtime = true;
      acc.loaders.version = pg.loaderRuntime.version;   // §24.2: URL이 아니라 런타임 객체 기준
    }
    for (const s of pg.scripts) {
      if (s.src) { if (!acc.foreign.src.includes(s.src)) acc.foreign.src.push(s.src); }
      else if (s.inline) acc.foreign.inline++;
    }
    // 중복은 **한 페이지 안에서** 같은 슬롯이 두 번 나오는 경우다.
    // 표본 페이지마다 같은 슬롯이 하나씩 있는 것은 정상이므로 합산하지 않고 페이지별 최대값을 쓴다.
    for (const name of new Set(pg.slots)) {
      const inPage = pg.slots.filter((s) => s === name).length;
      const row = acc.slots.find((s) => s.name === name);
      if (row) row.count = Math.max(row.count, inPage);
      else acc.slots.push({ name, count: inPage });
    }
    if (pg.hasDdakNs) acc.traces.windowNs = true;
    for (const c of pg.ddakClasses) if (!acc.traces.classes.includes(c)) acc.traces.classes.push(c);
    for (const l of pg.libs) if (!acc.libs.some((x) => x.name === l.name)) acc.libs.push(l);
    for (const c of pg.hostDdakCss) if (!acc.hostDdakCss.includes(c)) acc.hostDdakCss.push(c);
    if (pg.maxZIndex !== null) acc.observedMaxZIndex = Math.max(acc.observedMaxZIndex ?? 0, pg.maxZIndex);
  }

  const regUrl = pages.flatMap((pg) => pg.loaderTags).find((l) => l.registry)?.registry;
  if (regUrl) {
    try {
      const r = await fetch(regUrl, { cache: "no-store" });          // JSON 자산 조회(읽기)
      const body = await r.text();
      let valid = false;
      try { valid = JSON.parse(body)?.schema_version === 1; } catch { valid = false; }
      acc.registry = { url: regUrl, status: r.status, valid };
    } catch {
      acc.registry = { url: regUrl, status: 0, valid: false };
    }
  }

  const dir = p("state", "site_scans");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p("state", "site_scans", `${site_id}_${acc.scanned_at.replace(/[:.]/g, "-")}.json`), JSON.stringify(acc, null, 2) + "\n");
  return acc;
}

export type Verdict = { code: "C1" | "C2" | "C3" | "C4"; blocked: boolean; text: string };

/** C1~C4. C4는 경고로 강등할 수 없다 (§24.13). */
export function verdict(scan: ScanResult, latest = currentLoaderVersion()): Verdict {
  const n = scan.loaders.count;
  if (n === 0 && !scan.loaders.runtime) return { code: "C1", blocked: false, text: "로더 0개 — 신규 삽입 경로입니다." };
  if (n > 1) {
    return {
      code: "C4", blocked: true,
      text: [
        `중복 로더 발견 ${n}개 — BLOCKED. 자동으로 제거하지 않습니다 (INV-1).`,
        `런타임에서는 두 번째 로더가 스스로 종료해 무해화되지만(§24.2), 삽입 자체가 남아 있으면 연결 실패로 처리합니다.`,
        `유지 대상 1개(최신 ${latest})를 고르고 나머지는 사람이 직접 제거하세요. 제거 전 원문 스냅샷 보관 필수 (INV-6).`,
      ].join("\n"),
    };
  }
  const v = scan.loaders.version;
  if (v === latest) return { code: "C2", blocked: false, text: `로더 1개 · 최신(${latest}) — 이미 연결됨. 새로 심지 않습니다 (INV-2).` };
  return { code: "C3", blocked: true, text: `로더 1개 · 구버전(${v ?? "불명"} → ${latest}). 교체는 INV-2 예외라 명시 승인이 필요합니다.` };
}

/** E1·E2·E4는 연결 실패다. E3는 §24.10에 따라 보고만 한다. */
export function conflicts(scan: ScanResult): { blocking: string[]; report: string[] } {
  const blocking: string[] = [];
  const report: string[] = [];

  for (const s of scan.slots) if (s.count > 1) blocking.push(`E1 slot 이름 중복: "${s.name}" ${s.count}개`);
  if (scan.hostDdakCss.length) blocking.push(`E2 호스트 CSS가 ddak- 클래스를 이미 정의함: ${scan.hostDdakCss.join(", ")}`);

  const widgetSrc = manifest().widgets
    .map((w) => { const f = p("src", "widgets", w.widget_id, "index.js"); return existsSync(f) ? readFileSync(f, "utf8") : ""; })
    .join("\n");
  for (const lib of scan.libs) {
    if (new RegExp(lib.name, "i").test(widgetSrc)) blocking.push(`E4 라이브러리 중복 로드 시도: ${lib.name} (호스트가 이미 로드 중)`);
  }

  if (scan.observedMaxZIndex !== null) {
    report.push(`E3 표본에서 관측된 최대 z-index: ${scan.observedMaxZIndex} (위젯 상한 9000). 가려짐 여부는 실사이트에서 육안 확인하세요 — 자동 판정하지 않습니다.`);
  }
  return { blocking, report };
}

/** §24.5 정본 판정. "어느 쪽이 정본이냐"를 묻지 않는다 — 정본은 언제나 Git이다 (INV-3). */
export type DriftRow = { kind: "드리프트" | "미배포" | "불일치"; detail: string; action: string };

export function driftReport(scan: ScanResult, site_id: string): DriftRow[] {
  const m = manifest();
  const site = m.sites.find((s) => s.site_id === site_id);
  const declared = site?.slots ?? [];
  const found = scan.slots.map((s) => s.name);
  const rows: DriftRow[] = [];

  for (const s of found) {
    if (!declared.includes(s)) rows.push({ kind: "드리프트", detail: `사이트에 있으나 Git에 없는 슬롯: ${s}`, action: "기록만 하고 손대지 않습니다." });
  }
  for (const s of declared) {
    if (!found.includes(s)) rows.push({ kind: "미배포", detail: `Git에 있으나 사이트에 없는 슬롯: ${s}`, action: "슬롯은 1회 삽입 대상입니다. 삽입 여부를 확인하세요." });
  }
  if (scan.foreign.inline > 0 || scan.foreign.src.length > 0) {
    rows.push({ kind: "드리프트", detail: `우리 것이 아닌 스크립트 src ${scan.foreign.src.length}개 / 인라인 ${scan.foreign.inline}개`, action: "기록만 합니다. 정리·개선을 먼저 제안하지 않습니다." });
  }
  const latest = currentLoaderVersion();
  if (scan.loaders.version && scan.loaders.version !== latest) {
    rows.push({ kind: "불일치", detail: `로더 사이트 ${scan.loaders.version} ↔ Git ${latest}`, action: "정본(Git) 기준 재배포·교체를 제안합니다. 사이트를 정본으로 승격하지 않습니다." });
  }
  for (const w of m.widgets.filter((x) => x.site === site_id && x.enabled)) {
    if (!scan.traces.windowNs) {
      rows.push({ kind: "미배포", detail: `${w.widget_id}@${w.version} 이 enabled인데 사이트에서 흔적이 없음`, action: "재배포로 정본을 반영할지 확인하세요." });
      break;
    }
  }
  return rows;
}

export function summarize(scan: ScanResult): string {
  return [
    sampleNotice(scan.paths.length),
    "",
    `스캔 결과 (${scan.site_id} · ${scan.paths.join(" ")})`,
    `S1 로더: 태그 ${scan.loaders.count}개 / 런타임 ${scan.loaders.runtime ? `v${scan.loaders.version}` : "미탐지"}`,
    `S2 외부 스크립트: src ${scan.foreign.src.length}개 / 인라인 ${scan.foreign.inline}개`,
    `S3 슬롯: ${scan.slots.length ? scan.slots.map((s) => `${s.name}×${s.count}`).join(", ") : "없음"}`,
    `S4 ddak 흔적: window.__ddak ${scan.traces.windowNs ? "있음" : "없음"} / 클래스 ${scan.traces.classes.length}개`,
    `S5 공용 라이브러리: ${scan.libs.length ? scan.libs.map((l) => `${l.name}${l.version ? "@" + l.version : ""}`).join(", ") : "없음"}`,
    `S6 registry: ${scan.registry ? `HTTP ${scan.registry.status} · 스키마 ${scan.registry.valid ? "정상" : "이상"}` : "참조 없음"}`,
    ...(scan.errors.length ? [`오류: ${scan.errors.join(" / ")}`] : []),
  ].join("\n");
}
