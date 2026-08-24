/* REQ-004. 아임웹 재편집 없이 되돌린다. 승인 대상 행위다 (§10).
   두 가지 경로:
     off   — enabled:false. 1비트 변경으로 즉시 정지 (§18.6-8)
     <ver> — 이전 불변 태그(w-<id>-<ver>)의 무결성 기록을 되살려 registry를 그 버전으로 되돌린다 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { stringify } from "yaml";
import { p, manifest, gateBlock } from "./paths.ts";
import { assertApproved } from "./approval.ts";
import { emptyReport, writeReport, summarize, type ActionReport } from "./report.ts";

const git = (...args: string[]) => execFileSync("git", args, { cwd: p(), encoding: "utf8" }).trim();

export async function rollback(widget_id: string, to: string, approvalId?: string): Promise<ActionReport> {
  const rep = emptyReport("rollback", widget_id);
  rep.approval.required = true;
  rep.approval.id = approvalId ?? "";

  try {
    const blocked = gateBlock("cdn_deploy");
    if (blocked) throw new Error(`BLOCKED: ${blocked}`);
    const a = assertApproved(approvalId, "rollback");
    rep.approval.status = a.status as "APPROVED";

    const m = manifest();
    const w = m.widgets.find((x) => x.widget_id === widget_id);
    if (!w) throw new Error(`BLOCKED: manifest 미등록 위젯 (${widget_id})`);
    rep.version_from = w.version;

    if (to === "off") {
      w.enabled = false;
      rep.version_to = w.version;
    } else {
      const tag = `w-${widget_id}-${to}`;
      let old: string;
      try {
        old = git("show", `${tag}:integrity/${widget_id}.json`);
      } catch {
        throw new Error(`BLOCKED: 태그 ${tag} 없음 — 되돌릴 버전이 CDN에 존재하지 않는다`);
      }
      writeFileSync(p("integrity", `${widget_id}.json`), old);
      w.version = to;
      w.enabled = true;
      rep.version_to = to;
    }

    writeFileSync(p("manifest", "widgets.yaml"), stringify(m));
    const { writeRegistry } = await import("./registry.ts");
    writeRegistry();
    rep.next_user_action = [
      "npm run deploy -- " + widget_id + " <approval_id> 로 registry를 CDN에 반영하고 purge까지 끝내라",
      "반영 확인 전에는 롤백 완료로 보고하지 않는다",
    ];
  } catch (e) {
    rep.result = String((e as Error).message).startsWith("BLOCKED") ? "BLOCKED" : "FAILED";
    rep.blocked_reason = (e as Error).message;
  }

  writeReport(rep);
  return rep;
}

if (import.meta.filename === process.argv[1]) {
  const [widget, to, approval] = process.argv.slice(2);
  if (!widget || !to) { console.error("사용법: npm run rollback -- <widget_id> <off|version> <approval_id>"); process.exit(1); }
  const rep = await rollback(widget, to, approval);
  console.log(summarize(rep));
  process.exit(rep.result === "OK" ? 0 : 1);
}
