import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
export const sri = (b: Buffer | string) => "sha384-" + createHash("sha384").update(b).digest("base64");
export const gzipSize = (b: Buffer | string) => gzipSync(b).length;

/** 아임웹은 저장 시 주석을 제거하는 등 코드를 정규화한다.
 *  따라서 아임웹 코드 비교는 바이트가 아니라 이 정규화본으로만 한다 (§7.8, §19.3-6). */
export function normalizeCode(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/\s+/g, " ")
    // 주석이 빠진 자리에 남는 공백까지 같은 기준으로 접는다. 안 접으면 diff가 0이 아니게 된다.
    .replace(/\s*([<>;{}])\s*/g, "$1")
    .trim();
}

export const normalizedDiff = (a: string, b: string) => (normalizeCode(a) === normalizeCode(b) ? 0 : 1);
