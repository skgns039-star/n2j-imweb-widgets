/* ENG-017 Channel Router 하부. update 단일 소유자 계약을 여기서 강제한다. */
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { p, yaml } from "../release/paths.ts";

const TOKEN = process.env.IMWEB_WIDGET_BOT_TOKEN ?? "";
const api = (m: string) => `https://api.telegram.org/bot${TOKEN}/${m}`;

export type Update = {
  update_id: number;
  message?: { chat: { id: number }; from?: { id: number }; message_thread_id?: number; text?: string };
};

function mask(s: string) {
  return TOKEN ? s.split(TOKEN).join("<TOKEN>") : s;
}

export async function call<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(api(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j: any = await r.json();
  if (!j.ok) throw new Error(mask(`telegram ${method} 실패: ${j.description}`));
  return j.result as T;
}

export const send = (chat_id: number, text: string, topic_id?: number) =>
  call("sendMessage", { chat_id, text, ...(topic_id ? { message_thread_id: topic_id } : {}) });

export const getUpdates = (offset: number) =>
  call<Update[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });

/** PTEST-012. webhook이 걸려 있으면 polling을 기동하지 않는다. 동시 consumer 금지. */
export async function assertSingleOwner() {
  if (!TOKEN) throw new Error("IMWEB_WIDGET_BOT_TOKEN 미설정 — 기동 거부");
  const info = await call<{ url: string }>("getWebhookInfo", {});
  if (info.url) throw new Error(`webhook(${info.url})이 설정되어 있다. polling과 동시 사용 금지 — 기동 거부`);
}

type Allow = { allowed: { chat_id: number; user_id?: number; label?: string }[] };

/** REQ-005. 화이트리스트 밖은 무응답 + 거절 로그.
 *  런타임 정본은 환경변수 ALLOWED_CHAT_IDS 다 (REQ-038 계열). yaml 과의 차이는
 *  setup:check 가 보고만 하고 자동 동기화하지 않는다. 환경변수가 비면 아무도 통과하지 못한다. */
export function isAllowed(chat_id: number, user_id?: number): boolean {
  const env = (process.env.ALLOWED_CHAT_IDS ?? "").split(/[,\s]+/).map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n !== 0);
  if (env.length) return env.includes(chat_id);
  const cfg = yaml<Allow>("config/allowed_chats.yaml");
  return (cfg.allowed ?? []).some((a) => a.chat_id === chat_id && (!a.user_id || a.user_id === user_id));
}

export function logReject(chat_id: number, user_id: number | undefined, text: string) {
  const d = p("logs");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), event: "REJECTED", chat_id, user_id, len: text.length });
  appendFileSync(p("logs", "rejected.jsonl"), line + "\n");
}
