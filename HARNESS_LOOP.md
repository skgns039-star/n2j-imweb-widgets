# HARNESS LOOP (ENG-027, RECORD_ONLY)

시작 근거: 배포 실패, 해시 불일치, 사용자 실사용 피드백, 아임웹 UI·업데이트로 인한 회귀.
변경 대상: `engineering/**`, `prompts/AGENT_SYSTEM.md`, 검사 스크립트.
모든 수정 후 재실행: TEST-003, TEST-004, TEST-005.
시스템 규칙·권한 변경은 사용자 승인 후에만 반영한다.

| 일시 | 이슈·피드백 | 원인 | 개선 후보 | 판정 | 재실행 검사 |
|---|---|---|---|---|---|
| 2026-08-24 | 초기 구축 | - | M0 하네스 설치 | 적용 | `npm test`, `npm run build`, `verify:integrity --local` |
| 2026-08-24 | §24 EXISTING_CHANGE (연결 위저드) | 스펙 신판 편입 | ENG-041~045 추가, 로더 1.0.0→1.1.0 자기식별 | 적용 | TEST-039~060, PTEST-038~042 + 기존 26건 회귀 |
| 2026-08-24 | 위저드 정상 완료가 방금 만든 승인까지 무효화 | 완료·취소·만료를 한 경로로 처리 | 정상 완료는 clearState, 취소·만료만 승인 무효화 | 수정 | TEST-045, PTEST-041 |
| 2026-08-24 | E1이 표본 페이지 간 슬롯을 중복으로 오탐 | 페이지별 개수를 합산 | 페이지 내 최대값 기준으로 변경 | 수정 | TEST-053 |
| 2026-08-24 | 테스트 파일 병렬 실행이 공유 sqlite·manifest를 서로 삭제 | 파일 병렬 기본값 | `--test-concurrency=1` 고정 | 수정 | 전체 59건 |

| 2026-08-24 | 초기 셋업 지원 (REQ-036~039) | 사람이 채워야 할 값이 문서에만 있었음 | `.env.example` + `setup:check` + 부팅 가드 | 적용 | TEST-061~066, PTEST-043 + 전체 회귀 |

| 2026-08-24 | 실행 엔진 연결 요청 | dry_run 기본값 | claude_agent_sdk 설치·전환, 어댑터 왕복 실측 통과 | 적용 | 전체 72건 회귀 |
| 2026-08-24 | 사용자가 봇 토큰을 대화로 2회 전송 | 값 주입 경로 오해 | 저장·기록 0건 유지, 재발급 안내. `npm run whoami` 로 chat_id 순환 해소 | 유지(거절) | TEST-042, PTEST-043 |

| 2026-08-24 | `.env` 에 값을 넣어도 프로세스가 못 읽음 | 로드 경로 부재 | npm 스크립트에 `--env-file-if-exists=.env` 추가 (에이전트 코드는 .env 미열람 유지) | 수정 | 전체 72건 |

| 2026-08-24 | **스캐너가 스크립트 109개 사이트를 0개로 보고** | page.evaluate에 화살표 함수 문자열을 넘겨 호출되지 않음 | 수집 코드를 IIFE로 변경 + 회귀 검사 추가 | 수정 | 전체 73건 |
| 2026-08-24 | **테스트가 실제 .env 를 삭제** | teardown이 무조건 rmSync | 원문 백업 후 복원하도록 변경 | 수정 | TEST-064/065 |
| 2026-08-24 | 세화건설(sehwa) 등록 | 신규 사이트 | manifest 등록, API 자격증명은 site 접미사 env로 분리 | 적용 | 스캔 C1 판정 |
| 2026-08-24 | GitHub public 저장소 연결 | jsDelivr 요구 | skgns039-star/n2j-imweb-widgets, state/ 비공개 제외, .gitattributes로 CRLF 변환 금지(INV-5) | 적용 | loader-1.1.0 CDN 해시 일치 |

| 2026-08-24 | **jsDelivr @main 이 12시간 캐시되어 배포·킬스위치가 반영 안 됨** | 브랜치→커밋 해석 캐시(s-maxage=43200)는 purge로 안 지워짐. 커밋 고정 URL·raw 는 최신 확인 | OPEN-REG-01 결정: registry만 raw.githubusercontent(max-age=300)로 분리. 자산은 jsDelivr 불변 태그 유지 | 적용 | 배포 반영 확인, TEST-034 재실행 필요 |
| 2026-08-24 | **REQ-022 완화 기록** | raw 는 max-age=300 | 킬 스위치 반영이 60초 → **최대 5분**. 고객사 확장 시 Cloudflare Pages(max-age=60)로 해소 | 완화(사용자 승인) | 미해소로 추적 |

