/* 2026-09-28 사용자 요구: 봇 명령으로 코드 위젯 수정·신규 생성이 자동으로 되되
   ① 누락 없이 ② 기존 코드가 변질되지 않게 ③ 방문자 화면에 관리용 요소가 보이지 않게.
   LLM 대신 각본 생성기로 정상·공격·실수 경로를 결정적으로 검사한다. */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT, p, manifest } from "../src/release/paths.ts";
import { runWidgetChange } from "../src/widget_pipeline/index.ts";
import { checkWidget, coverageErrors } from "../src/widget_pipeline/policy.ts";
import { writeAllowed, lastJson, type Generator, type GenSummary } from "../src/widget_pipeline/generate.ts";
import { build, BuildFailed } from "../src/release/build.ts";
import { load } from "../src/release/approval.ts";
import { handle, setWidgetGenerator } from "../src/bot/router.ts";
assert.equal(process.env.IMWEB_ISOLATED_TEST_ROOT, ROOT, "npm test로 격리 실행하세요.");

const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", ...a], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const WIDGET_PATHS = ["src/widgets", "dist", "integrity", "manifest", "registry.json", "loader"];

// 격리 복제본에 현재 작업 중 변경이 섞여 있으면 파이프라인이 "사전 확인"에서 멈춘다 → 기준 커밋을 만든다.
if (git("status", "--porcelain", "--", ...WIDGET_PATHS).trim()) { git("add", "-A", "--", ...WIDGET_PATHS); git("commit", "-qm", "test base", "--", ...WIDGET_PATHS); }
beforeEach(() => {
  git("checkout", "-q", "--", ...WIDGET_PATHS);
  git("clean", "-fdq", "--", "src/widgets", "dist", "integrity");
  rmSync(p("state", "widget-changes"), { recursive: true, force: true });
});

const ok: GenSummary = { requested: ["버튼 문구 변경"], done: ["버튼 문구 변경"], notDone: [] };
const scripted = (mutate: (dir: string) => void, summary: GenSummary = ok): Generator => async (task) => { mutate(join(task.workdir, "widget")); return summary; };
const edit = (file: string, from: string, to: string) => (dir: string) => {
  const f = join(dir, file); writeFileSync(f, readFileSync(f, "utf8").split(from).join(to));
};
const hashOf = (rel: string) => existsSync(p(rel)) ? readFileSync(p(rel)).toString("base64") : "";

const NEW_ID = "promo-banner";
const NEW_FILES = {
  "widget.json": JSON.stringify({ widget_id: NEW_ID, title: "할인 배너", purpose: "할인 안내", collects_personal_data: false, network: "없음 (CDN 자산 로드 외 요청 0건)" }, null, 2) + "\n",
  "style.css": ".ddak-promo { display: block; padding: 1em; font: inherit; }\n",
  "index.js": `(function () {\n  "use strict";\n  var host = document.querySelector('[data-ddak-slot="${NEW_ID}"]');\n  if (!host) return;\n  var el = document.createElement("div");\n  el.className = "ddak-promo";\n  el.textContent = "이번 달 할인 안내";\n  host.appendChild(el);\n})();\n`,
};
const writeNew = (files: Record<string, string>) => (dir: string) => { for (const [f, c] of Object.entries(files)) writeFileSync(join(dir, f), c); };

test("규칙: 현재 cta-contact 는 통과, 위험 코드는 거부", () => {
  const dir = p("src", "widgets", "cta-contact");
  const files: Record<string, string> = Object.fromEntries(["index.js", "style.css", "widget.json"].map((f) => [f, readFileSync(join(dir, f), "utf8")]));
  assert.deepEqual(checkWidget("cta-contact", files), []);
  const bad = (patch: Record<string, string>) => checkWidget("cta-contact", { ...files, ...patch }).join(" | ");
  assert.match(bad({ "index.js": files["index.js"]!.replace('"use strict";', '"use strict"; fetch("/x");') }), /네트워크/);
  assert.match(bad({ "style.css": files["style.css"]! + "\n.ddak-cta { position: fixed; }\n" }), /떠 있는 요소/);
  assert.match(bad({ "index.js": files["index.js"]!.replace("host.appendChild(root);", "document.body.appendChild(root);") }), /body\/html 에 직접 삽입/);
  assert.match(bad({ "index.js": files["index.js"]!.replace('var HREF = "/18";', 'var HREF = "https://evil.example/";') }), /외부 절대 URL/);
  assert.match(checkWidget("cta-contact", { ...files, "extra.js": "x" }).join(" "), /허용되지 않은 파일/);
});

