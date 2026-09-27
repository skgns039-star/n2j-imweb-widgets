/* 구글 OAuth 2.0 (설치형 앱 / 루프백 방식).

   **이게 구글이 공식으로 여는 자동화 경로다.** 브라우저 자동화로 로그인하려 하면
   "브라우저 또는 앱이 안전하지 않을 수 있습니다" 로 막힌다 — 막는 게 정상이고, 뚫지 않는다.
   대신 동의는 **사람이 자기 브라우저에서** 한 번 하고, 우리는 refresh token 만 보관한다.
   아임웹·네이버 세션과 같은 원칙이다: 비밀번호를 받지 않는다.

   client_id / client_secret 은 설치형 앱 자격증명이라 비밀이 아니지만(구글 문서 명시),
   그래도 .env 로만 받는다. refresh token 은 진짜 비밀이므로 state/ 아래 둔다 (gitignore). */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { p } from "../release/paths.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** 소유확인 + 사이트 등록 + 사이트맵 제출에 필요한 최소 범위. 더 넓게 받지 않는다. */
export const SCOPES = [
  "https://www.googleapis.com/auth/siteverification",
  "https://www.googleapis.com/auth/webmasters",
];

const tokenFile = () => p("state", "google", "token.json");

type Stored = { refresh_token: string; obtained_at: string };

export function creds(): { id: string; secret: string } {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
  if (!id || !secret) {
    throw new Error("BLOCKED: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 이 .env 에 없다. npm run google:setup 참고.");
  }
  return { id, secret };
}

export const hasToken = () => existsSync(tokenFile());

/** 동의 1회. 루프백 포트로 code 를 받는다 — 사람이 값을 복사해 옮길 필요가 없다. */
export async function authorize(port = 8765): Promise<string> {
  const { id, secret } = creds();
  const redirect = `http://127.0.0.1:${port}`;
  const url = `${AUTH_URL}?${new URLSearchParams({
    client_id: id, redirect_uri: redirect, response_type: "code",
    scope: SCOPES.join(" "), access_type: "offline", prompt: "consent",
  })}`;

  console.log("[구글 동의 필요] 아래 주소를 브라우저에서 열어주세요:\n");
  console.log(url + "\n");

  const code = await new Promise<string>((resolve, reject) => {
    const srv = createServer((req, res) => {
      const got = new URL(req.url ?? "/", redirect).searchParams.get("code");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(got ? "<h3>연결됐습니다. 창을 닫아주세요.</h3>" : "<h3>code 가 없습니다.</h3>");
      srv.close();
      got ? resolve(got) : reject(new Error("code 를 받지 못했다"));
    });
    srv.listen(port);
    setTimeout(() => { srv.close(); reject(new Error("동의 대기 시간이 지났다")); }, 600_000);
  });

  const r = await fetch(TOKEN_URL, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json() as any;
  if (!j.refresh_token) throw new Error(`refresh token 을 못 받았다: 응답 내용은 비밀값 보호를 위해 생략`);
  mkdirSync(p("state", "google"), { recursive: true });
  writeFileSync(tokenFile(), JSON.stringify({ refresh_token: j.refresh_token, obtained_at: new Date().toISOString() } satisfies Stored, null, 2));
  return "구글 연결 완료. refresh token 저장됨 (state/google/).";
}

/** 매 호출마다 access token 을 새로 받는다. 짧게 살고 저장하지 않는다. */
export async function accessToken(): Promise<string> {
  if (!hasToken()) throw new Error("BLOCKED: 구글 동의가 없다. npm run google:auth 먼저.");
  const { id, secret } = creds();
  const { refresh_token } = JSON.parse(readFileSync(tokenFile(), "utf8")) as Stored;
  const r = await fetch(TOKEN_URL, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token, grant_type: "refresh_token" }),
  });
  const j = await r.json() as any;
  if (!j.access_token) throw new Error(`access token 갱신 실패: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token as string;
}

if (import.meta.main) {
  console.log(await authorize());
}
