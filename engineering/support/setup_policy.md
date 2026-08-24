# ENG-046 초기 셋업 지원 (REQ-036~039)

구현: `.env.example`, `checks/setup_check.ts`, `src/bot/index.ts` 부팅 가드.

## 원칙
- **에이전트는 `.env` 를 읽지도 쓰지도 않는다.** 값 주입은 사람만 한다 (REQ-037).
  `.env` 를 쓰는 코드를 만들지 않는다 — 검사로 강제한다.
- 어떤 경로에서도 비밀값을 화면·로그·파일에 출력하지 않는다. **존재 여부·형식 일치 여부만** 다룬다.
- `config/**` 쓰기 권한은 확장하지 않는다 (P-13).
- 새 라이브러리 없음. `node:process` / `node:child_process` / `node:module` 기본 기능만.

## .env 로딩 방식
`.env` 는 **Node 런타임의 `--env-file-if-exists=.env` 플래그**로 주입한다. 에이전트 코드에는 `.env` 를 읽는 구문이 없다 —
REQ-037("에이전트는 .env 를 읽지도 쓰지도 않는다")은 이렇게 지켜진다. 코드는 `process.env` 의 **존재 여부**만 본다.
파일이 없어도 실행은 계속되고, 그때는 `setup:check` 가 MISSING 으로 잡는다.

## 파일
- `.env.example` — **키만** 담고 값은 비운다. 이것만 커밋한다.
- `.env` — 사람이 복사해 채운다. `.gitignore` 대상이며 **secretscan 검사 대상**이다(값은 출력하지 않고 종류만 보고).

## `npm run setup:check`
| 항목 | 판정 |
|---|---|
| `IMWEB_WIDGET_BOT_TOKEN` | 존재 + 형식(`숫자8~10:35자`) 일치 여부만 |
| `ALLOWED_CHAT_IDS` | 1개 이상. 비었거나 `0` 뿐이면 MISSING |
| `CDN_OWNER` / `CDN_REPO` | 존재 + manifest 일치. 불일치는 **WARN(보고만)** |
| `git remote origin` | 설정 여부 |
| 저장소 public | jsDelivr 가능 여부. private면 MISSING + `OPEN-REG-01` |
| Node | v22.6 이상 |
| Playwright chromium | 미설치는 **WARN** (A1 신규 연결에는 불필요) |
| `IMWEB_API_KEY/SECRET` | **점검 대상 아님.** M2 전용이며 CHK-001~003 미해소 상태에서는 `gateBlock()` 이 차단한다 |

MISSING이 하나라도 있으면 종료코드 1. 마지막에 남은 항목의 조치 방법을 한 줄씩 낸다.

## 부팅 가드 (REQ-039)
`src/bot/index.ts` 의 `main()` 첫 줄에서 점검한다 — `npm start` 든 직접 실행이든 **모든 기동 경로가 여기를 지난다**.
MISSING이 있으면 봇을 띄우지 않고 목록을 낸 뒤 종료한다. `ALLOWED_CHAT_IDS` 가 비면 "아무도 통과하지 못하는 상태"임을 명시한다.

## 정본 관계 (INV-3)
- 허용 chat 의 **런타임 정본은 환경변수** `ALLOWED_CHAT_IDS` 다. `config/allowed_chats.yaml` 과 다르면 **보고만** 하고 자동 동기화하지 않는다.
- `CDN_OWNER/REPO` 도 manifest 와 다르면 보고만 한다. 어느 쪽이 맞는지 에이전트가 판단하지 않는다.

검사: TEST-061~066 / PTEST-043.
