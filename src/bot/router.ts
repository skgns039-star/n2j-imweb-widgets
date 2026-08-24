/* ENG-009 Routing + ENG-045 인텐트 경계 (§24.8).
   승인·무결성·킬스위치·비밀값 판정은 LLM을 거치지 않는다 — 결정적으로 처리해야 하기 때문이다. */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { p, manifest, json } from "../release/paths.ts";
import { request, decide, load, latestPending, payloadText } from "../release/approval.ts";
import { looksSecret, SECRET_REFUSAL } from "../release/secrets.ts";
import { deploy, publishRegistry } from "../release/deploy.ts";
import { rollback } from "../release/rollback.ts";
import { verify } from "../release/verify.ts";
import { writeRegistry } from "../release/registry.ts";
import { summarize } from "../release/report.ts";
import { loadEngine, agentConfig, systemPrompt } from "../engine/index.ts";
import { getThread, setThread, type Ctx } from "./threads.ts";
import {
  WIZARDS, loadState, saveState, clearState, cancel, expire, type State, type Wizard, applyApproved,
} from "./onboarding.ts";
import { MIGRATE, requestOriginalRemoval } from "./migrate.ts";
import type { IntegrityRecord } from "../release/build.ts";

const ALL_WIZARDS: Record<string, Wizard> = { ...WIZARDS, migrate: MIGRATE };

export type Intent =
  | "approve" | "reject" | "kill" | "resume" | "inspect" | "install"
  | "deploy" | "rollback" | "connect" | "migrate" | "remove_original" | "agent" | "unclear";

/** §24.8 — "연결"은 다른 문맥에도 나온다. 기존 엔티티가 함께 등장하면 connect로 보내지 않는다.
 *  한국어 조사·어미 때문에 \b 가 오작동한 선례가 있어 토큰·문맥으로 판정한다. */
const CONNECT_WORDS = ["연결", "연동", "붙여줘", "붙여", "setup", "셋업", "connect", "/connect"];
const ENTITY_WORDS = ["위젯", "슬롯", "slot", "registry", "레지스트리", "모듈", "widget"];

export function mentionsConnect(text: string): boolean {
  const t = text.toLowerCase();
  return CONNECT_WORDS.some((w) => t.includes(w.toLowerCase()));
}
export function mentionsEntity(text: string): boolean {
  const t = text.toLowerCase();
  const ids = manifest().widgets.map((w) => w.widget_id.toLowerCase());
  return ENTITY_WORDS.some((w) => t.includes(w)) || ids.some((id) => t.includes(id));
}

export function classify(text: string): { intent: Intent; arg?: string } {
  const t = text.trim();
  const ap = t.match(/\b(AP-[0-9a-f]{8})\b/i)?.[1];

  // 한국어 뒤에는 \b가 성립하지 않는다 — 경계 대신 문자열 시작을 본다.
  if (/^\s*(승인|approve\b)/i.test(t)) return { intent: "approve", arg: ap };
  if (/^\s*(거절|취소|reject\b)/i.test(t)) return { intent: "reject", arg: ap };
  if (/전체\s*중지|전부\s*중지|모두\s*중지|킬\s*스위치|kill\s*switch/i.test(t)) return { intent: "kill" };
  if (/전체\s*재개|재개해|resume/i.test(t)) return { intent: "resume" };
  if (/원본\s*제거|기존\s*코드\s*제거|인라인\s*제거/.test(t)) return { intent: "remove_original" };
  if (/이관/.test(t)) return { intent: "migrate" };

  if (mentionsConnect(t)) {
    // 위젯·슬롯·registry 가 함께 나오면 connect가 아니다. 애매하면 되묻는다.
    if (!mentionsEntity(t)) return { intent: "connect" };
    return { intent: "unclear" };
  }

  if (/되돌려|롤백|rollback|이전\s*버전/i.test(t)) return { intent: "rollback" };
  if (/배포|deploy|반영해/i.test(t)) return { intent: "deploy" };
  if (/설치|로더|스니펫|install|loader/i.test(t)) return { intent: "install" };
  if (/상태|조회|확인해|목록|해시|integrity|status/i.test(t)) return { intent: "inspect" };
  if (/바꿔|수정|고쳐|추가|만들어|변경/.test(t)) return { intent: "agent" };
  return { intent: "unclear" };
}

const widgetFromText = (t: string): string | null => {
  const ids = manifest().widgets.map((w) => w.widget_id);
  return ids.find((id) => t.includes(id)) ?? (ids.length === 1 ? ids[0]! : null);
};

