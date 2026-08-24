# ENG-039 성능 예산 (REQ-024)

| 항목 | 상한 | 검사 |
|---|---|---|
| 위젯 1개 (JS+CSS, gzip) | 30KB | **빌드 실패** |
| 사이트 총합 (enabled 기준, gzip) | 100KB | **빌드 실패** |
| 로더 자체 (gzip) | 5KB | **빌드 실패** |
| 외부 폰트 요청 | 0건 | 린터 + TEST-029 |
| 렌더 차단 리소스 | 0건 (defer 필수) | 로더가 script.defer = true 로만 주입 |

- 구현: `src/release/build.ts` BUDGET
- 예산 초과는 경고가 아니라 실패다. Ponytail 방향과 일치한다.
- **PTEST-036 / TEST-037:** 31KB 위젯은 빌드가 실패해야 한다.
