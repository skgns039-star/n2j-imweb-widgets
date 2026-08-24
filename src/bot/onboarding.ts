/* ENG-041 대화형 연결 위저드 + ENG-044 연결 락 (REQ-026~035, §24).
   런타임 기능이다 — Hallmark 미적용. 새 라이브러리 없이 기존 라우터·Thread Store·승인 모듈을 재사용한다.
   **비밀값을 묻는 질문은 이 파일 어디에도 없다** (REQ-027 / PTEST-038). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { stringify } from "yaml";
import { p, manifest, yaml } from "../release/paths.ts";
import { request, payloadText, invalidatePending } from "../release/approval.ts";
import { envStatus, envStatusText } from "../release/secrets.ts";
import {
  net, scanSite, verdict, conflicts, driftReport, summarize, currentLoaderVersion, sampleNotice, MAX_SAMPLE,
} from "./scan.ts";
import { db, conversationKey, type Ctx } from "./threads.ts";

export const TTL_MS = 15 * 60 * 1000;

db.exec(`
  CREATE TABLE IF NOT EXISTS onboarding (
    conversation_key TEXT PRIMARY KEY,
    wizard_type TEXT NOT NULL, step TEXT NOT NULL,
    answers TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS connect_locks (
    site_id TEXT PRIMARY KEY,
    conversation_key TEXT NOT NULL, expires_at TEXT NOT NULL
  );
`);

// ─────────────────────── 상태 (REQ-028) ───────────────────────

export type Answers = Record<string, any>;
export type State = { wizard_type: string; step: string; answers: Answers };

export function loadState(ctx: Ctx): State | null {
  const row = db.prepare("SELECT wizard_type, step, answers, updated_at FROM onboarding WHERE conversation_key = ?")
    .get(conversationKey(ctx)) as any;
  if (!row) return null;
  if (Date.now() - Date.parse(row.updated_at) > TTL_MS) { expire(ctx); return null; }
  return { wizard_type: row.wizard_type, step: row.step, answers: JSON.parse(row.answers) };
}

export function saveState(ctx: Ctx, s: State) {
  db.prepare(`INSERT INTO onboarding (conversation_key, wizard_type, step, answers, updated_at)
    VALUES (?,?,?,?,?) ON CONFLICT(conversation_key) DO UPDATE SET
    wizard_type = excluded.wizard_type, step = excluded.step, answers = excluded.answers, updated_at = excluded.updated_at`)
    .run(conversationKey(ctx), s.wizard_type, s.step, JSON.stringify(s.answers), new Date().toISOString());
}

/** 위저드 종료는 항상 락 해제와 함께 일어난다. 한 대화는 한 번에 하나의 위저드만 가진다. */
export function clearState(ctx: Ctx) {
  const key = conversationKey(ctx);
  db.prepare("DELETE FROM connect_locks WHERE conversation_key = ?").run(key);
  db.prepare("DELETE FROM onboarding WHERE conversation_key = ?").run(key);
}

/** §24.7 위저드 만료 → 대기 승인 동반 무효화. */
export function expire(ctx: Ctx): number {
  clearState(ctx);
  return invalidatePending(ctx.chat_id, "EXPIRED");
}

/** §24.7 사용자 "취소" → 승인·위저드·락 모두 해제. */
export function cancel(ctx: Ctx): number {
  clearState(ctx);
  return invalidatePending(ctx.chat_id, "REJECTED");
}

// ─────────────────────── 연결 락 (ENG-044 / §24.6) ───────────────────────

export function acquireLock(site_id: string, ctx: Ctx): boolean {
  const key = conversationKey(ctx);
  const row = db.prepare("SELECT conversation_key, expires_at FROM connect_locks WHERE site_id = ?").get(site_id) as any;
  if (row && row.conversation_key !== key && Date.parse(row.expires_at) > Date.now()) return false;
  db.prepare(`INSERT INTO connect_locks (site_id, conversation_key, expires_at) VALUES (?,?,?)
    ON CONFLICT(site_id) DO UPDATE SET conversation_key = excluded.conversation_key, expires_at = excluded.expires_at`)
    .run(site_id, key, new Date(Date.now() + TTL_MS).toISOString());
  return true;
}

