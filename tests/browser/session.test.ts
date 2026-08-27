/* ENG-032 세션 계약 — 자격증명 미취급 · 게이트 · 만료 판정 (REQ-017, REQ-018). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { p, manifest } from "../../src/release/paths.ts";
import { sessionStatus, statePath, adminUrl, selectors, reloginNotice } from "../../src/browser/session.ts";

const SITE = manifest().sites[0]!.site_id;

test("자격증명을 다루는 코드가 존재하지 않는다 (REQ-017)", () => {
  // 문구가 아니라 **동작**을 본다 — "비밀번호를 받지 않습니다" 같은 안내문은 위반이 아니다.
  const src = readFileSync(p("src", "browser", "session.ts"), "utf8");
  for (const mechanism of [".fill(", ".type(", "keyboard.type", "IMWEB_PW", "IMWEB_PASSWORD"]) {
    assert.ok(!src.includes(mechanism), `세션 모듈이 값을 입력한다: ${mechanism}`);
  }
  // 비밀번호류 환경변수를 읽지 않는다
  assert.ok(!/process\.env\.[A-Z_]*(PASS|PW|SECRET)/.test(src), "비밀번호 환경변수를 읽으면 안 된다");
});

test("세션 파일 경로는 state/browser/ 이고 gitignore 대상이다 (P-10)", () => {
  assert.match(statePath(SITE).split("\\").join("/"), /state\/browser\/.+\.storage\.json$/);
  const ig = readFileSync(p(".gitignore"), "utf8");
  assert.ok(/^state\/$/m.test(ig) || /state\/browser\//.test(ig), "state/ 가 gitignore 되어야 한다");
});

test("저장된 세션이 없으면 로그인을 요구한다 — 자동 진행하지 않는다", () => {
  const s = sessionStatus("존재하지-않는-사이트");
  assert.equal(s.ok, false);
  assert.equal((s as any).needsLogin, true);
});

test("재로그인 안내는 자격증명을 요구하지 않는다", () => {
  const n = reloginNotice(SITE, "세션 만료");
  assert.match(n, /직접 로그인/);
  assert.match(n, /받지도 저장하지도 않습니다/);
  assert.ok(!/비밀번호를 (알려|입력해)/.test(n));
});

test("셀렉터는 외부 파일에 있고 미검증 상태가 표시된다 (§19.4)", () => {
  const s = selectors();
  for (const k of ["login_markers", "logout_markers", "common_code"]) {
    assert.ok((s as any)[k], `${k} 앵커 누락`);
  }
  assert.ok("primary" in s.login_markers && "fallback" in s.login_markers, "2단 셀렉터여야 한다");
  assert.equal(typeof s.verified, "boolean");
  assert.equal(s.verified, false, "실측 전에는 verified:false 여야 한다");
});

test("admin_url 은 manifest 의 사이트 호스트로 치환된다", () => {
  const url = adminUrl(SITE);
  assert.match(url, /^https:\/\//);
  assert.ok(!url.includes("{host}"), "치환되지 않은 자리표시자가 남으면 안 된다");
  assert.throws(() => adminUrl("없는사이트"), /BLOCKED/);
});

test("세션 파일은 저장소에 추적되지 않는다", () => {
  if (!existsSync(statePath(SITE))) return;                 // 아직 로그인 전이면 통과
  const { execFileSync } = require("node:child_process");
  const tracked = execFileSync("git", ["ls-files", "state/browser/"], { cwd: p(), encoding: "utf8" });
  assert.equal(tracked.trim(), "", "세션 파일이 git 에 추적되면 안 된다");
});
