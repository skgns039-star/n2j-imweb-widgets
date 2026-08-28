/* 디자인모드 메뉴별 SEO 필드 (SKILL §3).
   **건드리는 것은 페이지 제목·페이지 설명 둘뿐이다.**
   메뉴명·서브메뉴명·메뉴 주소는 불가침이라 읽기만 한다 (INV-11).
   경계 원칙: 화면에 보이는 글자면 불가침, 검색엔진만 보는 값이면 승인 후 가능.

   2026-08-28 실측에서 걸린 것들 — 전부 여기 적어둔다. 다시 겪지 않으려고:
   - 메뉴 목록 패널은 `transform: translateX(-252px)` 로 화면 밖에 접혀 있다.
     Playwright 가 "element is outside of the viewport" 로 클릭을 거절한다.
     패널을 펴는 토글을 못 찾아서, **우리 브라우저의 렌더링만** CSS 로 되돌린다.
     고객 사이트는 건드리지 않는다.
   - 같은 id(`#menu_info_title` 등)가 화면에 여러 개 있다. document.querySelector 는
     숨은 쪽을 집는다. 그래서 **모달 안에서** 찾는다.
   - 에디터가 무거워 로드 직후 클릭하면 핸들러가 아직 없어 조용히 무시된다.
   - 모달은 Escape 로 안 닫힌다. × 버튼을 눌러야 한다. */
import { writeFileSync, mkdirSync } from "node:fs";
import { p, manifest, gateBlock } from "../release/paths.ts";
import { sessionStatus, statePath, reloginNotice } from "./session.ts";

export const MODAL = "#cocoaModal.modal_menu_info";
export const F = {
  name: `${MODAL} #menu_info_name`,               // 메뉴명 — 읽기만
  url: `${MODAL} #menu_info_url`,                 // 메뉴 주소 — 읽기만
  title: `${MODAL} #menu_info_title`,             // 페이지 제목 — SEO 필드
  description: `${MODAL} #menu_info_description`, // 페이지 설명 — SEO 필드
  // 닫기는 × 아이콘이다. `.close` 가 아니다 — 안 닫히면 다음 메뉴가 모달에 가려 전부 실패한다.
  close: `${MODAL} .bt-times`,
} as const;

/** 에디터 부팅 대기. 짧게 주면 클릭이 먹지 않는다. */
const BOOT_MS = 20_000;

export type MenuSeo = { code: string; name: string; url: string; title: string; description: string; inherits: boolean };
export type Plan = { code: string; title: string; description: string };

async function open(site_id: string, headless: boolean) {
  const site = manifest().sites.find((s) => s.site_id === site_id);
  if (!site?.url) throw new Error(`${site_id} 미등록`);
  if (!sessionStatus(site_id).ok) throw new Error(reloginNotice(site_id, "저장된 세션 없음"));
  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless });
  const ctx = await b.newContext({ storageState: statePath(site_id), viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`https://${new URL(site.url).host}/admin/design`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(".dd-item[data-code]", { timeout: 60_000 });
  await page.waitForTimeout(BOOT_MS);
  await page.addStyleTag({ content: "#menu_list_slide{transform:none !important;}" });
  await page.waitForTimeout(1500);
  return { b, page };
}

async function openMenuDialog(page: any, code: string) {
  const info = page.locator(`._info[data-code="${code}"]`).first();
  if (!(await info.count())) throw new Error("설정(i) 버튼이 없는 메뉴");
  await page.locator(`.dd-item[data-code="${code}"]`).first().hover({ timeout: 20_000 });
  await page.waitForTimeout(500);
  await info.click({ timeout: 20_000, force: true });
  await page.locator(F.title).first().waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function closeDialog(page: any) {
  await page.locator(F.close).first().click({ timeout: 10_000, force: true });
  await page.locator(MODAL).first().waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

/** 메뉴별 현재 SEO 값을 읽는다. 아무것도 쓰지 않는다. */
export async function readAll(site_id: string): Promise<{ ok: boolean; report: string; rows: MenuSeo[] }> {
  const { b, page } = await open(site_id, true);
  const rows: MenuSeo[] = [];
  try {
    const codes: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".dd-item[data-code]")).map((e: any) => e.getAttribute("data-code")));
    for (const code of [...new Set(codes)]) {
      try {
        await openMenuDialog(page, code);
        const el = (s: string) => page.locator(s).first();
        // 첫 페이지(홈)는 아임웹이 개별 설정을 막고 기본설정을 따르게 한다.
        // 그때 값은 placeholder 로만 보인다 — 실제 입력값은 빈 문자열이다.
        const title = await el(F.title).inputValue().catch(() => "");
        rows.push({
          code,
          name: await el(F.name).inputValue().catch(() => ""),
          url: await el(F.url).inputValue().catch(() => ""),
          title,
          description: await el(F.description).inputValue().catch(() => ""),
          inherits: !title && !!(await el(F.title).getAttribute("placeholder").catch(() => "")),
        });
        await closeDialog(page);
      } catch (e) {
        rows.push({ code, name: `(열지 못함) ${(e as Error).message.split("\n")[0].slice(0, 50)}`,
                    url: "", title: "", description: "", inherits: false });
        await closeDialog(page).catch(() => {});
      }
    }
    writeFileSync(p("state", "browser", `${site_id}.menu-seo.json`), JSON.stringify(rows, null, 2));
    await b.close();
    return {
      ok: rows.some((r) => !r.name.startsWith("(열지 못함)")),
      rows,
      report: [`[메뉴별 SEO 현황] ${rows.length}개`,
        ...rows.map((r) => `  ${r.name.padEnd(16)} url=${(r.url || "-").padEnd(12)}` +
          ` 제목=${r.title ? `"${r.title}"` : r.inherits ? "(기본설정 상속)" : "(빈 값)"}` +
          ` 설명=${[...r.description].length}자`),
      ].join("\n"),
    };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: `읽기 실패: ${(e as Error).message.split("\n")[0]}`, rows: [] };
  }
}