function inspect(): string {
  const m = manifest();
  const lines = m.widgets.map((w) => {
    const rec = existsSync(p(`integrity/${w.widget_id}.json`)) ? json<IntegrityRecord>(`integrity/${w.widget_id}.json`) : null;
    return `${w.widget_id}@${w.version} enabled=${w.enabled} mount=${w.mount.type} hash=${rec?.files[0]?.dist_sha256?.slice(0, 12) ?? "-"}`;
  });
  return [
    `사이트: ${m.sites.map((s) => `${s.site_id}(${s.enabled ? "on" : "off"})`).join(", ")}`,
    `전역 킬스위치: ${existsSync(p("config", "kill_switch")) ? "정지 중" : "정상"}`,
    ...lines,
  ].join("\n");
}

/** REQ-022. 정지는 승인 없이 즉시. 재개는 승인 대상이다 (§22.1). */
async function setKill(on: boolean): Promise<string> {
  if (on) writeFileSync(p("config", "kill_switch"), new Date().toISOString());
  else if (existsSync(p("config", "kill_switch"))) unlinkSync(p("config", "kill_switch"));
  const reg = writeRegistry();
  const done = await publishRegistry(reg.updated_at);
  return done
    ? `전역 ${on ? "정지" : "재개"} 반영 완료 (global_enabled=${!on}). 60초 내 전 사이트 적용.`
    : "registry는 갱신했으나 CDN 반영 미확인 — BLOCKED. 수동 확인이 필요합니다.";
}

async function runApproved(id: string): Promise<string> {
  const a = load(id);
  if (!a) return `승인 ${id}: 기록 없음`;
  const w = String((a.payload as any).widget_id ?? "");
  if (a.action === "cdn_deploy") return summarize(await deploy(w, id));
  if (a.action === "rollback") return summarize(await rollback(w, String((a.payload as any).to ?? "off"), id));
  return applyApproved(a.action, a.payload);
}

// ─────────────────────── 위저드 구동 ───────────────────────

const askOf = (st: State, ctx: Ctx) => ALL_WIZARDS[st.wizard_type]!.steps[st.step]!.ask(st.answers, ctx);

function startWizard(type: string, ctx: Ctx, answers: Record<string, any> = {}): string {
  const w = ALL_WIZARDS[type]!;
  const st: State = { wizard_type: type, step: w.first, answers };
  saveState(ctx, st);
  return askOf(st, ctx);
}

async function stepWizard(text: string, st: State, ctx: Ctx): Promise<string> {
  const w = ALL_WIZARDS[st.wizard_type];
  if (!w) { clearState(ctx); return "진행 중이던 위저드를 찾지 못해 종료했습니다. 다시 '연결'이라고 말씀해주세요."; }
  const step = w.steps[st.step]!;
  const res = await step.run(text, st.answers, ctx);

  if (!res.ok) { saveState(ctx, st); return res.msg; }              // 통과 못하면 다음 단계로 넘어가지 않는다

  // 메뉴에서 분기 지시가 나오면 해당 위저드로 갈아탄다
  if (res.msg?.startsWith("__START__")) {
    const branch = res.msg.slice("__START__".length);
    return startWizard(branch, ctx, { ownership: st.answers.ownership });
  }
  // 정상 완료는 상태·락만 해제한다. 방금 만든 승인 페이로드까지 무효화하면 안 된다 (§24.7).
  if (res.next === null) { clearState(ctx); return res.msg ?? "완료했습니다."; }

  const nextState: State = { ...st, step: res.next };
  saveState(ctx, nextState);
  return [res.msg, askOf(nextState, ctx)].filter(Boolean).join("\n\n");
}

function greeting(): string {
  return [
    "아임웹 위젯 릴리스 에이전트입니다. 준비됐습니다.",
    "",
    "· 연결   — 사이트·엔진·GitHub 연결 위저드",
    "· 상태   — 위젯 목록과 해시 무결성",
    "· 설치   — 아임웹에 넣을 로더 스니펫",
    "· 배포 / 되돌려 — 승인을 거쳐 실행",
    "· 전체 중지 — 모든 위젯 즉시 정지 (승인 불필요)",
    "",
    "그 밖의 지시는 자연어로 말씀하시면 됩니다.",
  ].join("\n");
}

// ─────────────────────── 진입점 ───────────────────────

