# HANDOFF — 지금 상태와 다음 할 일

## 구축된 것 (M0 하네스)
- 불변 로더 `loader/loader.js` (registry 구동 · SRI · 킬 스위치 · 전 구간 fail-safe · gzip 5KB 이내)
- 릴리스 파이프라인: build → 4지점 해시 → 승인 → deploy(태그·purge·CDN 재검증) → rollback
- 성능 예산 게이트(30/100/5KB), CSS 스코프 린터(ddak- 강제), 시크릿 스캐너
- 텔레그램 라우터: 화이트리스트 · update 단일 소유자 · 대화별 Thread(sqlite) · 300초 타임아웃
- Agent Registry: `dry_run`(기본) / `codex_sdk` / `claude_agent_sdk` — yaml 한 줄로 전환
- 검사: `npm test` (라우팅·승인·무결성·로더 스키마·CSS 린트)

## §24 연결 위저드 (이번 변경분, TEST_CANDIDATE)
- 텔레그램에서 "연결" 한마디 → 소유권 확인 → A 사이트 / B 엔진 / C GitHub·CDN / D 텔레그램 4지선다
- 사이트 분기는 A1 신규 / A2 기존 / A3 재연결. **A2·A3는 스캔 선행 필수**
- 스캐너: Playwright 렌더 후 DOM 기준, 읽기 전용, 표본 한계 고지, C1~C4 판정, E1·E2·E4 충돌은 연결 실패
- 정본은 언제나 Git (INV-3) — 드리프트 / 미배포 / 불일치로 구분해 보고만 한다
- 로더 자기식별(v1.1.0): 중복 삽입 시 두 번째가 런타임에서 스스로 종료
- 이관(D1~D6): 스냅샷 없으면 착수 거부, 린트 실패 자동 수정 0건, 원본 제거는 72시간 관찰 후
- 비밀값: 위저드가 묻지 않고, 보내면 저장·로그·에코 0건 + 재발급 권고
- 연결 락: 같은 site_id를 두 대화가 동시에 진행하면 두 번째 거부, 커밋 직전 재확인

### 스캔 브라우저
이 PC에는 chromium이 이미 설치돼 있어 `npm run setup:check` 가 OK로 확인합니다.
다른 PC로 옮기면 `npx playwright install chromium` 이 1회 필요합니다.
브라우저가 없으면 스캔은 **정적 fetch로 대체하지 않고 실패**합니다 (fail-closed) — A2·A3 연결은 그때까지 진행되지 않습니다.

## 아직 없는 것 (의도적)
- 브라우저 자동 업로드(§19) — **M2.** M0 통과 전에는 착수하지 않는다. 로더 삽입·교체·원본 제거는 전부 **사람이 직접** 수행한다.
  (§24.3 스캔은 읽기 전용이라 M2와 별개로 허용된 경로다.)
- 주간 회귀 스케줄러, 다중 사이트, MCP 서버 프로세스, 독립 평가자.

## 셋업 (REQ-036~039)
```
cp .env.example .env      # 사람이 직접 값 입력. 에이전트는 .env 를 읽지도 쓰지도 않는다
npm run setup:check       # OK / MISSING / WARN 만 출력. 값은 절대 출력하지 않는다
npm run whoami            # 봇에 말을 건 뒤 실행하면 chat_id 를 알려준다 (본문·토큰 미출력)
```
chat_id 부트스트랩 순환(봇을 띄우려면 ALLOWED_CHAT_IDS 가 필요한데 chat_id 는 봇에 말을 걸어야 안다)은
`npm run whoami` 로 끊습니다. 봇이 polling 중이면 업데이트를 그쪽이 가져가므로 봇을 멈추고 실행하세요.
MISSING이 있으면 `npm start` 는 봇을 띄우지 않고 빠진 항목을 알려준 뒤 종료합니다.
허용 chat 의 런타임 정본은 환경변수 `ALLOWED_CHAT_IDS` 이며, yaml·manifest 와 다르면 **보고만** 하고 자동으로 맞추지 않습니다.

## 사용자가 해야 할 일 (이것 없이는 실동작 불가)
1. **GitHub public 저장소 생성** → `manifest/widgets.yaml` 의 `cdn.owner/repo` 와 git remote 설정
   (jsDelivr는 public이 필요하다. private면 Cloudflare Pages 대체 — `OPEN-REG-01`)
2. **@BotFather 로 봇 생성** → 토큰을 `IMWEB_WIDGET_BOT_TOKEN` 환경변수에 주입 (`.env` 는 gitignore)
3. **본인 chat_id 를 `config/allowed_chats.yaml` 에 등록** (기본값 0은 아무도 통과시키지 않는다)
   봇에 아무 메시지나 보낸 뒤 `logs/rejected.jsonl` 에서 chat_id를 확인하면 된다
4. **아임웹 요금제 확인** (공통 코드 삽입 가능 여부 — CHK-005) 후 `loader/LOADER_SNIPPET.md` 대로 1회 삽입
5. 엔진을 붙일 거면 CHK-004 확인 후 SDK 설치 + `config/agent_registry.yaml` 의 `runtime_engine` 변경

## 첫 왕복 (M0 게이트)
```
npm ci
npm run build
npm run verify:integrity -- --local     # source == dist
npm start                                # 텔레그램에서 "상태" → "배포" → "승인 AP-xxxx"
```

## 판정 기준
`npm run verify:integrity` 종료코드 0 · 배포 전후 아임웹 삽입 코드 정규화 diff = 0 · 롤백 후 이전 해시 복귀.
하나라도 어긋나면 BLOCKED다. 완료로 보고하지 않는다.