| 2026-08-25 | **M0 게이트 완료** | - | 로더 삽입·1왕복·해시 일치·롤백 왕복 전부 실사이트 검증 | 완료 | 실사이트 렌더 확인 |
| 2026-08-25 | registry 반영 확인이 60초 타임아웃에 걸려 거짓 BLOCKED | raw 엣지 캐시 실측 약 200초인데 상한이 60초 | `CONFIRM_TIMEOUT_MS = 360초` 로 호스트 캐시 수명에 맞춤 | 수정 | 재개 배포 재실행 |
| 2026-08-25 | 개발 의존성 최신화 | @types/node 22·typescript 5 가 런타임(Node 24)·최신과 벌어짐 | `@types/node@^24`(실행 런타임에 맞춤) · `typescript@^7` | 적용 | typecheck OK · 74/74 · lint OK · secretscan 0건 |
| 2026-08-25 | REQ-022 완화 수치 확정 | 추정치였음 | 킬 스위치 반영 **실측 약 200초**(상한 5분). 60초 요구 미충족 유지 | 기록 | Cloudflare 이전 시 해소 |

| 2026-08-25 | 일일 상태 점검 요청 | 배포 후 무결성·registry 서빙이 조용히 깨질 수 있음 | `checks/daily.ts` + Windows 작업 스케줄러 `imweb-widget-daily`(매일 09:00 → `logs/daily.log`). LLM·SDK 미사용이라 CHK-004 무관 | 적용 | 1회 수동 실행 exit 0, 16지점 일치 |

| 2026-08-25 | SEO 스킬 격리 추가 (ENG-046) | EXISTING_CHANGE | .claude/.codex 양쪽 배치(해시 10/10), src/seo/ 격리, STEST 28 + ITEST 4 실구현 | 적용 | 118건 전량 |
| 2026-08-25 | **지시 [2]와 [3] 충돌** | "src/bot 수정 0줄" ↔ "라우터에 seo 인텐트 추가" | 라우터 진입 8줄만, SEO 로직은 src/seo/ 에만. ITEST-001 로 나머지 경로 diff 0 강제 | 최소 해석(보고함) | ITEST-001 |
| 2026-08-25 | Codex 호환 결합 1건 | stest_coverage 가 .claude/ 경로 하드코딩 | skillPath() 로 .claude/.codex 양쪽 탐색. CLAUDE.md 는 AGENTS.md 포인터만 | 수정 | REQ-006 검사 추가 |

| 2026-08-25 | 런타임 의존성 최신화 | claude-agent-sdk 0.3.241 → 0.3.243 (패치) | `npm update` 로 반영. playwright·yaml 은 이미 최신. `@types/node` 는 24 유지(Node 24 런타임 일치, 26은 없는 API를 통과시킴) | 적용 | typecheck OK · 118/118 · lint OK · secretscan 0건 · daily.ts 정상 |

| 2026-08-25 | 봇이 "안녕"·"어제 요청사항 진행 다 됐어?" 에 전부 "지시가 불명확합니다" | classify 의 fallthrough 가 unclear 였다 — 결정적 키워드에 안 걸리면 엔진까지 가지 못했다 | fallthrough 를 agent 로 변경. 자유 지시는 엔진이 받고 스레드로 맥락 유지 | 수정 | 전체 118건, classify 회귀 |
| 2026-08-25 | 위저드 선택지에 "b" 로 답했는데 "불명확" | 15분 TTL 만료 후 loadState 가 조용히 null 을 주고 일반 fallthrough 로 떨어짐 | 상태 없이 도착한 단일 선택지 답변은 "만료됐습니다 — 다시 연결" 로 안내 | 수정 | TEST 회귀 |
| 2026-08-25 | 엔진이 터미널 작업 이력을 모름 | 텔레그램 스레드에만 맥락이 있고 터미널 작업은 파일에만 남음 | AGENT_SYSTEM.md 에 "RESUME → HARNESS_LOOP → RUN_STATE → git log 를 먼저 읽는다" 절 추가, 읽기 경로 확대 | 적용 | 실왕복 스모크: 미완 2건을 근거와 함께 보고 |
| 2026-08-25 | 긴/빈 응답이 전송 실패 | 텔레그램 4096자 상한, 빈 text 는 API 오류 | send() 를 3900자 분할 + 빈 응답 자리표시자로 변경 | 수정 | 전체 118건 |

