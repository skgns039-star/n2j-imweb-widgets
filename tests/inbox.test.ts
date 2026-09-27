import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createInbox, receipt } from "../src/bot/inbox.ts";
import type { Ctx } from "../src/bot/threads.ts";

const ctx: Ctx = { agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot", chat_id: 111 };
function setup(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "imweb-inbox-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "tasks.json");
  return { dir, file, q: createInbox(file) };
}

test("목록·중복 판정은 chat/topic/agent/channel/bot 별로 격리된다", (t) => {
  const { q } = setup(t);
  const contexts = [ctx, { ...ctx, chat_id: 222 }, { ...ctx, topic_id: 1 }, { ...ctx, topic_id: 2 },
    { ...ctx, agent_id: "other" }, { ...ctx, channel: "other" }, { ...ctx, bot_account_id: "other" }];
  const ids = contexts.map((c) => q.add(c, "동일한 요청").id);
  assert.equal(new Set(ids).size, contexts.length);
  for (const [i, c] of contexts.entries()) {
    assert.equal(q.add(c, "동일한 요청").id, ids[i]);
    assert.match(q.listText(c), /전체 1건/);
    for (const id of ids.filter((v) => v !== ids[i])) assert.ok(!q.listText(c).includes(id));
  }
  assert.equal(q.listText({ ...ctx, chat_id: 333 }), "접수된 작업이 없습니다.");
});

test("이전 chat-only 기록은 기본 봇의 토픽 없는 대화에만 보인다", (t) => {
  const { q, file } = setup(t);
  writeFileSync(file, JSON.stringify([{ id: "T-009", at: new Date().toISOString(), chat_id: ctx.chat_id, text: "이전 요청", status: "PENDING" }]));
  assert.match(q.listText(ctx), /이전 요청/);
  assert.equal(q.listText({ ...ctx, topic_id: 1 }), "접수된 작업이 없습니다.");
  assert.equal(q.listText({ ...ctx, bot_account_id: "other" }), "접수된 작업이 없습니다.");
  assert.equal(q.add(ctx, "다음 요청").id, "T-010");
});

test("JSON 손상·스키마 오류는 조회/접수/상태 변경을 차단하고 원본을 보존한다", (t) => {
  const { q, file, dir } = setup(t);
  for (const raw of ["{invalid", "null", "{}", '[{"id":"T-001"}]']) {
    writeFileSync(file, raw);
    for (const action of [() => q.listText(ctx), () => q.add(ctx, "새 요청"), () => q.take("T-001"), () => q.done("T-001")]) {
      assert.throws(action, /큐 손상/);
      assert.equal(readFileSync(file, "utf8"), raw);
      assert.deepEqual(readdirSync(dir), ["tasks.json"]);
    }
  }
});

test("유효한 JSON도 중복 ID·알 수 없는 상태·부분 대화 키이면 차단한다", (t) => {
  const { q, file } = setup(t);
  const task = q.add(ctx, "정상 요청");
  for (const bad of [[task, task], [{ ...task, status: "UNKNOWN" }], [{ ...task, channel: undefined }]]) {
    const raw = JSON.stringify(bad);
    writeFileSync(file, raw);
    assert.throws(() => q.add(ctx, "새 요청"), /큐 손상/);
    assert.equal(readFileSync(file, "utf8"), raw);
  }
});

test("읽기 실패를 빈 큐로 취급하지 않는다", (t) => {
  const { q, file } = setup(t);
  mkdirSync(file);
  assert.throws(() => q.add(ctx, "새 요청"), /읽기 실패/);
});

test("다른 프로세스가 잠금을 보유하면 쓰지 않고 중단한다", (t) => {
  const { q, file } = setup(t);
  q.add(ctx, "기존 요청");
  const original = readFileSync(file);
  writeFileSync(`${file}.lock`, "held");
  const moduleUrl = new URL("../src/bot/inbox.ts", import.meta.url).href;
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
    const {createInbox} = await import(${JSON.stringify(moduleUrl)});
    try { createInbox(${JSON.stringify(file)}).add(${JSON.stringify(ctx)}, '다른 프로세스 요청'); process.exitCode=2; }
    catch(e) { if(!e.message.includes('잠금 실패')) throw e; process.stdout.write('BLOCKED'); }
  `], { encoding: "utf8" });
  assert.equal(output, "BLOCKED");
  assert.deepEqual(readFileSync(file), original);
  rmSync(`${file}.lock`);
  assert.equal(q.add(ctx, "잠금 해제 후 요청").id, "T-002");
});

test("저장 후 다시 열어도 토픽·본문·완료 메모가 유지되고 상태가 역행하지 않는다", (t) => {
  const { q, file, dir } = setup(t);
  const task = q.add({ ...ctx, topic_id: 7 }, "요청");
  assert.match(receipt(task), /아직 실행하거나 완료한 상태가 아닙니다/);
  assert.throws(() => q.done(task.id), /가져온 작업/);
  assert.equal(q.take(task.id)?.status, "TAKEN");
  assert.throws(() => q.take(task.id), /대기 중/);
  assert.equal(q.done(task.id, "검증 완료")?.note, "검증 완료");
  const fresh = createInbox(file);
  assert.match(fresh.listText({ ...ctx, topic_id: 7 }), /DONE/);
  assert.equal(fresh.pending().length, 0);
  assert.throws(() => fresh.take(task.id), /대기 중/);
  assert.equal(fresh.take("T-999"), null);
  assert.deepEqual(readdirSync(dir), ["tasks.json"]);
});

test("비밀값·빈 요청·잘못된 대화 키는 파일을 쓰기 전에 거부한다", (t) => {
  const { q, dir } = setup(t);
  const secret = "ghp_" + "a".repeat(36);
  for (const action of [() => q.add(ctx, secret), () => q.add(ctx, " "),
    () => q.add({ ...ctx, chat_id: 0 }, "요청"), () => q.add({ ...ctx, topic_id: 0 }, "요청"),
    () => q.done("T-001", secret)]) assert.throws(action);
  assert.deepEqual(readdirSync(dir), []);
});

test("최종 파일 교체 실패 시 원본과 ID를 보존하고 임시 파일·잠금을 정리한다", (t) => {
  const { q, file, dir } = setup(t);
  q.add(ctx, "기존 요청");
  const original = readFileSync(file);
  const rename = t.mock.method(fs, "renameSync", () => { throw new Error("simulated disk failure"); });
  syncBuiltinESMExports();
  try {
    assert.throws(() => q.add(ctx, "실패할 요청"), /simulated disk failure/);
    assert.deepEqual(readFileSync(file), original);
    assert.deepEqual(readdirSync(dir), ["tasks.json"]);
  } finally { rename.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(q.add(ctx, "재개한 요청").id, "T-002");
});
