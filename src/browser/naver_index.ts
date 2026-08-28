/* 네이버 서치어드바이저 — 사이트맵 제출 · 웹페이지 수집(색인) 요청.

   소유확인이 끝난 뒤에는 캡차가 없다. 그래서 여기부터는 전부 자동이다.

   실측에서 걸린 것들:
   - 입력칸 id 는 렌더마다 바뀐다(Vuetify `input-208` 등). id 로 잡으면 다음 실행에서 깨진다.
   - 사이트맵 칸은 **전체 URL** 을 요구한다. `sitemap.xml` 만 넣으면 빨간 줄로 거부한다.
   - `new URL().host` 는 punycode 를 준다. 화면에는 한글 도메인이 찍힌다 — 대조에 쓰면 안 된다. */
import { statePath, sessionStatus } from "./console_session.ts";

const base = "https://searchadvisor.naver.com/console/site";
const q = (site: string) => `?site=${encodeURIComponent(site)}`;

/** 화면에 보이는 유일한 text input. id 를 쓰지 않는 이유는 위 주석 참고. */
const field = (page: any) => page.locator('input[type="text"]').filter({ visible: true }).first();

async function submitOne(page: any, url: string, value: string, listMarker: string): Promise<string> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(7000);
  await field(page).fill(value);
  await page.waitForTimeout(800);
  const btn = page.getByRole("button", { name: "확인" }).first();
  if (await btn.isDisabled()) return "입력 거부 (형식 확인 필요)";
  await btn.click();
  await page.waitForTimeout(7000);
  const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const i = t.indexOf(listMarker);
  return i < 0 ? "결과 확인 불가" : t.slice(i, i + 90).replace(listMarker, "").trim();
}

export type IndexResult = { ok: boolean; report: string };

export async function run(site: string, paths: string[]): Promise<IndexResult> {
  if (!sessionStatus("naver").ok) return { ok: false, report: "네이버 세션 없음. npm run console:login naver 부터." };
  const root = site.replace(/\/+$/, "");
  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless: true });
  const log: string[] = [];
  try {
    const ctx = await b.newContext({ storageState: statePath("naver"), viewport: { width: 1500, height: 950 } });
    const page = await ctx.newPage();

    // 1. 사이트맵 — 이미 있으면 목록에 그대로 남는다(중복 등록되지 않는다).
    log.push("사이트맵: " + await submitOne(page, `${base}/request/sitemap${q(site)}`, `${root}/sitemap.xml`, "제출된 사이트맵"));

    // 2. 웹페이지 수집 요청. 네이버는 하루 요청 수에 제한이 있어 **핵심 페이지만** 넣는다.
    let done = 0;
    for (const p of paths) {
      const r = await submitOne(page, `${base}/request/crawl${q(site)}`, `${root}${p}`, "수집 요청 내역");
      if (!/거부|불가/.test(r)) done++;
      await page.waitForTimeout(1500);
    }
    log.push(`수집 요청: ${done}/${paths.length}개`);

    await b.close();
    return { ok: done > 0, report: log.join("\n") };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: [...log, `실패: ${(e as Error).message.split("\n")[0]}`].join("\n") };
  }
}

if (import.meta.main) {
  const site = process.argv[2] ?? "https://세화건설산업.kr";
  const paths = process.argv.slice(3);
  const r = await run(site, paths.length ? paths : ["/", "/introduction", "/field", "/dwelling", "/industry", "/commerce", "/remodeling", "/18"]);
  console.log(r.report);
  process.exit(r.ok ? 0 : 1);
}
