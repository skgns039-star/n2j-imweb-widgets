/* PTEST-007. "되돌려"를 배포로 처리하면 안 된다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/bot/router.ts";

test("의도 분류", () => {
  assert.equal(classify("되돌려").intent, "rollback");
  assert.equal(classify("아까 그거 이전 버전으로 롤백해줘").intent, "rollback");
  assert.equal(classify("배포해줘").intent, "deploy");
  assert.equal(classify("전체 중지").intent, "kill");
  assert.equal(classify("전체 재개").intent, "resume");
  assert.equal(classify("로더 스니펫 줘").intent, "install");
  assert.equal(classify("상태 알려줘").intent, "inspect");
  assert.equal(classify("위젯 문구를 X로 바꿔줘").intent, "agent");
  assert.equal(classify("날씨 어때").intent, "unclear");
});

test("승인 회신에서 승인 ID를 뽑는다", () => {
  const r = classify("승인 AP-1a2b3c4d");
  assert.equal(r.intent, "approve");
  assert.equal(r.arg, "AP-1a2b3c4d");
});

test("배포 지시가 롤백보다 먼저 매칭되지 않는다", () => {
  // "되돌려서 배포해" 같은 혼합 문장은 롤백이 이겨야 안전하다 (되돌리기 우선)
  assert.equal(classify("되돌려서 배포해").intent, "rollback");
});
