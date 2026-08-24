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
