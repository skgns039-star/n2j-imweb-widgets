/* ENG-043 기존 코드 이관 절차 (D1~D6, §24.9).
   어느 단계에서 중단해도 아임웹은 이전 상태 그대로다 — 이 모듈은 아임웹에 쓰지 않는다.
   D3 린트 실패를 **자동 수정하지 않는다.** ddak- 를 임의로 붙이면 원래 동작이 깨진다 (§24.9). */
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { p, manifest, json } from "../release/paths.ts";
import { sha256, gzipSize } from "../release/hash.ts";
import { lintCss, lintJs } from "../release/css_scope_lint.ts";
import { request, payloadText } from "../release/approval.ts";
import type { Wizard, Answers } from "./onboarding.ts";
import type { Ctx } from "./threads.ts";

const OBSERVE_MS = 72 * 60 * 60 * 1000;
const WIDGET_GZIP_BUDGET = 30 * 1024;

/** 파일 쓰기는 이 한 곳으로만 나간다 (TEST-050에서 실패를 주입하기 위함). */
export const io = {
  write(path: string, data: string) { writeFileSync(path, data); },
  read(path: string) { return readFileSync(path, "utf8"); },
};

/** D1. 원문 스냅샷. 저장에 실패하면 이관을 착수하지 않는다 (INV-6). */
export function snapshotOriginal(site_id: string, code: string): string {
  const dir = p("state", "imweb_snapshots");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = p("state", "imweb_snapshots", `${site_id}_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
  io.write(file, code);
  const back = io.read(file);
  if (sha256(back) !== sha256(code)) throw new Error("스냅샷 검증 실패 — 저장된 내용이 원문과 다릅니다.");
  return file;
}

/** D3. 위반 목록만 만든다. 고치지 않는다. */
export function lintStaged(widget_id: string, code: string): string[] {
  const errs = [...lintJs(code, `${widget_id}/index.js`)];
  for (const m of code.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) errs.push(...lintCss(m[1] ?? "", `${widget_id}/inline.css`));
  const gz = gzipSize(code);
  if (gz > WIDGET_GZIP_BUDGET) errs.push(`${widget_id}: gzip ${gz}B > ${WIDGET_GZIP_BUDGET}B`);
  return errs;
}

/** 배포 후 관찰 시간. logs/actions 의 성공 배포 기록을 기준으로 센다. */
export function hoursSinceDeploy(widget_id: string): number | null {
  const dir = p("logs", "actions");
  if (!existsSync(dir)) return null;
  let latest = 0;
  for (const f of readdirSync(dir)) {
    const r = json<any>(`logs/actions/${f}`);
    if (r.action === "deploy" && r.widget_id === widget_id && r.result === "OK") {
      latest = Math.max(latest, statSync(p("logs", "actions", f)).mtimeMs);
    }
  }
  return latest ? (Date.now() - latest) / 3_600_000 : null;
}

export const MIGRATE: Wizard = {
  type: "migrate",
  first: "site",
  steps: {
    site: {
      ask: () => `어느 사이트의 코드를 이관하나요? site_id: ${manifest().sites.map((s) => s.site_id).join(", ") || "등록된 사이트 없음"}`,
      run: async (input, a: Answers) => {
        const id = input.trim();
        if (!manifest().sites.some((s) => s.site_id === id)) return { ok: false, msg: "등록된 site_id가 아닙니다. 다시 입력해주세요." };
        a.site_id = id;
        return { ok: true, next: "widget_id" };
      },
    },
    widget_id: {
      ask: () => "이관 후 쓸 widget_id를 정해주세요. 영소문자·숫자·하이픈만 (예: legacy-banner)",
      run: async (input, a: Answers) => {
        const id = input.trim();
        if (!/^[a-z0-9-]+$/.test(id)) return { ok: false, msg: "영소문자·숫자·하이픈만 씁니다." };
        if (manifest().widgets.some((w) => w.widget_id === id)) return { ok: false, msg: "이미 있는 widget_id입니다. 다른 이름을 주세요." };
        a.widget_id = id;
        return { ok: true, next: "paste" };
      },
    },
    paste: {
      ask: () => [
        "아임웹에 들어 있는 **원본 코드 전체**를 그대로 붙여넣어 주세요.",
        "이 내용이 곧 D1 스냅샷이 됩니다. 원본은 아직 지우지 마세요.",
        "토큰·키가 섞여 있으면 붙여넣지 말고 먼저 제거하세요.",
      ].join("\n"),
      run: async (input, a: Answers, _ctx) => {
        const code = input.trim();
        if (code.length < 20) return { ok: false, msg: "코드가 너무 짧습니다. 원본 전체를 붙여넣어 주세요." };

        // D1
        let snap: string;
        try {
          snap = snapshotOriginal(a.site_id, code);
        } catch (e) {
          return { ok: false, msg: `D1 스냅샷 저장 실패 — 이관을 착수하지 않습니다 (INV-6).\n${(e as Error).message}` };
        }
        a.snapshot = snap;

        // D2 — 정본 자리에 옮기되 원본은 아직 지우지 않는다
        const dir = p("src", "widgets", a.widget_id);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        io.write(p("src", "widgets", a.widget_id, "index.js"), code.endsWith("\n") ? code : code + "\n");

        // D3 — 위반은 보고만 하고 멈춘다
        const errs = lintStaged(a.widget_id, code);
        if (errs.length) {
          return {
            ok: false,
            msg: [
              `D3 중단 — 린트·예산 위반 ${errs.length}건. **자동으로 고치지 않습니다.**`,
              ...errs.map((e) => "  " + e),
              "",
              `스냅샷은 ${snap} 에 있고, 아임웹 원본은 그대로입니다.`,
              "코드를 직접 스코프에 맞게 고친 뒤 다시 붙여넣거나, '취소'로 종료하세요.",
            ].join("\n"),
          };
        }
        return { ok: true, next: "register", msg: `D1~D3 통과. 스냅샷: ${snap}` };
      },
    },
    register: {
      ask: (a: Answers) => [
        `D4 — ${a.widget_id} 를 registry에 **enabled:false** 로 등록합니다.`,
        "등록만으로는 사이트에 아무 변화도 없습니다. 이후 빌드·배포 승인이 따로 필요합니다.",
        "진행하려면 '승인 요청'.",
      ].join("\n"),
      run: async (input, a: Answers, ctx: Ctx) => {
        if (!/승인\s*요청|진행|반영/.test(input)) return { ok: false, msg: "'승인 요청' 또는 '취소'로 답해주세요." };
        const widget = {
          widget_id: a.widget_id, version: "0.1.0", enabled: false, site: a.site_id,
          match: { path_glob: ["/*"] }, mount: { type: "slot", slot: "content" },
        };
        const ap = request("manifest_commit", `widget ${a.widget_id} (이관)`, {
          kind: "widget", widget, snapshot: a.snapshot, files: ["manifest/widgets.yaml"],
          rollback: "manifest에서 해당 widget 항목 제거 + src/widgets 디렉터리 삭제",
        }, ctx.chat_id);
        return {
          ok: true, next: null,
          msg: [
            payloadText(ap), "",
            "승인 후: npm run build → 배포 승인 → enabled:true 전환 → 실사이트에서 신구 동시 동작 확인(D5).",
            "원본 제거(D6)는 배포 후 72시간 정상 동작을 확인한 뒤에만 제안합니다. 그전에는 요청해도 거부합니다.",
          ].join("\n"),
        };
      },
    },
  },
};

/** D6. 72시간 관찰 전에는 제거를 제안하지도, 승인 페이로드를 만들지도 않는다 (§24.9). */
export function requestOriginalRemoval(widget_id: string, ctx: Ctx): string {
  const w = manifest().widgets.find((x) => x.widget_id === widget_id);
  if (!w) return `manifest에 없는 위젯입니다 (${widget_id}).`;
  const hrs = hoursSinceDeploy(widget_id);
  if (hrs === null) return `${widget_id} 의 성공 배포 기록이 없습니다. 배포 후 72시간 관찰이 끝나야 원본 제거를 제안할 수 있습니다.`;
  if (hrs < 72) return `아직 ${Math.floor(hrs)}시간 경과 — 72시간 관찰이 끝나지 않았습니다. 원본을 제거하지 않습니다 (§24.9).`;
  if (!w.enabled) return `${widget_id} 가 enabled:false 입니다. 신 위젯이 실제로 동작하는 상태에서만 원본 제거를 제안합니다.`;

  const snaps = existsSync(p("state", "imweb_snapshots"))
    ? readdirSync(p("state", "imweb_snapshots")).filter((f) => f.startsWith(w.site + "_"))
    : [];
  if (!snaps.length) return `원문 스냅샷을 찾지 못했습니다. 스냅샷 없이는 제거를 진행하지 않습니다 (INV-6).`;

  const ap = request("imweb_remove_inline", `${w.site} 원본 인라인 코드 제거`, {
    widget_id, site: w.site, snapshot: snaps[snaps.length - 1],
    observed_hours: Math.floor(hrs),
    rollback: "스냅샷 원문으로 복원",
  }, ctx.chat_id);
  return [
    payloadText(ap), "",
    `관찰 ${Math.floor(hrs)}시간 경과. 제거는 사람이 직접 수행합니다 — 에이전트는 아임웹에 쓰지 않습니다.`,
    "제거 전 스냅샷을 다시 확인하고, 제거 후 정규화 diff로 검증하세요. 실패하면 스냅샷으로 복원합니다.",
  ].join("\n");
}
