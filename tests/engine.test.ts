import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { p } from "../src/release/paths.ts";

test("엔진 workspace는 터미널 위치와 무관하게 저장소 루트로 해석된다", () => {
  const moduleUrl = pathToFileURL(p("src", "engine", "index.ts")).href;
  const result = execFileSync(process.execPath, [
    "--input-type=module", "-e",
    `const { agentConfig } = await import(${JSON.stringify(moduleUrl)}); process.stdout.write(agentConfig().workspace);`,
  ], { cwd: tmpdir(), encoding: "utf8" });
  assert.equal(result, p());
});