export function holdsLock(site_id: string, ctx: Ctx): boolean {
  const row = db.prepare("SELECT conversation_key, expires_at FROM connect_locks WHERE site_id = ?").get(site_id) as any;
  return !!row && row.conversation_key === conversationKey(ctx) && Date.parse(row.expires_at) > Date.now();
}

export function releaseLock(site_id: string, ctx: Ctx) {
  db.prepare("DELETE FROM connect_locks WHERE site_id = ? AND conversation_key = ?").run(site_id, conversationKey(ctx));
}

// ─────────────────────── 위저드 골격 ───────────────────────

export type StepResult = { ok: true; next: string | null; msg?: string } | { ok: false; msg: string };
export type Step = { ask: (a: Answers, ctx: Ctx) => string; run: (input: string, a: Answers, ctx: Ctx) => Promise<StepResult> };
export type Wizard = { type: string; first: string; steps: Record<string, Step> };

const ok = (next: string | null, msg?: string): StepResult => ({ ok: true, next, msg });
const no = (msg: string): StepResult => ({ ok: false, msg });

/** 토큰 기반 선택지 판정 — 한국어 조사 때문에 \b 를 쓰지 않는다 (§24.8). */
const choose = (input: string, options: string[]): string | null => {
  const tokens = input.trim().toUpperCase().split(/[^A-Z0-9_]+/).filter(Boolean);
  const hit = options.filter((o) => tokens.includes(o.toUpperCase()));
  return hit.length === 1 ? hit[0]! : null;
};
const yesNo = (s: string) =>
  /(^|\s)(예|네|응|yes|y)(\s|$|[.!])/i.test(s) ? "yes"
  : /(아니오|아니요|아니|no|n)(\s|$|[.!])/i.test(s) ? "no"
  : /모름|몰라|unknown/i.test(s) ? "unknown" : null;
const wantsProceed = (s: string) => /승인\s*요청|진행|반영/.test(s);

// ─────────────────────── 메뉴 + 소유권 (§24.4) ───────────────────────

function doneLabel(): Record<string, string> {
  const m = manifest();
  const reg = yaml<any>("config/agent_registry.yaml");
  const chats = yaml<any>("config/allowed_chats.yaml");
  return {
    A: m.sites.some((s) => s.url) ? "완료됨" : "미완료",
    B: reg.agents?.[0]?.runtime_engine && reg.agents[0].runtime_engine !== "dry_run" ? "완료됨" : "미완료",
    C: m.cdn.owner && !m.cdn.owner.startsWith("<") ? "완료됨" : "미완료",
    D: (chats.allowed ?? []).some((c: any) => c.chat_id && c.chat_id !== 0) ? "완료됨" : "미완료",
  };
}

