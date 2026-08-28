# RESUME — 다음 세션에서 이어가는 지점

작업 경로: `C:\Users\cut07\projects\imweb-widget-agent`
저장소: `https://github.com/skgns039-star/n2j-imweb-widgets` (public)

## 지금 상태 (2026-08-28 갱신)

| 항목 | 상태 |
|---|---|
| 검사 | **151/151 통과** · typecheck OK · lint OK · secretscan 유출 0건 |
| 텔레그램 봇 | `@n2j_IMWEB_WIDGET_bot` · chat_id `8995797720` · polling · 세션과 분리된 프로세스로 상주 (pid 는 `state/bot.lock`) |
| 실행 엔진 | `claude_agent_sdk` (어댑터 왕복 실측 통과) |
| 사이트 | `sehwa` (세화건설) `https://sehwaconstruction.imweb.me` |
| 로더 | v1.1.0 · 4개 페이지 전부 부팅 확인 |
| 위젯 | `hello-badge@0.1.0`(mount:none) · `cta-contact@0.1.0`(mount:slot) — 둘 다 `enabled: true`, 태그 배포 완료 |
| registry | `raw.githubusercontent` (OPEN-REG-01 결정) · 반영 실측 **약 200초** |
| 의존성 | `claude-agent-sdk@0.3.247`(8/28) · `typescript@^7` · playwright·yaml 최신. `@types/node` 는 26 이 나와 있어도 **24 유지** — 런타임이 Node 24 다 |

## ★ M0 게이트 — **완료 (2026-08-25)**

| 항목 | 결과 |
|---|---|
| 로더 1회 삽입 | ✅ v1.1.0, 4개 페이지 전부 부팅 |
| 서브파일 수정 → 실사이트 반영 | ✅ 뱃지 렌더, 콘솔 에러 0 |
| 3지점 해시 일치 | ✅ `68ff35cc369a` |
| **롤백 왕복** | ✅ enabled:false → 뱃지 0개(사이트 정상) → true → 뱃지 복귀 |

실측: registry 반영 **약 200초**(정지 58초 / 재개 201초). 로더는 `cache:no-store` 로 읽으므로
브라우저 캐시는 개입하지 않고, 지연은 전적으로 raw 의 엣지 캐시(max-age=300)에서 온다.

## SEO 스킬 (ENG-046) — M1 진단 전용, 2026-08-25 추가

| 항목 | 상태 |
|---|---|
| 스킬 배치 | `.claude/skills/imweb-seo/` + `~/.codex/skills/imweb-seo/` (해시 10/10 일치) |
| 코드 | `src/seo/` 안에만. 라우터 진입 8줄 예외 |
| 트리거 | SEO·메타·검색등록·robots·GA4 등. 위젯/슬롯/배포가 함께 나오면 되묻는다 |
| 범위 | **진단까지.** 아임웹 쓰기 0건. 9~11단계·Naver/Daum 폼은 `SEO-M2` 게이트가 차단 |
| 검사 | STEST-001~028 전량 + ITEST-001~004. `npm run stest:coverage` 가 미구현 1건도 허용 안 함 |

**다음 SEO 작업:** 텔레그램에 `SEO` → 애널리틱스 사전 질문(Q-A1) 답변 → 메타 키워드 1개 → 진단 보고서.

## M2 · 검색엔진 등록 (2026-08-28 진행 중)

게이트가 열려서 브라우저 자동화가 실제로 돌기 시작했다.

| 게이트 | 판정 |
|---|---|
| OPEN-BRW-01 약관 | **RESOLVED_CONDITIONAL** — 원문상 금지 대상은 "불법 자동화로 속도지연·안전성 유발". 본인 사이트·저빈도는 비해당. 고객사 확장 시 재판정 |
| OPEN-BRW-02 2차 인증 | **RESOLVED** — 미사용 확인, 세션 재사용 경로 성립 |
| CHK-003 무료 호출 범위 / CHK-005 요금제 / SEO-M2 | **RESOLVED** |

실행 흔적 (모두 `state/` — 커밋되지 않는다):
- 사이트 검증 토큰 3종 확보: `state/seo/sehwa.verification.json` (naver · gsc · bing)
- 콘솔 세션: 아임웹 · 네이버 · 다음 (`state/browser/*.storage.json`)
- 구글 OAuth 토큰: `state/google/token.json`
- 메뉴·SEO 관측: `sehwa.menus.json` · `sehwa.menu-seo.json` · `sehwa.probe.json`

새 명령:
```
npm run console:login   # 검색엔진 콘솔 로그인 (사람이 직접)
npm run seo:register    # 사이트 등록
npm run seo:verify      # 네이버 소유확인
npm run google:auth / google:gsc
npm run daum:apply / naver:index / bing:setup
```

