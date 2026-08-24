# ENG-038 킬 스위치 · 로더 fail-safe (REQ-022, REQ-023, INV-9)

## 전역 킬 스위치
- `config/kill_switch` 파일 생성 → `registry.json` 의 global_enabled: false → purge → 60초 내 전 사이트 정지.
- 텔레그램 "전체 중지" 한마디로 실행된다. **정지는 승인 없이, 재개는 승인 필요.**
- 봇도 킬 스위치가 걸린 동안 새 작업을 받지 않는다(조회·재개 제외).
- 사이트별 스위치는 manifest.sites[].enabled → registry.sites.<site_id>.enabled.

## 로더 fail-safe
| 실패 지점 | 동작 |
|---|---|
| registry fetch 실패 | 조용히 종료. 호스트 페이지 정상 |
| 스키마·파싱 실패 | 조용히 종료 (fail-closed) |
| SRI 불일치 | 해당 모듈만 skip |
| 슬롯·앵커 미발견 | 해당 모듈만 skip |
| 모듈 실행 중 예외 | 해당 모듈만 격리 |
| 로더 자체 예외 | 최상위 try/catch. 콘솔 경고 1줄 |

**원칙: 위젯이 안 뜨는 건 사고가 아니다. 고객 사이트가 깨지는 게 사고다.**
