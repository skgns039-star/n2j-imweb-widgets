/* ENG-032 브라우저 세션 관리 (REQ-017, §19.2).
   **자격증명은 한 번도 프로그램에 들어오지 않는다.** 사람이 headed 창에 직접 입력한다.
   저장하는 것은 로그인 결과(storageState)뿐이며 state/browser/ 는 gitignore 대상이다. */
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { p, manifest, yaml, gateBlock } from "../release/paths.ts";

export const STATE_DIR = () => {
  const d = p("state", "browser");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
};

export const statePath = (site_id: string) => `${STATE_DIR()}/${site_id}.storage.json`;

export type Selectors = {
  site: { admin_url: string; login_url: string };
  login_markers: { primary: string; fallback: string };
  logout_markers: { primary: string; fallback: string };
  common_code: Record<string, any>;
  verified: boolean;
  verified_at: string | null;
};

export const selectors = () => yaml<Selectors>("config/imweb_selectors.yaml");

/** {host} 치환. site_id 의 manifest url 에서 호스트를 뽑는다. */
export function adminUrl(site_id: string): string {
  const site = manifest().sites.find((s) => s.site_id === site_id);
  if (!site?.url) throw new Error(`BLOCKED: ${site_id} 에 url 이 없다. '연결' 위저드로 먼저 등록한다.`);
  return selectors().site.admin_url.replace("{host}", new URL(site.url).host);
}

export type SessionStatus =
  | { ok: true; site_id: string; savedAt: string }
  | { ok: false; reason: string; needsLogin: boolean };

/** 세션 파일 존재·나이만 본다. 유효성 최종 판정은 preflight 가 실제 페이지로 한다. */
export function sessionStatus(site_id: string): SessionStatus {
  const f = statePath(site_id);
  if (!existsSync(f)) return { ok: false, reason: "저장된 세션이 없다", needsLogin: true };
  const age = Date.now() - statSync(f).mtimeMs;
  const days = age / 86_400_000;
  if (days > 30) return { ok: false, reason: `세션이 ${Math.floor(days)}일 지났다`, needsLogin: true };
  return { ok: true, site_id, savedAt: new Date(statSync(f).mtimeMs).toISOString() };
}

async function launch(headless: boolean) {
  let pw: any;
  try { pw = await import("playwright"); }
  catch { throw new Error("BLOCKED: playwright 미설치"); }
  return pw.chromium.launch({ headless });
}

const anyVisible = async (page: any, sel: { primary: string; fallback: string }) => {
  for (const s of [sel.primary, sel.fallback]) {
    try { if (await page.locator(s).first().isVisible({ timeout: 2000 })) return true; } catch { /* 다음 */ }
  }
  return false;
};

/** 최초 1회 / 세션 만료 시. **headed 창을 띄우고 사람을 기다린다.**
 *  비밀번호를 받지도, 입력하지도, 저장하지도 않는다. 최대 10분 대기 후 취소 (§19.5). */
export async function loginInteractive(site_id: string, timeoutMs = 600_000): Promise<SessionStatus> {
  const blocked = gateBlock("browser_upload");
  if (blocked) return { ok: false, reason: `BLOCKED: ${blocked}`, needsLogin: false };

  const sel = selectors();
  const b = await launch(false);                       // headed — 사람이 직접 로그인한다
  try {
    const ctx = await b.newContext();
    const page = await ctx.newPage();
    await page.goto(sel.site.login_url, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (await anyVisible(page, sel.login_markers)) {
        await ctx.storageState({ path: statePath(site_id) });
        return { ok: true, site_id, savedAt: new Date().toISOString() };
      }
      await page.waitForTimeout(3000);
    }
    return { ok: false, reason: "10분 안에 로그인이 확인되지 않아 취소했다", needsLogin: true };
  } finally {
    try { await b.close(); } catch { /* ignore */ }
  }
}

/** §19.3-1 preflight. 저장된 세션으로 관리자 페이지가 실제로 열리는지 확인한다.
 *  실패하면 자동 진행하지 않고 사람 개입을 요청한다 (REQ-018). */
export async function preflight(site_id: string): Promise<SessionStatus> {
  const blocked = gateBlock("browser_upload");
  if (blocked) return { ok: false, reason: `BLOCKED: ${blocked}`, needsLogin: false };

  const st = sessionStatus(site_id);
  if (!st.ok) return st;

  const sel = selectors();
  const b = await launch(true);
  try {
    const ctx = await b.newContext({ storageState: statePath(site_id) });
    const page = await ctx.newPage();
    const res = await page.goto(adminUrl(site_id), { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!res || res.status() >= 400) {
      return { ok: false, reason: `관리자 페이지 HTTP ${res?.status() ?? "요청 실패"}`, needsLogin: true };
    }
    await page.waitForTimeout(2500);
    if (await anyVisible(page, sel.logout_markers)) {
      return { ok: false, reason: "로그인 화면이 떴다 — 세션 만료", needsLogin: true };
    }
    if (!(await anyVisible(page, sel.login_markers))) {
      return { ok: false, reason: "로그인 상태 마커를 찾지 못했다 (UI 변경 가능성)", needsLogin: true };
    }
    return { ok: true, site_id, savedAt: st.savedAt };
  } catch (e) {
    return { ok: false, reason: `preflight 실패: ${(e as Error).message}`, needsLogin: true };
  } finally {
    try { await b.close(); } catch { /* ignore */ }
  }
}

/** 세션 만료를 사람에게 알릴 때 쓰는 문구. 자격증명을 요구하지 않는다. */
export const reloginNotice = (site_id: string, reason: string) => [
  `[아임웹 세션] ${site_id} — ${reason}`,
  "재로그인이 필요합니다. 아래를 실행하면 브라우저 창이 열립니다.",
  `  npm run imweb:login -- ${site_id}`,
  "창에서 직접 로그인하시면 됩니다. 저는 비밀번호를 받지도 저장하지도 않습니다.",
].join("\n");

if (import.meta.filename === process.argv[1]) {
  const site = process.argv[2];
  if (!site) { console.error("사용법: npm run imweb:login -- <site_id>"); process.exit(1); }
  const cur = await preflight(site);
  if (cur.ok) { console.log(`세션 유효 (저장 ${cur.savedAt})`); process.exit(0); }
  console.log(`세션 없음/만료: ${cur.reason}`);
  console.log("브라우저 창을 엽니다. 직접 로그인해 주세요 (최대 10분 대기).");
  const r = await loginInteractive(site);
  if (r.ok) { console.log(`세션 저장 완료 → ${statePath(site)}`); process.exit(0); }
  console.error(`실패: ${r.reason}`);
  process.exit(1);
}