| 2026-08-28 | 자연어 우선 라우팅 (A안) | 단어 포함만으로 판정해 "전체 중지 안 해도 돼"가 킬스위치를 당김 | 결정적 경로를 안전·흐름진입만 남기고 나머지는 엔진. 부정어 가드 추가 | 적용 | 129건 |
| 2026-08-28 | SEO 위저드 무한 반복 | 상태 없이 매번 재진입 판정 | 연결 위저드와 같은 상태 기계로 전환 (analytics→keyword→diagnose) | 수정 | 회귀 2건 추가 |
| 2026-08-28 | 승인 파일 384건 누적 | 테스트가 매번 생성하고 정리 안 함 | `checks/purge_fixtures.ts` + posttest. 실제 배포 감사기록 3건은 대상 이름으로 보호 | 수정 | 정리 검사 추가 |
| 2026-08-28 | **D6 검사가 시계 때문에 깨짐** | 72시간이 실제로 지나 전제가 무너짐 | 판정을 순수 함수 `removalVerdict()` 로 분리해 모든 경우 검사 | 수정 | 129/129 |
| 2026-08-28 | **OPEN-BRW-01 해소** | 약관 원문 미확인 | 원문 실측: 금지 대상은 "불법 자동화로 속도지연·안전성 유발". 본인 사이트·저빈도는 비해당 | RESOLVED_CONDITIONAL | 고객사 확장 시 재판정 |
| 2026-08-28 | **OPEN-BRW-02 해소** | 2차 인증 여부 미확인 | 사용자 확인: 미사용 → 세션 재사용 경로 성립 | RESOLVED | - |
| 2026-08-28 | M2 세션 모듈 착수 | browser_upload 게이트 개방 | `src/browser/session.ts` + 셀렉터 외부화. 자격증명 미취급 검사로 강제 | 적용 | 세션 계약 7건 |

| 2026-08-28 | 정기 업데이트 확인 | claude-agent-sdk 0.3.243 → 0.3.247 | `npm update` 반영. `@types/node` 는 24 유지(런타임 Node 24), playwright·yaml·typescript 최신 | 적용 | typecheck OK · 140/140 · daily.ts 정상 · 일일 점검 4회 연속 exit 0 |

| 2026-08-28 | **`.gitignore` 의 `seo/` 가 `src/seo/` 를 통째로 무시** | 루트 SEO 산출물 디렉터리를 막으려던 패턴이 경로 어디서든 매칭돼, 신규 소스 8개와 검사 1개가 커밋 대상에서 조용히 빠져 있었다 | 루트 고정 `/seo/` 로 변경 | 수정 | `git status` 에 9개 파일 복귀, 151/151 |

| 2026-08-29 | 색인 적용 실측 | 코드·토큰은 있는데 실제 수락 여부 기록이 없었다 | 라이브 HTML·GSC API·Bing API·네이버 콘솔로 4곳 대조. 네이버 수집 8/8·Bing 사이트맵+8URL 재제출 | 확인 | 아래 표 |
| 2026-08-29 | `cta-contact` 가 registry 에만 있고 화면에 없음 | `mount.slot: cta-contact` 가 요구하는 `[data-ddak-slot="cta-contact"]` 가 실사이트에 없다. 로더는 슬롯 미발견 시 조용히 skip (loader.js:42-44) | 슬롯 1줄 추가(승인 대상) 또는 enabled:false. **미조치** | 대기 | 헤드리스 렌더 확인 |

## 미해소 차단 게이트 (해소되면 여기에 근거·확인일과 함께 기록)
CHK-001 Script API 쓰기 / CHK-002 비공개 앱 OAuth / CHK-003 무료 호출 범위 / CHK-004 구독 SDK 무인 실행 /
CHK-005 아임웹 요금제(해소) / SCHK-001~006 SEO 검색엔진 / SEO-M2 반영단계 / OPEN-REG-01 registry 호스팅 (2026-08-24 raw로 임시 해소, Cloudflare 이전 대기) / OPEN-REG-02 슬롯 프리셋 위치 / OPEN-BRW-01(해소) / OPEN-BRW-02(해소) /
OPEN-BRW-02 2차 인증 / OPEN-BRW-03 OPERATING_APPROVED 발급 / OPEN-PNY-01 Ponytail 설치·훅 / OPEN-HLM-01 Hallmark 컴포넌트 모드