**아직 확인 안 된 것:** 각 콘솔에서 소유확인·색인 요청이 실제로 수락됐는지의 최종 상태. 등록 결과 보고가 남았다.

## 다음 작업 후보

1. **실사용 위젯 제작** — hello-badge 는 검증용이다. 실제 팔 위젯을 `src/widgets/` 에 만든다
2. **슬롯 프리셋** (OPEN-REG-02) — 특정 위치에 붙일 위젯이 필요해지면 아임웹에 슬롯 div 1회 추가
3. **Cloudflare 이전** — 고객사 확장 시 REQ-022(60초) 충족용
4. **M1/M2** — 신규 위젯 무수정 추가 검증 / 브라우저 자동 업로드

## 일일 점검 (2026-08-25 추가)

Windows 작업 스케줄러 `imweb-widget-daily` — 매일 09:00 에 `node checks/daily.ts` 실행, `logs/daily.log` 에 누적.
검사 항목: 4지점 무결성 + registry 실시간 서빙(활성 모듈이 manifest 와 일치하는지). 이상이면 exit 1.

```
Get-ScheduledTaskInfo imweb-widget-daily     # 마지막 결과(0=정상)
node checks/daily.ts                        # 지금 즉시 확인
Unregister-ScheduledTask imweb-widget-daily # 해제
```

**Claude/Codex 에이전트를 스케줄에 걸지 않았다** — CHK-004(구독 SDK 무인 실행)가 OPEN 이라 사람 트리거만 허용된다. 이 작업은 LLM 을 호출하지 않는 순수 검사다.

## 텔레그램 대화 개선 (2026-08-25)

증상: "안녕", "어제 요청사항 진행 다 됐어?", 위저드 선택지 "b" 가 전부 `지시가 불명확합니다` 로 회신됐다.

| 원인 | 조치 |
|---|---|
| `classify()` fallthrough 가 `unclear` — 키워드에 안 걸리면 엔진까지 가지 못함 | fallthrough 를 `agent` 로. 승인·킬스위치·배포 등 결정적 경로만 위에서 가로챈다 |
| 위저드 15분 만료 후 도착한 "b" 가 일반 fallthrough 로 떨어짐 | 만료 안내로 회신 |
| 엔진이 터미널 작업 이력을 모름 | `prompts/AGENT_SYSTEM.md` 에 RESUME→HARNESS_LOOP→RUN_STATE→git log 선행 열람 규칙 |
| 4096자 초과·빈 응답 전송 실패 | `send()` 3900자 분할 + 빈 응답 대체 |

대화 맥락은 `state/threads.sqlite3` 의 `conversation_key`(chat+topic)별 SDK 세션 resume 으로 이어진다.
봇 재기동해야 반영된다. 세션과 분리해서 띄우려면:
```
Stop-Process -Id (Get-Content stateot.lock) -Force
Start-Process node -ArgumentList '--env-file-if-exists=.env','src/bot/index.ts' `
  -WorkingDirectory C:Userscut07projectsimweb-widget-agent -WindowStyle Hidden `
  -RedirectStandardOutput logsot.out -RedirectStandardError logsot.err
```

## 미해결 (추적 중)

| 항목 | 내용 |
|---|---|
| **REQ-022 완화** | 킬 스위치 반영이 60초 → **최대 5분** (raw 의 `max-age=300`). 고객사 확장 시 Cloudflare Pages(`max-age=60`)로 해소 |
| OPEN-REG-02 | 슬롯 프리셋 위치 미정. 현재 `mount: none` 이라 불필요 |
| OPEN-BRW-03 | `OPERATING_APPROVED` 발급. BRW-01·02 는 8/28 해소 |
| CHK-001·002 | 아임웹 Script API 쓰기 · 비공개 앱 OAuth. 여전히 OPEN |
| CHK-004 | 구독 SDK 무인 실행. **사람 트리거만** — 일일 점검이 LLM 을 안 쓰는 이유다 |
| OPEN-PNY-01 / OPEN-HLM-01 | Ponytail 훅 · Hallmark 컴포넌트 모드. 미착수 |
| CHK-005 | **해소됨** — 공통 코드 삽입이 4개 페이지 전부 적용됨을 실측 |

## 되살리기

```
cd C:\Users\cut07\projects\imweb-widget-agent
npm ci
npm run setup:check     # 전 항목 OK 여야 한다
npm test                # 151/151
npm start               # 텔레그램 봇 기동
```

`.env` 는 커밋되지 않는다. 다른 PC에서는 `.env.example` 을 복사해 사람이 값을 채운다.

## 이 프로젝트에서 절대 완화하지 않는 것

INV-1~9 (`contracts/AUTHORITY_MANIFEST.yaml`), 승인 게이트, 4지점 해시 검증,
아임웹 쓰기 전 스냅샷, 비밀값 미노출. 자세한 건 `AGENTS.md` 를 먼저 읽는다.