const MENU: Wizard = {
  type: "menu",
  first: "own",
  steps: {
    // Q-OWN. 위저드 첫 단계 (REQ-035)
    own: {
      ask: () => [
        "이 사이트를 직접 소유·관리하시나요?",
        "  A 본인 계정의 본인 사이트",
        "  B 고객사 사이트이며 관리 위임을 받음",
        "  C 아님 / 확실하지 않음",
        "취소하려면 '취소'.",
      ].join("\n"),
      run: async (input, a) => {
        const c = choose(input, ["A", "B", "C"]);
        if (!c) return no("A / B / C 중 하나로 답해주세요.");
        if (c === "C") return ok(null, "소유·관리 권한이 확인되지 않아 연결을 종료합니다. 권한이 확인되면 다시 '연결'이라고 말씀해주세요.");
        a.ownership = c;
        return ok("choose", c === "B"
          ? "위임 사이트는 스캔(읽기)까지만 진행합니다. 아임웹 쓰기는 OPEN-BRW-01 해소 전까지 차단됩니다."
          : undefined);
      },
    },
    choose: {
      ask: () => {
        const d = doneLabel();
        return [
          "무엇을 연결할까요? 알파벳으로 답하세요.",
          `  A 아임웹 사이트 연결 (${d.A})`,
          `  B 실행 엔진 연결 (${d.B})`,
          `  C GitHub·CDN 연결 (${d.C})`,
          `  D 텔레그램 재설정 (${d.D})`,
        ].join("\n");
      },
      run: async (input, a) => {
        const c = choose(input, ["A", "B", "C", "D"]);
        if (!c) return no("A / B / C / D 중 하나로 답해주세요.");
        a.branch = c;
        if (doneLabel()[c] === "완료됨" && !a.reconfirmed) { a.reconfirmed = true; return ok("confirm"); }
        return ok(null, `__START__${c}`);
      },
    },
    confirm: {
      ask: (a) => `${a.branch} 항목은 이미 완료됨입니다. 변경할까요? (예/아니오)`,
      run: async (input, a) => {
        const v = yesNo(input);
        if (!v) return no("예 또는 아니오로 답해주세요.");
        return v === "yes" ? ok(null, `__START__${a.branch}`) : ok(null, "변경하지 않고 종료합니다.");
      },
    },
  },
};

// ─────────────────────── A. 아임웹 사이트 ───────────────────────

