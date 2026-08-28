/* 엔진 B. @anthropic-ai/claude-agent-sdk. 설치·인증은 각 환경에서 개별 확인한다. */
import type { Engine, EngineCtx } from "./index.ts";

const engine: Engine = {
  id: "claude_agent_sdk",
  async run(prompt: string, ctx: EngineCtx) {
    // 선택적 의존성. 리터럴이 아닌 지정자를 써서 미설치 상태에서도 타입검사가 통과한다.
    const PKG = "@anthropic-ai/claude-agent-sdk";
    let mod: any;
    try {
      mod = await import(PKG);
    } catch {
      throw new Error("claude_agent_sdk 미설치: npm i @anthropic-ai/claude-agent-sdk 후 인증 상태를 확인해라 (CHK-004)");
    }
    let text = "";
    let sessionId = ctx.threadId ?? "";
    for await (const msg of mod.query({
      prompt,
      options: {
        cwd: ctx.workspace,
        // 문자열로 주면 기본 프롬프트를 **통째로 대체**한다 — 도구 사용 지침까지 사라진다.
        // 우리 규약은 덧붙이는 것이지 갈아치우는 게 아니다.
        systemPrompt: { type: "preset", preset: "claude_code", append: ctx.systemPrompt },
        // 이걸 안 켜면 .claude/skills/ 의 SKILL.md 가 목록에 뜨지 않는다.
        // (스킬을 모른 채 매번 파일을 뒤지던 원인)
        skills: "all",
        // settingSources 는 생략한다 = 전 소스 로드. .claude/settings.json 의 deny 규칙
        // (배포·롤백·태그푸시·.env)이 그대로 살아 있어야 한다.
        ...(ctx.threadId ? { resume: ctx.threadId } : {}),
      },
    })) {
      if (msg.session_id) sessionId = msg.session_id;
      if (msg.type === "result" && msg.result) text = msg.result;
    }
    return { threadId: sessionId, text };
  },
};
export default engine;
