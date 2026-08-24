# ENG-036 Ponytail (구축자 미니멀리즘 규칙셋)

- 층: **Builder-side.** 런타임에 들어가지 않는다. `dist/`, `registry.json`, 로더 어디에도 흔적이 없다.
- 적용 대상: Claude Code · Codex 양쪽 (REQ-006 동일 계약)
- 초기 모드: `full`. 보호 목록 위반이 관측되면 `lite` 로 강등한다.

## 설치 (각 구축자 환경에서 개별 확인. 상호 복사 금지)
| 구축자 | 명령 |
|---|---|
| Claude Code | `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail` |
| Codex | `codex plugin marketplace add DietrichGebert/ponytail` → `codex plugin add ponytail@ponytail` |

설치 후 훅 검토·신뢰 처리, 새 스레드 시작이 필요하다. 서드파티 마켓플레이스이므로 설치 전 권한·deny list를 검토한다. → `OPEN-PNY-01`

## 보호 목록 — 축소·제거 금지 (위반 시 해당 커밋 무효)
| # | 보호 대상 | 근거 |
|---|---|---|
| P-1 | 아임웹 쓰기 전 원문 스냅샷 저장 | REQ-011 |
| P-2 | 셀렉터 헬스체크 및 미발견 시 중단 | REQ-018 |
| P-3 | 4단 해시 검증 (source·dist·cdn·SRI) | REQ-003, REQ-014 |
| P-4 | 저장 후 재조회 정규화 diff | REQ-019 |
| P-5 | 실패 시 스냅샷 자동 복원 | REQ-019 |
| P-6 | 승인 게이트 및 OPERATING_APPROVED 범위 검사 | §10, §19.6 |
| P-7 | 허용 사용자 화이트리스트·타임아웃 | REQ-005 |
| P-8 | registry 스키마 검증 fail-closed | §18.4 |
| P-9 | 로더의 앵커 미발견 조용한 skip 처리 | §18.3 |
| P-10 | 시크릿 마스킹·`state/browser/` gitignore | REQ-017 |
| P-11 | Hallmark 8-state 구현 | REQ-021, §21.3 |
| P-12 | 접근성·대비 게이트 통과 코드 | §21.3 |
| P-16 | STEST 구현을 축소하지 않는다 (선언만 남기고 테스트 삭제 금지) | ENG-046 §18.8 |
| P-13 | `config/**` 쓰기 권한 미확장 · 설정 반영은 승인 게이트 경유 | §10, REQ-036~039 |

## 훅 정책
- Ponytail 훅은 **승인 게이트·검증 단계를 우회하거나 건너뛰게 만들 수 없다.** 우회가 관측되면 즉시 `lite` 또는 비활성화한다.
- 런타임 훅(ENG-024)은 OMIT 유지. 범위가 다르므로 충돌 없음.

## 검사
PTEST-028 (브라우저 업로드 구현 시 P-1~P-5 존재) / PTEST-029 (보호 목록 간소화 제안은 거부 + HARNESS_LOOP 기록) / PTEST-030 (양쪽 구축자 산출물이 동일 검사 통과)