const SITE: Wizard = {
  type: "site",
  first: "kind",
  steps: {
    kind: {
      ask: () => [
        "이 사이트는 어느 쪽인가요?",
        "  A1 신규 — 아임웹에 우리 코드가 하나도 없음",
        "  A2 기존 — 이미 코드 위젯·스크립트가 들어가 있음 (로더 포함/미포함 무관)",
        "  A3 재연결 — 이미 등록된 site_id를 다시 설정",
        "판단이 안 서면 A2를 고르세요. A2가 더 안전합니다.",
      ].join("\n"),
      run: async (input, a) => {
        const k = choose(input, ["A1", "A2", "A3"]);
        if (!k) return no("A1 / A2 / A3 중 하나로 답해주세요.");
        a.kind = k;
        return ok("site_id");
      },
    },
    site_id: {
      ask: (a) => a.kind === "A3"
        ? `재연결할 site_id를 입력하세요. 등록된 것: ${manifest().sites.map((s) => s.site_id).join(", ") || "없음"}`
        : "site_id를 정해주세요. 영소문자·숫자·하이픈만 (예: ddak-main)",
      run: async (input, a, ctx) => {
        const id = input.trim();
        if (!/^[a-z0-9-]+$/.test(id)) return no("영소문자·숫자·하이픈만 씁니다. 다시 입력해주세요.");
        const exists = manifest().sites.some((s) => s.site_id === id);
        if (a.kind === "A3" && !exists) return no("등록되지 않은 site_id입니다. 다시 입력해주세요.");
        if (a.kind !== "A3" && exists) return no("이미 쓰이는 site_id입니다. 다른 이름을 주세요.");
        if (!acquireLock(id, ctx)) return no(`다른 대화에서 ${id} 연결이 진행 중입니다. 그쪽을 끝내거나 취소한 뒤 다시 시도하세요 (§24.6).`);
        a.site_id = id;
        return ok("url");
      },
    },
    url: {
      ask: () => "사이트 공개 URL을 알려주세요. (https://... 형식)",
      run: async (input, a) => {
        const u = input.trim().replace(/\/+$/, "");
        if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(u)) return no("https:// 로 시작하는 주소여야 합니다. 다시 입력해주세요.");
        const st = await net.status(u);
        if (st !== 200) return no(`그 주소가 200을 주지 않습니다 (HTTP ${st || "요청 실패"}). 확인 후 다시 입력해주세요.`);
        a.url = u;
        return ok("plan");
      },
    },
    plan: {
      ask: () => "아임웹 요금제가 '공통 코드 삽입'을 지원하나요? (예 / 아니오 / 모름)",
      run: async (input, a) => {
        const v = yesNo(input);
        if (!v) return no("예 / 아니오 / 모름 중 하나로 답해주세요.");
        a.common_code = v;
        return ok("test_path", v === "yes"
          ? "공통 코드 삽입 경로(아임웹 권장)를 씁니다."
          : "코드 위젯 1개에 넣는 경로로 갑니다. CHK-005는 OPEN으로 유지합니다.");
      },
    },
    test_path: {
      ask: (a) => `테스트에 쓸 페이지 경로를 알려주세요 (최대 ${MAX_SAMPLE - 1}개, 쉼표 구분). 예: /product/1 — ${a.url} 기준`,
      run: async (input, a) => {
        const paths = input.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
        if (!paths.length || paths.some((x) => !x.startsWith("/"))) return no("/ 로 시작하는 경로여야 합니다. 다시 입력해주세요.");
        for (const path of paths.slice(0, MAX_SAMPLE - 1)) {
          const st = await net.status(a.url + path);
          if (st !== 200) return no(`${path} 가 200을 주지 않습니다 (HTTP ${st || "요청 실패"}). 다른 경로를 주세요.`);
        }
        a.paths = paths.slice(0, MAX_SAMPLE - 1);
        a.test_path = a.paths[0];
        // REQ-031: A2·A3는 스캔을 건너뛸 수 없다.
        return a.kind === "A1" ? ok("slots") : ok("scan", "기존 사이트이므로 먼저 상태를 스캔합니다. 읽기 전용이고 로그인하지 않습니다.");
      },
    },

    scan: {
      ask: () => "스캔을 시작하려면 '스캔'이라고 답하세요. (아임웹에 아무것도 쓰지 않습니다)",
      run: async (input, a) => {
        if (!/스캔|scan|시작/i.test(input)) return no("'스캔' 이라고 답해주세요. 중단하려면 '취소'.");
        const scan = await scanSite(a.site_id, a.url, a.paths);
        a.scan = scan;
        if (scan.pages.every((pg) => !pg.ok)) {
          return no([sampleNotice(scan.paths.length), "", "스캔 실패 — 페이지를 렌더하지 못했습니다.", ...scan.errors,
            "정적 HTML만 읽고 판정하지 않습니다. 브라우저가 준비되면 다시 '스캔'."].join("\n"));
        }

        const v = verdict(scan);
        const conf = conflicts(scan);
        const drift = driftReport(scan, a.site_id);
        const lines = [summarize(scan), "", `판정 ${v.code}: ${v.text}`];
        if (drift.length) lines.push("", "정본은 Git입니다 (INV-3). 사이트를 정본으로 승격하지 않습니다.",
          ...drift.map((d) => `  [${d.kind}] ${d.detail} → ${d.action}`));
        if (conf.report.length) lines.push("", ...conf.report);
        if (scan.foreign.src.length || scan.foreign.inline) {
          lines.push("", "기존 커스텀 코드는 그대로 둡니다. 정리·개선을 먼저 제안하지 않습니다.",
            "이관을 원하시면 '이관'이라고 말씀하세요.");
        }

        if (conf.blocking.length) {
          lines.push("", "충돌 — 연결 실패로 처리합니다 (경고로 강등하지 않습니다):", ...conf.blocking);
          return ok(null, lines.join("\n"));
        }
        if (v.code === "C4") return ok(null, lines.join("\n"));              // 자동 제거 0건
        if (v.code === "C3") {
          if (a.ownership === "B") return ok(null, lines.join("\n") + "\n\n위임 사이트는 아임웹 쓰기가 차단되어 교체를 진행할 수 없습니다 (OPEN-BRW-01).");
          return ok("replace_approve", lines.join("\n"));
        }
        if (a.kind === "A3") {
          if (!drift.length) return ok(null, lines.join("\n") + "\n\n변경 없음. 아무것도 커밋하지 않았습니다.");
          return ok("commit", lines.join("\n"));
        }
        if (v.code === "C2") { a.already_connected = true; return ok("commit", lines.join("\n")); }
        return ok("slots", lines.join("\n"));
      },
    },

    // C3 — 구버전 교체는 INV-2 예외라 명시 승인
    replace_approve: {
      ask: (a) => [
        `로더 교체 승인이 필요합니다 (${a.scan.loaders.version ?? "불명"} → ${currentLoaderVersion()}).`,
        `변경 전: 사이트에서 관측된 로더 v${a.scan.loaders.version ?? "불명"}`,
        `변경 후: loader/LOADER_SNIPPET.md 의 @loader-${currentLoaderVersion()} 스니펫`,
        `영향 위젯: ${manifest().widgets.filter((w) => w.site === a.site_id).map((w) => w.widget_id).join(", ") || "없음"}`,
        "되돌리기: 교체 전 원문 스냅샷으로 복원 (교체 전 반드시 보관)",
        "진행하려면 '승인 요청', 중단하려면 '취소'.",
      ].join("\n"),
      run: async (input, a, ctx) => {
        if (!wantsProceed(input)) return no("'승인 요청' 또는 '취소'로 답해주세요.");
        const ap = request("loader_replace", `${a.site_id} 로더 교체`, {
          site_id: a.site_id, from: a.scan.loaders.version ?? null, to: currentLoaderVersion(),
          rollback: "교체 전 원문 스냅샷 복원",
        }, ctx.chat_id);
        return ok(null, payloadText(ap) + "\n\n승인해도 코드는 사람이 직접 교체합니다. 에이전트는 아임웹에 쓰지 않습니다.");
      },
    },

    slots: {
      ask: () => "슬롯 프리셋을 심을까요? (예/아니오) — 위치 지정 위젯을 나중에 붙이려면 지금 심어두는 편이 낫습니다.",
      run: async (input, a) => {
        const v = yesNo(input);
        if (!v) return no("예 또는 아니오로 답해주세요.");
        if (v !== "yes") { a.slots = []; return ok("snippet"); }
        return ok("slot_pick");
      },
    },
    slot_pick: {
      ask: () => "어디에 심을까요? header / content / footer 중 골라 쉼표로 나열하세요. (예: content, footer)",
      run: async (input, a) => {
        const picked = input.toLowerCase().split(/[,\s]+/).filter((s) => ["header", "content", "footer"].includes(s));
        if (!picked.length) return no("header / content / footer 중에서 골라주세요.");
        a.slots = [...new Set(picked)];
        return ok("snippet");
      },
    },

    snippet: {
      ask: (a) => {
        if (a.ownership === "B") return "위임 사이트는 아임웹 쓰기가 차단되어 삽입 안내를 진행하지 않습니다 (OPEN-BRW-01). '취소'로 종료하세요.";
        const md = readFileSync(p("loader", "LOADER_SNIPPET.md"), "utf8");
        const slots = (a.slots ?? []).map((s: string) => `<div data-ddak-slot="${s}"></div>`).join("\n");
        return [
          "── 삽입 전에 반드시 ──",
          "넣을 코드 영역의 **원문을 통째로 복사해 보관**하세요. 스냅샷 없이는 되돌릴 수 없습니다 (INV-6).",
          "",
          `삽입 위치: ${a.common_code === "yes" ? "환경설정 > SEO(검색엔진최적화) > 공통 코드 삽입" : "코드 위젯 1개 (공통 코드 삽입 불가 요금제)"}`,
          "기존 코드는 지우지 말고 아래를 **덧붙이세요**.",
          "",
          md,
          slots ? "\n[이번에 함께 심을 슬롯]\n" + slots : "",
          "",
          `data-site 값은 "${a.site_id}" 로 바꿔 넣으세요.`,
          "삽입을 마쳤으면 '삽입했어' 라고 알려주세요. 실제로 들어갔는지 렌더해서 확인합니다.",
        ].join("\n");
      },
      run: async (input, a) => {
        if (a.ownership === "B") return no("위임 사이트는 여기서 진행할 수 없습니다. '취소'로 종료하세요.");
        if (!/삽입했|넣었|완료|했어|done/i.test(input)) return no("삽입을 마쳤으면 '삽입했어' 라고 답해주세요. 중단하려면 '취소'.");
        const scan = await scanSite(a.site_id, a.url, a.paths);
        a.scan = scan;
        if (scan.loaders.count === 0 && !scan.loaders.runtime) {
          return no([
            "확인 실패 — 표본 페이지에서 로더를 찾지 못했습니다.",
            sampleNotice(scan.paths.length),
            "1) 저장 후 실제로 반영됐는지 2) 삽입 위치가 그 페이지에 적용되는 영역인지 확인해주세요.",
            "다시 삽입한 뒤 '삽입했어' 라고 알려주세요.",
          ].join("\n"));
        }
        const v = verdict(scan);
        if (v.code === "C4") return no(v.text);
        a.verified = true;
        return ok("commit", `로더를 확인했습니다 (런타임 v${scan.loaders.version ?? "불명"}).`);
      },
    },

    // REQ-029 — 설정 확정은 1회 승인 대상
    commit: {
      ask: () => "설정을 manifest에 반영하려면 '승인 요청' 이라고 답하세요.",
      run: async (input, a, ctx) => {
        if (!wantsProceed(input)) return no("'승인 요청' 또는 '취소'로 답해주세요.");
        if (!holdsLock(a.site_id, ctx)) return no(`${a.site_id} 연결 락을 잃었습니다. 커밋하지 않습니다 (§24.6). 처음부터 다시 진행해주세요.`);
        const site = {
          site_id: a.site_id, enabled: true, label: a.site_id, url: a.url,
          test_path: a.test_path, common_code: a.common_code,
          slots: a.slots ?? (a.scan?.slots ?? []).map((s: any) => s.name),
          connected_at: new Date().toISOString(),
          last_scan: a.scan?.scanned_at ?? null,
        };
        const ap = request("manifest_commit", `site ${a.site_id}`, {
          kind: "site", site, conversation_key: conversationKey(ctx), files: ["manifest/widgets.yaml"],
          rollback: "manifest/widgets.yaml 에서 해당 site 항목 제거",
        }, ctx.chat_id);
        return ok(null, payloadText(ap));
      },
    },
  },
};

