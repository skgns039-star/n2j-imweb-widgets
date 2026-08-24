# ENG-019 무결성 가드 (REQ-003, REQ-014, INV-5)

- 구현: `src/release/hash.ts`, `src/release/verify.ts`, `src/release/build.ts`
- **4지점 검증:** source → dist → cdn → browser(SRI)
  - source: 정본 파일 SHA-256 = `integrity/<id>.json` 기록
  - dist: 산출물 SHA-256 = 기록, 그리고 dist_sha256 == source_sha256 (번들러가 없으므로 바이트가 같아야 한다)
  - cdn: 배포된 URL 재fetch SHA-256 = dist
  - browser: `registry.json` 의 SRI(sha384)로 브라우저가 최종 검증. 불일치 시 해당 모듈만 로드되지 않는다
- **재시도 정책:** 네트워크 실패는 3회 backoff. **해시 불일치는 재시도 0회 — 즉시 중단**한다.
- 1건이라도 불일치면 verify 종료코드 1, 배포는 `result=BLOCKED`.
- 아임웹 코드 비교만 예외적으로 **정규화 diff**를 쓴다 — 아임웹이 주석을 제거하기 때문이다.
- **PTEST-014 / TEST-004:** dist를 1바이트 변조하면 배포가 중단되어야 한다.
