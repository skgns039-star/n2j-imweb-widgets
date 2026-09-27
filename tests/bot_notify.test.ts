/* 2026-09-28 사용자 요구: 봇 켜짐·꺼짐을 텔레그램으로 알린다. 알림 실패가 봇을 멈추게 하면 안 된다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerChats, notifyOwners } from "../src/bot/telegram.ts";

test("켜짐·꺼짐 알림은 허용된 대화 전부에 한 번씩, 실패해도 예외 없이", async (t) => {
  const prev = process.env.ALLOWED_CHAT_IDS;
  process.env.ALLOWED_CHAT_IDS = "111, 222 111";
  const sent: number[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    const body = JSON.parse(init.body);
    if (body.chat_id === 222) throw new Error("network down");
    sent.push(body.chat_id);
    return new Response(JSON.stringify({ ok: true, result: {} }));
  });
  try {
    assert.deepEqual(ownerChats(), [111, 222]);
    assert.equal(await notifyOwners("🟢 위젯 봇 켜짐"), 1);
    assert.deepEqual(sent, [111]);
  } finally { process.env.ALLOWED_CHAT_IDS = prev; }
});
