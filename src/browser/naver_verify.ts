import { assertBrowserFormAllowed } from "../seo/gates.ts";
import { consumeApproval } from "../release/approval.ts";
/* 네이버 서치어드바이저 소유확인 마무리.

   여기까지는 자동으로 온다: 사이트 등록 → HTML 태그 방식 선택 → 메타 태그를 아임웹에 삽입.
   마지막 [소유확인] 을 누르면 **캡차**가 뜬다. 네이버가 화면에 이렇게 써 둔다 —
   "프로그램을 이용한 자동등록을 방지하기 위해 보안절차를 거치고 있습니다."
   그 절차를 우회하지 않는다. 사람이 그 한 칸만 채우면 된다.

   그래서 이 도구는 **거기까지 차려놓고 기다린다.** 사람이 캡차를 넣으면
   확인 결과를 읽고 사이트맵 제출까지 이어서 한다. */
import { statePath, sessionStatus } from "./console_session.ts";

const VERIFY = (site: string) =>
  `https://searchadvisor.naver.com/console/verify?site=${encodeURIComponent(site)}`;

/** 소유확인이 끝났는지. 목록에서 "소유확인 진행" 이 사라지면 끝난 것이다.
 *  **반드시 별도 탭에서 확인한다.** 사람이 캡차를 치는 페이지를 새로고침하면 입력이 날아간다 —
 *  실제로 그렇게 만들어서 무한히 반복시켰다. */
async function verified(page: any, site: string): Promise<boolean> {
  await page.goto("https://searchadvisor.naver.com/console/board", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(6000);
  // **그 사이트의 줄만** 본다. 페이지 전체에서 "소유확인 진행" 을 찾으면,
  // 다른 사이트 하나가 미확인이어도 영원히 완료로 안 잡힌다.
  // `new URL().host` 는 punycode(xn--…)를 준다. 화면에는 한글 도메인 그대로 찍힌다 —
  // 그래서 그걸로 찾으면 영원히 0건이다. 입력 문자열에서 보이는 그대로 뽑는다.
  const host = site.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return page.evaluate((h: string) => {
    const rows = Array.from(document.querySelectorAll("tr, li, div"))
      .filter((e) => (e.textContent ?? "").includes(h) && (e.textContent ?? "").length < 400);
    if (!rows.length) return false;
    // 그 호스트를 담은 요소 중 **가장 짧은 것** = 그 사이트의 줄. 조상 요소는 페이지 전체를 담는다.
    const row = rows.sort((a, b) => (a.textContent ?? "").length - (b.textContent ?? "").length)[0]!;
    return !(row.textContent ?? "").includes("소유확인 진행");
  }, host);
}

export async function assist(site: string, timeoutMs = 900_000, approvalId?: string): Promise<{ ok: boolean; report: string }> {
  assertBrowserFormAllowed("naver");
  consumeApproval(approvalId, "naver_verify", { site });
  if (!sessionStatus("naver").ok) return { ok: false, report: "네이버 세션이 없다. npm run console:login naver 부터." };

  const pw = await import("playwright");
  // 이미 끝났으면 창을 열지 않는다. 화면 없는 브라우저로 먼저 확인한다.
  {
    const cb = await pw.chromium.launch({ headless: true });
    const cp = await (await cb.newContext({ storageState: statePath("naver") })).newPage();
    const done = await verified(cp, site).catch(() => false);
    await cb.close();
    if (done) return { ok: true, report: "이미 소유확인이 끝나 있다." };
  }
  const b = await pw.chromium.launch({ headless: false });   // 사람이 캡차를 봐야 한다
  const ctx = await b.newContext({ storageState: statePath("naver"), viewport: { width: 1500, height: 1100 } });
  const page = await ctx.newPage();
  const log: string[] = [];
  try {
    if (await verified(page, site)) {
      await b.close();
      return { ok: true, report: "이미 소유확인이 끝나 있다." };
    }
    await page.goto(VERIFY(site), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(7000);
    // HTML 태그 방식. 텍스트를 눌러서는 라디오가 안 바뀐다 — 라디오를 직접 잡는다.
    await page.locator("input[type=radio]").nth(1).check({ force: true });
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: /소유확인/ }).first().click({ timeout: 20_000 });
    log.push("HTML 태그 방식 선택 + [소유확인] 클릭 완료 → 캡차 대기");
    log.push("창에 보이는 글자를 입력하고 [확인] 을 눌러주세요.");

    // 확인은 **완전히 별개의 브라우저**에서, 화면 없이 한다.
    // 같은 창에 탭을 하나 더 열었더니 그 탭이 페이지를 열 때마다 앞으로 튀어나와
    // 사람이 캡차를 치는 화면을 계속 가렸다. 창을 나누면 서로 건드릴 일이 없다.
    const wb = await pw.chromium.launch({ headless: true });
    const wctx = await wb.newContext({ storageState: statePath("naver") });
    const watcher = await wctx.newPage();
    try {
      const until = Date.now() + timeoutMs;
      while (Date.now() < until) {
        await watcher.waitForTimeout(10_000);
        if (await verified(watcher, site).catch(() => false)) {
          log.push("", "소유확인 완료.");
          await wb.close(); await b.close();
          return { ok: true, report: log.join("\n") };
        }
      }
      await wb.close(); await b.close();
      return { ok: false, report: [...log, "", "대기 시간이 지났다. 다시 실행해라."].join("\n") };
    } finally {
      await wb.close().catch(() => {});
    }
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: [...log, `실패: ${(e as Error).message.split("\n")[0]}`].join("\n") };
  }
}

if (import.meta.main) {
  const site = process.argv[2] ?? "https://세화건설산업.kr";
  const r = await assist(site);
  console.log(r.report);
  process.exit(r.ok ? 0 : 1);
}
