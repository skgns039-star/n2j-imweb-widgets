/* ENG-033 셀렉터 실측 (§19.4). **읽기 전용이다** — 값을 입력하거나 저장하지 않는다.
   추정 셀렉터를 실제 관리자 화면에 대고 맞춰본 뒤, 맞은 것만 config 에 채운다.
   맞지 않으면 추측해서 채우지 않고 "못 찾음"으로 남긴다 — 그게 guard 가 막아야 할 상태다. */
import { writeFileSync } from "node:fs";
import { p } from "../release/paths.ts";
import { sessionStatus, statePath, adminUrl, selectors, reloginNotice } from "./session.ts";

export type Probe = { name: string; url: string; tried: string[]; hit: string | null; sample: string };

/** 후보를 순서대로 대보고 **처음 보이는 것**을 채택한다. 없으면 null. */
async function first(page: any, cands: string[]): Promise<{ hit: string | null; sample: string }> {
  for (const sel of cands) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1200 })) {
        const tag = await el.evaluate((e: any) =>
          `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${e.name ? "[name=" + e.name + "]" : ""}`);
        return { hit: sel, sample: tag };
      }
    } catch { /* 없으면 다음 후보 */ }
  }
  return { hit: null, sample: "" };
}

/** 관리자 화면을 열어 SEO 설정 칸들을 실측한다. 아무것도 쓰지 않는다. */
export async function probe(site_id: string): Promise<{ ok: boolean; report: string; probes: Probe[] }> {
  const s = sessionStatus(site_id);
  if (!s.ok) return { ok: false, report: reloginNotice(site_id, "저장된 세션 없음"), probes: [] };

  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless: false });   // 사람이 보고 있어야 한다 (무인 실행은 OPEN-BRW-03)
  const ctx = await b.newContext({ storageState: statePath(site_id) });
  const page = await ctx.newPage();
  const probes: Probe[] = [];
  const sel = selectors();

  try {
    // 에디터가 연결을 계속 열어둬서 networkidle 은 반드시 타임아웃 난다. domcontentloaded 로 간다.
    await page.goto(adminUrl(site_id), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(4000);

    const loggedOut = await first(page, [sel.logout_markers.primary, sel.logout_markers.fallback]);
    if (loggedOut.hit) {
      await b.close();
      return { ok: false, report: reloginNotice(site_id, "세션 만료 — 로그인 화면이 보인다"), probes: [] };
    }

    // SEO 설정 화면 후보. 아임웹 관리자 구조가 사이트마다 달라 여러 경로를 대본다.
    const host = new URL(adminUrl(site_id)).host;
    const targets: { name: string; path: string; cands: string[] }[] = [
      { name: "사이트 제목", path: "/admin/config/seo",
        cands: ['input[name*="title"]', 'input[name*="site_name"]', '#site_title', 'input[placeholder*="제목"]'] },
      { name: "사이트 설명", path: "/admin/config/seo",
        cands: ['textarea[name*="desc"]', 'input[name*="desc"]', '#site_desc', 'textarea[placeholder*="설명"]'] },
      { name: "사이트 키워드", path: "/admin/config/seo",
        cands: ['input[name*="keyword"]', '#site_keyword', 'input[placeholder*="키워드"]'] },
      { name: "검색엔진 노출", path: "/admin/config/seo",
        cands: ['input[name*="robot"]', 'input[name*="expose"]', 'input[type="checkbox"][name*="seo"]'] },
      { name: "저장 버튼", path: "/admin/config/seo",
        cands: [sel.common_code.save_button.primary, 'button:has-text("저장")', 'a:has-text("저장")'] },
    ];

    let lastPath = "";
    for (const t of targets) {
      if (t.path !== lastPath) {
        await page.goto(`https://${host}${t.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(3500);
        lastPath = t.path;
      }
      const r = await first(page, t.cands);
      probes.push({ name: t.name, url: `https://${host}${t.path}`, tried: t.cands, hit: r.hit, sample: r.sample });
    }

    // 화면에 실제로 뭐가 있는지도 남긴다 — 추정이 다 빗나갔을 때 사람이 볼 근거다.
    const inventory = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input,textarea,select"))
        .filter((e: any) => e.offsetParent !== null && e.type !== "hidden")
        .slice(0, 40)
        .map((e: any) => `${e.tagName.toLowerCase()} name=${e.name || "-"} id=${e.id || "-"} ph=${(e.placeholder || "-").slice(0, 20)}`));

    writeFileSync(p("state", "browser", `${site_id}.probe.json`),
      JSON.stringify({ probes, inventory }, null, 2));

    const found = probes.filter((x) => x.hit).length;
    const report = [
      `[셀렉터 실측] ${site_id} — ${found}/${probes.length} 확인`,
      ...probes.map((x) => `  ${x.hit ? "OK  " : "못찾음"} ${x.name.padEnd(12)} ${x.hit ?? x.tried[0]}${x.sample ? "  → " + x.sample : ""}`),
      "",
      "화면에 실제로 있는 입력 요소:",
      ...inventory.map((x: string) => "  " + x),
    ].join("\n");
    await b.close();
    return { ok: found === probes.length, report, probes };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: `실측 실패: ${(e as Error).message}`, probes };
  }
}

if (import.meta.main) {
  const site = process.argv[2] ?? "sehwa";
  const r = await probe(site);
  console.log(r.report);
  process.exit(r.ok ? 0 : 1);
}
