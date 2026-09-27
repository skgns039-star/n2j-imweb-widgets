import { assertBrowserFormAllowed } from "../seo/gates.ts";
import { consumeApproval } from "../release/approval.ts";
/* 검색엔진 등록 오케스트레이터.

   **사람은 두 가지만 한다: 로그인, 그리고 캡차.** 나머지는 전부 여기서 한다.
   - 세션 없으면 로그인 창을 띄우고 기다린다 (비밀번호는 받지 않는다)
   - 사이트 등록 · 소유확인 방식 선택 · 코드 수령
   - 코드를 모아 아임웹 Header Code 에 한 번에 조립해 넣는다 (기존 블록 보존)
   - 라이브에서 태그가 보이는지 확인
   - 확인 버튼을 누르고, 캡차가 뜨면 **그 창을 그대로 두고** 사람을 기다린다

   캡차는 풀지 않는다. 네이버가 화면에 "프로그램을 이용한 자동등록을 방지하기 위해" 라고
   적어둔 절차다. 사람이 있는지 확인하려는 장치를 대신 통과시키지 않는다. */
import { manifest } from "../release/paths.ts";
import { statePath, sessionStatus, loginInteractive, CONSOLES, type Console } from "./console_session.ts";
import { load as loadCodes, put as putCode, summary } from "../seo/verification_store.ts";
import { compose } from "../seo/header_code.ts";
import { putBlock } from "./common_code.ts";

export type Step = { name: string; ok: boolean; detail: string };

const siteUrl = (site_id: string) => {
  const s = manifest().sites.find((x) => x.site_id === site_id);
  if (!s?.url) throw new Error(`${site_id} 미등록`);
  return s.url;
};

/** 네이버: 사이트 등록 → HTML 태그 방식 → 코드 수령. 캡차 전까지. */
export async function naverCode(target: string, approvalId?: string): Promise<{ code: string; already: boolean }> {
  assertBrowserFormAllowed("naver");
  consumeApproval(approvalId, "naver_register", { target });
  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless: true });
  try {
    const ctx = await b.newContext({ storageState: statePath("naver"), viewport: { width: 1500, height: 950 } });
    const page = await ctx.newPage();
    await page.goto("https://searchadvisor.naver.com/console/board", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(7000);
    const host = new URL(target).host;
    const listed = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    if (!listed.includes(host)) {
      // 목록에 없으면 등록부터. 입력칸은 id 가 매번 바뀌어서 placeholder 로 잡는다.
      const inp = page.locator('input').filter({ hasNot: page.locator("[type=checkbox]") }).first();
      await inp.fill(target);
      await inp.press("Enter");
      await page.waitForTimeout(7000);
    }
    await page.goto(`https://searchadvisor.naver.com/console/verify?site=${encodeURIComponent(target)}`,
      { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(7000);
    await page.locator("input[type=radio]").nth(1).check({ force: true });   // HTML 태그
    await page.waitForTimeout(2500);
    const code = await page.evaluate(() =>
      document.body.innerText.match(/naver-site-verification"\s*content="([A-Za-z0-9]+)"/)?.[1] ?? "");
    return { code, already: !listed.includes("소유확인 진행") && listed.includes(host) };
  } finally {
    await b.close().catch(() => {});
  }
}

/** 모아둔 코드 전량 + JSON-LD 로 Header Code 를 다시 쓴다. */
export async function syncHeaderCode(site_id: string, jsonLd: string, approvalId?: string): Promise<Step> {
  const codes = loadCodes(site_id);
  const next = compose({ jsonLd, verification: codes });
  const r = await putBlock(site_id, "Header Code", "owner-verification", "", false, false, next, approvalId);
  return { name: "아임웹 Header Code 반영", ok: r.ok, detail: `${summary(codes)} — ${r.report.split("\n").pop()}` };
}

/** 라이브에서 태그가 실제로 보이는지. 콘솔이 보는 것과 같은 것을 본다. */
export async function liveHasTag(url: string, metaName: string): Promise<boolean> {
  try {
    const h = await (await fetch(`${url.replace(/\/+$/, "")}/?cb=${Math.random()}`)).text();
    return new RegExp(`<meta[^>]*name="${metaName}"[^>]*>`, "i").test(h);
  } catch { return false; }
}

/** 세션이 없으면 로그인 창을 띄운다. 이미 있으면 건너뛴다. */
export async function ensureSession(c: Console): Promise<Step> {
  if (sessionStatus(c).ok) return { name: `${CONSOLES[c].label} 세션`, ok: true, detail: "이미 있음" };
  const r = await loginInteractive(c);
  return { name: `${CONSOLES[c].label} 로그인`, ok: r.ok, detail: r.report };
}

export function report(steps: Step[]): string {
  return steps.map((s) => `  ${s.ok ? "OK  " : "대기 "}${s.name.padEnd(26)}${s.detail}`).join("\n");
}

/** 한 번에 돌리는 진입점. 사람이 필요한 지점(로그인·캡차)에서만 멈춘다. */
if (import.meta.main) {
  assertBrowserFormAllowed("naver");
  const site_id = process.argv[2] ?? "sehwa";
  const target = process.argv[3] ?? "https://세화건설산업.kr";
  const { BODY } = await import("../seo/jsonld_sehwa.ts");
  const steps: Step[] = [];

  steps.push(await ensureSession("naver"));
  if (steps.at(-1)!.ok) {
    const { code, already } = await naverCode(target);
    if (code) {
      putCode(site_id, "naver", code);
      steps.push({ name: "네이버 코드 수령", ok: true, detail: "코드 수령 (값 미출력)" });
    } else {
      steps.push({ name: "네이버 코드 수령", ok: already, detail: already ? "이미 소유확인 완료" : "코드를 못 찾음" });
    }
  }

  steps.push(await syncHeaderCode(site_id, BODY));

  for (const [engine, meta] of [["naver", "naver-site-verification"], ["gsc", "google-site-verification"],
                                ["bing", "msvalidate.01"], ["daum", "daum-site-verification"]] as const) {
    if (!loadCodes(site_id)[engine]) continue;
    const live = await liveHasTag(siteUrl(site_id), meta);
    steps.push({ name: `라이브 태그 (${engine})`, ok: live, detail: live ? "확인됨" : "아직 안 보임 (반영 대기)" });
  }

  console.log("[검색엔진 등록]");
  console.log(report(steps));
  console.log();
  console.log("사람이 할 일: 로그인 안 된 콘솔의 로그인, 그리고 네이버 [소유확인] 의 캡차 한 칸.");
  console.log("캡차 창은 `npm run seo:verify` 로 띄운다.");
}
