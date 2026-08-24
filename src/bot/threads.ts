/* ENG-018 Thread State. conversation_key 단위로 대화를 분리한다.
   node:sqlite (Node 22.5+ 내장) — 별도 의존성 없음. */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { p } from "../release/paths.ts";

if (!existsSync(p("state"))) mkdirSync(p("state"), { recursive: true });
export const db = new DatabaseSync(p("state", "threads.sqlite3"));

db.exec(`
  CREATE TABLE IF NOT EXISTS threads (
    conversation_key TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL, channel TEXT NOT NULL, bot_account_id TEXT NOT NULL,
    chat_id INTEGER NOT NULL, topic_id INTEGER,
    thread_id TEXT, engine TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS seen_updates (update_id INTEGER PRIMARY KEY, seen_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS offsets (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
`);

export type Ctx = { agent_id: string; channel: string; bot_account_id: string; chat_id: number; topic_id?: number };

export const conversationKey = (c: Ctx) =>
  [c.agent_id, c.channel, c.bot_account_id, c.chat_id, c.topic_id ?? 0].join("|");

export function getThread(c: Ctx): { thread_id: string | null; engine: string | null } {
  const key = conversationKey(c);
  const row = db.prepare("SELECT thread_id, engine FROM threads WHERE conversation_key = ?").get(key) as any;
  if (row) return { thread_id: row.thread_id ?? null, engine: row.engine ?? null };
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO threads (conversation_key, agent_id, channel, bot_account_id, chat_id, topic_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
  ).run(key, c.agent_id, c.channel, c.bot_account_id, c.chat_id, c.topic_id ?? null, now, now);
  return { thread_id: null, engine: null };
}

export function setThread(c: Ctx, thread_id: string, engine: string) {
  db.prepare("UPDATE threads SET thread_id = ?, engine = ?, updated_at = ? WHERE conversation_key = ?")
    .run(thread_id, engine, new Date().toISOString(), conversationKey(c));
}

/** 멱등성 키 = update_id. 프로세스 재시작 후 중복 처리 방지 (§13). */
export function markSeen(update_id: number): boolean {
  const dup = db.prepare("SELECT 1 FROM seen_updates WHERE update_id = ?").get(update_id);
  if (dup) return false;
  db.prepare("INSERT INTO seen_updates (update_id, seen_at) VALUES (?, ?)").run(update_id, new Date().toISOString());
  return true;
}

export function getOffset(): number {
  const row = db.prepare("SELECT v FROM offsets WHERE k = 'telegram'").get() as any;
  return row ? Number(row.v) : 0;
}

export function setOffset(v: number) {
  db.prepare("INSERT INTO offsets (k, v) VALUES ('telegram', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(v);
}
