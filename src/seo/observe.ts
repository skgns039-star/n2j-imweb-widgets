/* OBSERVE 단계 — 공개 페이지 진단. **읽기 전용이다.** 아임웹 쓰기 코드가 여기 존재하지 않는다.
   위젯 스캐너와 독립된 자체 수집기를 쓴다 (격리 계약). 판정은 렌더 후 DOM 기준이다. */
import { NS } from "./marker.ts";

export type Analytics = { ga4: string[]; gtm: string[]; hasGtag: boolean; hasDataLayer: boolean;
  ga4ConfigCount?: number; duplicateGa4Config?: boolean };
export type PageSeo = {
  path: string; ok: boolean; error?: string;
  title: string; description: string; descriptionCount?: number; canonical: string;
  og: Record<string, string>;
  h1: string[]; h2Count: number;
  bodyText: string;              // 렌더된 본문 발췌. 문구의 **근거**로만 쓴다 (INV-13).
  imgTotal: number; imgNoAlt: number;
  jsonLdTypes: string[];
  ownerVerification: Record<string, boolean>;
  seoMarkers: string[];
  analytics: Analytics;
};

/** 측정 ID는 어떤 경우에도 마스킹해서 내보낸다 (절대규칙 9 / STEST-008). */
export function maskId(id: string): string {
  if (!id) return "";
  const m = id.match(/^(G-|GTM-|UA-)?(.*)$/);
  const prefix = m?.[1] ?? "";
  const rest = m?.[2] ?? "";
  return prefix + rest.slice(0, 4) + "*".repeat(Math.max(rest.length - 4, 0));
}

export const maskAnalytics = (a: Analytics): Analytics => ({
  ...a, ga4: a.ga4.map(maskId), gtm: a.gtm.map(maskId),
});

export const COLLECT = `(() => {
  const meta = (sel, attr) => { const e = document.querySelector(sel); return e ? (e.getAttribute(attr) || "") : ""; };
  const og = {};
  for (const m of Array.from(document.querySelectorAll('meta[property^="og:"]'))) {
    og[m.getAttribute("property")] = m.getAttribute("content") || "";
  }
  const jsonLdTypes = [];
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const j = JSON.parse(s.textContent);
      const visit = (node) => {
        if (Array.isArray(node)) { for (const x of node) visit(x); return; }
        if (!node || typeof node !== "object") return;
        const t = node["@type"];
        if (Array.isArray(t)) jsonLdTypes.push(...t.map(String));
        else if (t) jsonLdTypes.push(String(t));
        if (node["@graph"]) visit(node["@graph"]);
      };
      visit(j);
    } catch (e) { jsonLdTypes.push("PARSE_ERROR"); }
  }
  const imgs = Array.from(document.querySelectorAll("img"));
  const html = document.documentElement.outerHTML;
  const scripts = Array.from(document.querySelectorAll("script"));
  const configIds = scripts.flatMap((s) => Array.from((s.textContent || "").matchAll(/gtag\\s*\\(\\s*['"]config['"]\\s*,\\s*['"](G-[A-Z0-9]{6,})['"]/g), (m) => m[1]));
  const uniq = (a) => Array.from(new Set(a));
  return {
    title: document.title || "",
    description: meta('meta[name="description"]', "content"),
    descriptionCount: document.querySelectorAll('meta[name="description"]').length,
    canonical: meta('link[rel="canonical"]', "href"),
    og,
    h1: Array.from(document.querySelectorAll("h1")).map((e) => e.innerText.trim()).filter(Boolean),
    h2Count: document.querySelectorAll("h2").length,
    bodyText: ((document.querySelector("main") || document.querySelector("article") || document.body) || { innerText: "" })
      .innerText.replace(/\\s+/g, " ").trim().slice(0, 600),
    imgTotal: imgs.length,
    imgNoAlt: imgs.filter((i) => !i.getAttribute("alt") || !i.getAttribute("alt").trim()).length,
    jsonLdTypes: uniq(jsonLdTypes),
    ownerVerification: {
      google: !!document.querySelector('meta[name="google-site-verification"]'),
      naver: !!document.querySelector('meta[name="naver-site-verification"]'),
      bing: !!document.querySelector('meta[name="msvalidate.01"]'),
      daum: !!document.querySelector('meta[name="daum-site-verification"]'),
    },
    seoMarkers: uniq((html.match(/DDAK-SEO:START\\s+type=([a-z0-9-]+)/g) || []).map((s) => s.split("type=")[1])),
    analytics: {
      ga4: uniq((html.match(/G-[A-Z0-9]{6,}/g) || [])),
      gtm: uniq((html.match(/GTM-[A-Z0-9]{4,}/g) || [])),
      hasGtag: /gtag\\s*\\(/.test(html),
      hasDataLayer: /dataLayer/.test(html),
      ga4ConfigCount: configIds.length,
      duplicateGa4Config: configIds.length > uniq(configIds).length,
    },
  };
})()`;

