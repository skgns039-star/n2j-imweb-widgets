/* ENG-017 Channel Router 하부. update 단일 소유자 계약을 여기서 강제한다. */
import { appendFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { p, yaml } from "../release/paths.ts";

// 2026-09-28 실측: 이 망은 IPv6 경로가 막혀 있다. Node 기본(0.25초)으로는 IPv4 로 넘어가기 전에 fetch 가
// ETIMEDOUT 으로 끝나 텔레그램 API 에 닿지 못했다(GitHub 처럼 IPv4 만 있는 곳은 정상). 1초로 늘리면 연결된다.
setDefaultAutoSelectFamilyAttemptTimeout(1000);

const TOKEN = process.env.IMWEB_WIDGET_BOT_TOKEN ?? "";
const api = (m: string) => `https://api.telegram.org/bot${TOKEN}/${m}`;

export type Attachment = { file_id: string; mime_type?: string; file_name?: string };

export type Message = {
  chat: { id: number }; from?: { id: number }; message_thread_id?: number;
  text?: string;
  /** 사진은 text 가 없다. 설명은 caption 에 온다. */
  caption?: string;
  /** 해상도별 배열. 마지막이 가장 크다. */
  photo?: Attachment[];
  /** "파일로 보내기" 로 올린 스크린샷. 이미지 mime 만 받는다. */
  document?: Attachment;
};

export type Update = { update_id: number; message?: Message };

/** 메시지에서 본문과 이미지 첨부를 뽑는다.
 *  사진 메시지를 text 유무로 거르면 통째로 버려진다 — 그게 이 함수가 있는 이유다. */
export function inbound(msg: Message): { body: string; image: Attachment | null } {
  const body = msg.text ?? msg.caption ?? "";
  const doc = msg.document?.mime_type?.startsWith("image/") ? msg.document : null;
  return { body, image: msg.photo?.at(-1) ?? doc ?? null };
}

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

/** 텔레그램 상한 4096자. 넘으면 나눠 보내고, 빈 응답은 자리표시자로 대체한다 (빈 text 는 API 오류). */
export async function send(chat_id: number, text: string, topic_id?: number) {
  const body = (text ?? "").trim() || "(응답이 비어 있습니다)";
  let last: any;
  for (let i = 0; i < body.length; i += 3900) {
    const part = body.slice(i, i + 3900);
    last = await call("sendMessage", { chat_id, text: part, ...(topic_id ? { message_thread_id: topic_id } : {}) });
  }
  return last;
}

/** 입력 중 표시. 실패해도 본 작업을 막지 않는다. */
export const sendTyping = (chat_id: number) =>
  call("sendChatAction", { chat_id, action: "typing" }).catch(() => null);

export const getUpdates = (offset: number) =>
  call<Update[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });

/** 첨부 이미지를 state/inbox/ 에 내려받고 경로를 돌려준다.
 *  내려받기 URL 에는 봇 토큰이 박혀 있다 — 오류 문구는 반드시 mask() 를 지난다. */
export async function downloadImage(file_id: string): Promise<string> {
  const f = await call<{ file_path: string }>("getFile", { file_id });
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.file_path}`);
  if (!r.ok) throw new Error(mask(`이미지 내려받기 실패: HTTP ${r.status}`));
  const dir = p("state", "inbox");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ext = f.file_path.split(".").pop()?.toLowerCase() || "jpg";
  const out = p("state", "inbox", `${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`);
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return out;
}

/** PTEST-012. webhook이 걸려 있으면 polling을 기동하지 않는다. 동시 consumer 금지. */
export async function assertSingleOwner() {
  if (!TOKEN) throw new Error("IMWEB_WIDGET_BOT_TOKEN 미설정 — 기동 거부");
  const info = await call<{ url: string }>("getWebhookInfo", {});
  if (info.url) throw new Error(`webhook(${info.url})이 설정되어 있다. polling과 동시 사용 금지 — 기동 거부`);
}

/** 봇 켜짐·꺼짐 알림 대상 = 허용된 대화 전부 (환경변수가 정본). */
export function ownerChats(): number[] {
  return [...new Set((process.env.ALLOWED_CHAT_IDS ?? "").split(/[,\s]+/).map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n !== 0))];
}

/** 운영 상태 알림(켜짐·꺼짐·비정상 종료). 실패해도 봇 동작을 막지 않는다. 보낸 대화 수를 돌려준다. */
export async function notifyOwners(text: string): Promise<number> {
  let sent = 0;
  for (const chat_id of ownerChats()) {
    try { await send(chat_id, text); sent++; } catch { /* 알림 실패는 조용히 넘긴다 */ }
  }
  return sent;
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
