/* OBSERVE 단계 — 공개 페이지 진단. **읽기 전용이다.** 아임웹 쓰기 코드가 여기 존재하지 않는다.
   위젯 스캐너와 독립된 자체 수집기를 쓴다 (격리 계약). 판정은 렌더 후 DOM 기준이다. */
import { NS } from "./marker.ts";

export type Analytics = { ga4: string[]; gtm: string[]; hasGtag: boolean; hasDataLayer: boolean };
export type PageSeo = {
  path: string; ok: boolean; error?: string;
  title: string; description: string; canonical: string;
  og: Record<string, string>;
  h1: string[]; h2Count: number;
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

const COLLECT = `(() => {
  const meta = (sel, attr) => { const e = document.querySelector(sel); return e ? (e.getAttribute(attr) || "") : ""; };
  const og = {};
  for (const m of Array.from(document.querySelectorAll('meta[property^="og:"]'))) {
    og[m.getAttribute("property")] = m.getAttribute("content") || "";
  }
  const jsonLdTypes = [];
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const j = JSON.parse(s.textContent);
      const arr = Array.isArray(j) ? j : [j];
      for (const x of arr) if (x && x["@type"]) jsonLdTypes.push(String(x["@type"]));
    } catch (e) { jsonLdTypes.push("PARSE_ERROR"); }
  }
  const imgs = Array.from(document.querySelectorAll("img"));
  const html = document.documentElement.outerHTML;
  const uniq = (a) => Array.from(new Set(a));
  return {
    title: document.title || "",
    description: meta('meta[name="description"]', "content"),
    canonical: meta('link[rel="canonical"]', "href"),
    og,
    h1: Array.from(document.querySelectorAll("h1")).map((e) => e.innerText.trim()).filter(Boolean),
    h2Count: document.querySelectorAll("h2").length,
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
    },
  };
})()`;

/** 페이지 사실 수집은 이 한 곳으로만 나간다 (테스트에서 교체 가능). */
export const collector = {
  async page(url: string, path: string): Promise<PageSeo> {
    const base: PageSeo = {
      path, ok: false, title: "", description: "", canonical: "", og: {},
      h1: [], h2Count: 0, imgTotal: 0, imgNoAlt: 0, jsonLdTypes: [],
      ownerVerification: { google: false, naver: false, bing: false, daum: false },
      seoMarkers: [], analytics: { ga4: [], gtm: [], hasGtag: false, hasDataLayer: false },
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

export async function observe(url: string, paths: string[]): Promise<PageSeo[]> {
  const base = url.replace(/\/+$/, "");
  const out: PageSeo[] = [];
  for (const p of [...new Set(["/", ...paths])].slice(0, 10)) out.push(await collector.page(base, p));
  return out;
}

/** §1.1 자동 추론. 추론값에는 반드시 [추론] 태그를 붙인다 (STEST-009). */
export type Inferred = { field: string; value: string; inferred: boolean };

export function infer(pages: PageSeo[]): Inferred[] {
  const first = pages.find((p) => p.ok);
  const out: Inferred[] = [];
  const domain = first?.canonical ? new URL(first.canonical).origin : "";
  out.push({ field: "정식 도메인", value: domain, inferred: !!domain });
  const brand = first?.title.split(/[|\-–]/).pop()?.trim() ?? "";
  out.push({ field: "브랜드명", value: brand, inferred: !!brand });
  const shop = pages.some((p) => p.ok && (p.canonical.includes("/shop_") || p.path.includes("/shop_")));
  out.push({ field: "쇼핑몰 여부", value: shop ? "예" : "아니오", inferred: true });
  const ga = [...new Set(pages.flatMap((p) => p.analytics.ga4))];
  out.push({ field: "GA4", value: ga.length ? ga.map(maskId).join(", ") : "미연결", inferred: true });
  return out;
}

/** 추론 실패 항목만 모아 **최대 4개까지** 한 번에 묻는다. 하나씩 묻지 않는다 (STEST-010). */
export function questionsFor(inferred: Inferred[]): string[] {
  return inferred.filter((i) => !i.value || i.value === "미연결").map((i) => i.field).slice(0, 4);
}

export const markerTypesFound = (pages: PageSeo[]) => [...new Set(pages.flatMap((p) => p.seoMarkers))];
export const seoNamespace = NS;
