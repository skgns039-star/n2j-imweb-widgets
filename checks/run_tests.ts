/* 테스트는 운영 .env·큐·DB·스냅샷 대신 임시 저장소에서 실행한다. */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "../src/release/paths.ts";

export function runTests(patterns = ["tests/**/*.test.ts"]): number {
  if (!patterns.length || patterns.some((s) => !/^tests\/[\w/*.-]+\.test\.ts$/.test(s) || s.includes(".."))) {
    throw new Error("테스트 파일은 tests/ 아래의 .test.ts 경로로 지정하세요.");
  }
  // API 인증·사용자 Git 설정을 자식 프로세스에 전달하지 않는다.
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "SystemRoot", "TEMP", "TMP", "TMPDIR"]) if (process.env[key]) env[key] = process.env[key];
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = process.platform === "win32" ? "NUL" : "/dev/null";
  env.GIT_TERMINAL_PROMPT = "0";
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "imweb-tests-")));
  const git = (args: string[], cwd = ROOT) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
    const unsafe = (f: string) => /^(state|logs|seo|node_modules)\//.test(f) || /^\.env(?:$|\.)/.test(f) && f !== ".env.example";
    const committed = git(["ls-tree", "-r", "--name-only", "-z", "HEAD"]).split("\0").filter(Boolean);
    if ([...tracked, ...committed].some(unsafe)) throw new Error("운영 데이터가 Git 추적 대상입니다. 테스트 복제를 중단합니다.");
    // 현재 변경을 HEAD 위에 복사하므로 git diff 기반 계약 검사도 보존된다.
    git(["clone", "--quiet", "--no-hardlinks", "--", ROOT, scratch]);
    git(["remote", "remove", "origin"], scratch);
    git(["config", "core.filemode", "false"], scratch);
    const files = new Set([...committed, ...tracked, ...git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)]);
    for (const rel of files) {
      if (unsafe(rel)) continue;
      const from = join(ROOT, rel), to = join(scratch, rel);
      if (!existsSync(from)) { rmSync(to, { force: true }); continue; }
      if (!lstatSync(from).isFile()) throw new Error("일반 파일이 아닌 테스트 입력입니다.");
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to);
    }
    symlinkSync(join(ROOT, "node_modules"), join(scratch, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    env.IMWEB_ISOLATED_TEST_ROOT = scratch;
    console.log("운영 데이터를 제외한 임시 저장소에서 테스트합니다.");
    const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...patterns], { cwd: scratch, env, stdio: "inherit" });
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runTests(process.argv.length > 2 ? process.argv.slice(2) : undefined); }
  catch { console.error("격리 테스트 실행 실패. Git·의존성·입력 경로를 확인하세요."); process.exitCode = 1; }
}
