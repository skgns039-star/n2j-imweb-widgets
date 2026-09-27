/* ENG-009 Routing + ENG-045 인텐트 경계 (§24.8).
   승인·무결성·킬스위치·비밀값 판정은 LLM을 거치지 않는다 — 결정적으로 처리해야 하기 때문이다. */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { p, manifest, json, gateBlock } from "../release/paths.ts";
import { request, decide, load, latestPending, payloadText } from "../release/approval.ts";
import { looksSecret, SECRET_REFUSAL } from "../release/secrets.ts";
import { deploy, publishRegistry, deploymentPayload } from "../release/deploy.ts";
import { rollback, rollbackPayload } from "../release/rollback.ts";
import { verify } from "../release/verify.ts";
import { writeRegistry } from "../release/registry.ts";
import { summarize } from "../release/report.ts";
import type { Ctx } from "./threads.ts";
import { inbox, receipt } from "./inbox.ts";
import {
  WIZARDS, loadState, saveState, clearState, cancel, expire, type State, type Wizard, applyApproved,
} from "./onboarding.ts";
import { MIGRATE, requestOriginalRemoval } from "./migrate.ts";
import { decide as seoDecide, start as seoStart, SEO_WIZARD, AMBIGUOUS_REPLY } from "../seo/route.ts";
import type { IntegrityRecord } from "../release/build.ts";
import { runWidgetChange } from "../widget_pipeline/index.ts";
import type { Generator } from "../widget_pipeline/generate.ts";

const ALL_WIZARDS: Record<string, Wizard> = { ...WIZARDS, migrate: MIGRATE, seo: SEO_WIZARD };

export type Intent =
  | "approve" | "reject" | "kill" | "resume" | "inspect" | "install"
  | "deploy" | "rollback" | "connect" | "migrate" | "remove_original" | "seo" | "agent" | "unclear"
  | "widget_edit" | "widget_new";

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

/** 부정·유보 표현. "전체 중지 안 해도 돼" 가 킬 스위치를 당기면 안 된다. */
export const negated = (t: string) =>
  /(안\s*해도|안\s*할|하지\s*마|필요\s*없|말고|아닌|아니야|아니다|아니고|나중에|보류)/.test(t);

/** DESIGN-WRITE가 닫힌 경우 화면 본문 수정 지시를 접수 전에 차단한다.
 *  SEO 필드의 언급만으로 함께 요청한 본문 수정까지 허용하지 않는다. */
export function protectedEdit(t: string): string | null {
  // 매니페스트가 정본이다. DESIGN-WRITE 가 열려 있으면 막지 않는다 —
  // 2026-08-31 사용자 결정으로 INV-11 은 폐기됐다 (overrides 참조).
  if (!gateBlock("design_mode_write")) return null;

  const target = /(본문|텍스트|이미지|사진|레이아웃|섹션|배치|메뉴명|메뉴 이름|상품명|폰트|색상)/.test(t.replace(/대체 텍스트/g, ""));
  const verb = /(고쳐|수정|바꿔|변경|교체|지워|삭제|넣어|옮겨)/.test(t);
  if (!target || !verb) return null;
  return [
    "디자인모드의 본문·이미지·레이아웃·메뉴명·상품명은 **읽기 전용**입니다 (DESIGN-WRITE 게이트).",
    "화면에 보이는 글자는 불가침이고, 검색엔진만 보는 값(페이지 제목·설명·ALT)만 승인 후 다룹니다.",
    "",
    "개선안이 필요하시면 진단 보고서에 '권장(미적용)' 으로 남겨드립니다.",
  ].join("\n");
}

/** SEO 를 언급한 문장이 **진단 시작**인지 **작업 지시**인지 가른다.
 *  시작어(시작·진단·점검·현황)가 있으면 위저드, 없이 시키는 말투면 작업 큐로 보낸다. */
export const seoWorkOrder = (t: string) =>
  !/시작|진단|점검|현황|상태|목록/.test(t) &&
  /(채워|고쳐|수정|넣어|바꿔|적용|반영|올려|진행)\s*(줘|주세요|해|해줘|해주세요|라)?/.test(t);