// ─────────────────────── B. 실행 엔진 ───────────────────────

const ENGINES = ["dry_run", "codex_sdk", "claude_agent_sdk"];

/** 인증은 대화로 받지 않는다. 로컬 존재 여부만 본다 (REQ-027). */
function engineAuthCheck(engine: string): string {
  if (engine === "dry_run") return "dry_run: 인증 불필요.";
  const pkg = engine === "codex_sdk" ? "@openai/codex-sdk" : "@anthropic-ai/claude-agent-sdk";
  const installed = existsSync(p("node_modules", ...pkg.split("/")));
  const env = envStatus(engine === "codex_sdk" ? "CODEX_AUTH" : "CLAUDE_AUTH", 1);
  return [
    `패키지 ${pkg}: ${installed ? "설치됨 OK" : "미설치 NG — npm i " + pkg}`,
    `${envStatusText(env)} ${env.present ? "OK" : "NG"}`,
    "해당 CLI에서 로그인한 뒤 '확인'이라고 알려주세요. 값은 보내지 마세요.",
  ].join("\n");
}

const ENGINE: Wizard = {
  type: "engine",
  first: "choose",
  steps: {
    choose: {
      ask: () => [
        `현재: ${yaml<any>("config/agent_registry.yaml").agents[0].runtime_engine}`,
        "어느 엔진을 쓸까요? 하나만 고르세요.",
        "  dry_run (기본, LLM 미연결) / codex_sdk / claude_agent_sdk",
        "두 개를 동시에 켜는 것은 거부됩니다 (update 단일 소유자 원칙).",
      ].join("\n"),
      run: async (input, a) => {
        const named = ENGINES.filter((e) => input.includes(e));
        if (named.length > 1) return no("두 엔진 동시 활성화는 거부합니다. 같은 봇 업데이트에 두 소유자를 붙일 수 없습니다. 하나만 고르세요.");
        if (!named.length) return no("dry_run / codex_sdk / claude_agent_sdk 중 하나로 답해주세요.");
        a.engine = named[0];
        return ok("auth", engineAuthCheck(named[0]!));
      },
    },
    auth: {
      ask: (a) => `${a.engine} 준비가 끝났으면 '확인', 다시 점검만 하려면 '점검'.`,
      run: async (input, a, ctx) => {
        if (/점검|재확인/.test(input)) return no(engineAuthCheck(a.engine));
        if (!/확인|ok|완료/i.test(input)) return no("'확인' 또는 '점검' 으로 답해주세요.");
        const ap = request("engine_switch", `runtime_engine → ${a.engine}`, {
          kind: "engine", engine: a.engine, files: ["config/agent_registry.yaml"],
          rollback: "config/agent_registry.yaml 의 runtime_engine 을 이전 값으로 되돌림",
        }, ctx.chat_id);
        return ok(null, payloadText(ap));
      },
    },
  },
};

