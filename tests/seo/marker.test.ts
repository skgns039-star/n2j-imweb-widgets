/* STEST-001~007, 023, 026 — 마커 계약 (INV-10). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { p } from "../../src/release/paths.ts";
import { wrap, upsert, remove, parse, find, assertMarked, hasAnyBlock, foreignRegions, lostTypes, NS } from "../../src/seo/marker.ts";

const HOST = `<script src="https://cdn.jsdelivr.net/gh/o/r@loader-1.1.0/loader/loader.js" data-site="sehwa" defer></script>
<!-- 고객이 예전에 넣은 코드 -->
<script>window.legacyThing = 1;</script>`;

test("STEST-001 마커 없는 SEO 코드 삽입은 거부된다", () => {
  assert.throws(() => assertMarked('<meta name="google-site-verification" content="x">'), /마커가 없는/);
  assert.doesNotThrow(() => assertMarked(wrap("owner-verification", '<meta name="x" content="y">')));
});

test("STEST-002 SEO 블록을 넣어도 로더 영역 diff = 0", () => {
  const after = upsert(HOST, "owner-verification", '<meta name="google-site-verification" content="abc">');
  const loaderLine = HOST.split("\n")[0]!;
  assert.ok(after.includes(loaderLine), "로더 줄이 그대로 남아야 한다");
  assert.equal(after.split("\n")[0], loaderLine, "로더 줄 위치도 그대로여야 한다");
  assert.ok(after.includes("window.legacyThing = 1;"), "고객 기존 코드도 그대로여야 한다");
});

test("STEST-006 같은 마커를 2회 삽입해도 중복 없이 갱신만 된다 (멱등성)", () => {
  const one = upsert(HOST, "json-ld", '{"@type":"Organization"}');
  const two = upsert(one, "json-ld", '{"@type":"WebSite"}');
  assert.equal(parse(two).filter((b) => b.type === "json-ld").length, 1, "블록이 2개가 되면 안 된다");
  assert.equal(find(two, "json-ld")!.body, '{"@type":"WebSite"}');
  assert.equal((two.match(new RegExp(`${NS}:START`, "g")) ?? []).length, 1);
});

test("STEST-023 마커 구간만 롤백하면 주변 코드 diff = 0", () => {
  const withBlock = upsert(HOST, "owner-verification", "<meta name=x>");
  const back = remove(withBlock, "owner-verification");
  assert.ok(!hasAnyBlock(back), "마커가 남으면 안 된다");
  for (const line of HOST.split("\n")) assert.ok(back.includes(line.trim()), `주변 코드 유실: ${line.slice(0, 40)}`);
});

test("마커 밖 코드는 우리 것이 아니다 — 읽고 보고만 한다", () => {
  const withBlock = upsert(HOST, "json-ld", "{}");
  const foreign = foreignRegions(withBlock).join("\n");
  assert.ok(foreign.includes("legacyThing"), "기존 코드를 외부 영역으로 인식해야 한다");
  assert.ok(!foreign.includes(`${NS}:START`), "우리 블록은 외부 영역이 아니다");
});

test("STEST-026 마커가 사라지면 유실을 감지한다", () => {
  const before = upsert(HOST, "owner-verification", "<meta name=x>");
  const after = remove(before, "owner-verification");
  assert.deepEqual(lostTypes(before, after), ["owner-verification"]);
  assert.deepEqual(lostTypes(before, before), []);
});

test("STEST-007 스냅샷 저장에 실패하면 착수하지 않는다 (INV-6)", async () => {
  const { snapshotOriginal, io } = await import("../../src/bot/migrate.ts");
  const orig = io.write;
  io.write = () => { throw new Error("디스크 오류"); };
  try {
    assert.throws(() => snapshotOriginal("sehwa", "<html>header code</html>"), /디스크 오류/);
  } finally { io.write = orig; }
});

test("ITEST-002 SEO 모듈이 로더 마커를 참조하지 않는다", () => {
  const files = ["marker.ts", "quality.ts", "gates.ts", "observe.ts", "index.ts", "route.ts"];
  for (const f of files) {
    const src = readFileSync(p("src", "seo", f), "utf8");
    assert.ok(!src.includes("DDAK-LOADER"), `${f} 가 DDAK-LOADER 를 참조한다`);
  }
});

test("ITEST-002b SEO 산출물이 dist·registry·loader 를 건드리지 않는다", () => {
  const files = ["marker.ts", "quality.ts", "gates.ts", "observe.ts", "index.ts", "route.ts"];
  // 주석은 제외한다 — "건드리지 않는다"고 적은 문장까지 위반으로 세면 안 된다.
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const f of files) {
    const src = stripComments(readFileSync(p("src", "seo", f), "utf8"));
    for (const forbidden of ['p("dist"', 'p("loader"', 'p("registry', "writeRegistry", "publishRegistry"]) {
      assert.ok(!src.includes(forbidden), `${f} 가 ${forbidden} 에 접근한다`);
    }
  }
});

test("STEST-013 seo/** 의 토큰 문자열을 secretscan 이 검출한다", async () => {
  const { scanRepo, leaks } = await import("../../checks/secret_scan.ts");
  const dir = p("seo", "sehwa", "exports");
  const probe = p("seo", "sehwa", "exports", "__probe.json");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(probe, JSON.stringify({ note: "ghp_" + "a".repeat(36) }));
    assert.ok(scanRepo().some((h) => h.includes("__probe.json")), "seo/exports 가 검사 대상이어야 한다");
  } finally {
    rmSync(probe, { force: true });
  }
  assert.deepEqual(leaks(scanRepo()), [], "정리 후 유출 0건");
  assert.ok(existsSync(p("checks", "secret_scan.ts")));
});
