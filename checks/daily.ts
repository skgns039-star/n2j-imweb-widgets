/* 하루 1회 상태 점검 (ENG-027 하네스 입력용).
   LLM·SDK 를 쓰지 않는다 — CHK-004(무인 SDK 실행)에 걸리지 않는 순수 검사다.
   실행: node checks/daily.ts   (실패 시 exit 1)
   ponytail: 알림 없이 logs/daily.log 기록만 한다. 놓치면 곤란해지면 텔레그램 통지를 붙인다. */
import { manifest } from "../src/release/paths.ts";
import { verify } from "../src/release/verify.ts";

const ts = new Date().toISOString();
const m = manifest();
const lines: string[] = [];
let bad = 0;

// 1) 4지점 무결성 (source/dist/cdn/sri)
const points = await verify();
const fail = points.filter((x) => !x.ok);
bad += fail.length;
lines.push(`무결성 ${points.length}지점 중 불일치 ${fail.length}건`);
for (const f of fail) lines.push(`  FAIL ${f.widget_id} ${f.file} [${f.point}] ${f.detail}`);

// 2) registry 실시간 서빙 — 로더가 실제로 읽는 URL 그대로
const url = m.cdn.registry_url;
if (!url) { bad++; lines.push("registry_url 없음"); }
else {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const reg = r.ok ? await r.json() : null;
    if (!reg) throw new Error(`HTTP ${r.status}`);
    const on = reg.modules.filter((x: any) => x.enabled).map((x: any) => `${x.widget_id}@${x.version}`);
    const stale = m.widgets.filter((w) => w.enabled && !on.includes(`${w.widget_id}@${w.version}`));
    if (stale.length) { bad++; lines.push(`manifest·registry 불일치: ${stale.map((w) => w.widget_id).join(", ")} 미반영`); }
    lines.push(`registry OK global_enabled=${reg.global_enabled} 활성=${on.join(", ") || "없음"} updated=${reg.updated_at}`);
  } catch (e) { bad++; lines.push(`registry 도달 실패: ${(e as Error).message}`); }
}

console.log(`=== ${ts} ${bad ? `이상 ${bad}건` : "정상"}\n${lines.join("\n")}`);
process.exit(bad ? 1 : 0);
