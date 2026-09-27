import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import cp from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { ROOT, p, manifest } from "../src/release/paths.ts";
import { request, decide, consumeApproval, assertApproved, load } from "../src/release/approval.ts";
import { deploymentPayload, deploy, publishRegistry, registryHash } from "../src/release/deploy.ts";
import { readRegistry } from "../src/release/registry.ts";
import { verify } from "../src/release/verify.ts";
assert.equal(process.env.IMWEB_ISOLATED_TEST_ROOT, ROOT, "npm test로 격리 실행하세요.");

test("다른 대화는 승인할 수 없고 거절/소비된 승인은 부활하지 않는다", () => {
  const a = request("cdn_deploy", "t", { widget_id: "t" }, 9500);
  assert.throws(() => decide(a.id, "APPROVED", 9501), /다른 대화/);
  decide(a.id, "REJECTED", 9500);
  assert.equal(decide(a.id, "APPROVED", 9500)?.status, "REJECTED");
  const b = request("cdn_deploy", "t", { widget_id: "t", version: "1" }, 9500);
  decide(b.id, "APPROVED", 9500);
  assert.throws(() => consumeApproval(b.id, "cdn_deploy", { version: "2" }), /불일치/);
  consumeApproval(b.id, "cdn_deploy", { widget_id: "t", version: "1" });
  assert.throws(() => consumeApproval(b.id, "cdn_deploy", {}), /USED|사용/);
  assert.equal(decide(b.id, "APPROVED", 9500)?.status, "USED");
});

test("잘못된 승인 ID와 잘못된 만료 시각은 차단된다", () => {
  assert.throws(() => load("../../registry"), /잘못된 승인/);
  const a = request("cdn_deploy", "t", {});
  decide(a.id, "APPROVED");
  for (const created_at of ["invalid", new Date(Date.now() + 60_000).toISOString()]) {
    writeFileSync(p("logs", "approvals", `${a.id}.json`), JSON.stringify({ ...a, status: "APPROVED", created_at }));
    assert.throws(() => assertApproved(a.id, "cdn_deploy"), /만료/);
  }
});

test("승인 뒤 위젯 내용이 바뀌면 네트워크와 Git 쓰기 전에 배포가 막힌다", async (t) => {
  const id = manifest().widgets[0]!.widget_id;
  const a = request("cdn_deploy", id, deploymentPayload(id));
  decide(a.id, "APPROVED");
  const file = p("src", "widgets", id, "index.js");
  const before = readFileSync(file);
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; throw new Error("network must not run"); });
  try {
    writeFileSync(file, Buffer.concat([before, Buffer.from("\n// drift")]));
    const result = await deploy(id, a.id);
    assert.equal(result.result, "BLOCKED");
    assert.match(result.blocked_reason, /승인 대상\/내용 불일치/);
    assert.equal(requests, 0);
    assert.equal(load(a.id)?.status, "APPROVED");
  } finally { writeFileSync(file, before); }
});

test("위조된 실행 승인으로 registry를 공개하지 못한다", async () => {
  const reg = readRegistry();
  const fake = request("cdn_deploy", "t", { registry_sha256: registryHash(reg) });
  await assert.rejects(publishRegistry(reg.updated_at, { ...fake, status: "USED" }), /실행 승인/);
});

test("소비한 승인도 허용 밖 파일 공개와 재사용을 막는다", async (t) => {
  const reg = readRegistry();
  const a = request("cdn_deploy", "t", { registry_sha256: registryHash(reg) });
  decide(a.id, "APPROVED");
  const permit = consumeApproval(a.id, "cdn_deploy", a.payload);
  await assert.rejects(publishRegistry(reg.updated_at, permit, [".env"]), /범위 밖/);
  const commands: string[][] = [];
  const mock = t.mock.method(cp, "execFileSync", (_bin: any, args: any) => { commands.push(args); return ""; });
  syncBuiltinESMExports();
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(reg), { status: 200 }));
  try {
    assert.equal(await publishRegistry(reg.updated_at, permit), true);
    await assert.rejects(publishRegistry(reg.updated_at, permit), /실행 승인/);
    assert.ok(!commands.some((args) => args.includes("-A")));
  } finally { mock.mock.restore(); syncBuiltinESMExports(); }
});

