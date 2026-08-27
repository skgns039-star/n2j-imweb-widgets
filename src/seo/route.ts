/* SEO 인텐트 경계 판정 + 진입 흐름. §24.8 규칙을 준용한다.
   라우터는 이 파일만 호출한다 — SEO 로직이 src/bot 으로 새지 않게 하기 위함이다. */
import { manifest } from "../release/paths.ts";
import type { Wizard, Answers } from "../bot/onboarding.ts";
import type { Ctx } from "../bot/threads.ts";
import { resolveSiteId, engineStatusText } from "./gates.ts";
import { runDiagnosis, analyticsGateQuestions, rejectIdInChat } from "./index.ts";

/** 진입어. 한국어 조사 때문에 \b 를 쓰지 않고 토큰·포함으로 판정한다 (§24.8 선례). */
export const SEO_WORDS = [
  "seo", "에스이오", "메타", "검색등록", "서치어드바이저", "색인",
  "robots", "llms", "구조화", "json-ld", "jsonld", "ga4", "애널리틱스", "sitemap", "사이트맵",
];

/** 기존 엔티티가 함께 나오면 seo 로 가지 않는다. "위젯 SEO 문구 바꿔줘" → 위젯 라우트 */
export const SEO_CONFLICT_WORDS = [
  "위젯", "widget", "슬롯", "slot", "registry", "레지스트리", "로더", "loader", "배포", "deploy", "롤백", "rollback",
];

export const mentionsSeo = (t: string) => {
  const s = t.toLowerCase();
  return SEO_WORDS.some((w) => s.includes(w));
};

export const mentionsSeoConflict = (t: string) => {
  const s = t.toLowerCase();
  const ids = manifest().widgets.map((w) => w.widget_id.toLowerCase());
  return SEO_CONFLICT_WORDS.some((w) => s.includes(w)) || ids.some((id) => s.includes(id));
};

export type SeoDecision = "seo" | "not-seo" | "ambiguous";

/** 애매하면 임의 분기하지 않는다 (ITEST-004). */
export function decide(text: string): SeoDecision {
  if (!mentionsSeo(text)) return "not-seo";
  return mentionsSeoConflict(text) ? "ambiguous" : "seo";
}

export const AMBIGUOUS_REPLY =
  "SEO 진단을 말씀하시는 건가요, 아니면 위젯 쪽 작업인가요? 한 번만 확인하겠습니다.";

/** "SEO" 진입 시 첫 응답: site_id 확인 → 애널리틱스 사전 질문 → 키워드 요청 → OBSERVE. */
export async function enter(text: string): Promise<string> {
  const idReject = rejectIdInChat(text);
  if (idReject) return idReject;

  const sites = manifest().sites;
  if (!sites.length) return "등록된 사이트가 없습니다. 먼저 '연결'로 사이트를 등록하세요.";

  // 1) site_id 확인 — manifest 가 정본이다 (§18.3)
  const named = sites.find((s) => text.includes(s.site_id));
  const site = named ?? (sites.length === 1 ? sites[0]! : null);
  if (!site) {
    return `어느 사이트인가요? 등록된 site_id: ${sites.map((s) => s.site_id).join(", ")}`;
  }
  const r = resolveSiteId(site.site_id);
  if (!r.ok) return r.msg;
  if (!site.url) return `${site.site_id} 에 url 이 없습니다. '연결' 위저드로 먼저 등록하세요.`;

  // 2) 애널리틱스 자동 감지 → 사전 질문 (감지 없이 묻지 않는다)
  const { collector } = await import("./observe.ts");
  const first = await collector.page(site.url.replace(/\/+$/, ""), site.test_path ?? "/");
  const detected = { ga4: first.analytics.ga4, gtm: first.analytics.gtm };

  // 3) 메타 키워드 요청 + 4) OBSERVE 안내
  return [
    `[SEO] 사이트: ${site.site_id} (${site.url})  모드: OBSERVE`,
    "",
    analyticsGateQuestions(detected),
    "",
    "다음으로 **메타 키워드 1개**를 알려주세요. 나머지는 제가 추론합니다.",
    "",
    "검색엔진 등록 가능 범위:",
    engineStatusText(),
    "",
    "이번 범위는 **진단까지**입니다. 아임웹에 아무것도 쓰지 않습니다 (M1).",
  ].join("\n");
}

export { runDiagnosis };

// ─────────────────────── SEO 위저드 (단계 상태) ───────────────────────
/* 상태가 없으면 답변이 다시 진입어로 분류돼 같은 질문이 무한 반복된다.
   연결 위저드와 같은 상태 기계를 쓴다 — 답변은 단계로 들어가고, 중단·재개가 된다 (REQ-028). */

const CHOICE = /(^|[\s.,)\]])([abcdABCD])([\s.,)\]]|$)/;
const KEYWORD_LINE = /메타\s*키워드\s*[:：]\s*(.+)/;

