/* ENG-017. update 단일 소유자 polling 프로세스. 여기 말고 다른 consumer를 붙이지 않는다. */
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { p } from "../release/paths.ts";
import { assertSingleOwner, getUpdates, send, isAllowed, logReject } from "./telegram.ts";
import { getOffset, setOffset, markSeen } from "./threads.ts";
import { handle } from "./router.ts";
import { checkAll, missing, render, bootBlockers } from "../../checks/setup_check.ts";

const TASK_TIMEOUT_MS = 300_000; // §13, §14
const LOCK = p("state", "bot.lock");

function acquireLock() {
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, "utf8"));
    try { process.kill(pid, 0); throw new Error(`이미 실행 중이다 (pid ${pid}) — 중복 consumer 기동 거부`); }
    catch (e) { if ((e as Error).message.includes("중복")) throw e; } // 죽은 pid면 잠금 회수
  }
  writeFileSync(LOCK, String(process.pid));
  const release = () => { try { unlinkSync(LOCK); } catch { /* ignore */ } };
  process.on("exit", release);
  process.on("SIGINT", () => { release(); process.exit(0); });
}

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("타임아웃: 작업을 중단했다. 아무것도 배포하지 않았다.")), ms))]);

/** REQ-039. 셋업이 덜 된 상태로는 띄우지 않는다. 모든 기동 경로가 여기를 지난다.
 *  기동을 막는 것은 봇 자체에 필요한 항목뿐이다. 배포에만 필요한 항목(CDN·git remote)은
 *  경고로 알리고, 실제 배포 시 deploy 게이트가 따로 막는다. */
async function assertSetup() {
  const rows = await checkAll();
  const blockers = bootBlockers(rows);
  const deployGaps = missing(rows).filter((r) => r.blocks === "deploy");

  if (blockers.length) {
    console.error(render(rows));
    console.error(`\n기동 필수 항목 ${blockers.length}건이 비었습니다 — 봇을 띄우지 않습니다.`);
    if (blockers.some((r) => r.id === "ALLOWED_CHAT_IDS")) {
      console.error("ALLOWED_CHAT_IDS 가 비어 있습니다: 지금 띄워도 **아무도 통과하지 못하는 상태**입니다.");
    }
    process.exit(1);
  }
  if (deployGaps.length) {
    console.warn(`배포 준비 미완 ${deployGaps.length}건 (${deployGaps.map((r) => r.id).join(", ")}) — 대화는 되지만 배포는 BLOCKED 됩니다.`);
  }
}

async function main() {
  await assertSetup();
  acquireLock();
  await assertSingleOwner();
  console.log("imweb-widget-agent polling 시작 (Ctrl+C 종료)");

  for (;;) {
    let updates: Awaited<ReturnType<typeof getUpdates>> = [];
    try {
      updates = await getUpdates(getOffset());
    } catch (e) {
      console.error("getUpdates 실패:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    for (const u of updates) {
      setOffset(u.update_id + 1);
      const msg = u.message;
      if (!msg?.text) continue;
      if (!markSeen(u.update_id)) continue; // 멱등성

      const chat_id = msg.chat.id;
      const user_id = msg.from?.id;
      if (!isAllowed(chat_id, user_id)) { logReject(chat_id, user_id, msg.text); continue; } // 무응답

      // config/kill_switch 가 있으면 새 작업을 받지 않는다 (§19.6 중단 방법)
      if (existsSync(p("config", "kill_switch")) && !/재개|resume|상태|조회/.test(msg.text)) {
        await send(chat_id, "킬 스위치가 걸려 있다. 새 작업을 받지 않는다. 재개하려면 '전체 재개'.", msg.message_thread_id);
        continue;
      }

      const ctx = {
        agent_id: "imweb-widget-agent", channel: "telegram", bot_account_id: "imweb-widget-bot",
        chat_id, topic_id: msg.message_thread_id,
      };
      try {
        const reply = await withTimeout(handle(msg.text, ctx), TASK_TIMEOUT_MS);
        await send(chat_id, reply, msg.message_thread_id); // 원래 대화로만 회신 (REQ-005)
      } catch (e) {
        await send(chat_id, `실패: ${(e as Error).message}`, msg.message_thread_id);
      }
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