// ─────────────────────── C. GitHub·CDN ───────────────────────

const GITHUB: Wizard = {
  type: "github",
  first: "repo",
  steps: {
    repo: {
      ask: () => "GitHub 저장소를 owner/repo 형식으로 알려주세요. (jsDelivr는 public 저장소가 필요합니다)",
      run: async (input, a) => {
        const v = input.trim();
        if (!/^[\w.-]+\/[\w.-]+$/.test(v)) return no("owner/repo 형식이어야 합니다. 다시 입력해주세요.");
        const [owner, repo] = v.split("/");
        let status = 0, isPrivate = true;
        try {
          const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { cache: "no-store" });
          status = r.status;
          isPrivate = ((await r.json()) as any)?.private !== false;
        } catch { status = 0; }
        if (status === 404) return no("그 저장소를 찾을 수 없습니다. 이름을 확인해 다시 입력해주세요.");
        if (status !== 200 || isPrivate) {
          return no([
            "public으로 확인되지 않았습니다. jsDelivr는 public 저장소만 서빙합니다 — 여기서 중단합니다.",
            "OPEN-REG-01(registry 호스팅)로 등록해 두세요. public 전환 또는 Cloudflare Pages 대안을 정한 뒤 다시 시도하세요.",
          ].join("\n"));
        }
        a.owner = owner; a.repo = repo;
        return ok("remote");
      },
    },
    remote: {
      ask: (a) => {
        let remote = "";
        try { remote = execFileSync("git", ["remote", "-v"], { cwd: p(), encoding: "utf8" }).trim(); } catch { remote = ""; }
        if (remote) return `git remote 설정됨:\n${remote}\n계속하려면 '승인 요청'.`;
        return [
          "git remote가 없습니다. 아래를 **직접** 실행하세요 (에이전트가 대신 실행하지 않습니다).",
          `  git remote add origin https://github.com/${a.owner}/${a.repo}.git`,
          "  git branch -M main",
          "끝났으면 '승인 요청'.",
        ].join("\n");
      },
      run: async (input, a, ctx) => {
        if (!wantsProceed(input)) return no("'승인 요청' 또는 '취소'로 답해주세요.");
        const ap = request("manifest_commit", `cdn ${a.owner}/${a.repo}`, {
          kind: "cdn", owner: a.owner, repo: a.repo, files: ["manifest/widgets.yaml"],
          rollback: "manifest/widgets.yaml 의 cdn.owner/repo 를 이전 값으로 되돌림",
        }, ctx.chat_id);
        return ok(null, payloadText(ap));
      },
    },
  },
};

