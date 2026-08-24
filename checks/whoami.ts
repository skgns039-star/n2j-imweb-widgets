/* chat_id 부트스트랩 도우미 (REQ-036 보조).
   봇을 띄우려면 ALLOWED_CHAT_IDS 가 필요한데 chat_id 는 봇에 말을 걸어야 알 수 있다 — 그 순환을 끊는다.
   **토큰도 메시지 본문도 출력하지 않는다.** chat_id·user_id 만 낸다 (절대규칙 9). */
import { envStatus } from "../src/release/secrets.ts";

export type Update = {
  update_id: number;
  message?: { chat: { id: number; type?: string; title?: string }; from?: { id: number }; text?: string };
};

/** 본문은 길이만 센다. 어떤 경우에도 텍스트를 그대로 내보내지 않는다. */
export function summarize(updates: Update[]): string {
  const seen = new Map<number, { user?: number; type?: string; count: number }>();
  for (const u of updates) {
    const m = u.message;
    if (!m) continue;
    const row = seen.get(m.chat.id) ?? { user: m.from?.id, type: m.chat.type, count: 0 };
    row.count++;
    seen.set(m.chat.id, row);
  }
  if (!seen.size) {
    return [
      "받은 메시지가 없습니다.",
      "텔레그램에서 봇에게 아무 메시지나 하나 보낸 뒤 다시 실행하세요.",
      "(봇이 이미 polling 중이면 그쪽이 업데이트를 가져갑니다 — 봇을 멈추고 실행하세요)",
    ].join("\n");
  }
  const ids = [...seen.keys()];
  return [
    "발견한 chat_id:",
    ...ids.map((id) => {
      const r = seen.get(id)!;
      return `  ${id}  (user_id ${r.user ?? "?"}, ${r.type ?? "chat"}, 메시지 ${r.count}건)`;
    }),
    "",
    ".env 에 아래처럼 넣으세요. 값은 사람이 직접 입력합니다.",
    `  ALLOWED_CHAT_IDS=${ids.join(",")}`,
    "",
    "그다음 npm run setup:check → npm start.",
  ].join("\n");
}

if (import.meta.filename === process.argv[1]) {
  const env = envStatus("IMWEB_WIDGET_BOT_TOKEN", 40, 60);
  if (!env.present) {
    console.error("IMWEB_WIDGET_BOT_TOKEN 미설정 — .env 에 토큰을 넣은 뒤 다시 실행하세요.");
    process.exit(1);
  }
  const token = process.env.IMWEB_WIDGET_BOT_TOKEN!;

  // 봇 신원 — 공개 정보(이름·@username)만 출력한다.
  const me: any = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((x) => x.json()).catch(() => null);
  if (me?.ok) console.log(`봇: ${me.result.first_name} (@${me.result.username}, id ${me.result.id})\n`);

  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ timeout: 25, allowed_updates: ["message"] }),
  }).catch(() => null);

  if (!r) { console.error("텔레그램에 연결하지 못했습니다. 네트워크를 확인하세요."); process.exit(1); }
  const j: any = await r.json();
  if (!j.ok) {
    // 오류 설명에 토큰이 섞여 나오지 않도록 마스킹한다.
    console.error("텔레그램 오류: " + String(j.description ?? "unknown").split(token).join("<TOKEN>"));
    process.exit(1);
  }
  console.log(summarize(j.result as Update[]));
}
