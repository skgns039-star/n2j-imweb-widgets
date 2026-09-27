/* 텔레그램 → 터미널 작업 큐. 외부 실행·완료 회신은 사람이 이어받는다. */
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { p } from "../release/paths.ts";
import { looksSecret } from "../release/secrets.ts";
import type { Ctx } from "./threads.ts";

export type Task = {
  id: string; at: string; chat_id: number; topic_id?: number;
  agent_id?: string; channel?: string; bot_account_id?: string;
  text: string; status: "PENDING" | "TAKEN" | "DONE"; note?: string;
};
const legacy = { agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot" };
const validCtx = (c: Ctx) => Number.isSafeInteger(c.chat_id) && c.chat_id !== 0 &&
  (c.topic_id === undefined || Number.isSafeInteger(c.topic_id) && c.topic_id > 0) &&
  [c.agent_id, c.channel, c.bot_account_id].every((v) => typeof v === "string" && v.length > 0);
const sameConversation = (t: Task, c: Ctx) => t.chat_id === c.chat_id && t.topic_id === c.topic_id &&
  (t.agent_id ?? legacy.agent_id) === c.agent_id && (t.channel ?? legacy.channel) === c.channel &&
  (t.bot_account_id ?? legacy.bot_account_id) === c.bot_account_id;

function validate(value: unknown): asserts value is Task[] {
  if (!Array.isArray(value)) throw new Error("invalid queue");
  const ids = new Set<string>();
  for (const t of value) {
    if (!t || typeof t !== "object" || typeof t.id !== "string" || !/^T-\d{3,}$/.test(t.id) ||
      !Number.isSafeInteger(Number(t.id.slice(2))) || Number(t.id.slice(2)) < 1 || ids.has(t.id) ||
      typeof t.at !== "string" || !Number.isFinite(Date.parse(t.at)) ||
      typeof t.text !== "string" || !t.text.trim() || looksSecret(t.text) ||
      !["PENDING", "TAKEN", "DONE"].includes(t.status) ||
      (t.note !== undefined && (typeof t.note !== "string" || looksSecret(t.note))) ||
      !validCtx({ ...legacy, ...t }) ||
      !([t.agent_id, t.channel, t.bot_account_id].every((v) => v === undefined) ||
        [t.agent_id, t.channel, t.bot_account_id].every((v) => typeof v === "string" && v.length > 0))) {
      throw new Error("invalid queue");
    }
    ids.add(t.id);
  }
}

/** 경로 주입은 테스트 전용 임시 저장소에도 같은 구현을 사용하기 위함이다. */
export function createInbox(file: string) {
  function all(): Task[] {
    let raw: string;
    try { raw = readFileSync(file, "utf8"); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error("작업 큐 읽기 실패 — 원본을 보존하고 중단합니다.");
    }
    try { const list: unknown = JSON.parse(raw); validate(list); return list; }
    catch { throw new Error("작업 큐 손상 또는 안전 검사 실패 — 원본을 보존하고 중단합니다."); }
  }

  function mutate<T>(change: (list: Task[]) => T): T {
    mkdirSync(dirname(file), { recursive: true });
    const lock = `${file}.lock`;
    let fd: number;
    try { fd = openSync(lock, "wx", 0o600); }
    catch { throw new Error("작업 큐 잠금 실패 — 다른 작업 종료를 확인하세요. 비정상 종료 시 원본 확인 후 잠금을 복구하세요."); }
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      const list = all();
      const result = change(list);
      validate(list);
      writeFileSync(temp, JSON.stringify(list, null, 2), { flag: "wx", mode: 0o600 });
      const saved = openSync(temp, "r");
      try { fsyncSync(saved); } finally { closeSync(saved); }
      renameSync(temp, file);
      return result;
    } finally {
      try {
        try { unlinkSync(temp); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
      } finally { closeSync(fd); unlinkSync(lock); }
    }
  }

  function add(ctx: Ctx, text: string): Task {
    if (!validCtx(ctx) || !text.trim() || looksSecret(text)) throw new Error("작업 입력이 유효하지 않거나 비밀값이 포함되어 있습니다.");
    return mutate((list) => {
      const last = list.filter((t) => sameConversation(t, ctx)).at(-1);
      if (last?.status === "PENDING" && last.text.trim() === text.trim()) return last;
      const next = list.reduce((max, t) => Math.max(max, Number(t.id.slice(2))), 0) + 1;
      if (!Number.isSafeInteger(next)) throw new Error("작업 ID 범위 초과");
      const t: Task = {
        id: `T-${String(next).padStart(3, "0")}`, at: new Date().toISOString(),
        agent_id: ctx.agent_id, channel: ctx.channel, bot_account_id: ctx.bot_account_id,
        chat_id: ctx.chat_id, ...(ctx.topic_id === undefined ? {} : { topic_id: ctx.topic_id }),
        text: text.trim(), status: "PENDING",
      };
      list.push(t);
      return t;
    });
  }

  function take(id: string): Task | null {
    return mutate((list) => {
      const t = list.find((x) => x.id === id);
      if (!t) return null;
      if (t.status !== "PENDING") throw new Error("대기 중인 작업만 가져올 수 있습니다.");
      t.status = "TAKEN";
      return t;
    });
  }

  function done(id: string, note?: string): Task | null {
    if (note && looksSecret(note)) throw new Error("완료 메모에 비밀값을 저장할 수 없습니다.");
    return mutate((list) => {
      const t = list.find((x) => x.id === id);
      if (!t) return null;
      if (t.status !== "TAKEN") throw new Error("가져온 작업만 완료할 수 있습니다.");
      t.status = "DONE";
      if (note) t.note = note;
      return t;
    });
  }

  return {
    add, take, done,
    pending: () => all().filter((t) => t.status === "PENDING"),
    listText: (ctx: Ctx) => {
      if (!validCtx(ctx)) throw new Error("대화 정보가 필요합니다.");
      return formatList(all().filter((t) => sameConversation(t, ctx)));
    },
    // 전체 목록은 로컬 터미널 전용. 텔레그램 경로는 반드시 listText(ctx)를 사용한다.
    terminalListText: () => formatList(all()),
  };
}

function formatList(list: Task[]): string {
  if (!list.length) return "접수된 작업이 없습니다.";
  return ["[작업 목록]", "", ...list.slice(-12).map((t) =>
    `  ${t.id} [${t.status}] ${t.at.slice(5, 16).replace("T", " ")}  ${t.text.slice(0, 40)}${t.text.length > 40 ? "…" : ""}`),
  "", `대기 ${list.filter((t) => t.status === "PENDING").length}건 / 전체 ${list.length}건`].join("\n");
}

export const receipt = (t: Task) =>
  [`[접수 ${t.id}] 요청을 받았습니다.`, "", `내용: ${t.text.slice(0, 120)}${t.text.length > 120 ? "…" : ""}`, "",
   "터미널에서 이어받아 처리합니다. 아직 실행하거나 완료한 상태가 아닙니다.",
   "진행 상태를 보려면 '작업 목록'이라고 보내주세요."].join("\n");

export const inbox = createInbox(p("state", "inbox", "tasks.json"));
export const { add, pending, take, done, listText, terminalListText } = inbox;

if (import.meta.main) {
  try {
    const [cmd, arg, ...rest] = process.argv.slice(2);
    if (cmd === "take" && arg) {
      const t = take(arg);
      if (!t) throw new Error("없는 작업 ID입니다.");
      console.log(`${t.id} 가져옴 (chat=${t.chat_id}, topic=${t.topic_id ?? "없음"}):\n${t.text}`);
    } else if (cmd === "done" && arg) {
      const t = done(arg, rest.join(" "));
      if (!t) throw new Error("없는 작업 ID입니다.");
      console.log(`${t.id} 완료 처리 (자동 회신 없음)`);
    } else if (!cmd || cmd === "list") {
      console.log(terminalListText());
      for (const t of pending()) console.log(`\n[${t.id}] chat=${t.chat_id} topic=${t.topic_id ?? "없음"}\n${t.text}`);
    } else throw new Error("사용법: inbox [list | take ID | done ID 메모]");
  } catch (e) { console.error((e as Error).message); process.exitCode = 1; }
}