/** 페이지 사실 수집은 이 한 곳으로만 나간다 (테스트에서 교체 가능). */
export const collector = {
  async page(url: string, path: string): Promise<PageSeo> {
    const base: PageSeo = {
      path, ok: false, title: "", description: "", descriptionCount: 0, canonical: "", og: {},
      h1: [], h2Count: 0, bodyText: "", imgTotal: 0, imgNoAlt: 0, jsonLdTypes: [],
      ownerVerification: { google: false, naver: false, bing: false, daum: false },
      seoMarkers: [], analytics: { ga4: [], gtm: [], hasGtag: false, hasDataLayer: false, ga4ConfigCount: 0, duplicateGa4Config: false },
    };
    let pw: any;
    try { pw = await import("playwright"); }
    catch { return { ...base, error: "playwright 미설치 — 진단 불가" }; }
    let b: any;
    try {
      b = await pw.chromium.launch({ headless: true });
      const page = await (await b.newContext()).newPage();
      const res = await page.goto(url + path, { waitUntil: "networkidle", timeout: 30_000 });
      if (!res || res.status() !== 200) return { ...base, error: `HTTP ${res?.status() ?? "요청 실패"}` };
      return { ...base, ...(await page.evaluate(COLLECT)), path, ok: true };
    } catch (e) {
      return { ...base, error: `렌더 실패: ${(e as Error).message}` };
    } finally {
      try { await b?.close(); } catch { /* ignore */ }
    }
  },
};

/** SKILL: `쇼핑몰 여부 — /shop_, 장바구니 요소 존재로 판정`.
 *  규칙은 그대로 두되, **근거가 약하면 판정을 밀어붙이지 않고 묻는다** (SKILL §3 "판단이 애매하면 질문한다").
 *
 *  세화(건설업)가 아임웹 **템플릿 샘플 상품** 두 개("shine water cup", "round dot cup") 때문에
 *  쇼핑몰로 판정됐다. 규칙이 틀린 게 아니라 근거가 약한 경우다. */
export function shopVerdict(pages: PageSeo[]): { value: string; weak: boolean; why: string } {
  const shopPages = pages.filter((p) => p.ok && (p.canonical.includes("/shop_") || p.path.includes("/shop_")));
  if (!shopPages.length) return { value: "아니오", weak: false, why: "상품 상세 경로 없음" };

  const details = shopPages.filter((p) => /\/shop_view\//.test(p.path));
  // 영문만으로 된 짧은 상품명은 템플릿 기본값일 가능성이 높다. 확신하지 않고 근거로만 쓴다.
  const latinOnly = details.filter((p) => (p.h1[0] ?? "") && !/[가-힣]/.test(p.h1[0]!));
  const weak = details.length > 0 && details.length <= 3 && latinOnly.length === details.length;
  return {
    value: "예",
    weak,
    why: weak
      ? `상품 ${details.length}건뿐이고 이름이 모두 영문(${details.map((p) => p.h1[0]).join(", ")}) — 템플릿 샘플일 수 있다`
      : `상품 상세 ${details.length}건 확인`,
  };
}

/** 브랜드명은 **모든 페이지 제목에 공통으로 나오는 조각**이다.
 *  마지막 조각을 집던 예전 방식은 제목을 "브랜드 | 페이지" 순서로 바꾸는 순간 뒤집힌다 —
 *  실제로 키워드를 브랜드로 잘못 집었다. 페이지마다 다른 쪽이 페이지명, 같은 쪽이 브랜드다. */
export function brandOf(pages: PageSeo[]): string {
  const titles = pages.filter((p) => p.ok && p.title).map((p) => p.title);
  if (!titles.length) return "";
  // 제목이 하나면 "공통 조각" 이라는 개념이 성립하지 않는다. 관례대로 마지막 조각을 쓴다.
  if (titles.length === 1) return titles[0]!.split(/[|\-–ㅣ]/).pop()!.trim();
  const count = new Map<string, number>();
  for (const t of titles) {
    for (const seg of new Set(t.split(/[|\-–ㅣ]/).map((s) => s.trim()).filter((s) => s.length >= 2))) {
      count.set(seg, (count.get(seg) ?? 0) + 1);
    }
  }
  const best = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0];
  // 페이지가 하나뿐이면 공통이라는 근거가 없다 — 그때만 마지막 조각으로 물러선다.
  if (!best || (titles.length > 1 && best[1] < 2)) return titles[0]!.split(/[|\-–ㅣ]/).pop()!.trim();
  return best[0];
}

