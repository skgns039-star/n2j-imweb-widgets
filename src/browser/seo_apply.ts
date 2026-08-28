/* SKILL 9~11단계 아임웹 SEO 반영. **관리자 SEO 설정만 건드린다.**
   디자인모드 본문·이미지·레이아웃·메뉴명은 여기서 열지도 않는다 (INV-11).

   순서가 곧 안전장치다: 스냅샷 → 쓰기 → 저장 → 재확인.
   스냅샷 없이 쓰면 되돌릴 수가 없다. "원래 비어 있었다" 도 기록해야 할 사실이다. */
import { writeFileSync, mkdirSync } from "node:fs";
import { p, manifest, gateBlock } from "../release/paths.ts";
import { sessionStatus, statePath, selectors, reloginNotice } from "./session.ts";

export type Snapshot = { at: string; site_id: string; before: Record<string, string> };

const SEO_URL = (host: string) => `https://${host}/admin/config/seo`;

/** 입력 칸은 메인 문서가 아니라 iframe 안에 있다 — 2026-08-28 실측.
 *  frameLocator 를 쓴다: **동작할 때마다 프레임을 다시 찾아준다.**
 *  page.frames() 로 직접 잡으면 React 가 iframe 을 갈아끼운 뒤 죽은 프레임을 물고 있게 되고,
 *  그 위의 locator 는 영원히 기다린다. 키워드 칸이 "사라진" 것처럼 보인 게 이것이었다 —
 *  화면에는 멀쩡히 있었다. */
const IFRAME = 'iframe[src*="/_/config-seo"]';

/** 2단 셀렉터를 실제로 쓴다. primary 가 안 맞으면 fallback 을 대본다 (§19.4).
 *  설정 파일에 fallback 을 적어두고 코드가 primary 만 쓰면 적어둔 의미가 없다. */
async function pick(box: any, anchor: { primary: string; fallback?: string | null }, timeout = 20_000) {
  const cands = [anchor.primary, anchor.fallback].filter(Boolean) as string[];
  for (const sel of cands) {
    const el = box.locator(sel).first();
    try { await el.waitFor({ state: "visible", timeout }); return el; } catch { /* 다음 후보 */ }
  }
  throw new Error(`BLOCKED: SEO 설정 화면에서 ${cands.join(" 도 ")} 도 찾지 못했다 — UI 변경 가능. 추측해서 진행하지 않는다.`);
}

export type ApplyInput = { site_id: string; title: string; description: string; keywords: string[]; dryRun?: boolean };