/** 메뉴별 페이지 제목·설명을 반영한다. 메뉴명·URL 은 손대지 않는다. */
export async function applyAll(site_id: string, plans: Plan[]): Promise<{ ok: boolean; report: string }> {
  const blocked = gateBlock("seo_apply");
  if (blocked) return { ok: false, report: `BLOCKED: ${blocked}` };

  const before = await readAll(site_id);
  if (!before.ok) return { ok: false, report: before.report };
  mkdirSync(p("seo", site_id, "snapshots"), { recursive: true });
  writeFileSync(p("seo", site_id, "snapshots", `menu-seo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
    JSON.stringify(before.rows, null, 2));

  const { b, page } = await open(site_id, false);   // 사람이 보는 앞에서만 쓴다
  const log: string[] = ["스냅샷 저장 완료", ""];
  let done = 0;
  try {
    for (const plan of plans) {
      const was = before.rows.find((r) => r.code === plan.code);
      const who = was?.name || plan.code;
      try {
        await openMenuDialog(page, plan.code);
        const t = page.locator(F.title).first();
        if (await t.isDisabled()) { log.push(`  ${who}: 건너뜀 — 아임웹이 개별 설정을 막은 메뉴`); await closeDialog(page); continue; }
        // 메뉴명·URL 은 열어만 두고 만지지 않는다. 이 두 줄이 INV-11 경계다.
        // 모달에 저장 버튼이 없다. 입력하면 초안에 바로 들어가고, 공개는 `게시하기` 로 한다.
        // 없는 저장 버튼을 누르려다 매 항목이 타임아웃 났었다.
        await t.fill(plan.title);
        await t.blur();
        await page.waitForTimeout(500);
        const d = page.locator(F.description).first();
        await d.fill(plan.description);
        await d.blur();
        await page.waitForTimeout(500);
        await closeDialog(page);
        done++;
        log.push(`  ${who}: "${plan.title}"`);
      } catch (e) {
        log.push(`  ${who}: 실패 — ${(e as Error).message.split("\n")[0].slice(0, 60)}`);
        await closeDialog(page).catch(() => {});
      }
    }
    // 메뉴 설정 모달에는 저장 버튼이 없다. 값은 `게시하기` 로만 공개된다.
    // **게시하기는 디자인 전체를 게시한다** — SEO 필드만 나가는 게 아니다.
    // 헤더는 <design-mode-magnet> 커스텀 엘리먼트(shadow DOM)라 일반 DOM 조회로는 안 잡힌다.
    if (done > 0) {
      await page.locator("design-mode-magnet").getByText("게시하기", { exact: true }).click({ timeout: 30_000 });
      await page.waitForTimeout(3000);
      // "디자인을 게시하시겠습니까?" 확인 창이 뜬다. 이걸 안 누르면 **아무것도 게시되지 않는다.**
      // 첫 시도에서 헤더 버튼만 누르고 끝내서, 관리자에는 저장됐는데 공개 페이지는 그대로였다.
      // 창 안내: "게시한 뒤에는 실행 취소가 불가"
      const confirm = page.getByRole("button", { name: "게시하기", exact: true })
        .or(page.locator('button:has-text("게시하기")')).last();
      await confirm.click({ timeout: 20_000 });
      await page.waitForTimeout(10_000);
      log.push("", "게시하기 → 확인창 승인 — 디자인 전체 게시 (되돌리기 불가)");
    }

    await b.close();
    return { ok: done > 0, report: [...log, "", `${done}/${plans.length}개 반영`].join("\n") };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: [...log, `실패: ${(e as Error).message.split("\n")[0]}`].join("\n") };
  }
}

if (import.meta.main) {
  const r = await readAll(process.argv[2] ?? "sehwa");
  console.log(r.report);
  process.exit(r.ok ? 0 : 1);
}
