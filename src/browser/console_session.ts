/* 서치도구(GSC·네이버 서치어드바이저·Bing) 세션.

   아임웹 세션과 **같은 원칙**이다 (REQ-017):
   - 비밀번호를 받지 않는다. 사람이 열린 창에서 직접 로그인한다.
   - 우리는 로그인 **결과(storageState)** 만 보관한다.
   - 저장 파일은 state/browser/ 아래이고 gitignore 대상이다.

   님의 Chrome 프로필을 훔쳐 쓰는 방법도 검토했으나, 실행 중 쿠키 파일이 잠기고
   무엇보다 **다른 사이트 로그인까지 전부 딸려온다.** 필요한 것만 갖는 편이 낫다. */
import { existsSync, mkdirSync, statSync } from "node:fs";
import { p } from "../release/paths.ts";

export type Console = "gsc" | "naver" | "bing" | "daum";

/** 로그인 판정.
 *  주소만 보면 안 된다 — 다음 검색등록처럼 **로그인 없이도 열리는** 콘솔이 있어서,
 *  주소가 맞다는 이유로 즉시 "로그인됨" 이 돼버린다.
 *  그래서 (1) 로그인 화면 호스트로 튕겼는지 (2) 로그인해야만 보이는 표시가 있는지 둘 다 본다. */
export const CONSOLES: Record<Console, {
  label: string; url: string; home: string; authHosts: string[];
  loggedInText?: string; loggedOutText?: string; authCookies: string[]; cookieRe?: RegExp;
}> = {
  gsc: {
    label: "Google Search Console",
    url: "https://search.google.com/search-console",
    home: "search.google.com/search-console",
    authHosts: ["accounts.google.com"],
    // /search-console/about 은 **비로그인 안내 페이지**다. 주소만 보면 통과해버린다.
    authCookies: ["SID", "SSID", "SAPISID"],
  },
  naver: {
    label: "네이버 서치어드바이저",
    url: "https://searchadvisor.naver.com/console/board",
    home: "searchadvisor.naver.com/console",
    authHosts: ["nid.naver.com"],
    authCookies: ["NID_AUT", "NID_SES"],
  },
  bing: {
    label: "Bing Webmaster Tools",
    url: "https://www.bing.com/webmasters/home",
    home: "bing.com/webmasters",
    authHosts: ["login.live.com", "login.microsoftonline.com"],
    authCookies: ["_U", "MSPAuth"],
  },
  daum: {
    label: "다음 검색등록",
    url: "https://register.search.daum.net/index.daum",
    home: "register.search.daum.net",
    authHosts: ["accounts.kakao.com", "logins.daum.net"],
    // 이 페이지는 비로그인도 열린다. 카카오 로그인 쿠키 이름이 여러 가지라 정규식으로 본다.
    // "로그아웃" 텍스트만 보던 판정은 실제로 로그인해도 못 잡았다.
    loggedOutText: "로그인",
    authCookies: [],
    cookieRe: /^(_ka|_kp|TIARA|DAUM)/i,
  },
};

export const statePath = (c: Console) => p("state", "browser", `console-${c}.storage.json`);

export function sessionStatus(c: Console): { ok: boolean; savedAt?: string } {
  const f = statePath(c);
  return existsSync(f) ? { ok: true, savedAt: statSync(f).mtime.toISOString() } : { ok: false };
}

/** 창을 열어두고 사람이 로그인할 때까지 기다린다. 값을 대신 입력하지 않는다. */
export async function loginInteractive(c: Console, timeoutMs = 600_000): Promise<{ ok: boolean; report: string }> {
  const cfg = CONSOLES[c];
  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless: false });   // 사람이 보고 직접 친다
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  mkdirSync(p("state", "browser"), { recursive: true });
  try {
    await page.goto(cfg.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const until = Date.now() + timeoutMs;
    // 판정이 왜 안 되는지 눈에 보이게 남긴다. 추측으로 조건을 고치다 두 번 헛돌았다.
    let tick = 0;
    const trace = (why: string, extra = "") =>
      { if (++tick % 5 === 0) console.log(`  [${new Date().toISOString().slice(11, 19)}] ${why} ${extra}`); };
    while (Date.now() < until) {
      await page.waitForTimeout(3000);
      const u = page.url();
      if (cfg.authHosts.some((h) => u.includes(h))) { trace("로그인 화면", u.slice(0, 60)); continue; }
      if (!u.includes(cfg.home)) { trace("콘솔 밖", u.slice(0, 60)); continue; }
      // **인증 쿠키가 가장 확실한 신호다.** 주소만 보면 안내 페이지에 속는다 —
      // GSC 의 /search-console/about 이 그랬다.
      const all = (await ctx.cookies()).map((x) => x.name);
      const names = new Set(all);
      const hasAuth = cfg.authCookies.some((n) => names.has(n)) ||
        (cfg.cookieRe ? all.some((n) => cfg.cookieRe!.test(n)) : false);
      if (!hasAuth) { trace("인증 쿠키 없음", "쿠키 " + all.length + "개: " + all.slice(0, 6).join(",")); continue; }
      if (cfg.loggedOutText) {
        const out = await page.getByRole("link", { name: cfg.loggedOutText, exact: true }).first()
          .isVisible({ timeout: 1500 }).catch(() => false);
        if (out) { trace("로그인 링크 보임 → 비로그인"); continue; }
      }
      if (cfg.loggedInText) {
        const seen = await page.getByText(cfg.loggedInText, { exact: false }).first()
          .isVisible({ timeout: 1500 }).catch(() => false);
        if (!seen) { trace("로그인 표시 없음"); continue; }
      }
      await page.waitForTimeout(2500);
      await ctx.storageState({ path: statePath(c) });
      await b.close();
      return { ok: true, report: `${cfg.label} 세션 저장 완료 → ${statePath(c)}` };
    }
    await b.close();
    return { ok: false, report: `${cfg.label} 로그인 대기 시간이 지났다. 다시 실행해라.` };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: `실패: ${(e as Error).message.split("\n")[0]}` };
  }
}

export function notice(c: Console): string {
  const cfg = CONSOLES[c];
  return [
    `[${cfg.label} 로그인 필요]`,
    "",
    "창이 열리면 직접 로그인해 주세요.",
    "저는 비밀번호를 받지도 저장하지도 않습니다. 로그인 결과만 보관합니다.",
    `주소: ${cfg.url}`,
  ].join("\n");
}

if (import.meta.main) {
  const c = (process.argv[2] ?? "gsc") as Console;
  if (!CONSOLES[c]) { console.error(`알 수 없는 콘솔: ${c} (gsc|naver|bing)`); process.exit(1); }
  console.log(notice(c));
  const r = await loginInteractive(c);
  console.log(r.report);
  process.exit(r.ok ? 0 : 1);
}
