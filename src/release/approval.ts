/* ENG-022. 침묵·과거 승인·계획 승인은 외부 실행 승인이 아니다 (§10). */
import { writeFileSync, readdirSync, existsSync, mkdirSync, openSync, closeSync, renameSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { p, json } from "./paths.ts";
import { looksSecret } from "./secrets.ts";

const consumed = new WeakMap<Approval, string>();
const issuedHere = new Map<string, { created_at: string; monotonic: number }>();
const TTL_MS = 15 * 60 * 1000;

function dir() {
  const d = p("logs", "approvals");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

export type Approval = {
  id: string; action: string; target: string; created_at: string;
  status: "PENDING" | "APPROVED" | "EXPIRED" | "REJECTED" | "USED";
  payload: Record<string, unknown>; chat_id?: number;
};

function save(a: Approval) {
  const file = p("logs", "approvals", `${a.id}.json`);
  const temp = `${file}.${randomUUID()}.tmp`;
  try { writeFileSync(temp, JSON.stringify(a, null, 2), { flag: "wx", mode: 0o600 }); renameSync(temp, file); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
}

export function request(action: string, target: string, payload: Record<string, unknown>, chat_id?: number): Approval {
  if (looksSecret(JSON.stringify(payload))) throw new Error("BLOCKED: 승인 페이로드에 비밀값 포함");
  dir();
  const a: Approval = {
    id: "AP-" + randomUUID().slice(0, 8), action, target,
    created_at: new Date().toISOString(), status: "PENDING", payload, chat_id,
  };
  issuedHere.set(a.id, { created_at: a.created_at, monotonic: performance.now() });
  save(a);
  return a;
}

export function load(id: string): Approval | null {
  if (!/^AP-[0-9a-f]{8}$/.test(id)) throw new Error("BLOCKED: 잘못된 승인 ID");
  return existsSync(p("logs", "approvals", `${id}.json`)) ? json<Approval>(`logs/approvals/${id}.json`) : null;
}

export const expired = (a: Approval) => {
  const issued = issuedHere.get(a.id);
  const age = issued?.created_at === a.created_at
    ? performance.now() - issued.monotonic
    : Date.now() - Date.parse(a.created_at);
  return !Number.isFinite(age) || age < 0 || age > TTL_MS;
};

export function decide(id: string, status: "APPROVED" | "REJECTED", chat_id?: number): Approval | null {
  const a = load(id);
  if (!a) return null;
  if (chat_id !== undefined && a.chat_id !== chat_id) throw new Error("BLOCKED: 다른 대화의 승인");
  if (a.status !== "PENDING") return a;
  if (expired(a)) { a.status = "EXPIRED"; save(a); return a; }
  a.status = status;
  save(a);
  return a;
}

/** 배포·롤백·아임웹 쓰기 직전 게이트. 통과하지 못하면 실행하지 않는다 (INV-8). */
export function assertApproved(id: string | undefined, action: string, expected: Record<string, unknown> = {}): Approval {
  if (!id) throw new Error(`BLOCKED: 승인 페이로드 없음 (${action})`);
  const a = load(id);
  if (!a) throw new Error(`BLOCKED: 승인 ID 없음 (${id})`);
  if (a.action !== action) throw new Error(`BLOCKED: 승인 범위 불일치 (${a.action} != ${action})`);
  if (expired(a)) { a.status = "EXPIRED"; save(a); throw new Error("BLOCKED: 승인 만료 (15분)"); }
  if (a.status !== "APPROVED") throw new Error(`BLOCKED: 승인 상태 ${a.status}`);
  for (const [key, value] of Object.entries(expected)) {
    if (canonical(a.payload[key]) !== canonical(value)) throw new Error(`BLOCKED: 승인 대상/내용 불일치 (${key})`);
  }
  if (existsSync(p("logs", "approvals", `${id}.used`))) throw new Error("BLOCKED: 이미 사용한 승인");
  return a;
}

/** 객체 키 순서와 무관한 JSON 내용 비교. */
export const canonical = (value: unknown): string => JSON.stringify(value, (_key, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);

/** 외부/설정 쓰기 직전에 한 번 소비한다. 실패한 실행도 같은 승인을 재사용하지 않는다. */
export function consumeApproval(id: string | undefined, action: string, expected: Record<string, unknown>): Approval {
  const a = assertApproved(id, action, expected);
  let fd: number;
  try { fd = openSync(p("logs", "approvals", `${a.id}.used`), "wx", 0o600); }
  catch { throw new Error("BLOCKED: 승인 소비 실패 또는 이미 사용 중"); }
  closeSync(fd);
  a.status = "USED";
  save(a);
  consumed.set(a, canonical(a));
  return a;
}

/** §24.7. 위저드가 만료·취소되면 그 대화의 대기 승인도 함께 무효화한다 — orphan 승인을 남기지 않는다. */
export function invalidatePending(chat_id: number, reason: "EXPIRED" | "REJECTED" = "EXPIRED"): number {
  let n = 0;
  for (const f of readdirSync(dir()).filter((f) => /^AP-[0-9a-f]{8}\.json$/.test(f))) {
    const a = json<Approval>(`logs/approvals/${f}`);
    if (a.status !== "PENDING" || a.chat_id !== chat_id) continue;
    a.status = reason;
    save(a);
    n++;
  }
  return n;
}

export function latestPending(chat_id?: number): Approval | null {
  const rows = readdirSync(dir()).filter((f) => /^AP-[0-9a-f]{8}\.json$/.test(f))
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

/** 동일 프로세스에서 소비한 승인 객체만 후속 공개 단계에 한 번 사용할 수 있다. */
export function useConsumedApproval(a: Approval, actions: string[], expected: Record<string, unknown>): void {
  if (consumed.get(a) !== canonical(a) || !actions.includes(a.action)) throw new Error("BLOCKED: 유효한 실행 승인 없음");
  for (const [key, value] of Object.entries(expected)) {
    if (canonical(a.payload[key]) !== canonical(value)) throw new Error("BLOCKED: 공개 대상이 승인 후 변경됨");
  }
  consumed.delete(a);
}
