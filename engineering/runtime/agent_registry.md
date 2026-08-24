# ENG-016 Agent Registry (REQ-007)

- 구현: `config/agent_registry.yaml` + `src/engine/index.ts`
- `runtime_engine` 값만 바꾸면 전환된다. 프롬프트·workspace·권한·Thread Store는 엔진과 무관하게 동일하다.
- 엔진: `dry_run`(기본) / `codex_sdk` / `claude_agent_sdk`
- **두 엔진을 동시에 같은 봇 업데이트에 붙이지 않는다.**
- `dry_run` 이 기본값인 이유: CHK-004(구독 인증 무인 SDK 실행 허용 여부) 미해소. 이 상태에서도 라우팅·승인·무결성 경로는 전부 동작한다.
- **PTEST-011:** 미등록 agent_id·미등록 runtime_engine 은 예외를 던지고 거절한다.
- 전환 절차: yaml 값 변경 → 해당 SDK 설치·인증 확인 → 동일 지시로 TEST-010 재실행.
