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
        systemPrompt: ctx.systemPrompt,
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