export async function handle(text: string, ctx: Ctx): Promise<string> {
  // REQ-027 — 무엇보다 먼저. 값을 저장·로그·에코하지 않는다.
  if (looksSecret(text)) return SECRET_REFUSAL;

  // REQ-037 / PTEST-043. 에이전트는 .env 를 읽지도 쓰지도 않는다.
  if (/\.env\b|환경\s*변수/.test(text) && /넣어|설정해|써줘|추가해|수정해|만들어|채워/.test(text)) {
    return [
      ".env 는 제가 읽지도 쓰지도 않습니다. 값 주입은 사람만 합니다 (REQ-037).",
      "1) .env.example 을 .env 로 복사  2) 사람이 직접 값 입력  3) 'npm run setup:check' 로 확인",
      "저에게 값을 보내지 마세요. 저는 존재 여부와 형식만 점검합니다.",
    ].join("\n");
  }

  if (/^\s*\/(start|help)\b/.test(text)) return greeting();

  const st = loadState(ctx);

  if (/^\s*취소/.test(text)) {
    if (!st) return "진행 중인 연결이 없습니다.";
    const n = cancel(ctx);
    return `연결을 취소했습니다. 락을 풀고 대기 중이던 승인 ${n}건을 무효화했습니다. 아무것도 커밋하지 않았습니다.`;
  }
  if (/^\s*이어서/.test(text)) {
    if (!st) return "이어서 진행할 연결이 없습니다. 15분이 지나 만료됐을 수 있습니다. '연결'로 다시 시작하세요.";
    return askOf(st, ctx);
  }
  if (/전체\s*중지|킬\s*스위치/.test(text)) return await setKill(true);   // 사고 대응은 위저드보다 우선

  const { intent, arg } = classify(text);

  if (intent === "connect") { if (st) cancel(ctx); return startWizard("menu", ctx); }
  if (intent === "migrate") { if (st) cancel(ctx); return startWizard("migrate", ctx); }
  if (st) return await stepWizard(text, st, ctx);                          // 위저드 진행 중에는 입력을 위저드로

  switch (intent) {
    case "approve": {
      const target = arg ?? latestPending(ctx.chat_id)?.id;
      if (!target) return "대기 중인 승인이 없습니다. 승인 ID를 확인해주세요.";
      const a = decide(target, "APPROVED");
      if (!a) return `승인 ${target}: 기록 없음`;
      if (a.status !== "APPROVED") return `승인 ${target}: 상태 ${a.status} — 재요청이 필요합니다.`;
      return await runApproved(target);
    }
    case "reject": {
      const target = arg ?? latestPending(ctx.chat_id)?.id;
      if (!target) return "대기 중인 승인이 없습니다.";
      decide(target, "REJECTED");
      return `승인 ${target} 거절 처리. 아무것도 실행하지 않았습니다.`;
    }
    case "resume": {
      const a = request("cdn_deploy", "registry(global_enabled=true)", { widget_id: "", site: "전체", rollback: "다시 '전체 중지'" }, ctx.chat_id);
      return "재개는 승인 대상입니다 (정지는 승인 없이, 재개는 승인 필요).\n" + payloadText(a);
    }
    case "remove_original": {
      const w = widgetFromText(text);
      if (!w) return "어느 위젯의 원본을 제거하나요? widget_id를 함께 알려주세요.";
      return requestOriginalRemoval(w, ctx);
    }
    case "inspect": {
      const pts = await verify({ cdn: false });
      return inspect() + `\n로컬 무결성: ${pts.filter((x) => x.ok).length}/${pts.length} 일치`;
    }
    case "install":
      return readFileSync(p("loader", "LOADER_SNIPPET.md"), "utf8").slice(0, 3500);
    case "deploy": {
      const w = widgetFromText(text);
      if (!w) return "어느 위젯인가요? manifest/widgets.yaml 의 widget_id로 다시 말씀해주세요.";
      const rec = existsSync(p(`integrity/${w}.json`)) ? json<IntegrityRecord>(`integrity/${w}.json`) : null;
      if (!rec) return `${w}: 빌드 기록이 없습니다. npm run build 먼저.`;
      const a = request("cdn_deploy", `${w}@${rec.version}`, {
        widget_id: w, files: rec.files.map((f) => f.name), sha256: rec.files[0]?.dist_sha256 ?? "",
        site: manifest().widgets.find((x) => x.widget_id === w)?.site, rollback: `npm run rollback -- ${w} off`,
      }, ctx.chat_id);
      return payloadText(a);
    }
    case "rollback": {
      const w = widgetFromText(text);
      if (!w) return "어느 위젯을 되돌리나요?";
      const to = text.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "off";
      const a = request("rollback", `${w} -> ${to}`, {
        widget_id: w, to, site: manifest().widgets.find((x) => x.widget_id === w)?.site, rollback: "다시 배포",
      }, ctx.chat_id);
      return payloadText(a);
    }
    case "agent": {
      const cfg = agentConfig(ctx.agent_id);
      const engine = await loadEngine(ctx.agent_id);
      const t = getThread(ctx);
      const res = await engine.run(text, { threadId: t.thread_id, workspace: cfg.workspace, systemPrompt: systemPrompt(ctx.agent_id) });
      if (res.threadId) setThread(ctx, res.threadId, engine.id);
      return res.text;
    }
    default:
      return mentionsConnect(text) && mentionsEntity(text)
        ? "사이트·엔진 연결 설정을 말씀하시는 건가요, 아니면 위젯을 슬롯에 붙이는 작업인가요? 한 번만 확인하겠습니다."
        : "지시가 불명확합니다. 연결 / 조회 / 수정 / 신규추가 / 배포 / 롤백 / 설치 중 무엇인가요?";
  }
}

export { expire };
