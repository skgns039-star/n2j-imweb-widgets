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

## 미해소 차단 게이트 (해소되면 여기에 근거·확인일과 함께 기록)
CHK-001 Script API 쓰기 / CHK-002 비공개 앱 OAuth / CHK-003 무료 호출 범위 / CHK-004 구독 SDK 무인 실행 /
CHK-005 아임웹 요금제 / OPEN-REG-01 registry 호스팅 / OPEN-REG-02 슬롯 프리셋 위치 / OPEN-BRW-01 약관 자동화 조항 /
OPEN-BRW-02 2차 인증 / OPEN-BRW-03 OPERATING_APPROVED 발급 / OPEN-PNY-01 Ponytail 설치·훅 / OPEN-HLM-01 Hallmark 컴포넌트 모드
