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

## 2026-09-16 배포 경계 보강
- 태그 push 후 모든 대상 자산을 확인하고 나서 registry를 공개한다. 해시 불일치 시 공개를 중단한다.
- 파일 목록·원본/산출물·manifest·integrity·HEAD를 승인 대상에 결합한다. 기존 staged 변경과 예상 밖 자산을 허용하지 않는다.
- registry 반영 확인은 updated_at과 실제 내용 해시 모두 비교한다. 같은 시각의 다른 내용은 성공으로 판정하지 않는다.
- 로컬 테스트의 CDN 응답은 모의 응답이다. 실제 CDN·브라우저 SRI 성공과 구분해 기록한다.
