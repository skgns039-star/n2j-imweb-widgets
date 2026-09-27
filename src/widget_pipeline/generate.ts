/* 위젯 코드 생성기. 봇 명령을 받아 임시 작업 폴더의 위젯 파일만 고치거나 새로 만든다.
   LLM 에게 주는 것은 읽기·쓰기 도구뿐이다 (Bash·네트워크 없음). 쓰기는 작업 폴더의 위젯 파일 3개로만 허용한다.
   생성기가 무엇을 만들든 최종 판정은 policy.ts·render_check.ts 가 한다 — 여기서는 "만드는 일"만 한다. */
import { resolve, relative, sep } from "node:path";
import { ALLOWED_FILES } from "./policy.ts";

export type Mode = "edit" | "new";
export type GenTask = {
  mode: Mode; widget_id: string; request: string;
  /** 임시 작업 폴더. 그 안의 widget/ 만 쓸 수 있고 reference/ 는 참고용 기존 위젯이다. */
  workdir: string;
};
export type GenSummary = { requested: string[]; done: string[]; notDone: string[]; note?: string };
export type Generator = (task: GenTask, signal?: AbortSignal) => Promise<GenSummary>;

export const RULES = (id: string) => `
[위젯 규격 — 어기면 자동 관문에서 전부 거부된다]
- 파일은 widget/ 폴더의 index.js · style.css · widget.json 세 개뿐이다. 다른 파일·폴더를 만들지 않는다.
- index.js 는 즉시실행함수 (function () { "use strict"; … })(); 하나. 전역은 window.__ddak 만 쓴다.
- 반드시 자기 슬롯 document.querySelector('[data-ddak-slot="${id}"]') 안에만 그린다. 슬롯이 없으면 아무것도 하지 않고 return.
- document.body / document.documentElement 에 직접 붙이지 않는다. position: fixed / sticky 금지 (떠 있는 요소 금지).
- fetch · XMLHttpRequest · WebSocket · eval · new Function · document.write · localStorage · cookie · 동적 import 금지.
- 외부 절대 URL(http://, https://) 금지. 링크는 사이트 안 상대 경로(/18 같은)만.
- CSS 셀렉터는 전부 .ddak- 로 시작한다. 전역 셀렉터(body, html, *, :root)·@import·@font-face 금지. 폰트는 inherit.
- 개인정보를 수집하지 않는다. widget.json: {"widget_id":"${id}","title":…,"purpose":…,"collects_personal_data":false,"network":"없음 (CDN 자산 로드 외 요청 0건)"}
- 수정 요청이면 요청한 부분만 바꾼다. 요청과 무관한 줄은 한 글자도 바꾸지 않는다 (공백·주석·순서 포함).
`;

const PROMPT = (t: GenTask) => [
  t.mode === "edit"
    ? `기존 코드 위젯 "${t.widget_id}" 를 사용자 요청대로 수정하라. 현재 파일은 widget/ 에 있다.`
    : `새 코드 위젯 "${t.widget_id}" 를 사용자 요청대로 만들어라. widget/ 폴더에 파일 3개를 새로 작성하라. 형식은 reference/ 의 기존 위젯을 참고하라.`,
  `사용자 요청: """${t.request}"""`,
  RULES(t.widget_id),
  `작업이 끝나면 마지막 응답을 JSON 한 덩어리로만 끝내라:`,
  `{"requested":["요청을 빠짐없이 나눈 항목", …],"done":["실제로 반영한 항목", …],"notDone":["반영하지 못한 항목과 이유", …]}`,
  `요청 중 규격 때문에 할 수 없는 것이 있으면 억지로 하지 말고 notDone 에 적어라.`,
].join("\n\n");

/** 마지막 JSON 덩어리를 뽑는다. 없으면 null — 누락 판정에서 거부된다. */
export function lastJson(text: string): GenSummary | null {
  const blocks = [...text.matchAll(/\{[\s\S]*?"requested"[\s\S]*\}/g)].map((m) => m[0]);
  for (const b of blocks.reverse()) { try { return JSON.parse(b); } catch { /* 다음 후보 */ } }
  return null;
}

/** 쓰기 도구가 건드리려는 경로가 widget/ 의 허용 파일인지. 절대경로·../ 탈출을 모두 막는다. */
export function writeAllowed(workdir: string, filePath: unknown): boolean {
  if (typeof filePath !== "string" || !filePath) return false;
  const abs = resolve(workdir, filePath);
  const rel = relative(resolve(workdir, "widget"), abs);
  return !rel.startsWith("..") && !rel.includes(sep) && (ALLOWED_FILES as readonly string[]).includes(rel);
}

export const claudeGenerator: Generator = async (task, signal) => {
  const PKG = "@anthropic-ai/claude-agent-sdk";
  const sdk: any = await import(PKG);
  const abort = new AbortController();
  signal?.addEventListener("abort", () => abort.abort(), { once: true });
  let text = "";
  for await (const msg of sdk.query({
    prompt: PROMPT(task),
    options: {
      cwd: task.workdir,
      tools: ["Read", "Write", "Edit", "Glob", "Grep"],
      settingSources: [],               // 작업 폴더 밖 설정·스킬·훅을 끌어오지 않는다
      maxTurns: 30,
      abortController: abort,
      canUseTool: async (tool: string, input: Record<string, unknown>) => {
        if (tool === "Write" || tool === "Edit") {
          return writeAllowed(task.workdir, input.file_path)
            ? { behavior: "allow", updatedInput: input }
            : { behavior: "deny", message: "widget/ 의 index.js·style.css·widget.json 만 쓸 수 있다" };
        }
        if (["Read", "Glob", "Grep"].includes(tool)) {
          const target = String(input.file_path ?? input.path ?? task.workdir);
          return relative(task.workdir, resolve(task.workdir, target)).startsWith("..")
            ? { behavior: "deny", message: "작업 폴더 밖은 읽을 수 없다" }
            : { behavior: "allow", updatedInput: input };
        }
        return { behavior: "deny", message: `${tool} 은 이 작업에서 쓸 수 없다` };
      },
    },
  })) {
    if (msg.type === "result" && typeof msg.result === "string") text = msg.result;
  }
  const summary = lastJson(text);
  return summary ?? { requested: [], done: [], notDone: ["생성기가 변경 요약 JSON 을 돌려주지 않음"] };
};
