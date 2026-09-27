import { gateBlock } from "../release/paths.ts";
import { consumeApproval } from "../release/approval.ts";
import { sha256 } from "../release/hash.ts";
/* Search Console API + Site Verification API.

   순서가 정해져 있다:
   1) 소유확인 (siteVerification) — 우리가 이미 <head> 에 심어둔 META 토큰을 구글이 읽어 확인한다
   2) 사이트 등록 (webmasters sites.add)
   3) 사이트맵 제출 (sitemaps.submit)

   1 을 건너뛰고 2 부터 하면 등록은 되지만 **미확인 상태**라 데이터가 안 나온다.
   그래서 항상 1 → 2 → 3 이다. */
import { accessToken } from "./oauth.ts";

const SV = "https://www.googleapis.com/siteVerification/v1";
const WM = "https://www.googleapis.com/webmasters/v3";

async function call(url: string, init: RequestInit = {}, approvalId?: string): Promise<{ status: number; body: any }> {
  const blocked = gateBlock("gsc_api");
  if (blocked) throw new Error(`BLOCKED: ${blocked}`);
  if (init.method && init.method !== "GET") consumeApproval(approvalId, "gsc_api_write", { url, request_sha256: sha256(String(init.body ?? "")) });
  const t = await accessToken();
  const r = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${t}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* 그대로 둔다 */ }
  return { status: r.status, body };
}

/** 구글이 발급하는 META 토큰. 우리가 넣은 값과 같아야 한다. */
export async function metaToken(site: string, approvalId?: string): Promise<string> {
  const { status, body } = await call(`${SV}/token`, {
    method: "POST",
    body: JSON.stringify({ verificationMethod: "META", site: { type: "SITE", identifier: site } }),
  }, approvalId);
  if (status !== 200) throw new Error(`토큰 조회 실패 ${status}: 응답 내용은 비밀값 보호를 위해 생략`);
  // "<meta name=\"google-site-verification\" content=\"...\" />" 에서 값만 뽑는다
  return String(body.token ?? "").match(/content="([^"]+)"/)?.[1] ?? String(body.token ?? "");
}

/** 소유확인 실행. 사이트에 META 태그가 이미 있어야 통과한다. */
export async function verify(site: string, approvalId?: string): Promise<string> {
  const { status, body } = await call(`${SV}/webResource?verificationMethod=META`, {
    method: "POST",
    body: JSON.stringify({ site: { type: "SITE", identifier: site } }),
  }, approvalId);
  if (status === 200) return `소유확인 완료 (${body.id ?? site})`;
  if (status === 400 && JSON.stringify(body).includes("already")) return "이미 확인됨";
  throw new Error(`소유확인 실패 ${status}: 응답 내용은 비밀값 보호를 위해 생략`);
}

export async function listSites(): Promise<string[]> {
  const { status, body } = await call(`${WM}/sites`);
  if (status !== 200) throw new Error(`사이트 목록 실패 ${status}`);
  return (body.siteEntry ?? []).map((s: any) => `${s.siteUrl} (${s.permissionLevel})`);
}

export async function addSite(site: string, approvalId?: string): Promise<string> {
  const { status, body } = await call(`${WM}/sites/${encodeURIComponent(site)}`, { method: "PUT" }, approvalId);
  if (status === 204 || status === 200) return "사이트 등록 완료";
  throw new Error(`사이트 등록 실패 ${status}: 응답 내용은 비밀값 보호를 위해 생략`);
}

export async function submitSitemap(site: string, sitemapUrl: string, approvalId?: string): Promise<string> {
  const { status, body } = await call(
    `${WM}/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemapUrl)}`, { method: "PUT" }, approvalId);
  if (status === 204 || status === 200) return "사이트맵 제출 완료";
  throw new Error(`사이트맵 제출 실패 ${status}: 응답 내용은 비밀값 보호를 위해 생략`);
}

export async function sitemapStatus(site: string): Promise<string> {
  const { status, body } = await call(`${WM}/sites/${encodeURIComponent(site)}/sitemaps`);
  if (status !== 200) return `조회 실패 ${status}`;
  const rows = body.sitemap ?? [];
  return rows.length
    ? rows.map((s: any) => `${s.path} · 마지막 제출 ${s.lastSubmitted ?? "-"} · 오류 ${s.errors ?? 0}`).join("\n    ")
    : "제출된 사이트맵 없음";
}

/** 1 → 2 → 3 을 순서대로. 각 단계 결과를 그대로 보고한다. */
export async function setup(site: string, sitemapUrl: string, approvals: { metaToken?: string; verify?: string; addSite?: string; sitemap?: string } = {}): Promise<string> {
  const blocked = gateBlock("gsc_api");
  if (blocked) throw new Error(`BLOCKED: ${blocked}`);
  const out: string[] = [];
  const step = async (name: string, f: () => Promise<string>) => {
    try { out.push(`  OK   ${name.padEnd(16)}${await f()}`); return true; }
    catch (e) { out.push(`  실패 ${name.padEnd(16)}${(e as Error).message.split("\n")[0]}`); return false; }
  };
  await step("META 토큰", async () => {
    const t = await metaToken(site, approvals.metaToken);
    return t ? "META 토큰 수령 (값 미출력)" : "META 토큰 없음";
  });
  if (!(await step("소유확인", () => verify(site, approvals.verify)))) return out.join("\n");
  await step("사이트 등록", () => addSite(site, approvals.addSite));
  await step("사이트맵 제출", () => submitSitemap(site, sitemapUrl, approvals.sitemap));
  await step("사이트맵 상태", () => sitemapStatus(site));
  return out.join("\n");
}

if (import.meta.main) {
  const site = process.argv[2] ?? "https://xn--z69at79a6jasc240auy1a.kr/";
  const sm = process.argv[3] ?? `${site.replace(/\/+$/, "")}/sitemap.xml`;
  console.log(`[Google Search Console API] ${site}`);
  console.log(await setup(site, sm));
}