// ─────────────────────── D. 텔레그램 재설정 ───────────────────────

const TELEGRAM: Wizard = {
  type: "telegram",
  first: "check",
  steps: {
    check: {
      ask: (_a, ctx) => [
        envStatusText(envStatus("IMWEB_WIDGET_BOT_TOKEN", 40, 60)),
        `이 대화의 chat_id: ${ctx.chat_id}`,
        "값은 보내지 마세요. 환경변수 설정 여부만 봅니다.",
        "이 chat_id를 허용 목록에 넣으려면 '승인 요청', 그만두려면 '취소'.",
      ].join("\n"),
      run: async (input, _a, ctx) => {
        if (!wantsProceed(input)) return no("'승인 요청' 또는 '취소'로 답해주세요.");
        const ap = request("config_commit", `allowed_chats + ${ctx.chat_id}`, {
          kind: "allowed_chat", chat_id: ctx.chat_id, files: ["config/allowed_chats.yaml"],
          rollback: "config/allowed_chats.yaml 에서 해당 항목 제거",
        }, ctx.chat_id);
        return ok(null, payloadText(ap));
      },
    },
  },
};

export const WIZARDS: Record<string, Wizard> = {
  menu: MENU, A: SITE, B: ENGINE, C: GITHUB, D: TELEGRAM,
  site: SITE, engine: ENGINE, github: GITHUB, telegram: TELEGRAM,
};

