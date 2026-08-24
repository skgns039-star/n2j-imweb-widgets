/* INV-10 — SEO 삽입물 마커. **위젯 로더와 절대 섞지 않는다.**
   이 모듈은 SEO 마커만 다룬다. 로더 마커를 읽거나 쓰는 코드가 여기 생기면 격리 계약 위반이다 (ITEST-002).
   삽입·갱신은 마커 구간만 치환한다. 파일 전체를 덮어쓰지 않는다. */

export const NS = "DDAK-SEO";

export type Block = { type: string; version: number; body: string; start: number; end: number };

const open = (type: string, v: number) => `<!-- ${NS}:START type=${type} v=${v} -->`;
const close = () => `<!-- ${NS}:END -->`;

/** 한 블록을 마커로 감싼다. 마커 없는 삽입은 존재하지 않는다 (STEST-001). */
export function wrap(type: string, body: string, version = 1): string {
  if (!/^[a-z0-9-]+$/.test(type)) throw new Error(`잘못된 마커 type: ${type}`);
  return `${open(type, version)}\n${body.trim()}\n${close()}`;
}

/** 마커로 감싸이지 않은 코드는 삽입을 거부한다 (INV-10). */
export function assertMarked(code: string): void {
  if (!hasAnyBlock(code)) {
    throw new Error(`BLOCKED: ${NS} 마커가 없는 SEO 코드는 삽입하지 않는다 (INV-10)`);
  }
}

const blockRe = () =>
  new RegExp(`<!--\\s*${NS}:START\\s+type=([a-z0-9-]+)\\s+v=(\\d+)\\s*-->([\\s\\S]*?)<!--\\s*${NS}:END\\s*-->`, "g");

export const hasAnyBlock = (code: string) => blockRe().test(code);

export function parse(code: string): Block[] {
  const out: Block[] = [];
  for (const m of code.matchAll(blockRe())) {
    out.push({ type: m[1]!, version: Number(m[2]), body: (m[3] ?? "").trim(), start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

export const find = (code: string, type: string) => parse(code).find((b) => b.type === type) ?? null;

/** 멱등성: 같은 type이 이미 있으면 추가하지 않고 그 구간만 갱신한다 (STEST-006).
 *  주변 코드는 한 바이트도 건드리지 않는다 (STEST-002, STEST-023). */
export function upsert(code: string, type: string, body: string, version = 1): string {
  const existing = find(code, type);
  const block = wrap(type, body, version);
  if (!existing) return code.trimEnd() + (code.trim() ? "\n" : "") + block + "\n";
  return code.slice(0, existing.start) + block + code.slice(existing.end);
}

/** 마커 구간만 제거한다. 주변 코드 diff = 0 이어야 한다 (STEST-023). */
export function remove(code: string, type: string): string {
  const b = find(code, type);
  if (!b) return code;
  const cut = code.slice(0, b.start) + code.slice(b.end);
  return cut.replace(/\n{3,}/g, "\n\n");
}

/** 마커 밖의 코드는 우리 것이 아니다 — 읽고 보고만 한다 (INV-10). */
export function foreignRegions(code: string): string[] {
  const blocks = parse(code);
  const out: string[] = [];
  let cursor = 0;
  for (const b of blocks) {
    const chunk = code.slice(cursor, b.start).trim();
    if (chunk) out.push(chunk);
    cursor = b.end;
  }
  const tail = code.slice(cursor).trim();
  if (tail) out.push(tail);
  return out;
}

/** 드리프트 감시 — 있던 마커가 사라졌는지 (STEST-026). */
export function lostTypes(before: string, after: string): string[] {
  const had = parse(before).map((b) => b.type);
  const now = new Set(parse(after).map((b) => b.type));
  return had.filter((t) => !now.has(t));
}
