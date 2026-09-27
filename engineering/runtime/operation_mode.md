# ENG-015 실행 형태

- 형태: `event-driven` (텔레그램 메시지). 상시 서버·스케줄러 없음.
- 실행 호스트: 로컬 macOS (Apple Silicon). Node 버전은 `.node-version`에 기록한다. 사용자가 `npm start` 로 띄운 동안만 동작한다.
- 플랫폼 이전 시 `package-lock.json`을 유지한 채 `npm ci`로 해당 OS의 의존성을 설치한다. 다른 OS의 `node_modules`는 재사용하지 않는다.
- 시간대: Asia/Seoul. 단일 작업 타임아웃 300초, 세션 30분.
- **PTEST-010:** "24시간 상시 실행" 요청은 범위 밖으로 안내한다. 무인 스케줄 실행은 CHK-004 해소 전 금지 (`unattended_sdk_run` 게이트).
- 재시작 복구: `update_id` 기준 중복 처리 방지 (`state/threads.sqlite3` seen_updates).
- 일반 지시와 질문은 대화·토픽별 작업 큐에 접수하고 터미널에서 이어받는다. 문장 끝의 물음표로 SDK를 직접 실행하지 않는다. 목록 조회는 해당 대화에만 즉답한다.
- 큐 쓰기는 배타 잠금과 임시 파일 교체로 처리한다. 읽기·스키마·저장 오류 시 원본을 보존하고 중단한다. 비정상 종료로 `state/inbox/tasks.json.lock`이 남으면 모든 큐 사용 프로세스의 종료와 원본 JSON을 확인한 뒤 잠금을 복구한다. 자동 잠금 삭제·자동 재시도는 없다.
- 테스트는 `npm test`로 실행한다. `checks/run_tests.ts`가 현재 소스를 임시 Git 저장소에 복사하고 운영 `.env`·state·logs·SEO 산출물과 인증 환경변수를 제외한다. 테스트 파일을 직접 실행하면 기존 테스트가 운영 파일을 사용할 수 있으므로 직접 실행하지 않는다. 특정 파일은 `npm test -- tests/inbox.test.ts`처럼 지정한다.