test("검토되지 않은 로컬 커밋이 있으면 registry 공개 전에 막고 push 하지 않는다", async (t) => {
  const reg = readRegistry();
  const a = request("cdn_deploy", "t", { registry_sha256: registryHash(reg) });
  decide(a.id, "APPROVED");
  const permit = consumeApproval(a.id, "cdn_deploy", a.payload);
  const pushes: string[][] = [];
  const mock = t.mock.method(cp, "execFileSync", (_bin: any, args: any) => {
    if (args[0] === "push" || args[0] === "commit") pushes.push(args);
    if (args[0] === "log") return "자연어 라우팅 + SEO 상태기계\nregistry 2026-09-27";
    if (args[0] === "diff" && args.includes("origin/main")) return "src/bot/router.ts\nregistry.json";
    return "";
  });
  syncBuiltinESMExports();
  t.mock.method(globalThis, "fetch", async () => { throw new Error("network must not run"); });
  try {
    await assert.rejects(publishRegistry(reg.updated_at, permit), /검토되지 않은 로컬 커밋 1개·배포 밖 파일 1개/);
    assert.deepEqual(pushes, []);
  } finally { mock.mock.restore(); syncBuiltinESMExports(); }
});

test("빈 파일 목록/다른 버전의 무결성 기록은 성공으로 통과하지 않는다", async () => {
  const w = manifest().widgets[0]!;
  const file = p("integrity", `${w.widget_id}.json`);
  const before = readFileSync(file);
  const rec = JSON.parse(before.toString());
  try {
    for (const bad of [{ ...rec, files: [] }, { ...rec, version: "999.0.0" }]) {
      writeFileSync(file, JSON.stringify(bad));
      const points = await verify({ widget: w.widget_id, cdn: false });
      assert.ok(points.length > 0 && points.some((x) => !x.ok));
    }
  } finally { writeFileSync(file, before); }
});

import { rollback, rollbackPayload } from "../src/release/rollback.ts";
import { latestPending } from "../src/release/approval.ts";

test("소비 표식 파일이 있어도 대기 승인 조회가 깨지지 않는다", () => {
  const a = request("rollback", "t", {}, 9555);
  decide(a.id, "APPROVED"); consumeApproval(a.id, "rollback", {});
  assert.equal(latestPending(9555), null);
});

for (const mode of ["deploy-ok", "deploy-bad-cdn", "deploy-abort", "rollback-off", "rollback-version"] as const) test(`${mode}: 자산 검증과 공개 순서`, async (t) => {
  const w = manifest().widgets[0]!;
  const files = ["manifest/widgets.yaml", "registry.json", `integrity/${w.widget_id}.json`,
    `src/widgets/${w.widget_id}/index.js`, `src/widgets/${w.widget_id}/style.css`,
    `dist/${w.widget_id}/${w.version}/index.js`, `dist/${w.widget_id}/${w.version}/style.css`];
  const before = new Map(files.map((file) => [file, readFileSync(p(file))]));
  const real = cp.execFileSync;
  const events: string[] = [];
  const controller = new AbortController();
  let staged: string[] = [];
  const committed: string[] = [];
  const mock = t.mock.method(cp, "execFileSync", (bin: any, args: any, options: any) => {
    if (bin !== "git") throw new Error("unexpected process");
    if (["rev-parse", "show"].includes(args[0])) return (real as any)(bin, args, options);
    // 공개 전 가드: 이 테스트가 만든 배포 커밋만 origin/main 앞에 있다.
    if (args[0] === "fetch") return "";
    if (args[0] === "log") return committed.join("\n");
    if (args[0] === "diff") return staged.join("\n");
    if (args[0] === "add") { staged = args.slice(args.indexOf("--") + 1); events.push('stage:' + staged.join(',')); return ""; }
    if (args[0] === "commit") { staged = []; committed.push(args[args.indexOf("-m") + 1]); events.push("commit"); return ""; }
    if (args[0] === "tag" && args[1] === "--list") return "";
    if (["tag", "push"].includes(args[0])) { events.push(args.join(" ")); return ""; }
    throw new Error("unexpected Git command");
  });
  syncBuiltinESMExports();
  t.mock.method(globalThis, "fetch", async (url: any) => {
    const asset = String(url).match(/\/dist\/(.+)$/);
    if (asset) {
      events.push("cdn");
      if (mode === "deploy-abort") controller.abort();
      return new Response(mode === "deploy-bad-cdn" ? "tampered" : new Uint8Array(readFileSync(p("dist", asset[1]!))));
    }
    events.push("registry-confirm");
    return new Response(readFileSync(p("registry.json")), { status: 200 });
  });
  try {
    const isRollback = mode.startsWith("rollback");
    const to = mode === "rollback-off" ? "off" : w.version;
    const payload = isRollback ? rollbackPayload(w.widget_id, to) : deploymentPayload(w.widget_id);
    const a = request(isRollback ? "rollback" : "cdn_deploy", "t", payload);
    decide(a.id, "APPROVED");
    const result = isRollback ? await rollback(w.widget_id, to, a.id) : await deploy(w.widget_id, a.id, controller.signal);
    assert.equal(result.result, ["deploy-bad-cdn", "deploy-abort"].includes(mode) ? "BLOCKED" : "OK", result.blocked_reason);
    const registryStage = events.findIndex((e) => e.startsWith("stage:") && e.includes("registry.json"));
    if (["deploy-bad-cdn", "deploy-abort"].includes(mode)) {
      assert.equal(registryStage, -1);
      assert.deepEqual(readFileSync(p("registry.json")), before.get("registry.json"));
    } else {
      assert.ok(registryStage > events.lastIndexOf("cdn"), events.join(" | "));
      assert.ok(events.includes("registry-confirm"));
      assert.equal(result.integrity.match, true);
    }
    if (isRollback) assert.ok(!events.some((e) => e.startsWith("tag ")), "롤백에서 새 태그 생성 금지");
    assert.equal(load(a.id)?.status, "USED");
  } finally {
    mock.mock.restore(); syncBuiltinESMExports();
    for (const [file, data] of before) writeFileSync(p(file), data);
  }
});

