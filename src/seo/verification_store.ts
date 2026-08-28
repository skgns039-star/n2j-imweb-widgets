/* 검색엔진 소유확인 코드 보관.

   코드는 비밀값이 아니다 — 사이트 <head> 에 그대로 노출된다. 그래도 state/ 아래 둔다.
   고객 사이트 정보이고, 저장소에 올릴 이유가 없다 (state/ 는 gitignore 대상).

   여러 엔진이 **같은 Header Code 칸**을 공유하므로, 한 엔진을 추가할 때
   나머지가 지워지면 안 된다. 그래서 값을 여기 모아두고 매번 전량을 조립한다. */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { p } from "../release/paths.ts";
import type { Verification } from "./header_code.ts";

const file = (site_id: string) => p("state", "seo", `${site_id}.verification.json`);

export function load(site_id: string): Verification {
  const f = file(site_id);
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, "utf8")) as Verification; } catch { return {}; }
}

/** 한 엔진 값을 넣거나 갱신한다. 나머지는 그대로 둔다. */
export function put(site_id: string, engine: keyof Verification, code: string): Verification {
  const v = load(site_id);
  const next: Verification = { ...v, [engine]: code.trim() };
  mkdirSync(p("state", "seo"), { recursive: true });
  writeFileSync(file(site_id), JSON.stringify(next, null, 2));
  return next;
}

export const summary = (v: Verification) =>
  (["gsc", "naver", "bing", "daum"] as const)
    .map((k) => `${k}=${v[k] ? "있음" : "없음"}`).join(" ");
