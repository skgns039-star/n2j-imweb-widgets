/* PTEST-017 / INV-8. 승인 없이는 실행되지 않는다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { request, decide, assertApproved, load } from "../src/release/approval.ts";
import { p } from "../src/release/paths.ts";

test("승인 ID가 없으면 차단", () => {
  assert.throws(() => assertApproved(undefined, "cdn_deploy"), /BLOCKED: 승인 페이로드 없음/);
});

test("PENDING 상태로는 실행되지 않는다", () => {
  const a = request("cdn_deploy", "t@0.0.1", { widget_id: "t" });
  assert.throws(() => assertApproved(a.id, "cdn_deploy"), /BLOCKED: 승인 상태 PENDING/);
});

test("승인 범위(action)가 다르면 차단", () => {
  const a = request("cdn_deploy", "t@0.0.1", { widget_id: "t" });
  decide(a.id, "APPROVED");
  assert.throws(() => assertApproved(a.id, "rollback"), /BLOCKED: 승인 범위 불일치/);
});

test("승인되면 통과한다", () => {
  const a = request("rollback", "t -> off", { widget_id: "t" });
  decide(a.id, "APPROVED");
  assert.equal(assertApproved(a.id, "rollback").status, "APPROVED");
});

test("15분 지난 승인은 만료로 차단된다", () => {
  const a = request("cdn_deploy", "t@0.0.1", { widget_id: "t" });
  decide(a.id, "APPROVED");
  const stale = { ...load(a.id)!, created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString() };
  writeFileSync(p("logs", "approvals", `${a.id}.json`), JSON.stringify(stale));
  assert.throws(() => assertApproved(a.id, "cdn_deploy"), /BLOCKED: 승인 만료/);
});

test("거절된 승인은 실행되지 않는다", () => {
  const a = request("cdn_deploy", "t@0.0.1", { widget_id: "t" });
  decide(a.id, "REJECTED");
  assert.throws(() => assertApproved(a.id, "cdn_deploy"), /BLOCKED: 승인 상태 REJECTED/);
});

/* 테스트가 만든 승인이 쌓여 실제 승인 대기 목록을 오염시킨 적이 있다 (384건 누적).
   검사가 끝나면 자기 흔적을 지운다. */
import { after } from "node:test";
import { purgeFixtures } from "../checks/purge_fixtures.ts";
import { rmSync } from "node:fs";

after(() => { purgeFixtures(); });

test("검사 픽스처 승인은 정리되고 실제 배포 기록은 보존된다", () => {
  const a = request("cdn_deploy", "t@0.0.1", { widget_id: "t" }, 9001);
  assert.ok(load(a.id), "생성 확인");
  assert.ok(purgeFixtures().removed >= 1, "검사 픽스처는 정리된다");
  assert.equal(load(a.id), null, "정리 후에는 남지 않는다");
  // 실제 배포 감사기록은 대상 이름으로 보호된다.
  // 이 검사가 만든 것도 보호 규칙에 걸리므로, 확인 후 직접 지운다 (흔적을 남기지 않는다).
  const real = request("cdn_deploy", "hello-badge@0.1.0", { widget_id: "hello-badge" });
  purgeFixtures();
  assert.ok(load(real.id), "실제 위젯 승인은 지워지면 안 된다");
  rmSync(p("logs", "approvals", `${real.id}.json`), { force: true });
});
