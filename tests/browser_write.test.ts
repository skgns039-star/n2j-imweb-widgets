import { test } from "node:test";
import assert from "node:assert/strict";
import { ROOT } from "../src/release/paths.ts";
import { request, decide } from "../src/release/approval.ts";
import { verifiedWrite, writePayload } from "../src/browser/verified_write.ts";
import { putBlock } from "../src/browser/common_code.ts";
import * as Google from "../src/google/gsc.ts";
import * as Bing from "../src/bing/api.ts";
assert.equal(process.env.IMWEB_ISOLATED_TEST_ROOT, ROOT, "npm test로 격리 실행하세요.");

function editor(mode: "ok" | "truncate" | "corrupt" | "restore-fail") {
  let current = "original", saved = current, writes = 0, saves = 0;
  return { stats: () => ({ current, saved, writes, saves }),
    read: async () => current,
    write: async (value: string) => { writes++; current = mode === "truncate" && writes === 1 ? value.slice(0, 2) : value; },
    save: async () => { saves++; saved = mode === "restore-fail" || mode === "corrupt" && saves === 1 ? "corrupt" : current; },
    reload: async () => { current = saved; },
  };
}
const approval = () => { const a = request("imweb_write", "field", writePayload("test-site", "field", "original", "new value")); decide(a.id, "APPROVED"); return a.id; };

test("승인 없거나 원문이 달라지면 쓰기 0건", async () => {
  const io = editor("ok");
  assert.equal((await verifiedWrite(io, "test-site", "field", "original", "new value")).ok, false);
  assert.equal((await verifiedWrite(io, "test-site", "field", "stale", "new value", approval())).ok, false);
  assert.equal(io.stats().writes, 0);
});

test("승인·원문·입력·저장 재조회가 모두 맞을 때만 성공", async () => {
  const io = editor("ok");
  assert.equal((await verifiedWrite(io, "test-site", "field", "original", "new value", approval())).ok, true);
  assert.equal(io.stats().saved, "new value");
});

for (const mode of ["truncate", "corrupt", "restore-fail"] as const) test(`${mode}: 실패를 숨기지 않고 원문 복원을 검증한다`, async () => {
  const io = editor(mode);
  const result = await verifiedWrite(io, "test-site", "field", "original", "new value", approval());
  assert.equal(result.ok, false);
  assert.equal(result.restored, mode !== "restore-fail");
  assert.equal(io.stats().writes, 2);
  if (mode !== "restore-fail") assert.equal(io.stats().saved, "original");
});

test("공통 코드 무승인·로더 쓰기 및 미해소 검색엔진 API는 연결 전에 막힌다", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("network must not run"); });
  assert.equal((await putBlock("sehwa", "Header Code", "test", "body")).ok, false);
  assert.equal((await putBlock("sehwa", "Header Code 상단", "test", "body", true)).ok, false);
  for (const action of [() => Google.listSites(), () => Google.addSite("https://example.test"), () => Bing.listSites(), () => Bing.addSite("https://example.test")]) {
    await assert.rejects(action(), /SCHK-00[12]/);
  }
  assert.equal(calls, 0);
});

import { applySeo } from "../src/browser/seo_apply.ts";
import { applyAll } from "../src/browser/menu_seo.ts";
import { run as naverIndex } from "../src/browser/naver_index.ts";
import { assist as naverVerify } from "../src/browser/naver_verify.ts";
import { apply as daumRegister } from "../src/browser/daum_register.ts";
import { naverCode } from "../src/browser/register.ts";
import { readSlot } from "../src/browser/common_code.ts";
import { gateBlock } from "../src/release/paths.ts";

test("SEO 설정/메뉴 초안 무승인 및 검색엔진 브라우저 게이트는 진입 전에 막힌다", async () => {
  assert.equal((await applySeo({ site_id: "sehwa", title: "test", description: "test", keywords: [] })).ok, false);
  assert.equal((await applyAll("sehwa", [{ code: "menu", title: "test", description: "test" }])).ok, false);
  // 네이버 폼 게이트(SCHK-003)가 열려 있으면 게이트에서, 해소됐으면 1회 승인에서 막혀야 한다.
  for (const action of [() => naverIndex("https://example.test", ["/"]), () => naverVerify("https://example.test"),
    () => naverCode("https://example.test")]) await assert.rejects(action(), gateBlock("naver_form") ? /SCHK-003/ : /BLOCKED: 승인/);
  await assert.rejects(daumRegister({ url: "https://example.test" }), /BLOCKED: 승인/);
});

