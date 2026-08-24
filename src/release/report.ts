/* §7.6 출력 계약. 모든 행동은 이 스키마로 logs/actions/에 남는다. */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { p } from "./paths.ts";

export type ActionReport = {
  action: "modify" | "build" | "deploy" | "rollback" | "inspect" | "install";
  widget_id: string;
  version_from: string;
  version_to: string;
  integrity: { source_sha256: string; dist_sha256: string; cdn_sha256: string; match: boolean };
  approval: { required: boolean; id: string; status: "PENDING" | "APPROVED" | "NONE" };
  result: "OK" | "BLOCKED" | "FAILED";
  blocked_reason: string;
  next_user_action: string[];
};

export function emptyReport(action: ActionReport["action"], widget_id = ""): ActionReport {
  return {
    action, widget_id, version_from: "", version_to: "",
    integrity: { source_sha256: "", dist_sha256: "", cdn_sha256: "", match: false },
    approval: { required: false, id: "", status: "NONE" },
    result: "OK", blocked_reason: "", next_user_action: [],
  };
}

export function writeReport(r: ActionReport): string {
  const d = p("logs", "actions");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  const file = p("logs", "actions", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(r, null, 2) + "\n");
  return file;
}

const s12 = (h: string) => (h ? h.slice(0, 12) : "-");

/** 사용자 보고: 한국어 3~5줄. 해시는 앞 12자만 (§7.6). */
export function summarize(r: ActionReport): string {
  const lines = [
    `[${r.action}] ${r.widget_id || "-"} ${r.version_from || "-"} -> ${r.version_to || "-"} : ${r.result}`,
    `해시 source ${s12(r.integrity.source_sha256)} / dist ${s12(r.integrity.dist_sha256)} / cdn ${s12(r.integrity.cdn_sha256)} / 일치 ${r.integrity.match ? "예" : "아니오"}`,
  ];
  if (r.approval.required) lines.push(`승인 ${r.approval.id || "-"} : ${r.approval.status}`);
  if (r.blocked_reason) lines.push(`중단 사유: ${r.blocked_reason}`);
  if (r.next_user_action.length) lines.push(`다음: ${r.next_user_action.join(" / ")}`);
  return lines.slice(0, 5).join("\n");
}
