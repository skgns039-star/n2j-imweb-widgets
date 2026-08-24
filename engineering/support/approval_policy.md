# ENG-022 / ENG-022b 승인 정책

구현: `src/release/approval.ts`

## 1회 승인 (항상 필요)
CDN 공개 배포 · git tag push · 롤백 · 아임웹 쪽 모든 쓰기 · 로더 스니펫 교체 · 킬 스위치 **재개**

페이로드 형식:
`행위자: imweb-widget-agent / 대상: <widget_id>@<version> / 행동: CDN 배포 / 데이터: 변경 파일 + SHA-256 / 시점: 즉시 / 영향: <site> 공개 페이지 / 되돌리기: git tag <이전버전>으로 롤백`

- 승인 ID·상태: `logs/approvals/<id>.json`
- **만료 15분.** 미승인 15분 경과 시 자동 만료, 재요청 필요 (PTEST-017).
- **침묵·과거 승인·계획 승인은 외부 실행 승인이 아니다.**
- 승인 범위가 행동과 다르면 거절한다 (`assertApproved` 의 action 일치 검사).

## 승인 없이 실행하는 유일한 행동
전역/사이트 **정지**(`global_enabled: false`). 사고 상황에서 승인을 기다리게 하지 않는다 (§22.1). **재개는 승인 대상이다.**

## OPERATING_APPROVED — 현재 `N/A`
반복 운영 승인은 브라우저 자동 업로드(M2)와 함께 도입한다. 발급 전에는 매 외부 반영마다 1회 승인을 받는다.
발급 시 범위: 대상 사이트, 행동(registry 배포·purge·로더 삽입), 빈도 한도(1일 20회 / 1회 5위젯), 유효기간(+30일), 중단 방법(텔레그램 "중단" 또는 `config/kill_switch`), 실패 알림(모든 BLOCKED·FAILED 즉시 통보).
**범위 밖은 자동 실행하지 않는다:** 새 사이트, 새 슬롯(new-slot), 기존 코드 삭제, 한도 초과, 기간 만료. → `OPEN-BRW-03`