test("브라우저 DOM에 일부 줄만 있어도 전체 모델을 읽고 모델 미발견 시 중단한다", async () => {
  const full = Array.from({ length: 1000 }, (_, n) => `line ${n}`).join("\n");
  const content: any = { cmView: { view: { state: { doc: { length: full.length, toString: () => full } } } } };
  const editor = { querySelector: () => content };
  const fakeDocument = { querySelectorAll: () => [editor] };
  const adapter = { frames: () => [{ url: () => "https://fixture.test/_/config-seo", evaluate: async (fn: (k: number) => string, k: number) => {
    const before = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", { value: fakeDocument, configurable: true });
    try { return fn(k); }
    finally { if (before) Object.defineProperty(globalThis, "document", before); else delete (globalThis as any).document; }
  } }] };
  assert.equal(await readSlot(adapter, 0), full);
  delete content.cmView;
  await assert.rejects(readSlot(adapter, 0), /전체 문서 접근 불가/);
});

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { p } from "../src/release/paths.ts";
import { sha256 } from "../src/release/hash.ts";

test("게이트 해소 후에도 API 쓰기는 요청 내용과 일치하는 승인으로 한 번만 실행된다", async (t) => {
  const authority = p("contracts", "AUTHORITY_MANIFEST.yaml");
  const original = readFileSync(authority, "utf8");
  const keys = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "BING_WEBMASTER_API_KEY"];
  const env = new Map(keys.map((k) => [k, process.env[k]]));
  const tokenFile = p("state", "google", "token.json");
  const tokenBefore = existsSync(tokenFile) ? readFileSync(tokenFile) : null;
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async (url: any) => {
    fetches++;
    return new Response(JSON.stringify(String(url).includes("oauth2") ? { access_token: "test-only" } : { token: "test-only", id: "verified", d: true }));
  });
  try {
    writeFileSync(authority, original.replace("SCHK-001: { status: OPEN", "SCHK-001: { status: RESOLVED").replace("SCHK-002: { status: OPEN", "SCHK-002: { status: RESOLVED"));
    for (const key of keys) process.env[key] = "test-only";
    mkdirSync(p("state", "google"), { recursive: true });
    writeFileSync(tokenFile, JSON.stringify({ refresh_token: "test-only" }));
    const site = "https://example.test/", sitemap = site + "sitemap.xml";
    const SV = "https://www.googleapis.com/siteVerification/v1", WM = "https://www.googleapis.com/webmasters/v3";
    const cases: [string, string, string, (id: string) => Promise<unknown>][] = [
      ["gsc_api_write", `${SV}/token`, JSON.stringify({ verificationMethod: "META", site: { type: "SITE", identifier: site } }), (id) => Google.metaToken(site, id)],
      ["gsc_api_write", `${SV}/webResource?verificationMethod=META`, JSON.stringify({ site: { type: "SITE", identifier: site } }), (id) => Google.verify(site, id)],
      ["gsc_api_write", `${WM}/sites/${encodeURIComponent(site)}`, "", (id) => Google.addSite(site, id)],
      ["gsc_api_write", `${WM}/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemap)}`, "", (id) => Google.submitSitemap(site, sitemap, id)],
      ["bing_api_write", "AddSite", JSON.stringify({ siteUrl: site }), (id) => Bing.addSite(site, id)],
      ["bing_api_write", "SubmitFeed", JSON.stringify({ siteUrl: site, feedUrl: sitemap }), (id) => Bing.submitSitemap(site, sitemap, id)],
      ["bing_api_write", "SubmitUrlBatch", JSON.stringify({ siteUrl: site, urlList: [site] }), (id) => Bing.submitUrls(site, [site], id)],
    ];
    for (const [action, destination, body, run] of cases) {
      const payload = { [action === "gsc_api_write" ? "url" : "op"]: destination, request_sha256: sha256(body) };
      const approval = request(action, "test request", payload);
      decide(approval.id, "APPROVED");
      await run(approval.id);
      const previous = fetches;
      await assert.rejects(run(approval.id), /USED|사용/);
      assert.equal(fetches, previous);
    }
  } finally {
    writeFileSync(authority, original);
    for (const [key, value] of env) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (tokenBefore) writeFileSync(tokenFile, tokenBefore); else unlinkSync(tokenFile);
  }
});
