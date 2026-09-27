/* 관리자 → SEO → 고급 설정 → 공통 코드 삽입 (Header/Body/Footer Code).

   API 경로는 막혀 있다 (2026-08-28 실측):
   - 레거시 api.imweb.me/v2 는 인증은 되지만 **스크립트 엔드포인트가 없다** (쇼핑 전용).
   - 신규 openapi.imweb.me/script 는 존재하지만 `grantType` 이 authorization_code|refresh_token
     뿐이다. client_credentials 가 없어 **개발자센터 앱 등록 + 사용자 동의 없이는 도달 불가**.
   그래서 브라우저 경로로 간다.

   입력 칸은 textarea 가 아니라 **CodeMirror 6** (`.cm-editor` / `.cm-content`) 다.
   라벨 순서로 6개가 있고 우리가 쓸 것은 그중 하나뿐이다:
     [0] robots.txt  [1] llms.txt  [2] Header Code 상단  [3] Header Code  [4] Body Code  [5] Footer Code

   **[2] Header Code 상단에는 위젯 로더가 들어 있다. 절대 건드리지 않는다** (격리 계약).
   SEO 삽입물은 DDAK-SEO 마커 구간만 치환한다 (INV-10). */
import { assertApproved, canonical } from "../release/approval.ts";
import { normalizeCode } from "../release/hash.ts";
import { verifiedWrite, writePayload } from "./verified_write.ts";
import { p, manifest, gateBlock } from "../release/paths.ts";
import { sessionStatus, statePath, reloginNotice } from "./session.ts";
import { wrap, assertMarked, upsert, foreignRegions } from "../seo/marker.ts";

export const SLOTS = ["robots.txt 사용", "llms.txt 사용", "Header Code 상단", "Header Code", "Body Code", "Footer Code"] as const;
export type Slot = (typeof SLOTS)[number];

/** 로더가 사는 칸. 여기에 SEO 코드를 쓰면 격리 계약 위반이다. */
const LOADER_SLOT: Slot = "Header Code 상단";

const IFRAME = 'iframe[src*="/_/config-seo"]';

