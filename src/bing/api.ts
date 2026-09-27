import { gateBlock } from "../release/paths.ts";
import { consumeApproval } from "../release/approval.ts";
import { sha256 } from "../release/hash.ts";
/* Bing Webmaster Tools REST API.

   브라우저 경로는 막혔다 — Bing 로그인을 구글 계정으로 하려니 구글이
   "브라우저 또는 앱이 안전하지 않을 수 있습니다" 로 막는다. 그래서 API 로 간다.
   키는 Bing 웹마스터 도구 → 설정 → API 액세스 에서 발급한다 (무료).

   구글과 다른 점: Bing 은 **소유확인을 API 로 못 한다.** AddSite 로 넣은 뒤
   메타 태그/XML/CNAME 중 하나로 확인해야 하고, 그 확인은 Bing 쪽에서 판정한다.
   가장 빠른 길은 웹마스터 도구에서 "GSC 에서 가져오기" 다 — 소유확인이 통째로 넘어온다. */
const BASE = "https://ssl.bing.com/webmaster/api.svc/json";

function key(): string {
  const k = process.env.BING_WEBMASTER_API_KEY ?? "";
  if (!k) throw new Error("BLOCKED: BING_WEBMASTER_API_KEY 가 .env 에 없다.");
  return k;
}

async function call(op: string, body?: unknown, approvalId?: string): Promise<any> {
  const blocked = gateBlock("bing_api");
  if (blocked) throw new Error(`BLOCKED: ${blocked}`);
  if (body !== undefined) consumeApproval(approvalId, "bing_api_write", { op, request_sha256: sha256(JSON.stringify(body)) });
  // op 에 이미 쿼리가 붙어 있을 수 있다. 무조건 `?apikey=` 를 붙이면 `?` 가 두 번 들어가
  // InvalidApiKey 로 튕긴다 — 실제로 그랬다.
  const url = `${BASE}/${op}${op.includes("?") ? "&" : "?"}apikey=${key()}`;
  const r = await fetch(url, body === undefined
    ? {}
    : { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
  const text = await r.text();
  let j: any = text;
  try { j = text ? JSON.parse(text) : null; } catch { /* 그대로 */ }
  if (r.status !== 200) throw new Error(`${op} ${r.status}: 응답 내용 생략`);
  // Bing 은 오류도 200 으로 주고 본문에 ErrorCode 를 담는다. 상태코드만 믿으면 안 된다.
  if (j?.ErrorCode) throw new Error(`${op} 오류 ${j.ErrorCode}: 응답 내용 생략`);
  return j?.d ?? j;
}

export const listSites = async (): Promise<string[]> =>
  (await call("GetUserSites") ?? []).map((s: any) => `${s.Url} (${s.IsVerified ? "확인됨" : "미확인"})`);

export const addSite = async (siteUrl: string, approvalId?: string): Promise<string> => {
  await call("AddSite", { siteUrl }, approvalId);
  return "사이트 추가 완료 (소유확인은 별도)";
};

/** 사이트맵은 SubmitFeed 로 넣는다. Bing 은 이걸 "피드" 라 부른다. */
export const submitSitemap = async (siteUrl: string, feedUrl: string, approvalId?: string): Promise<string> => {
  await call("SubmitFeed", { siteUrl, feedUrl }, approvalId);
  return "사이트맵 제출 완료";
};

/** URL 색인 요청. 하루 한도가 있으니 핵심 페이지만 넣는다. */
export const submitUrls = async (siteUrl: string, urlList: string[], approvalId?: string): Promise<string> => {
  await call("SubmitUrlBatch", { siteUrl, urlList }, approvalId);
  return `${urlList.length}개 색인 요청 완료`;
};

export async function quota(siteUrl: string): Promise<string> {
  const q = await call(`GetUrlSubmissionQuota?siteUrl=${encodeURIComponent(siteUrl)}`);
  return `일일 ${q?.DailyQuota ?? "?"} / 월간 ${q?.MonthlyQuota ?? "?"}`;
}

export async function setup(siteUrl: string, paths: string[], approvals: { addSite?: string; sitemap?: string; urls?: string } = {}): Promise<string> {
  const blocked = gateBlock("bing_api");
  if (blocked) throw new Error(`BLOCKED: ${blocked}`);
  const out: string[] = [];
  const step = async (name: string, f: () => Promise<string>) => {
    try { out.push(`  OK   ${name.padEnd(16)}${await f()}`); return true; }
    catch (e) { out.push(`  실패 ${name.padEnd(16)}${(e as Error).message.split("\n")[0]}`); return false; }
  };
  const sites = await listSites().catch(() => []);
  out.push(`  현재 등록: ${sites.join(", ") || "없음"}`);

  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!sites.some((s) => s.includes(host))) await step("사이트 추가", () => addSite(siteUrl, approvals.addSite));
  await step("사이트맵", () => submitSitemap(siteUrl, `${siteUrl.replace(/\/+$/, "")}/sitemap.xml`, approvals.sitemap));
  await step("색인 요청", () => submitUrls(siteUrl, paths.map((p) => `${siteUrl.replace(/\/+$/, "")}${p}`), approvals.urls));
  await step("남은 한도", () => quota(siteUrl));
  return out.join("\n");
}

if (import.meta.main) {
  const site = process.argv[2] ?? "https://xn--z69at79a6jasc240auy1a.kr";
  console.log(`[Bing Webmaster API] ${site}`);
  console.log(await setup(site, ["/", "/introduction", "/field", "/dwelling", "/industry", "/commerce", "/remodeling", "/18"]));
}