/** 한 번에 여는 페이지 상한. 넘치면 **잘렸다고 보고한다** — 조용히 자르면 전수 점검처럼 읽힌다. */
export const MAX_PAGES = 50;

export type SiteFiles = { sitemap: boolean; robots: boolean; llms: boolean; paths: string[]; sitemapHost: string };

/** SKILL 2단계 — sitemap/robots/llms 존재 확인 + 진단 대상 경로 발견.
 *  경로를 사람이 손으로 넣게 두면 "/" 한 장만 보고 끝난다. 실제로 그랬다. */
export async function siteFiles(url: string): Promise<SiteFiles> {
  const base = url.replace(/\/+$/, "");
  const head = async (f: string) => {
    try { return (await fetch(`${base}/${f}`, { redirect: "follow" })).ok; } catch { return false; }
  };
  const out: SiteFiles = { sitemap: false, robots: await head("robots.txt"), llms: await head("llms.txt"), paths: [], sitemapHost: "" };
  try {
    const r = await fetch(`${base}/sitemap.xml`, { redirect: "follow" });
    if (!r.ok) return out;
    out.sitemap = true;
    const locs = (await r.text()).match(/<loc>([^<]+)<\/loc>/g) ?? [];
    for (const l of locs) {
      const raw = l.replace(/<\/?loc>/g, "").trim();
      try {
        const u = new URL(raw);
        out.sitemapHost ||= u.hostname;
        // 경로만 쓴다. 사이트맵이 정식 도메인을 가리켜도 진단은 등록된 url 기준으로 돈다.
        if (!out.paths.includes(u.pathname)) out.paths.push(u.pathname);
      } catch { /* 잘못된 loc 은 무시 */ }
    }
  } catch { /* 없으면 없는 대로 보고한다 */ }
  return out;
}

export async function observe(url: string, paths: string[]): Promise<PageSeo[]> {
  const base = url.replace(/\/+$/, "");
  const out: PageSeo[] = [];
  for (const p of [...new Set(["/", ...paths])].slice(0, MAX_PAGES)) out.push(await collector.page(base, p));
  return out;
}

/** §1.1 자동 추론. 추론값에는 반드시 [추론] 태그를 붙인다 (STEST-009). */
/** weak = 값은 냈지만 **근거가 약하다**. 이런 항목은 조용히 통과시키지 않고 시작 전에 묻는다. */
export type Inferred = { field: string; value: string; inferred: boolean; weak?: boolean; why?: string };

export function infer(pages: PageSeo[]): Inferred[] {
  const first = pages.find((p) => p.ok);
  const out: Inferred[] = [];
  void first;
  const domain = first?.canonical ? new URL(first.canonical).origin : "";
  out.push({ field: "정식 도메인", value: domain, inferred: !!domain });
  out.push({ field: "브랜드명", value: brandOf(pages), inferred: true });
  const s = shopVerdict(pages);
  out.push({ field: "쇼핑몰 여부", value: s.value, inferred: true, weak: s.weak, why: s.why });
  const ga = [...new Set(pages.filter((p) => p.ok).flatMap((p) => p.analytics.ga4))];
  out.push({ field: "GA4", value: !first ? "판정 보류" : ga.length ? ga.map(maskId).join(", ") : "미연결", inferred: !!first });
  return out;
}

/** 추론 실패 항목만 모아 **최대 4개까지** 한 번에 묻는다. 하나씩 묻지 않는다 (STEST-010). */
export function questionsFor(inferred: Inferred[]): string[] {
  // 값이 비었거나(추론 실패) **근거가 약한** 항목을 묻는다. 최대 4개는 그대로 (STEST-010).
  return inferred.filter((i) => !i.value || i.value === "미연결" || i.value === "판정 보류" || i.weak).map((i) => i.field).slice(0, 4);
}

/** 근거가 약한 항목을 사람이 읽을 형태로. 시작 보고서에 붙는다. */
export const weakPoints = (inferred: Inferred[]) =>
  inferred.filter((i) => i.weak).map((i) => `${i.field}: ${i.value} — ${i.why ?? "근거 약함"}`);

export const markerTypesFound = (pages: PageSeo[]) => [...new Set(pages.flatMap((p) => p.seoMarkers))];
export const seoNamespace = NS;