export function classify(text: string): { intent: Intent; arg?: string } {
  const t = text.trim();
  const ap = t.match(/\b(AP-[0-9a-f]{8})\b/i)?.[1];

  // 한국어 뒤에는 \b가 성립하지 않는다 — 경계 대신 문자열 시작을 본다.
  if (/^\s*(승인|approve\b)/i.test(t)) return { intent: "approve", arg: ap };
  if (/^\s*(거절|취소|reject\b)/i.test(t)) return { intent: "reject", arg: ap };
  // 사고 대응은 즉시여야 한다 — 엔진 응답 2분을 기다릴 수 없다. 단, 부정문에는 걸리지 않는다.
  if (/전체\s*중지|전부\s*중지|모두\s*중지|킬\s*스위치|kill\s*switch/i.test(t) && !negated(t)) return { intent: "kill" };

  // 단계형 흐름 진입 — 엔진이 위저드를 대신 돌 수 없어서 여기서 잡는다.
  if (/이관/.test(t) && !negated(t)) return { intent: "migrate" };

  // §24.8 — 알려진 애매 조합(흐름 진입어 + 기존 엔티티)은 임의 분기하지 않고 한 번 되묻는다.
  // 이건 엔진에 맡기지 않는다. 규칙으로 강제해야 매번 같은 판정이 나온다.
  const seo = seoDecide(t);
  if (seo === "ambiguous") return { intent: "unclear" };
  // SEO 를 언급했어도 **진단 시작이 아니라 작업 지시**면 위저드로 끌고 가지 않는다.
  // "세화 메뉴 SEO 나머지 채워줘" 같은 말이 진단 위저드에 빨려들면 사람이 답답해진다.
  if (seo === "seo" && !negated(t) && !seoWorkOrder(t)) return { intent: "seo" };
  // 2026-09-28: 코드 위젯 수정·신규 생성은 자동 파이프라인으로 바로 간다(관문·승인은 파이프라인이 강제).
  // 배포·롤백·켜기/끄기·조회는 여기로 오지 않는다 — 코드를 바꾸는 요청만.
  const widget = widgetIntent(t);
  if (widget) return widget;
  if (mentionsConnect(t) && !negated(t)) {
    return mentionsEntity(t) ? { intent: "unclear" } : { intent: "connect" };
  }

  // 그 밖의 자연어는 작업 큐로 접수한다. 실제 실행은 터미널에서 승인·게이트를 확인한다.
  return { intent: "agent" };
}

const NON_CODE_WORDS = /배포|롤백|되돌려|켜\s*줘|꺼\s*줘|켜기|끄기|중지|활성화|비활성화|상태|조회|목록|알려|보여|어때|했어|됐어|확인해/;
const EDIT_WORDS = /수정|바꿔|바꾸|변경|고쳐|고치|교체|추가해|넣어|빼|삭제해|키워|줄여|늘려|색을|색상|문구|글자/;
const NEW_WORDS = /(새|신규|새로운)\s*(코드\s*)?위젯|위젯[^\n]{0,24}(만들어|생성|추가해|제작)|(만들어|생성해|제작해)[^\n]{0,16}위젯/;

/** 코드를 바꾸는 위젯 요청만 잡는다. 대상이 불분명하면 arg 없이 돌려 handle 에서 한 번 묻는다. */
export function widgetIntent(t: string): { intent: Intent; arg?: string } | null {
  if (negated(t) || NON_CODE_WORDS.test(t)) return null;
  const ids = manifest().widgets.map((w) => w.widget_id);
  if (NEW_WORDS.test(t)) {
    const id = t.match(/\b[a-z][a-z0-9-]{2,39}\b/g)?.find((x) => !ids.includes(x));
    return { intent: "widget_new", arg: id };
  }
  const named = ids.find((id) => t.includes(id));
  if ((named || /위젯/.test(t)) && EDIT_WORDS.test(t)) return { intent: "widget_edit", arg: named };
  return null;
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
async function setKill(on: boolean, signal?: AbortSignal): Promise<string> {
  if (on) writeFileSync(p("config", "kill_switch"), new Date().toISOString());
  else if (existsSync(p("config", "kill_switch"))) unlinkSync(p("config", "kill_switch"));
  const reg = writeRegistry();
  const done = await publishRegistry(reg.updated_at, undefined, undefined, signal);
  return done
    ? `전역 ${on ? "정지" : "재개"} 반영 완료 (global_enabled=${!on}). 새로 열거나 새로고침한 페이지에 적용됩니다.`
    : "registry는 갱신했으나 CDN 반영 미확인 — BLOCKED. 수동 확인이 필요합니다.";
}

async function runApproved(id: string, signal?: AbortSignal): Promise<string> {
  const a = load(id);
  if (!a) return `승인 ${id}: 기록 없음`;
  const w = String((a.payload as any).widget_id ?? "");
  if (a.action === "cdn_deploy") return summarize(await deploy(w, id, signal));
  if (a.action === "rollback") return summarize(await rollback(w, String((a.payload as any).to ?? "off"), id, signal));
  if (["manifest_commit", "engine_switch", "config_commit", "loader_replace"].includes(a.action)) return applyApproved(a.action, a.payload, id);
  return `승인 ${id} 기록 완료. 대상 실행은 터미널에서 15분 이내에 이 승인 ID로 진행하세요. 아직 실행하지 않았습니다.`;
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
    "작업 목록 — 이 대화에서 접수한 요청의 상태",
    "그 밖의 지시와 질문은 접수 후 터미널에서 이어받아 처리합니다.",
  ].join("\n");
}

// ─────────────────────── 진입점 ───────────────────────