async function open(site_id: string, headless: boolean) {
  const site = manifest().sites.find((s) => s.site_id === site_id);
  if (!site?.url) throw new Error(`${site_id} 미등록`);
  if (!sessionStatus(site_id).ok) throw new Error(reloginNotice(site_id, "저장된 세션 없음"));
  const pw = await import("playwright");
  const b = await pw.chromium.launch({ headless });
  try {
  const ctx = await b.newContext({ storageState: statePath(site_id), viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`https://${new URL(site.url).host}/admin/config/seo`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  if (await page.locator('input[type="password"]').count()) throw new Error("BLOCKED: 관리자 세션 만료 — 재로그인 필요");
  await page.frameLocator(IFRAME).locator('input[name="basic.siteName"]').first()
    .waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForTimeout(4000);
  return { b, page };
  } catch (e) { await b.close().catch(() => {}); throw e; }
}

/** 라벨로 에디터 번호를 찾는다. 순서를 코드에 박아두면 아임웹이 칸을 하나 추가하는 순간 엉뚱한 곳에 쓴다. */
async function indexOfSlot(page: any, slot: Slot): Promise<number> {
  const fr = page.frames().find((f: any) => f.url().includes("/_/config-seo"));
  const i = await fr.evaluate((want: string) => {
    const eds = Array.from(document.querySelectorAll(".cm-editor"));
    for (let k = 0; k < eds.length; k++) {
      let n: any = eds[k], lab = "";
      for (let d = 0; d < 5 && n && !lab; d++) { n = n.parentElement; lab = n?.querySelector("label")?.innerText?.trim() ?? ""; }
      if (lab === want) return k;
    }
    return -1;
  }, slot);
  if (i < 0) throw new Error(`BLOCKED: "${slot}" 입력 칸을 찾지 못했다 — UI 변경 가능. 추측해서 쓰지 않는다.`);
  return i;
}

export async function readSlot(page: any, i: number): Promise<string> {
  const fr = page.frames().find((f: any) => f.url().includes("/_/config-seo"));
  if (!fr) throw new Error("BLOCKED: SEO 프레임 없음");
  return fr.evaluate((k: number) => {
    const ed = document.querySelectorAll(".cm-editor")[k] as any;
    const content = ed?.querySelector(".cm-content");
    const view = content?.cmView?.view ?? content?.cmView?.rootView?.view ?? content?.cmTile?.root?.view;
    const doc = view?.state?.doc;
    if (!doc || typeof doc.toString !== "function" || typeof doc.length !== "number") {
      throw new Error("BLOCKED: CodeMirror 전체 문서 접근 불가 — DOM 일부를 원문으로 취급하지 않음");
    }
    const text = doc.toString();
    if (typeof text !== "string" || text.length !== doc.length) throw new Error("BLOCKED: 전체 문서 길이 불일치");
    return text;
  }, i);
}

export type Result = { ok: boolean; report: string; approvalPayload?: Record<string, unknown> };

/** 한 칸의 DDAK-SEO 블록을 넣거나 갱신한다. 마커 밖의 기존 코드는 그대로 둔다. */
export async function putBlock(site_id: string, slot: Slot, type: string, body: string, dryRun = false, replace = false, raw?: string, approvalId?: string): Promise<Result> {
  const blocked = gateBlock("common_code_insert") ?? gateBlock("seo_apply") ??
    ((slot === "robots.txt 사용" || slot === "llms.txt 사용") ? gateBlock("robots_llms_edit") : null);
  if (blocked) return { ok: false, report: `BLOCKED: ${blocked}` };
  if (slot === LOADER_SLOT || !SLOTS.includes(slot)) return { ok: false, report: "BLOCKED: 허용되지 않은 코드 칸" };
  const target = 'common-code:' + slot;
  if (!dryRun) {
    try { assertApproved(approvalId, "imweb_write", { site_id, target }); }
    catch { return { ok: false, report: "BLOCKED: 대상에 대한 1회 승인 필요" }; }
  }
  const { b, page } = await open(site_id, dryRun);
  try {
    const i = await indexOfSlot(page, slot);
    const before = await readSlot(page, i);
    const next = raw ?? (replace ? wrap(type, body) : upsert(before, type, body));
    assertMarked(next);
    if (canonical(foreignRegions(before)) !== canonical(foreignRegions(next))) throw new Error("BLOCKED: 마커 밖 코드 변경");
    const approvalPayload = writePayload(site_id, target, before, next);
    if (dryRun) return { ok: true, report: "dryRun — 전체 원문 확인, 쓰기 없음. 반환된 해시에 대한 승인이 필요합니다.", approvalPayload };
    const io = {
      read: async () => readSlot(page, await indexOfSlot(page, slot)),
      write: async (value: string) => {
        const index = await indexOfSlot(page, slot);
        const content = page.frameLocator(IFRAME).locator(".cm-content").nth(index);
        await content.click(); await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.press("Delete"); await page.keyboard.insertText(value);
      },
      save: async () => {
        const save = page.frameLocator(IFRAME).locator('button[type="submit"]');
        if (await save.count() !== 1) throw new Error("BLOCKED: 저장 버튼 불명확");
        if (!(await save.isDisabled())) { await save.click(); await page.waitForTimeout(5000); }
      },
      reload: async () => {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.frameLocator(IFRAME).locator('.cm-editor').first().waitFor({ state: "visible", timeout: 45_000 });
      },
    };
    return await verifiedWrite(io, site_id, target, before, next, approvalId, normalizeCode);
  } catch { return { ok: false, report: "BLOCKED: 전체 원문·마커·셀렉터 검증 실패" }; }
  finally { await b.close().catch(() => {}); }
}

export { wrap };
