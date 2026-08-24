# ENG-023 위젯 릴리스 Skill (재사용 절차)

절차를 건너뛰면 절차 위반이다 (PTEST-018). 순서 고정.

## A. 기존 위젯 수정
1. `src/widgets/<id>/` 만 수정한다. 변경 요약을 먼저 보고한다.
2. `manifest/widgets.yaml` 의 version 을 올린다 (같은 버전에 다른 바이트를 넣지 않는다).
3. `npm run build` — 린트·예산·해시·registry 갱신이 한 번에 돈다.
4. `npm run verify:integrity -- --local` (source == dist 확인)
5. 승인 요청 → 승인.
6. `npm run deploy -- <id> <approval_id>` — 태그 푸시 + registry purge + CDN 해시 재비교까지 통과해야 완료다.
7. 실사이트 확인 → 결과 보고 (`logs/actions/`).

## B. 신규 위젯 추가 (§18.6)
1. `src/widgets/<new_id>/` 생성
2. `npm run build` (dist + SHA-256 + SRI)
3. mount 전략 판정: none → slot → selector → new-slot. **new-slot이면 여기서 중단하고 승인 요청**
4. `manifest/widgets.yaml` 에 항목 추가, **enabled: false**
5. 승인 요청 → 승인
6. 태그 푸시 + registry 배포 + purge
7. `enabled: true` 로 전환 → 재배포 → 실사이트 확인
8. 문제 시 `enabled: false` (파일 삭제 없이 1비트 롤백)

## C. 롤백
- 즉시 정지: `npm run rollback -- <id> off <approval_id>`
- 이전 버전 복귀: `npm run rollback -- <id> <version> <approval_id>` (해당 태그가 존재해야 한다)
- 어느 쪽이든 마지막에 `deploy` 로 registry를 CDN에 반영해야 실제로 끝난다.

## 절대 하지 않는 것
아임웹 관리자 코드 직접 편집 / 검증 생략 / 승인 없이 배포 / 해시 불일치 상태에서 재시도.
