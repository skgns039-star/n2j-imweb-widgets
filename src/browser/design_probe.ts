/* 디자인모드 실측. **읽기 전용이다** — 값을 입력하거나 저장하지 않는다.
   목표는 메뉴별 SEO 필드(페이지 제목/설명)의 위치를 확인하는 것.
   SKILL §3: 메뉴명·메뉴 URL 은 불가침, 페이지 제목·설명은 SEO 필드라 승인 후 수정 가능. */
import { writeFileSync } from "node:fs";
import { p, manifest } from "../release/paths.ts";
import { sessionStatus, statePath, reloginNotice } from "./session.ts";

export type MenuRow = { code: string; label: string; depth: string; url: string };

const DESIGN_URL = (host: string) => `https://${host}/admin/design`;

/** 디자인모드 좌측 메뉴 목록. data-code 가 메뉴 식별자다. */
export async function listMenus(site_id: string): Promise<{ ok: boolean; report: string; menus: MenuRow[] }> {
  const site = manifest().sites.find((s) => s.site_id === site_id);
  if (!site?.url) return { ok: false, report: `${site_id} 미등록`, menus: [] };
  if (!sessionStatus(site_id).ok) return { ok: false, report: reloginNotice(site_id, "저장된 세션 없음"), menus: [] };

  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless: true });
  // 메뉴 패널은 화면 왼쪽 밖으로 밀려 있다가 열린다. 창이 좁으면 "viewport 밖"이라 클릭이 안 된다.
  const ctx = await b.newContext({ storageState: statePath(site_id), viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  try {
    await page.goto(DESIGN_URL(new URL(site.url).host), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector(".dd-item[data-code]", { timeout: 60_000 });
    await page.waitForTimeout(4000);

    const menus: MenuRow[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".dd-item[data-code]")).map((e: any) => ({
        code: e.getAttribute("data-code") ?? "",
        // innerText 에는 Expand/Collapse 같은 접근성 라벨이 섞인다 — 걷어낸다.
        label: (e.innerText || "").replace(/\s+/g, " ").replace(/\b(Expand|Collapse)\b/g, "").trim().slice(0, 30),
        depth: e.getAttribute("data-depth") ?? "",
        url: e.getAttribute("data-url") ?? "",
      })).filter((m: MenuRow) => m.code));

    const panel = await page.evaluate(() => {
      const e = document.querySelector("#menu_list_slide");
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), onScreen: r.left >= 0 && r.right <= innerWidth };
    });

    writeFileSync(p("state", "browser", `${site_id}.menus.json`), JSON.stringify({ menus, panel }, null, 2));
    await b.close();
    return {
      ok: menus.length > 0,
      menus,
      report: [
        `[디자인모드 메뉴] ${menus.length}개`,
        `패널 위치: ${panel ? `left=${panel.left} 화면안=${panel.onScreen}` : "찾지 못함"}`,
        ...menus.map((m) => `  d${m.depth} ${m.code}  ${m.label}${m.url ? "  (" + m.url + ")" : ""}`),
      ].join("\n"),
    };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: `실측 실패: ${(e as Error).message.split("\n")[0]}`, menus: [] };
  }
}

if (import.meta.main) {
  const r = await listMenus(process.argv[2] ?? "sehwa");
  console.log(r.report);
  process.exit(r.ok ? 0 : 1);
}