// ─────────────────────── 승인 실행부 ───────────────────────

/** 승인된 설정 변경만 여기서 파일에 반영된다. 부분 완료 상태로는 절대 커밋하지 않는다 (INV-9). */
export function applyApproved(action: string, payload: any): string {
  if (action === "manifest_commit" && payload.kind === "site") {
    const m = manifest();
    const i = m.sites.findIndex((s) => s.site_id === payload.site.site_id);
    if (i >= 0) m.sites[i] = { ...m.sites[i], ...payload.site };
    else m.sites.push(payload.site);
    writeFileSync(p("manifest", "widgets.yaml"), stringify(m));
    db.prepare("DELETE FROM connect_locks WHERE site_id = ?").run(payload.site.site_id);
    return `manifest에 site ${payload.site.site_id} 반영 완료.`;
  }
  if (action === "manifest_commit" && payload.kind === "cdn") {
    const m = manifest();
    m.cdn.owner = payload.owner; m.cdn.repo = payload.repo;
    writeFileSync(p("manifest", "widgets.yaml"), stringify(m));
    return `manifest cdn을 ${payload.owner}/${payload.repo} 로 반영 완료. 다음: npm run build`;
  }
  if (action === "manifest_commit" && payload.kind === "widget") {
    const m = manifest();
    if (!m.widgets.some((w) => w.widget_id === payload.widget.widget_id)) m.widgets.push(payload.widget);
    writeFileSync(p("manifest", "widgets.yaml"), stringify(m));
    return `manifest에 위젯 ${payload.widget.widget_id} 등록 완료 (enabled:false). 다음: npm run build 후 배포 승인.`;
  }
  if (action === "engine_switch") {
    const reg = yaml<any>("config/agent_registry.yaml");
    const before = reg.agents[0].runtime_engine;
    reg.agents[0].runtime_engine = payload.engine;
    writeFileSync(p("config", "agent_registry.yaml"), stringify(reg));
    return `runtime_engine ${before} → ${payload.engine} 반영 완료. 봇을 재시작하세요.`;
  }
  if (action === "config_commit" && payload.kind === "allowed_chat") {
    const cfg = yaml<any>("config/allowed_chats.yaml");
    cfg.allowed = (cfg.allowed ?? []).filter((c: any) => c.chat_id !== 0 && c.chat_id !== payload.chat_id);
    cfg.allowed.push({ chat_id: payload.chat_id, user_id: 0, label: "owner" });
    writeFileSync(p("config", "allowed_chats.yaml"), stringify(cfg));
    return `allowed_chats에 ${payload.chat_id} 반영 완료.`;
  }
  if (action === "loader_replace") {
    return [
      `로더 교체 승인됨 (${payload.from ?? "불명"} → ${payload.to}).`,
      "에이전트는 아임웹에 쓰지 않습니다. 교체 전 원문 스냅샷을 보관한 뒤 사람이 직접 교체하세요.",
      "교체 후 '삽입했어' 로 알려주시면 렌더해서 확인합니다.",
    ].join("\n");
  }
  return `승인 실행 경로 없음 (${action})`;
}