test("생성기 쓰기 경로: widget/ 의 파일 3개만", () => {
  assert.ok(writeAllowed("/w", "widget/index.js"));
  assert.ok(writeAllowed("/w", "/w/widget/style.css"));
  for (const bad of ["../x/index.js", "/etc/passwd", "widget/../loader.js", "widget/sub/index.js", "widget/evil.js", "reference/index.js", ROOT + "/loader/loader.js"]) {
    assert.equal(writeAllowed("/w", bad), false, bad);
  }
  assert.deepEqual(lastJson('작업 완료\n{"requested":["a"],"done":["a"],"notDone":[]}'), { requested: ["a"], done: ["a"], notDone: [] });
});

test("누락 판정: 처리 못한 항목·요약 없음·개수 부족은 거부", () => {
  assert.deepEqual(coverageErrors(ok), []);
  assert.match(coverageErrors({ requested: ["a", "b"], done: ["a"], notDone: ["b: 규격상 불가"] }).join(), /처리하지 못한 요청/);
  assert.match(coverageErrors({ requested: ["a", "b"], done: ["a"], notDone: [] }).join(), /2개 중 1개/);
  assert.match(coverageErrors(null).join(), /요약/);
});

test("수정: 요청한 줄만 바뀌고 버전·빌드·승인 요청까지 자동, 다른 위젯·로더·registry 불변", async () => {
  const before = Object.fromEntries(["src/widgets/hello-badge/index.js", "loader/loader.js", "registry.json", "integrity/hello-badge.json", "dist/cta-contact/0.1.0/index.js"].map((f) => [f, hashOf(f)]));
  const r = await runWidgetChange({ mode: "edit", widget_id: "cta-contact", request: "버튼 문구를 견적 문의하기로", chat_id: 7 },
    { generator: scripted(edit("index.js", 'label.textContent = "문의하기";', 'label.textContent = "견적 문의하기";')) });
  assert.equal(r.ok, true, r.report);
  assert.equal(r.version, "0.1.1");
  assert.equal(manifest().widgets.find((w) => w.widget_id === "cta-contact")!.version, "0.1.1");
  assert.ok(existsSync(p("dist", "cta-contact", "0.1.1", "index.js")));
  for (const [f, h] of Object.entries(before)) assert.equal(hashOf(f), h, `${f} 가 바뀌면 안 된다`);
  const changed = r.diff!.split("\n").filter((l) => /^[-+][^-+]/.test(l));
  assert.deepEqual(changed.map((l) => l[0]).sort(), ["+", "+", "-", "-"]);   // 문구 두 줄만
  assert.equal(load(r.approvalId!)?.status, "PENDING");
  assert.equal(load(r.approvalId!)?.action, "cdn_deploy");
});

test("변질 감시: 생성기가 작업 폴더 밖(로더)을 건드리면 전체를 버린다", async () => {
  const loader = p("loader", "loader.js");
  const original = readFileSync(loader);
  try {
    const r = await runWidgetChange({ mode: "edit", widget_id: "cta-contact", request: "문구 변경" },
      { generator: scripted((dir) => { edit("index.js", "문의하기", "견적")(dir); writeFileSync(loader, original.toString() + "\n// injected"); }) });
    assert.equal(r.ok, false);
    assert.equal(r.stage, "변질 감시");
    assert.match(r.errors.join(), /loader\/loader\.js/);
    assert.equal(manifest().widgets.find((w) => w.widget_id === "cta-contact")!.version, "0.1.0");
  } finally { writeFileSync(loader, original); }
});

test("화면 노출: 규칙을 피해 슬롯 밖에 그려도 렌더 검사가 잡는다", async () => {
  const r = await runWidgetChange({ mode: "edit", widget_id: "cta-contact", request: "문구 변경" },
    { generator: scripted(edit("index.js", "host.appendChild(root);", 'host.appendChild(root); var o = document.querySelector("main") || host.parentNode; o.appendChild(root.cloneNode(true));')) });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "렌더 검사");
  assert.match(r.errors.join(), /슬롯 밖/);
  assert.equal(existsSync(p("dist", "cta-contact", "0.1.1")), false);
});

