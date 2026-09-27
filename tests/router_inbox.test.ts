import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT, p } from "../src/release/paths.ts";
import { createInbox } from "../src/bot/inbox.ts";

// 라우터 import는 DB를 연다. 직접 실행에서도 운영 DB에 접근하기 전에 중단한다.
assert.equal(process.env.IMWEB_ISOLATED_TEST_ROOT, ROOT, "npm test로 격리 실행하세요.");
const { handle } = await import("../src/bot/router.ts");
const ctx = { agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot", chat_id: 8100 };

test("물음표·설명 요청을 섞은 작업도 SDK 실행 없이 큐로 간다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imweb-routing-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const q = createInbox(join(dir, "tasks.json"));
  for (const text of ["본문 수정해줘?", "수정하고 결과 알려줘", "Can you update the page?", "어제 작업 다 됐어?"]) {
    assert.match(await handle(text, ctx, q), /접수 T-/);
  }
  assert.equal(q.pending().length, 4);
});

test("라우터 목록은 호출자의 토픽에 한정된다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imweb-routing-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const q = createInbox(join(dir, "tasks.json"));
  await handle("첫 번째 요청", { ...ctx, topic_id: 1 }, q);
  await handle("두 번째 요청", { ...ctx, topic_id: 2 }, q);
  await handle("다른 대화 요청", { ...ctx, chat_id: 8101 }, q);
  const reply = await handle("작업 목록", { ...ctx, topic_id: 1 }, q);
  assert.match(reply, /첫 번째 요청/);
  assert.ok(!/두 번째|다른 대화/.test(reply));
});

test("닫힌 디자인 게이트는 물음표·SEO 혼합 지시도 접수하지 않는다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imweb-routing-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const q = createInbox(join(dir, "tasks.json"));
  const file = p("contracts", "AUTHORITY_MANIFEST.yaml");
  const original = readFileSync(file, "utf8");
  try {
    writeFileSync(file, original.replace(/DESIGN-WRITE: \{ status: RESOLVED,/, "DESIGN-WRITE: { status: OPEN,"));
    for (const text of ["본문 수정해줘?", "본문 수정하고 메타도 수정해줘?"]) {
      assert.match(await handle(text, ctx, q), /읽기 전용/);
    }
    assert.equal(q.pending().length, 0);
    assert.match(await handle("대체 텍스트 수정해줘", ctx, q), /접수 T-/);
  } finally { writeFileSync(file, original); }
});

test("부정된 전체 중지 지시는 킬 스위치를 실행하지 않는다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imweb-routing-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const q = createInbox(join(dir, "tasks.json"));
  assert.match(await handle("전체 중지 안 해도 돼", ctx, q), /접수 T-/);
});

test("작업 목록을 언급한 변경 지시를 조회로 삼키지 않는다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imweb-routing-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const q = createInbox(join(dir, "tasks.json"));
  assert.match(await handle("작업 목록 표시 문구 수정해줘", ctx, q), /접수 T-/);
  const response = await handle("작업 목록 보여줘", ctx, q);
  assert.match(response, /전체 1건/);
  assert.equal(q.pending().length, 1);
});