export async function handle(text: string, ctx: Ctx, queue = inbox, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
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
  // 위저드가 15분 만료된 뒤 도착한 선택지 답변("b", "예")은 불명확이 아니라 만료다
  const one = text.trim();
  if (!st && (one.length === 1 && "abcdABCD".includes(one) || one === "예" || one === "아니오")) {
    return "진행 중이던 연결이 만료됐습니다 (15분 무응답). '연결'로 다시 시작하세요.";
  }
  const { intent, arg } = classify(text);
  if (intent === "kill") return await setKill(true, signal);   // 사고 대응은 위저드보다 우선

  if (intent === "connect") { if (st) cancel(ctx); return startWizard("menu", ctx); }
  if (intent === "migrate") { if (st) cancel(ctx); return startWizard("migrate", ctx); }
  if (st) return await stepWizard(text, st, ctx);                          // 위저드 진행 중에는 입력을 위저드로

  switch (intent) {
    case "approve": {
      const target = arg ?? latestPending(ctx.chat_id)?.id;
      if (!target) return "대기 중인 승인이 없습니다. 승인 ID를 확인해주세요.";
      const a = decide(target, "APPROVED", ctx.chat_id);
      if (!a) return `승인 ${target}: 기록 없음`;
      if (a.status !== "APPROVED") return `승인 ${target}: 상태 ${a.status} — 재요청이 필요합니다.`;
      return await runApproved(target, signal);
    }
    case "reject": {
      const target = arg ?? latestPending(ctx.chat_id)?.id;
      if (!target) return "대기 중인 승인이 없습니다.";
      decide(target, "REJECTED", ctx.chat_id);
      return `승인 ${target} 거절 처리. 아무것도 실행하지 않았습니다.`;
    }
    case "resume": {
      const a = request("cdn_deploy", "registry(global_enabled=true)", { widget_id: "", site: "전체", rollback: "다시 '전체 중지'" }, ctx.chat_id);
      return "재개는 승인 대상입니다 (정지는 승인 없이, 재개는 승인 필요).\n" + payloadText(a);
    }
    case "seo": {
      // 상태를 시작한다 — 이후 답변은 위저드 단계로 들어간다. 상태가 없으면 같은 질문이 반복된다.
      const started = await seoStart(text, ctx);
      if (typeof started === "string") return started;
      saveState(ctx, { wizard_type: "seo", step: SEO_WIZARD.first, answers: started.answers });
      return started.intro;
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
        ...deploymentPayload(w), widget_id: w, files: rec.files.map((f) => f.name), sha256: rec.files[0]?.dist_sha256 ?? "",
        site: manifest().widgets.find((x) => x.widget_id === w)?.site, rollback: `npm run rollback -- ${w} off`,
      }, ctx.chat_id);
      return payloadText(a);
    }
    case "rollback": {
      const w = widgetFromText(text);
      if (!w) return "어느 위젯을 되돌리나요?";
      const to = text.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "off";
      const a = request("rollback", `${w} -> ${to}`, {
        ...rollbackPayload(w, to), widget_id: w, to, site: manifest().widgets.find((x) => x.widget_id === w)?.site, rollback: "다시 배포",
      }, ctx.chat_id);
      return payloadText(a);
    }
    case "widget_edit":
    case "widget_new": {
      const mode = intent === "widget_new" ? "new" : "edit";
      const internal = (id: string) => { try { return JSON.parse(readFileSync(p("src", "widgets", id, "widget.json"), "utf8")).internal === true; } catch { return false; } };
      const editable = manifest().widgets.map((w) => w.widget_id).filter((id) => !internal(id));
      const id = arg ?? (mode === "edit" && editable.length === 1 ? editable[0] : undefined);
      if (!id) {
        return mode === "new"
          ? "새 위젯 ID를 영문으로 정해 주세요. 예: '새 위젯 promo-banner 만들어줘: 할인 안내 문구와 버튼'"
          : `어느 위젯인가요? 수정 가능한 위젯: ${editable.join(", ") || "없음"}`;
      }
      const r = await runWidgetChange({ mode, widget_id: id, request: text, chat_id: ctx.chat_id }, { generator: widgetGenerator, signal });
      return r.report;
    }
    case "agent": {
      const { add, listText } = queue;
      // 작업 목록 조회는 즉답한다. 큐에 쌓을 일이 아니다.
      if (/^\s*(?:내\s*)?(?:작업\s*(?:목록|현황|상태)|대기\s*작업|inbox)(?:\s*(?:보여줘|보여주세요|알려줘|알려주세요|조회))?[?？.!]?\s*$/i.test(text)) return listText(ctx);

      // 문장 끝의 물음표는 실행 권한이 아니다. 자유 입력은 질문도 동일하게 접수한다.
      const blocked = protectedEdit(text);
      if (blocked) return blocked;
      return receipt(add(ctx, text));
    }
    default:
      if (seoDecide(text) === "ambiguous") return AMBIGUOUS_REPLY;
      return mentionsConnect(text) && mentionsEntity(text)
        ? "사이트·엔진 연결 설정을 말씀하시는 건가요, 아니면 위젯을 슬롯에 붙이는 작업인가요? 한 번만 확인하겠습니다."
        : "지시가 불명확합니다. 연결 / 조회 / 수정 / 신규추가 / 배포 / 롤백 / 설치 중 무엇인가요?";
  }
}

export { expire };

/** 테스트가 LLM 대신 각본 생성기를 끼운다. 운영에서는 undefined → Claude 생성기. */
let widgetGenerator: Generator | undefined;
export function setWidgetGenerator(g: Generator | undefined) { widgetGenerator = g; }
