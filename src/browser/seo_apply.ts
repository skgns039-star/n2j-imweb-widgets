/* SKILL 9~11단계 아임웹 SEO 반영. **관리자 SEO 설정만 건드린다.**
   디자인모드 본문·이미지·레이아웃·메뉴명은 여기서 열지도 않는다 (INV-11).

   순서가 곧 안전장치다: 스냅샷 → 쓰기 → 저장 → 재확인.
   스냅샷 없이 쓰면 되돌릴 수가 없다. "원래 비어 있었다" 도 기록해야 할 사실이다. */
import { assertApproved, canonical } from "../release/approval.ts";
import { verifiedWrite, writePayload } from "./verified_write.ts";
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

export type ApplyInput = { site_id: string; title: string; description: string; keywords: string[]; dryRun?: boolean; approvalId?: string };

export async function applySeo(a: ApplyInput): Promise<{ ok: boolean; report: string; approvalPayload?: Record<string, unknown> }> {
  const blocked = gateBlock("seo_apply");
  if (blocked) return { ok: false, report: `BLOCKED: ${blocked}` };
  const target = "seo-settings";
  if (!a.dryRun) {
    try { assertApproved(a.approvalId, "imweb_write", { site_id: a.site_id, target }); }
    catch { return { ok: false, report: "BLOCKED: SEO 설정에 대한 1회 승인 필요" }; }
  }
  const site = manifest().sites.find((s) => s.site_id === a.site_id);
  if (!site?.url) return { ok: false, report: "BLOCKED: 미등록 사이트" };
  if (!sessionStatus(a.site_id).ok) return { ok: false, report: reloginNotice(a.site_id, "저장된 세션 없음") };
  const sel = selectors() as any;
  if (!sel.verified) return { ok: false, report: "BLOCKED: 셀렉터 미실측" };
  const S = sel.seo_settings;
  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless: !!a.dryRun });
  try {
    const ctx = await b.newContext({ storageState: statePath(a.site_id) });
    const page = await ctx.newPage();
    await page.goto(SEO_URL(new URL(site.url).host), { waitUntil: "domcontentloaded", timeout: 60_000 });
    const box = () => page.frameLocator(IFRAME);
    const keys = async (): Promise<string[]> => (await pick(box(), S.site_keyword)).evaluate((kw: any) => {
      if (!kw.parentElement) throw new Error("BLOCKED: 키워드 원문 확인 불가");
      return Array.from(kw.parentElement.children)
        .filter((e: any) => e !== kw && e.innerText?.trim() && !/^\d+\/\d+$/.test(e.innerText.trim()))
        .map((e: any) => e.innerText.trim());
    });
    const read = async () => canonical({
      title: await (await pick(box(), S.site_title, 45_000)).inputValue(),
      description: await (await pick(box(), S.site_description)).inputValue(), keywords: await keys(),
    });
    const before = await read();
    const original = JSON.parse(before);
    // 기존 키워드를 보존하며 중복 없이 추가한다. 복원 시에는 원래 목록을 정확히 되살린다.
    const next = canonical({ title: a.title, description: a.description, keywords: [...new Set([...original.keywords, ...a.keywords])] });
    if (a.dryRun) return { ok: true, report: "dryRun — 제목·설명·키워드 전체 변경 계획, 쓰기 없음", approvalPayload: writePayload(a.site_id, target, before, next) };
    const io = {
      read,
      write: async (value: string) => {
        const wanted = JSON.parse(value);
        await (await pick(box(), S.site_title)).fill(wanted.title);
        await (await pick(box(), S.site_description)).fill(wanted.description);
        const current = await keys();
        if (canonical(current) !== canonical(wanted.keywords)) {
          for (let n = current.length; n > 0; n--) {
            const input = await pick(box(), S.site_keyword);
            await input.fill(""); await input.press("Backspace");
            if ((await keys()).length !== n - 1) throw new Error("BLOCKED: 키워드 제거 검증 실패");
          }
          for (const keyword of wanted.keywords) {
            const input = await pick(box(), S.site_keyword);
            await input.fill(keyword); await input.press("Enter");
          }
        }
      },
      save: async () => {
        const button = await pick(box(), S.save_button);
        if (!(await button.isDisabled())) { await button.click(); await page.waitForTimeout(4000); }
      },
      reload: async () => { await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }); },
    };
    return await verifiedWrite(io, a.site_id, target, before, next, a.approvalId);
  } catch { return { ok: false, report: "BLOCKED: SEO 원문·셀렉터 확인 실패" }; }
  finally { await b.close().catch(() => {}); }
}