/** 사용자가 "1. c / 2. 추적불필요 / 3. 메타키워드: ..." 처럼 한 번에 답하는 경우를 받아준다. */
function parseCombined(text: string) {
  const choice = text.match(CHOICE)?.[2]?.toUpperCase() ?? null;
  const kw = text.match(KEYWORD_LINE)?.[1]?.trim() ?? null;
  const ecommerce = /추적\s*(불필요|필요\s*없)/.test(text) ? "B" : /추적\s*필요/.test(text) ? "A" : null;
  return { choice, kw, ecommerce };
}

async function detectAnalytics(site: { url?: string; test_path?: string }) {
  const { collector } = await import("./observe.ts");
  const first = await collector.page((site.url ?? "").replace(/\/+$/, ""), site.test_path ?? "/");
  return { ga4: first.analytics.ga4, gtm: first.analytics.gtm };
}

export const SEO_WIZARD: Wizard = {
  type: "seo",
  first: "analytics",
  steps: {
    analytics: {
      ask: (a: Answers) => a.__intro ?? "애널리틱스 선택(A/B/C/D)을 알려주세요.",
      run: async (text: string, a: Answers) => {
        const c = parseCombined(text);
        if (!c.choice) return { ok: false, msg: "A / B / C / D 중 하나로 답해주세요. (권장은 위 안내 참고)" };
        a.ga_choice = c.choice;
        if (c.ecommerce) a.ecommerce = c.ecommerce;
        const note =
          c.choice === "A" ? "GA4는 검수만 합니다 (설치 안 함)."
          : c.choice === "B" ? "GA4 설치는 승인 대상이며 M2 범위입니다. 이번 진단에서는 설정 위치만 보고합니다."
          : c.choice === "C" ? "GA4 섹션은 이번 작업에서 제외합니다."
          : "감지 결과 재판정이 필요하므로 GA4는 PENDING으로 두고 나머지를 진행합니다.";
        // 키워드까지 함께 줬으면 바로 진단으로 넘어간다
        if (c.kw) { a.keyword = c.kw; return { ok: true, next: "diagnose", msg: `${note}\n메타 키워드: ${c.kw}` }; }
        return { ok: true, next: "keyword", msg: note };
      },
    },
    keyword: {
      ask: () => "메타 키워드 1개를 알려주세요. (예: 조립식 건축) — 나머지는 제가 추론합니다.",
      run: async (text: string, a: Answers) => {
        const reject = rejectIdInChat(text);
        if (reject) return { ok: false, msg: reject };
        const kw = (text.match(KEYWORD_LINE)?.[1] ?? text).trim();
        if (kw.length < 2) return { ok: false, msg: "키워드가 너무 짧습니다. 다시 알려주세요." };
        a.keyword = kw;
        return { ok: true, next: "diagnose", msg: `메타 키워드: ${kw}` };
      },
    },
    diagnose: {
      ask: () => "진단을 시작하려면 '진단' 또는 '시작'이라고 답해주세요. (읽기 전용, 아임웹 쓰기 0건)",
      run: async (text: string, a: Answers) => {
        if (!/진단|시작|go|네|예|응/i.test(text)) {
          return { ok: false, msg: "'진단' 이라고 답하면 시작합니다. 중단하려면 '취소'." };
        }
        const report = await runDiagnosis(a.site_id, a.keyword ?? "");
        const tail = a.ga_choice === "C" ? "\n\n(GA4 섹션은 요청에 따라 제외했습니다.)" : "";
        return { ok: true, next: null, msg: report + tail };
      },
    },
  },
};

/** SEO 진입 — 첫 질문을 만들고 **상태를 시작한다.** 이후 답변은 단계로 들어간다. */
export async function start(text: string, _ctx: Ctx): Promise<{ answers: Answers; intro: string } | string> {
  const idReject = rejectIdInChat(text);
  if (idReject) return idReject;

  const sites = manifest().sites;
  if (!sites.length) return "등록된 사이트가 없습니다. 먼저 '연결'로 사이트를 등록하세요.";
  const named = sites.find((s) => text.includes(s.site_id));
  const site = named ?? (sites.length === 1 ? sites[0]! : null);
  if (!site) return `어느 사이트인가요? 등록된 site_id: ${sites.map((s) => s.site_id).join(", ")}`;
  const r = resolveSiteId(site.site_id);
  if (!r.ok) return r.msg;
  if (!site.url) return `${site.site_id} 에 url 이 없습니다. '연결' 위저드로 먼저 등록하세요.`;

  const detected = await detectAnalytics(site);
  const intro = [
    `[SEO] 사이트: ${site.site_id} (${site.url})  모드: OBSERVE`,
    "",
    analyticsGateQuestions(detected),
    "",
    "답변 예: `C` / `B, 추적 불필요` / `C 메타키워드: 국내 건설 회사 순위` (한 번에 주셔도 됩니다)",
    "",
    "검색엔진 등록 가능 범위:",
    engineStatusText(),
    "",
    "이번 범위는 **진단까지**입니다. 아임웹에 아무것도 쓰지 않습니다 (M1).",
  ].join("\n");

  return { answers: { site_id: site.site_id, __intro: intro }, intro };
}
