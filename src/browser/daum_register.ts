/* 다음 검색등록.

   **네이버·구글과 성격이 다르다.** 웹마스터 콘솔이 아니라 **심사 신청 폼**이다:
   - 소유확인 메타 태그가 없다. 그래서 Header Code 에 넣을 것도 없다.
   - 사이트 URL·분류·소개를 적어 내면 사람이 검토한다. 노출을 보장하지 않는다고 명시돼 있다.

   그래서 여기서는 "등록 완료" 라고 말하지 않는다. **신청 접수**까지가 우리가 할 수 있는 전부다. */
import { statePath, sessionStatus } from "./console_session.ts";

const FORM = "https://register.search.daum.net/searchForm.daum?act=insert";
const CHECK = "https://register.search.daum.net/searchForm.daum?act=search";

export type Apply = { url: string; dryRun?: boolean };

/** 신청 폼 1단계: 유형(사이트검색) + URL. 이후 단계는 로그인 뒤에야 보인다. */
export async function apply(a: Apply): Promise<{ ok: boolean; report: string }> {
  if (!sessionStatus("daum").ok) {
    return { ok: false, report: "다음 세션이 없다. npm run console:login daum 부터." };
  }
  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless: !!a.dryRun });
  const log: string[] = [];
  try {
    const ctx = await b.newContext({ storageState: statePath("daum"), viewport: { width: 1400, height: 1000 } });
    const page = await ctx.newPage();

    // 이미 신청/등록된 사이트인지 먼저 본다. 같은 걸 두 번 넣지 않는다.
    await page.goto(CHECK, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(5000);
    const already = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "))).includes(a.url.replace(/^https?:\/\//, ""));
    if (already) { await b.close(); return { ok: true, report: "이미 신청/등록되어 있다." }; }

    await page.goto(FORM, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(5000);
    await page.locator("#chkIn_1").first().check({ force: true });          // 사이트검색
    await page.waitForTimeout(600);
    // #urlread 는 "http://" 가 박힌 **readonly** 표시용이다. 실제 입력은 #url2 다.
    // id 가 중복이라 .first() 로 골라도 editable 이 아니어서 계속 타임아웃 났다.
    await page.locator("#url2").first().fill(a.url.replace(/^https?:\/\//, ""));
    await page.waitForTimeout(600);
    log.push(`유형: 사이트검색 · URL: ${a.url}`);

    // 다음 단계로. 버튼 이름이 화면마다 달라 텍스트로 잡는다.
    const next = page.getByRole("button", { name: /확인|다음|등록/ })
      .or(page.locator('a:has-text("확인"), a:has-text("다음")')).first();
    if (await next.count()) { await next.click({ timeout: 15_000 }); await page.waitForTimeout(6000); }

    const fields = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input,textarea,select"))
        .filter((e: any) => e.getBoundingClientRect().width > 0 && e.type !== "hidden")
        .map((e: any) => `${e.tagName.toLowerCase()} name=${e.name || "-"} id=${e.id || "-"} type=${e.type || "-"}`));
    log.push("", "다음 단계 입력 항목:", ...fields.map((f: string) => "  " + f));
    log.push("", a.dryRun ? "dryRun — 제출하지 않았다." : "여기서 멈춘다. 제출 전 항목 확인이 필요하다.");

    await b.close();
    return { ok: true, report: log.join("\n") };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: [...log, `실패: ${(e as Error).message.split("\n")[0]}`].join("\n") };
  }
}

if (import.meta.main) {
  const url = process.argv[2] ?? "https://세화건설산업.kr";
  const r = await apply({ url, dryRun: !process.argv.includes("--go") });
  console.log(r.report);
  process.exit(r.ok ? 0 : 1);
}
