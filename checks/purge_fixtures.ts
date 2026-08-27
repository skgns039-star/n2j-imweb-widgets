/* 테스트가 만든 승인 파일이 쌓여 실제 승인 대기 목록을 오염시킨 적이 있다 (384건 누적).
   승인 모듈(src/release/)은 격리 계약상 건드리지 않는다 — 정리는 checks/ 쪽에서 한다. */
import { readdirSync, rmSync } from "node:fs";
import { p, json } from "../src/release/paths.ts";

/** 실제 사이트·위젯을 가리키는 승인은 배포 감사기록이다. 절대 지우지 않는다. */
const REAL = /hello-badge|cta-contact|sehwa/;
/** 검사용 픽스처가 쓰는 대상 이름. */
const FIXTURE = /^(t@|t ->|my-site|widget legacy-banner|runtime_engine|registry\(global)/;
const TEST_CHAT = (c?: number) => c !== undefined && c >= 9000 && c < 10000;

export function purgeFixtures(): { removed: number; kept: string[] } {
  const dir = p("logs", "approvals");
  let removed = 0;
  const kept: string[] = [];
  for (const f of readdirSync(dir)) {
    const a = json<{ chat_id?: number; target?: string; action?: string }>(`logs/approvals/${f}`);
    const target = a.target ?? "";
    if (REAL.test(target)) { kept.push(f); continue; }          // 감사기록 보존
    if (TEST_CHAT(a.chat_id) || FIXTURE.test(target)) { rmSync(`${dir}/${f}`, { force: true }); removed++; continue; }
    kept.push(f);                                                // 분류 불명은 보존한다 (fail-safe)
  }
  return { removed, kept };
}

if (import.meta.filename === process.argv[1]) {
  const r = purgeFixtures();
  console.log(`정리 ${r.removed}건 / 보존 ${r.kept.length}건`);
  for (const f of r.kept) console.log("  보존:", f);
}
