# ENG-018 Thread State

- 구현: `src/bot/threads.ts` / 저장소: `state/threads.sqlite3` (`node:sqlite`, 의존성 없음)
- `conversation_key = agent_id | channel | bot_account_id | chat_id | topic_id`
- 대화별로 엔진 thread_id를 보관해 후속 지시("아까 그거 되돌려")가 맥락을 유지한다 (AC-008).
- 멱등성: `seen_updates(update_id)`. 프로세스 재시작 후에도 같은 update를 두 번 처리하지 않는다.
- polling offset도 DB에 둔다 — 재시작 시 유실·중복을 만들지 않는다.
- **PTEST-013:** 두 chat이 동시에 대화해도 thread가 섞이지 않는다.
