/* ENG-016 Agent Registry / REQ-007.
   config/agent_registry.yaml 의 runtime_engine 값만 바꾸면 엔진이 전환된다.
   프롬프트·workspace·권한·Thread Store는 엔진과 무관하게 동일하다.
   두 엔진을 동시에 같은 봇 업데이트에 붙이지 않는다. */
import { readFileSync } from "node:fs";
import { p, yaml } from "../release/paths.ts";

export type EngineCtx = { threadId: string | null; workspace: string; systemPrompt: string };
export type EngineResult = { text: string; threadId: string };
export type Engine = { id: string; run(prompt: string, ctx: EngineCtx): Promise<EngineResult> };

type RegistryFile = {
  agents: {
    agent_id: string; runtime_engine: string; prompt_path: string; workspace: string;
    permission_profile: string; engines: Record<string, { auth_ref?: string; package?: string; status: string }>;
  }[];
};

export function agentConfig(agent_id = "imweb-widget-agent") {
  const reg = yaml<RegistryFile>("config/agent_registry.yaml");
  const a = reg.agents.find((x) => x.agent_id === agent_id);
  if (!a) throw new Error(`미등록 agent_id: ${agent_id}`); // PTEST-011
  if (!a.engines[a.runtime_engine]) throw new Error(`미등록 runtime_engine: ${a.runtime_engine}`);
  return a;
}

export const systemPrompt = (agent_id?: string) => readFileSync(p(agentConfig(agent_id).prompt_path), "utf8");

export async function loadEngine(agent_id?: string): Promise<Engine> {
  const a = agentConfig(agent_id);
  const mod = await import(`./${a.runtime_engine}.ts`);
  return mod.default as Engine;
}
