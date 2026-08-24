/* TEST-034 / TEST-035 / TEST-036 — 로더 fail-safe. INV-7, INV-9.
   jsdom 없이 최소 DOM 셰임으로 돌린다 (의존성 추가 금지). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { p } from "../src/release/paths.ts";

const LOADER = readFileSync(p("loader", "loader.js"), "utf8");

type El = { tagName: string; attrs: Record<string, unknown>; onload?: () => void; onerror?: () => void };

function makeEnv(registry: unknown, opts: { slot?: boolean; path?: string; ok?: boolean } = {}) {
  const injected: El[] = [];
  const el = (tag: string): any => {
    const e: any = { tagName: tag, attrs: {}, setAttribute: (k: string, v: unknown) => (e.attrs[k] = v), remove() {} };
    return e;
  };
  const slot = opts.slot === false ? null : el("div");
  const script: any = el("script");
  script.attrs["data-site"] = "test-site";
  script.attrs["data-registry"] = "https://cdn.example/registry.json";
  script.getAttribute = (k: string) => script.attrs[k] ?? null;

  const doc = {
    currentScript: script,
    body: el("body"),
    head: { appendChild: (e: El) => { injected.push(e); queueMicrotask(() => e.onload?.()); } },
    createElement: el,
    querySelector: (sel: string) => (sel.includes("data-ddak-slot") ? slot : null),
  };

  const sandbox = {
    document: doc,
    location: { pathname: opts.path ?? "/" },
    window: {} as Record<string, unknown>,
    console: { warn() {} },
    fetch: async () => ({ ok: opts.ok !== false, json: async () => registry }),
    Promise, setTimeout, queueMicrotask, RegExp, JSON, String, Number, Array, Object,
  };
  return { sandbox, injected };
}

const valid = {
  schema_version: 1,
  updated_at: "2026-08-24T10:00:00+09:00",
  global_enabled: true,
  sites: { "test-site": { enabled: true } },
  modules: [{
    widget_id: "hello-badge", version: "0.1.0", enabled: true,
    match: { site: "test-site", path_glob: ["/*"] },
    mount: { type: "slot", slot: "content" },
    assets: [{ type: "js", url: "https://cdn.example/a.js", integrity: "sha384-x" }],
  }],
};

const run = async (reg: unknown, opts?: Parameters<typeof makeEnv>[1]) => {
  const { sandbox, injected } = makeEnv(reg, opts);
  runInNewContext(LOADER, sandbox);
  await new Promise((r) => setTimeout(r, 20));
  return { injected, ns: sandbox.window.__ddak as any };
};

test("정상 registry면 모듈을 주입한다", async () => {
  const { injected } = await run(valid);
  assert.equal(injected.length, 1);
  assert.equal((injected[0] as any).integrity, "sha384-x");
  assert.equal((injected[0] as any).crossOrigin, "anonymous");
  assert.equal((injected[0] as any).defer, true, "렌더 차단 금지");
});

test("global_enabled:false면 아무것도 로드하지 않는다 (킬 스위치)", async () => {
  const { injected } = await run({ ...valid, global_enabled: false });
  assert.equal(injected.length, 0);
});

test("사이트별 스위치가 꺼져도 로드하지 않는다", async () => {
  const { injected } = await run({ ...valid, sites: { "test-site": { enabled: false } } });
  assert.equal(injected.length, 0);
});

test("스키마가 깨지면 fail-closed — 호스트는 멀쩡하다", async () => {
  for (const bad of [null, {}, { schema_version: 2, updated_at: "x", modules: [] }, { schema_version: 1, modules: [] }, "깨진 JSON"]) {
    const { injected } = await run(bad);
    assert.equal(injected.length, 0, `스키마 위반을 로드했다: ${JSON.stringify(bad)}`);
  }
});

test("registry fetch 실패는 조용히 종료한다", async () => {
  const { injected } = await run(valid, { ok: false });
  assert.equal(injected.length, 0);
});

test("enabled:false 모듈은 즉시 사라진다", async () => {
  const off = { ...valid, modules: [{ ...valid.modules[0], enabled: false }] };
  const { injected } = await run(off);
  assert.equal(injected.length, 0);
});

test("integrity 없는 자산은 실행하지 않는다 (REQ-014)", async () => {
  const noSri = { ...valid, modules: [{ ...valid.modules[0], assets: [{ type: "js", url: "https://cdn.example/a.js" }] }] };
  const { injected } = await run(noSri);
  assert.equal(injected.length, 0);
});

test("슬롯 앵커가 없으면 조용히 건너뛴다 (사이트 파손 방지)", async () => {
  const { injected } = await run(valid, { slot: false });
  assert.equal(injected.length, 0);
});

test("path_glob이 맞지 않으면 로드하지 않는다", async () => {
  const scoped = { ...valid, modules: [{ ...valid.modules[0], match: { site: "test-site", path_glob: ["/product/*"] } }] };
  assert.equal((await run(scoped, { path: "/about" })).injected.length, 0);
  assert.equal((await run(scoped, { path: "/product/123" })).injected.length, 1);
});

test("다른 사이트의 모듈은 로드하지 않는다", async () => {
  const other = { ...valid, modules: [{ ...valid.modules[0], match: { site: "other-site", path_glob: ["/*"] } }] };
  assert.equal((await run(other)).injected.length, 0);
});

/* TEST-054 — 로더 2개가 실제로 삽입돼도 두 번째는 런타임에서 자동 종료된다 (§24.2, INV-1). */
test("자기식별: window.__ddak.loader에 버전·사이트·부팅시각이 노출된다", async () => {
  const { ns } = await run(valid);
  assert.equal(typeof ns.loader.version, "string");
  assert.equal(ns.loader.site, "test-site");
  assert.equal(typeof ns.loader.bootAt, "number");
});

test("TEST-054 로더가 두 번 실행되면 두 번째는 즉시 종료한다", async () => {
  const { sandbox, injected } = makeEnv(valid);
  runInNewContext(LOADER, sandbox);
  await new Promise((r) => setTimeout(r, 20));
  const first = injected.length;
  const bootAt = (sandbox.window.__ddak as any).loader.bootAt;
  runInNewContext(LOADER, sandbox);            // 두 번째 삽입
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(injected.length, first, "두 번째 로더가 자산을 또 주입하면 안 된다");
  assert.equal((sandbox.window.__ddak as any).loader.bootAt, bootAt, "첫 로더의 식별 정보가 유지돼야 한다");
});
