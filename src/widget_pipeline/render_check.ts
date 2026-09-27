/* 헤드리스 렌더 관문. 위젯이 "자기 슬롯 안에만" 그려지고, 슬롯이 없으면 화면에 아무것도 나타나지 않는지 실제로 본다.
   네트워크는 전부 막는다 — 위젯이 외부로 나가려 하면 요청 기록에 잡힌다. */

export type RenderReport = {
  ok: boolean; errors: string[];
  withSlot: { rendered: boolean; outsideAdded: number; floating: number; pageErrors: string[]; requests: string[] };
  withoutSlot: { visibleAdded: number; pageErrors: string[]; requests: string[] };
};

type Scene = { slot: boolean };

async function scene(pw: any, id: string, js: string, css: string, { slot }: Scene) {
  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (e: Error) => pageErrors.push(e.message.slice(0, 160)));
    await page.route("**/*", (route: any) => {
      const url = route.request().url();
      if (url === "https://preview.invalid/") {
        return route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html><head><meta charset="utf-8"></head><body>
<header id="host-header">host header</header><main id="host-main"><p>host content</p>${slot ? `<div data-ddak-slot="${id}"></div>` : ""}</main>
<footer id="host-footer">host footer</footer></body></html>`,
        });
      }
      requests.push(url);
      return route.abort();
    });
    await page.goto("https://preview.invalid/", { waitUntil: "load" });
    const before = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => !e.closest("[data-ddak-slot]")).length);
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const all = [...document.querySelectorAll("body *")];
      const outside = all.filter((e) => !e.closest("[data-ddak-slot]"));
      const inSlot = [...document.querySelectorAll("[data-ddak-slot] *")];
      const floating = all.filter((e) => ["fixed", "sticky"].includes(getComputedStyle(e).position)).length;
      const visible = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      return { outside: outside.length, rendered: inSlot.some(visible), floating, visibleAdded: all.filter((e) => !["host-header", "host-main", "host-footer"].includes(e.id) && !e.closest("#host-header,#host-footer") && e.tagName !== "P" && visible(e)).length };
    });
    return { before, after, pageErrors, requests };
  } finally { await browser.close(); }
}

export async function renderCheck(id: string, js: string, css: string): Promise<RenderReport> {
  const pw = await import("playwright");
  const a = await scene(pw, id, js, css, { slot: true });
  const b = await scene(pw, id, js, css, { slot: false });
  const report: RenderReport = {
    ok: true, errors: [],
    withSlot: { rendered: a.after.rendered, outsideAdded: a.after.outside - a.before, floating: a.after.floating, pageErrors: a.pageErrors, requests: a.requests },
    withoutSlot: { visibleAdded: b.after.outside - b.before, pageErrors: b.pageErrors, requests: b.requests },
  };
  const e = report.errors;
  if (!report.withSlot.rendered) e.push("슬롯이 있는데 아무것도 보이지 않음 (렌더 실패)");
  if (report.withSlot.outsideAdded > 0) e.push(`슬롯 밖에 요소 ${report.withSlot.outsideAdded}개 추가 (화면 노출 위반)`);
  if (report.withSlot.floating > 0) e.push(`떠 있는 요소 ${report.withSlot.floating}개 (화면 노출 위반)`);
  if (report.withoutSlot.visibleAdded > 0) e.push(`슬롯이 없는데 요소 ${report.withoutSlot.visibleAdded}개가 생김 (화면 노출 위반)`);
  for (const [name, s] of [["슬롯 있음", a], ["슬롯 없음", b]] as const) {
    if (s.pageErrors.length) e.push(`${name}: 스크립트 오류 ${s.pageErrors.join(" / ")}`);
    if (s.requests.length) e.push(`${name}: 외부 요청 시도 ${s.requests.length}건 (${s.requests[0]})`);
  }
  report.ok = e.length === 0;
  return report;
}
