/* PTEST-014 / TEST-004 / AC-003. dist 1바이트 변조 → 불일치 감지. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { p, manifest } from "../src/release/paths.ts";
import { sha256, sri, normalizeCode, normalizedDiff } from "../src/release/hash.ts";
import { verify } from "../src/release/verify.ts";
import { lintCss, lintJs } from "../src/release/css_scope_lint.ts";

test("빌드 산출물은 정본과 해시가 같다 (번들러 없음)", async () => {
  const pts = await verify({ cdn: false });
  assert.ok(pts.length > 0, "검증 대상이 있어야 한다");
  assert.deepEqual(pts.filter((x) => !x.ok), [], "로컬 4지점 중 source/dist 전부 일치해야 한다");
});

test("dist를 1바이트 변조하면 무결성 검사가 실패한다", async () => {
  const w = manifest().widgets[0]!;
  const file = join(p("dist", w.widget_id, w.version), "index.js");
  const original = readFileSync(file);
  try {
    appendFileSync(file, "\n// tampered\n");
    const pts = await verify({ widget: w.widget_id, cdn: false });
    assert.ok(pts.some((x) => x.point === "dist" && !x.ok), "dist 불일치를 잡아야 한다");
  } finally {
    writeFileSync(file, original);
  }
});

test("SRI는 sha384 base64 형식이다", () => {
  const s = sri("hello");
  assert.match(s, /^sha384-[A-Za-z0-9+/]+=*$/);
  assert.notEqual(sha256("hello"), sha256("hello "));
});

test("아임웹 정규화 diff — 주석 제거 후 같으면 0", () => {
  const a = "<script>/* 주석 */ var x = 1;</script>";
  const b = "<script>var x = 1;</script>";
  assert.equal(normalizedDiff(a, b), 0);
  assert.equal(normalizedDiff(a, "<script>var x = 2;</script>"), 1);
  assert.equal(normalizeCode("a   b"), "a b");
});

test("CSS 스코프 린터가 전역 오염을 잡는다", () => {
  assert.ok(lintCss("body { margin: 0 }", "x.css").length > 0);
  assert.ok(lintCss(".btn { color: red }", "x.css").length > 0, "ddak- 접두사 없으면 실패");
  assert.ok(lintCss("@import url(a.css); .ddak-a { color: red }", "x.css").length > 0);
  assert.ok(lintCss(".ddak-a { z-index: 99999 }", "x.css").length > 0);
  assert.equal(lintCss(".ddak-a { color: red }", "x.css").length, 0);
  assert.ok(lintJs("window.foo = 1", "x.js").length > 0);
  assert.equal(lintJs("window.__ddak = {}", "x.js").length, 0);
});

/* @keyframes 스텝(0%/50%/from/to)을 셀렉터로 오인해 정상 위젯 빌드를 막은 적이 있다. */
test("린터가 @keyframes 스텝을 셀렉터로 오인하지 않는다", () => {
  const css = ".ddak-a { animation: ddak-p 1s } @keyframes ddak-p { 0%, 100% { opacity: 1 } 50% { opacity: .3 } }";
  assert.deepEqual(lintCss(css, "x.css"), []);
  assert.deepEqual(lintCss("@keyframes ddak-q { from { top: 0 } to { top: 9px } }", "x.css"), []);
  // 진짜 전역 셀렉터는 여전히 잡아야 한다 — @media 안쪽도 검사 대상이다
  assert.ok(lintCss("@media (min-width: 40em) { body { margin: 0 } }", "x.css").length > 0,
    "@media 안의 전역 셀렉터가 빠져나가면 안 된다");
  assert.ok(lintCss("@supports (display: grid) { html { color: red } }", "x.css").length > 0);
  assert.deepEqual(lintCss("@media (max-width: 480px) { .ddak-a { width: 100% } }", "x.css"), []);
});
