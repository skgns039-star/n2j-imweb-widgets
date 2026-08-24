/* 기본 엔진. CHK-004(구독 인증 무인 SDK 실행) 해소 전까지의 안전 기본값.
   LLM을 호출하지 않고, 라우팅·승인·무결성 경로만 그대로 태운다. */
import type { Engine } from "./index.ts";

const engine: Engine = {
  id: "dry_run",
  async run(prompt) {
    return {
      threadId: "dry-run",
      text:
        "엔진 미연결(dry_run) 상태다. 라우팅·승인·해시 검증 경로는 정상 동작한다.\n" +
        "자연어 자유 지시를 처리하려면 config/agent_registry.yaml 의 runtime_engine 을 " +
        "codex_sdk 또는 claude_agent_sdk 로 바꾸고 해당 SDK를 설치해라.\n" +
        `받은 지시: ${prompt.slice(0, 120)}`,
    };
  },
};
export default engine;
