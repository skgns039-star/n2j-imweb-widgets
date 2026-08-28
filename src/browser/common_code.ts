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
import { writeFileSync, mkdirSync } from "node:fs";
import { p, manifest, gateBlock } from "../release/paths.ts";
import { sessionStatus, statePath, reloginNotice } from "./session.ts";
import { wrap, assertMarked, upsert } from "../seo/marker.ts";

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
  const ctx = await b.newContext({ storageState: statePath(site_id), viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`https://${new URL(site.url).host}/admin/config/seo`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.frameLocator(IFRAME).locator('input[name="basic.siteName"]').first()
    .waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForTimeout(4000);
  return { b, page };
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

async function readSlot(page: any, i: number): Promise<string> {
  const fr = page.frames().find((f: any) => f.url().includes("/_/config-seo"));
  return fr.evaluate((k: number) => {
    const ed = document.querySelectorAll(".cm-editor")[k] as any;
    if (!ed) return "";
    if (ed.querySelector(".cm-placeholder")) return "";      // 비어 있으면 placeholder 만 있다
    return Array.from(ed.querySelectorAll(".cm-line")).map((l: any) => l.innerText).join("\n");
  }, i);
}

export type Result = { ok: boolean; report: string };

/** 한 칸의 DDAK-SEO 블록을 넣거나 갱신한다. 마커 밖의 기존 코드는 그대로 둔다. */
export async function putBlock(site_id: string, slot: Slot, type: string, body: string, dryRun = false, replace = false, raw?: string): Promise<Result> {
  const blocked = gateBlock("common_code_insert");
  if (blocked) return { ok: false, report: `BLOCKED: ${blocked}` };
  if (slot === LOADER_SLOT) {
    return { ok: false, report: `BLOCKED: "${LOADER_SLOT}" 에는 위젯 로더가 있다. SEO 코드는 여기 쓰지 않는다 (격리 계약).` };
  }

  const { b, page } = await open(site_id, !dryRun ? false : true);
  const log: string[] = [];
  try {
    const i = await indexOfSlot(page, slot);
    const before = await readSlot(page, i);
    mkdirSync(p("seo", site_id, "snapshots"), { recursive: true });
    writeFileSync(p("seo", site_id, "snapshots", `common-code-${slot.replace(/[^a-zA-Z]/g, "")}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`), before);
    log.push(`[${slot}] 에디터 #${i}`, `기존 내용 ${before.length}자 → 스냅샷 저장`);

    // CodeMirror 는 화면 밖 줄을 DOM 에서 지운다(가상 스크롤). 그래서 readSlot 이 돌려주는 값은
    // **렌더된 부분뿐**이다 — 잘린 것처럼 보인다. 이 값으로 upsert 하면 온전한 기존 블록을 못 찾아
    // 새 블록을 덧붙이게 된다. 실제로 마커가 두 벌 들어갔다.
    // 그래서 이 칸이 우리 것만 담는 경우(replace=true)에는 통째로 교체한다.
    // raw 가 오면 그대로 쓴다 — 블록이 여럿(소유확인 + JSON-LD)일 때는 정본을 통째로 넘긴다.
    const next = raw ?? (replace ? wrap(type, body) : upsert(before, type, body));
    assertMarked(next);
    if (dryRun) {
      await b.close();
      return { ok: true, report: [...log, "", "dryRun — 쓰지 않았다.", "", next].join("\n") };
    }

    // CodeMirror 는 contenteditable 이다.
    // locator.fill() 은 긴 내용을 **조용히 잘라 먹는다** — 1160자를 794자에서 끊어
    // 깨진 JSON 을 라이브에 올린 적이 있다. insertText 는 붙여넣기와 같아서 한 번에 들어간다.
    const box = page.frameLocator(IFRAME);
    const content = box.locator(".cm-content").nth(i);
    await content.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
    await page.keyboard.insertText(next);
    await page.waitForTimeout(1500);

    // 저장 전에 **끝까지** 들어갔는지 본다. 가상 스크롤 때문에 길이 비교는 못 하니,
    // 커서를 문서 끝으로 보내 마지막 줄을 렌더시킨 뒤 닫는 마커를 확인한다.
    await page.keyboard.press("ControlOrMeta+End");
    await page.waitForTimeout(800);
    const tail = await readSlot(page, i);
    if (!tail.includes("DDAK-SEO:END")) {
      await b.close();
      return { ok: false, report: [...log,
        "BLOCKED: 에디터에 닫는 마커가 없다 — 내용이 잘렸다. 저장하지 않았다."].join("\n") };
    }

    const save = box.locator('button[type="submit"]').first();
    if (await save.isDisabled()) { log.push("저장 생략 (변경 없음)"); }
    else { await save.click(); await page.waitForTimeout(5000); log.push("저장"); }

    // 저장됐는지 새로고침 후 다시 읽는다. 클릭은 저장의 증거가 아니다.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.frameLocator(IFRAME).locator('input[name="basic.siteName"]').first().waitFor({ state: "visible", timeout: 45_000 });
    await page.waitForTimeout(4000);
    const j = await indexOfSlot(page, slot);
    const head = await readSlot(page, j);
    await page.frameLocator(IFRAME).locator(".cm-content").nth(j).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.waitForTimeout(800);
    const foot = await readSlot(page, j);
    // 가상 스크롤이라 전체 대조는 불가능하다. 여는 마커가 **한 벌**이고 닫는 마커가 있으면 정상.
    // 최종 확인은 공개 페이지에서 한다 — 그게 진짜 오라클이다.
    const starts = ((head + foot).match(/DDAK-SEO:START/g) ?? []).length;
    const ok = foot.includes("DDAK-SEO:END") && starts >= 1;
    log.push("", `저장 후 재확인: 여는 마커 ${starts}회 · 닫는 마커 ${foot.includes("DDAK-SEO:END") ? "있음" : "없음"} → ${ok ? "정상" : "이상"}`);

    await b.close();
    return { ok, report: log.join("\n") };
  } catch (e) {
    await b.close().catch(() => {});
    return { ok: false, report: [...log, `실패: ${(e as Error).message.split("\n")[0]}`].join("\n") };
  }
}

export { wrap };