export async function applySeo(a: ApplyInput): Promise<{ ok: boolean; report: string; snapshot?: Snapshot }> {
  const blocked = gateBlock("seo_apply");
  if (blocked) return { ok: false, report: `BLOCKED: ${blocked}` };

  const site = manifest().sites.find((s) => s.site_id === a.site_id);
  if (!site?.url) return { ok: false, report: `${a.site_id} 미등록` };
  if (!sessionStatus(a.site_id).ok) return { ok: false, report: reloginNotice(a.site_id, "저장된 세션 없음") };

  const sel = selectors() as any;
  if (!sel.verified) return { ok: false, report: "BLOCKED: 셀렉터 미실측 (verified:false)" };
  const S = sel.seo_settings;
  const host = new URL(site.url).host;

  const pw = await import("playwright");
  // headless:false — 사람이 보고 있는 상태에서만 쓴다. 무인 자동 실행은 OPEN-BRW-03 로 막혀 있다.
  const b = await pw.chromium.launch({ headless: false });
  const ctx = await b.newContext({ storageState: statePath(a.site_id) });
  const page = await ctx.newPage();
  const log: string[] = [];

  try {
    await page.goto(SEO_URL(host), { waitUntil: "domcontentloaded", timeout: 60_000 });
    const box = page.frameLocator(IFRAME);
    const titleEl = await pick(box, S.site_title, 45_000);
    const descEl = await pick(box, S.site_description);
    const kwEl = await pick(box, S.site_keyword);

    // ── 1. 스냅샷. 쓰기 전에 무조건 남긴다.
    const before = {
      "사이트 제목": await titleEl.inputValue(),
      "사이트 설명": await descEl.inputValue(),
      // 키워드는 칩이다. **input 의 직속 부모** 안만 읽는다. 화면 전체에서 [class*=chip|tag] 를
      // 긁으면 "자동 업데이트중" 같은 상태 라벨이 딸려온다.
      "메타 키워드": await kwEl.evaluate((kw: any) => {
        if (!kw.parentElement) return "READ_FAILED";       // 못 읽었으면 빈 값이라 우기지 않는다
        return Array.from(kw.parentElement.children)
          .filter((e: any) => e !== kw && e.innerText?.trim() && !/^\d+\/\d+$/.test(e.innerText.trim()))
          .map((e: any) => e.innerText.trim()).join(", ");
      }),
    };
    const snapshot: Snapshot = { at: new Date().toISOString(), site_id: a.site_id, before };
    mkdirSync(p("seo", a.site_id, "snapshots"), { recursive: true });
    writeFileSync(p("seo", a.site_id, "snapshots", `seo-settings-${snapshot.at.replace(/[:.]/g, "-")}.json`),
      JSON.stringify(snapshot, null, 2));
    log.push("스냅샷 저장:");
    for (const [k, v] of Object.entries(before)) log.push(`  ${k}: ${v ? `"${v}"` : "(비어 있음)"}`);

    if (a.dryRun) {
      await b.close();
      return { ok: true, snapshot, report: [...log, "", "dryRun — 아무것도 쓰지 않았다."].join("\n") };
    }

    // 아임웹은 **바뀐 게 없으면 저장 버튼을 비활성화한다.** 그건 오류가 아니라
    // "저장할 것이 없다" 는 뜻이다. 여기서 실패로 처리하면 재실행이 전부 실패한다.
    const save = async (): Promise<string> => {
      const btn = await pick(box, S.save_button);
      if (await btn.isDisabled()) return "저장 생략 (변경 없음)";
      await btn.click();
      await page.waitForTimeout(4000);
      return "저장";
    };

    // ── 2. 제목·설명을 먼저 넣고 **바로 저장한다.**
    // 셋을 다 채운 뒤 한 번에 저장하면, 키워드 칸에서 실패했을 때 제목·설명까지 통째로 날아간다.
    // 실제로 세 번 그랬다. 저장을 나누면 실패가 거기서 멈춘다.
    await titleEl.fill(a.title);
    await page.waitForTimeout(800);
    await descEl.fill(a.description);
    await page.waitForTimeout(800);
    log.push("", "입력:", `  사이트 제목: "${a.title}"`, `  사이트 설명: "${a.description}"`);
    log.push("  → " + (await save()));

    // ── 3. 키워드. 엔터로 하나씩 칩을 만든다 — 한 번에 붙이면 통째로 한 개가 된다.
    let added = 0;
    if (a.keywords.length) {
      try {
        for (const k of a.keywords) {
          // 칩이 생기면 placeholder 가 사라져 앵커가 바뀐다 — 매번 다시 고른다.
          const kwNow = await pick(box, S.site_keyword);
          await kwNow.fill(k);
          await kwNow.press("Enter");
          await page.waitForTimeout(500);
          added++;
        }
        const done = await save();
        log.push(`  메타 키워드: ${added}/${a.keywords.length}개 (${a.keywords.join(", ")}) → ${done}`);
      } catch (e) {
        // 키워드만 실패했다면 제목·설명은 이미 저장돼 있다. 실패를 숨기지 않고 그대로 보고한다.
        log.push(`  메타 키워드: ${added}/${a.keywords.length}개만 입력 — ${(e as Error).message.split("\n")[0]}`);
      }
    }

    // ── 4. 저장됐는지 화면에서 다시 읽는다. 클릭했다는 사실은 저장의 증거가 아니다.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    const box2 = page.frameLocator(IFRAME);
    const after = {
      "사이트 제목": await (await pick(box2, S.site_title, 45_000)).inputValue(),
      "사이트 설명": await (await pick(box2, S.site_description)).inputValue(),
      "메타 키워드": await (await pick(box2, S.site_keyword)).evaluate((kw: any) =>
        Array.from(kw.parentElement?.children ?? [])
          .filter((e: any) => e !== kw && e.innerText?.trim() && !/^\d+\/\d+$/.test(e.innerText.trim()))
          .map((e: any) => e.innerText.trim()).join(", ")),
    };
    const okTitle = after["사이트 제목"] === a.title;
    const okDesc = after["사이트 설명"] === a.description;
    log.push("", "저장 후 재확인:",
      `  사이트 제목: ${okTitle ? "일치" : `불일치 — "${after["사이트 제목"]}"`}`,
      `  사이트 설명: ${okDesc ? "일치" : `불일치 — "${after["사이트 설명"]}"`}`,
      `  메타 키워드: ${after["메타 키워드"] || "(비어 있음)"}`);

    await b.close();
    return { ok: okTitle && okDesc, snapshot, report: log.join("\n") };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: [...log, "", `실패: ${(e as Error).message}`].join("\n") };
  }
}
