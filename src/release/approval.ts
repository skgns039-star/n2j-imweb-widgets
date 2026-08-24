/* ENG-022. 침묵·과거 승인·계획 승인은 외부 실행 승인이 아니다 (§10). */
import { writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { p, json } from "./paths.ts";

const TTL_MS = 15 * 60 * 1000;

function dir() {
  const d = p("logs", "approvals");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

export type Approval = {
  id: string; action: string; target: string; created_at: string;
  status: "PENDING" | "APPROVED" | "EXPIRED" | "REJECTED";
  payload: Record<string, unknown>; chat_id?: number;
};

function save(a: Approval) {
  writeFileSync(p("logs", "approvals", `${a.id}.json`), JSON.stringify(a, null, 2));
}

export function request(action: string, target: string, payload: Record<string, unknown>, chat_id?: number): Approval {
  dir();
  const a: Approval = {
    id: "AP-" + randomUUID().slice(0, 8), action, target,
    created_at: new Date().toISOString(), status: "PENDING", payload, chat_id,
  };
  save(a);
  return a;
}

export function load(id: string): Approval | null {
  return existsSync(p("logs", "approvals", `${id}.json`)) ? json<Approval>(`logs/approvals/${id}.json`) : null;
}

export const expired = (a: Approval) => Date.now() - Date.parse(a.created_at) > TTL_MS;

export function decide(id: string, status: "APPROVED" | "REJECTED"): Approval | null {
  const a = load(id);
  if (!a) return null;
  if (expired(a)) { a.status = "EXPIRED"; save(a); return a; }
  a.status = status;
  save(a);
  return a;
}

/** 배포·롤백·아임웹 쓰기 직전 게이트. 통과하지 못하면 실행하지 않는다 (INV-8). */
export function assertApproved(id: string | undefined, action: string): Approval {
  if (!id) throw new Error(`BLOCKED: 승인 페이로드 없음 (${action})`);
  const a = load(id);
  if (!a) throw new Error(`BLOCKED: 승인 ID 없음 (${id})`);
  if (a.action !== action) throw new Error(`BLOCKED: 승인 범위 불일치 (${a.action} != ${action})`);
  if (expired(a)) { a.status = "EXPIRED"; save(a); throw new Error("BLOCKED: 승인 만료 (15분)"); }
  if (a.status !== "APPROVED") throw new Error(`BLOCKED: 승인 상태 ${a.status}`);
  return a;
}

/** §24.7. 위저드가 만료·취소되면 그 대화의 대기 승인도 함께 무효화한다 — orphan 승인을 남기지 않는다. */
export function invalidatePending(chat_id: number, reason: "EXPIRED" | "REJECTED" = "EXPIRED"): number {
  let n = 0;
  for (const f of readdirSync(dir())) {
    const a = json<Approval>(`logs/approvals/${f}`);
    if (a.status !== "PENDING" || a.chat_id !== chat_id) continue;
    a.status = reason;
    save(a);
    n++;
  }
  return n;
}

export function latestPending(chat_id?: number): Approval | null {
  const rows = readdirSync(dir())
    .map((f) => json<Approval>(`logs/approvals/${f}`))
    .filter((a) => a.status === "PENDING" && !expired(a) && (chat_id === undefined || a.chat_id === chat_id))
    .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at));
  return rows[0] ?? null;
}

/** §10 승인 페이로드 문구. 해시는 앞 12자만 노출한다 (§7.6). */
export function payloadText(a: Approval): string {
  const v = a.payload as Record<string, any>;
  return [
    `승인 요청 ${a.id}`,
    `행위자: imweb-widget-agent / 대상: ${a.target}`,
    `행동: ${a.action}`,
    `데이터: ${(v.files ?? []).join(", ") || "-"}`,
    `해시: ${String(v.sha256 ?? "-").slice(0, 12)}`,
    `영향: ${v.site ?? "-"} 공개 페이지`,
    `되돌리기: ${v.rollback ?? "git tag 이전 버전으로 롤백"}`,
    `유효 15분. "승인 ${a.id}" 로 회신하면 실행한다.`,
  ].join("\n");
}
