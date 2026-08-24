# ENG-015 실행 형태

- 형태: `event-driven` (텔레그램 메시지). 상시 서버·스케줄러 없음.
- 실행 호스트: 로컬 Windows PC. 사용자가 `npm start` 로 띄운 동안만 동작한다.
- 시간대: Asia/Seoul. 단일 작업 타임아웃 300초, 세션 30분.
- **PTEST-010:** "24시간 상시 실행" 요청은 범위 밖으로 안내한다. 무인 스케줄 실행은 CHK-004 해소 전 금지 (`unattended_sdk_run` 게이트).
- 재시작 복구: `update_id` 기준 중복 처리 방지 (`state/threads.sqlite3` seen_updates).
