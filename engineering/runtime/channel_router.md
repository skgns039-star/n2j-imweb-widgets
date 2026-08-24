# ENG-017 Channel Router

- 구현: `src/bot/telegram.ts`, `src/bot/index.ts`
- channel `telegram` / bot_account_id `imweb-widget-bot` / token_ref `env:IMWEB_WIDGET_BOT_TOKEN` (원시값 미기록)
- **update 단일 소유자:** polling 프로세스 1개만. 기동 시 두 가지를 강제한다.
  1. `getWebhookInfo` 에 url이 있으면 **기동 거부** (PTEST-012)
  2. `state/bot.lock` (pid) 로 중복 프로세스 **기동 거부**
- **REQ-005 화이트리스트:** `config/allowed_chats.yaml` 밖은 **무응답** + `logs/rejected.jsonl` 기록. 거절 사실을 상대에게 알려주지 않는다.
- 응답은 **원래 chat_id(+topic_id)로만** 보낸다. 브로드캐스트 경로가 코드에 존재하지 않는다.
- 토큰은 오류 메시지에서 마스킹한다.