test("화면 노출·위험 API·누락은 저장소에 들어오지 못한다", async () => {
  const cases: [(dir: string) => void, GenSummary, RegExp][] = [
    [edit("style.css", "font: inherit;", "font: inherit; position: fixed; bottom: 0;"), ok, /떠 있는 요소/],
    [edit("index.js", '"use strict";', '"use strict"; fetch("/log");'), ok, /네트워크/],
    [edit("index.js", "문의하기", "견적"), { requested: ["문구", "색상"], done: ["문구"], notDone: ["색상: 지정 없음"] }, /처리하지 못한 요청/],
  ];
  for (const [mutate, summary, pattern] of cases) {
    const r = await runWidgetChange({ mode: "edit", widget_id: "cta-contact", request: "변경" }, { generator: scripted(mutate, summary) });
    assert.equal(r.ok, false);
    assert.match(r.errors.join(" "), pattern);
    assert.equal(git("status", "--porcelain", "--", ...WIDGET_PATHS).trim(), "", "관문 실패 시 저장소는 그대로");
  }
});

test("신규: 새 위젯은 꺼진 상태로 등록되고 슬롯 없이는 보이지 않는다", async () => {
  const r = await runWidgetChange({ mode: "new", widget_id: NEW_ID, request: "할인 안내 배너", chat_id: 7 },
    { generator: scripted(writeNew(NEW_FILES), { requested: ["할인 안내 문구"], done: ["할인 안내 문구"], notDone: [] }) });
  assert.equal(r.ok, true, r.report);
  const w = manifest().widgets.find((x) => x.widget_id === NEW_ID)!;
  assert.equal(w.enabled, false);
  assert.equal(w.version, "0.1.0");
  assert.deepEqual(w.mount, { type: "slot", slot: NEW_ID });
  assert.equal(r.render!.withoutSlot.visibleAdded, 0);
  assert.equal(r.render!.withSlot.outsideAdded, 0);
  assert.ok(existsSync(p("dist", NEW_ID, "0.1.0", "index.js")));
  assert.equal(manifest().widgets.filter((x) => x.widget_id !== NEW_ID).length, 2, "기존 위젯 항목 그대로");
});

test("신규: 규격 파일이 빠지거나 ID 가 이미 있으면 거부", async () => {
  const { ["style.css"]: _drop, ...partial } = NEW_FILES;
  const r = await runWidgetChange({ mode: "new", widget_id: NEW_ID, request: "배너" }, { generator: scripted(writeNew(partial)) });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /필수 파일 없음: style\.css/);
  assert.equal((await runWidgetChange({ mode: "new", widget_id: "cta-contact", request: "x" }, { generator: scripted(() => {}) })).stage, "입력");
  assert.equal((await runWidgetChange({ mode: "edit", widget_id: "hello-badge", request: "x" }, { generator: scripted(() => {}) })).stage, "입력");
});

test("검증용(internal) 위젯은 켤 수 없다 — 빌드가 막는다", () => {
  const file = p("manifest", "widgets.yaml");
  const text = readFileSync(file, "utf8");
  writeFileSync(file, text.replace(/(widget_id: hello-badge\n    version: 0\.1\.0\n    enabled: )false/, "$1true"));
  assert.throws(() => build(), (e: unknown) => e instanceof BuildFailed && /internal\(검증용\)/.test(e.errors.join()));
});

test("봇 명령 한 줄로 수정 → 검증 → 승인 요청까지", async () => {
  setWidgetGenerator(scripted(edit("index.js", 'label.textContent = "문의하기";', 'label.textContent = "견적 문의하기";')));
  try {
    const ctx = { agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "t", chat_id: 99 };
    const reply = await handle("cta-contact 버튼 문구를 '견적 문의하기'로 바꿔줘", ctx);
    assert.match(reply, /cta-contact@0\.1\.1 — 검증 통과, 승인 대기/);
    assert.match(reply, /승인 요청 AP-[0-9a-f]{8}/);
    assert.match(await handle("새 위젯 하나 만들어줘", ctx), /영문으로 정해/);
  } finally { setWidgetGenerator(undefined); }
});