test("소비한 승인 객체의 내용을 변조해도 공개 범위를 바꾸지 못한다", async () => {
  const reg = readRegistry();
  const a = request("cdn_deploy", "t", { registry_sha256: registryHash(reg) });
  decide(a.id, "APPROVED");
  const permit = consumeApproval(a.id, "cdn_deploy", a.payload);
  permit.payload.extra = "changed after consume";
  await assert.rejects(publishRegistry(reg.updated_at, permit), /실행 승인/);
});

test("동일 updated_at이라도 CDN registry 내용이 다르면 완료로 보고하지 않는다", async (t) => {
  const reg = readRegistry();
  const a = request("cdn_deploy", "t", { registry_sha256: registryHash(reg) });
  decide(a.id, "APPROVED");
  const permit = consumeApproval(a.id, "cdn_deploy", a.payload);
  const mock = t.mock.method(cp, "execFileSync", () => "");
  syncBuiltinESMExports();
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => { fetches++; return new Response(JSON.stringify({ ...reg, modules: [] })); });
  try {
    assert.equal(await publishRegistry(reg.updated_at, permit), false);
    assert.equal(fetches, 1, "내용 불일치 재시도 금지");
  } finally { mock.mock.restore(); syncBuiltinESMExports(); }
});

test("이미 staged인 다른 변경이 있으면 배포 승인 소비 전 중단한다", async (t) => {
  const id = manifest().widgets[0]!.widget_id;
  const a = request("cdn_deploy", "t", deploymentPayload(id));
  decide(a.id, "APPROVED");
  const real = cp.execFileSync;
  const mock = t.mock.method(cp, "execFileSync", (bin: any, args: any, options: any) => {
    if (args[0] === "diff") return "unrelated.txt";
    if (args[0] !== "rev-parse") throw new Error("unexpected Git mutation");
    return (real as any)(bin, args, options);
  });
  syncBuiltinESMExports();
  try {
    const result = await deploy(id, a.id);
    assert.equal(result.result, "BLOCKED");
    assert.match(result.blocked_reason, /staged/);
    assert.equal(load(a.id)?.status, "APPROVED");
  } finally { mock.mock.restore(); syncBuiltinESMExports(); }
});

import { unlinkSync } from "node:fs";
test("승인 뒤 추가한 미기록 파일은 배포에 섞이지 않는다", async () => {
  const id = manifest().widgets[0]!.widget_id;
  const a = request("cdn_deploy", "t", deploymentPayload(id));
  decide(a.id, "APPROVED");
  const file = p("src", "widgets", id, "unapproved.js");
  try {
    writeFileSync(file, "// not approved");
    const result = await deploy(id, a.id);
    assert.equal(result.result, "BLOCKED");
    assert.match(result.blocked_reason, /파일 목록 불일치/);
    assert.equal(load(a.id)?.status, "APPROVED");
  } finally { unlinkSync(file); }
});

test("같은 프로세스에서 발급한 승인 TTL은 벽시계 역행으로 오판하지 않는다", (t) => {
  const a = request("cdn_deploy", "t", {});
  const previous = Date.now();
  t.mock.method(Date, "now", () => previous - 1000);
  assert.equal(decide(a.id, "APPROVED")?.status, "APPROVED");
  assert.equal(assertApproved(a.id, "cdn_deploy").id, a.id);
});
