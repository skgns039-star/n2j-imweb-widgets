/* Header Code 칸의 **정본**. 이 파일이 원본이고 아임웹은 사본이다.

   왜 이렇게 하나:
   메타 인증 태그와 JSON-LD 는 둘 다 <head> 로 가야 해서 같은 칸을 쓴다.
   그런데 CodeMirror 는 화면 밖 줄을 DOM 에서 지워서(가상 스크롤) 기존 내용을 온전히 못 읽는다.
   못 읽는 값 위에 upsert 를 하면 블록이 중복된다 — 실제로 마커가 두 벌 들어간 적이 있다.
   그래서 **읽어서 고치지 않고, 우리가 가진 정본으로 칸을 통째로 쓴다.**

   주의: 이 칸에 사람이 직접 넣은 코드가 있으면 덮어쓴다.
   그래서 쓰기 전 스냅샷을 남기고, 로더가 있는 "Header Code 상단" 은 아예 손대지 않는다. */
import { wrap } from "./marker.ts";

export type Verification = { gsc?: string; naver?: string; bing?: string; daum?: string };

const TAG: Record<keyof Verification, string> = {
  gsc: "google-site-verification",
  naver: "naver-site-verification",
  bing: "msvalidate.01",
  daum: "daum-site-verification",
};

/** 소유확인 메타 태그. **값이 있는 엔진 줄만** 넣는다 — 빈 content 는 확인 실패를 만든다. */
export function verificationBlock(v: Verification): string | null {
  const lines = (Object.keys(TAG) as (keyof Verification)[])
    .filter((k) => (v[k] ?? "").trim())
    .map((k) => `<meta name="${TAG[k]}" content="${(v[k] as string).trim()}" />`);
  return lines.length ? wrap("owner-verification", lines.join("\n")) : null;
}

/** Header Code 칸 전체를 만든다. 순서를 고정한다 — 매번 같은 바이트가 나와야 diff 가 읽힌다. */
export function compose(a: { jsonLd?: string; verification?: Verification }): string {
  const parts: string[] = [];
  const ver = a.verification ? verificationBlock(a.verification) : null;
  if (ver) parts.push(ver);                                   // 소유확인이 먼저 — 검증 도구가 head 앞쪽을 본다
  if (a.jsonLd) parts.push(wrap("json-ld-org", a.jsonLd));
  return parts.join("\n\n");
}
