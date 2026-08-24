/* REQ-027 / §5 비밀값 취급 — 예외 없음.
   값은 저장·로그·에코 어디에도 남기지 않는다. 존재 여부와 길이 범위만 다룬다. */

export const SECRET_PATTERNS: [string, RegExp][] = [
  ["telegram bot token", /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/],
  ["openai key", /\bsk-[A-Za-z0-9]{20,}/],
  ["anthropic key", /\bsk-ant-[A-Za-z0-9-]{20,}/],
  ["github token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["aws key", /\bAKIA[0-9A-Z]{16}\b/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["password literal", /(password|passwd|비밀번호)\s*[:=]\s*["'][^"']{4,}["']/i],
];

/** 값 자체는 절대 반환하지 않는다. 어떤 종류인지(라벨)만 돌려준다. */
export function looksSecret(text: string): string | null {
  for (const [name, re] of SECRET_PATTERNS) if (re.test(text)) return name;
  return null;
}

/** 이미 노출된 값이므로 재발급 권고를 반드시 포함한다. */
export const SECRET_REFUSAL = [
  "비밀값은 받지 않습니다. 저장하지도, 기록하지도 않았습니다.",
  "방금 보낸 메시지를 삭제하고, 해당 토큰·키를 즉시 재발급하세요. (이미 대화에 노출된 값입니다)",
  "설정은 환경변수로만 합니다. 예: PowerShell에서 $env:IMWEB_WIDGET_BOT_TOKEN = \"...\"",
  "설정한 뒤 '확인'이라고만 답하면 존재 여부만 점검합니다.",
].join("\n");

export type EnvStatus = { name: string; present: boolean; lengthOk: boolean };

/** 값은 어디에도 남기지 않는다. boolean 두 개만 만든다. */
export function envStatus(name: string, min = 20, max = 300): EnvStatus {
  const raw = process.env[name];
  const len = raw ? raw.length : 0;
  return { name, present: len > 0, lengthOk: len >= min && len <= max };
}

export const envStatusText = (s: EnvStatus) =>
  `${s.name}: ${s.present ? (s.lengthOk ? "설정됨 (길이 정상)" : "설정됨 (길이 이상 — 값 확인 필요)") : "미설정"}`;
