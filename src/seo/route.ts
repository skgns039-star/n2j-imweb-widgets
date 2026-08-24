/* SEO 인텐트 경계 판정 + 진입 흐름. §24.8 규칙을 준용한다.
   라우터는 이 파일만 호출한다 — SEO 로직이 src/bot 으로 새지 않게 하기 위함이다. */
import { manifest } from "../release/paths.ts";
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
