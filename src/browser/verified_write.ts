/* 공통 쓰기 트랜잭션: 승인된 전체 원문 → 스냅샷 → 저장 → 재조회 → 실패 시 1회 복원. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { p } from "../release/paths.ts";
import { sha256 } from "../release/hash.ts";
import { consumeApproval } from "../release/approval.ts";

export type EditorIO = {
  read(): Promise<string>; write(value: string): Promise<void>;
  save(): Promise<void>; reload(): Promise<void>;
};
export const writePayload = (site_id: string, target: string, before: string, next: string) =>
  ({ site_id, target, before_sha256: sha256(before), after_sha256: sha256(next) });

export async function verifiedWrite(io: EditorIO, site_id: string, target: string, before: string, next: string,
  approvalId?: string, normalize = (s: string) => s): Promise<{ ok: boolean; report: string; restored?: boolean }> {
  let attempted = false;
  try {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(site_id)) throw new Error("invalid site");
    if (await io.read() !== before) throw new Error("source changed");
    const dir = p("state", "imweb_snapshots", site_id);
    mkdirSync(dir, { recursive: true });
    const snapshot = p("state", "imweb_snapshots", site_id, `${randomUUID()}.txt`);
    writeFileSync(snapshot, before, { flag: "wx", mode: 0o600 });
    if (sha256(readFileSync(snapshot)) !== sha256(before)) throw new Error("snapshot mismatch");
    consumeApproval(approvalId, "imweb_write", writePayload(site_id, target, before, next));
    attempted = true;
    await io.write(next);
    if (await io.read() !== next) throw new Error("editor truncated input");
    await io.save();
    await io.reload();
    if (normalize(await io.read()) !== normalize(next)) throw new Error("saved content mismatch");
    return { ok: true, report: "전체 원문 스냅샷·승인·저장 후 재조회 일치 확인" };
  } catch {
    if (!attempted) return { ok: false, report: "BLOCKED: 원문·스냅샷·승인 검증 실패. 쓰기를 시작하지 않았습니다." };
    try {
      await io.write(before);
      if (await io.read() !== before) throw new Error("restore input mismatch");
      await io.save(); await io.reload();
      if (normalize(await io.read()) !== normalize(before)) throw new Error("restore mismatch");
      return { ok: false, restored: true, report: "BLOCKED: 저장 검증 실패. 원문 복원 및 재조회 일치를 확인했습니다." };
    } catch {
      return { ok: false, restored: false, report: "BLOCKED: 저장·자동 복원 검증 실패. 스냅샷으로 수동 복구가 필요합니다. 재시도하지 마세요." };
    }
  }
}
