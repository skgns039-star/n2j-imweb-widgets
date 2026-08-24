/* 엔진 A. @openai/codex-sdk. 설치·인증은 각 환경에서 개별 확인한다 (상호 복사 금지). */
import type { Engine, EngineCtx } from "./index.ts";

const engine: Engine = {
  id: "codex_sdk",
  async run(prompt: string, ctx: EngineCtx) {
    // 선택적 의존성. 리터럴이 아닌 지정자를 써서 미설치 상태에서도 타입검사가 통과한다.
    const PKG = "@openai/codex-sdk";
    let mod: any;
    try {
      mod = await import(PKG);
    } catch {
      throw new Error("codex_sdk 미설치: npm i @openai/codex-sdk 후 인증 상태를 확인해라 (CHK-004)");
    }
    const codex = new mod.Codex();
    const thread = ctx.threadId ? codex.resumeThread(ctx.threadId) : codex.startThread({ workingDirectory: ctx.workspace });
    const res = await thread.run(`${ctx.systemPrompt}\n\n[사용자 지시]\n${prompt}`);
    return { threadId: thread.id ?? ctx.threadId ?? "", text: res.finalResponse ?? String(res) };
  },
};
export default engine;
