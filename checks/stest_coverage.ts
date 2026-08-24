/* SKILL §18.8 — 선언만 있고 테스트가 없는 STEST 가 1건이라도 있으면 빌드 실패다.
   장식용 선언을 허용하지 않기 위한 강제 장치다. */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { p } from "../src/release/paths.ts";

/** 스킬 정본은 한 벌이지만 배치 위치는 구축자마다 다르다.
 *  어느 쪽으로 열어도 같은 검사가 돌도록 양쪽을 본다 (REQ-006 동일 계약). */
export function skillPath(): string {
  const candidates = [
    p(".claude", "skills", "imweb-seo", "SKILL.md"),
    join(homedir(), ".codex", "skills", "imweb-seo", "SKILL.md"),
  ];
  const hit = candidates.find((f) => existsSync(f));
  if (!hit) throw new Error("imweb-seo SKILL.md 를 찾지 못했다 (.claude / .codex 양쪽 모두 없음)");
  return hit;
}

const ids = (text: string, prefix: string) =>
  new Set([...text.matchAll(new RegExp(`${prefix}-\\d{3}`, "g"))].map((m) => m[0]));

export function coverage() {
  const skill = readFileSync(skillPath(), "utf8");
  const declared = ids(skill, "STEST");
  const dir = p("tests", "seo");
  const tests = readdirSync(dir).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
  const implemented = ids(tests, "STEST");
  const missing = [...declared].filter((x) => !implemented.has(x)).sort();
  return { declared: [...declared].sort(), implemented: [...implemented].sort(), missing };
}

if (import.meta.filename === process.argv[1]) {
  const c = coverage();
  console.log(`STEST 선언 ${c.declared.length}건 / 구현 ${c.implemented.length}건`);
  if (c.missing.length) {
    console.error(`미구현 ${c.missing.length}건: ${c.missing.join(", ")}`);
    process.exit(1);
  }
  console.log("STEST 커버리지: 전량 구현");
}
