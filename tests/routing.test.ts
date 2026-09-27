/* PTEST-007. "되돌려"를 배포로 처리하면 안 된다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/bot/router.ts";

/* 결정적 경로는 안전 경계와 단계형 흐름 진입뿐이다.
   조회·배포·롤백·설치는 엔진이 자연어로 받는다 — 실행은 승인 게이트가 막는다. */
test("의도 분류", () => {
  // 안전 경계 — 결정적으로 남는다
  assert.equal(classify("전체 중지").intent, "kill");
  assert.equal(classify("승인 AP-1a2b3c4d").intent, "approve");
  assert.equal(classify("거절").intent, "reject");
  // 단계형 흐름 진입 — 엔진이 대신 돌 수 없다
  assert.equal(classify("연결").intent, "connect");
  assert.equal(classify("SEO").intent, "seo");
  assert.equal(classify("이관").intent, "migrate");
  // 나머지는 전부 엔진이 자연어로 받는다
  assert.equal(classify("되돌려").intent, "agent");
  assert.equal(classify("배포해줘").intent, "agent");
  assert.equal(classify("로더 스니펫 줘").intent, "agent");
  assert.equal(classify("상태 알려줘").intent, "agent");
  // 2026-09-28: 코드 위젯 수정·신규 생성은 자동 파이프라인으로 간다(관문·승인은 파이프라인이 강제)
  assert.equal(classify("위젯 문구를 X로 바꿔줘").intent, "widget_edit");
  // 결정적 경로에 안 걸리는 자연어는 엔진이 받는다 (되묻지 않는다)
  assert.equal(classify("날씨 어때").intent, "agent");
  assert.equal(classify("어제 요청사항 진행 다 됐어?").intent, "agent");
});

test("코드 위젯 수정·신규 요청만 파이프라인으로 보내고, 배포·조회·켜기는 보내지 않는다", () => {
  assert.deepEqual(classify("cta-contact 버튼 문구를 '견적 문의하기'로 바꿔줘"), { intent: "widget_edit", arg: "cta-contact" });
  assert.equal(classify("위젯 버튼 색상 좀 진하게 수정해줘").intent, "widget_edit");
  assert.deepEqual(classify("새 위젯 promo-banner 만들어줘: 할인 안내 문구와 버튼"), { intent: "widget_new", arg: "promo-banner" });
  assert.deepEqual(classify("위젯 하나 새로 만들어줘"), { intent: "widget_new", arg: undefined });
  for (const t of ["cta-contact 배포해줘", "cta-contact 롤백해줘", "cta-contact 켜줘", "cta-contact 상태 알려줘",
    "위젯 수정은 아직 하지 마", "위젯 목록 보여줘", "위젯 바꾼 거 배포됐어?"]) {
    assert.ok(!["widget_edit", "widget_new"].includes(classify(t).intent), t);
  }
});

test("승인 회신에서 승인 ID를 뽑는다", () => {
  const r = classify("승인 AP-1a2b3c4d");
  assert.equal(r.intent, "approve");
  assert.equal(r.arg, "AP-1a2b3c4d");
});

test("부정·유보 표현을 실행 명령으로 오인하지 않는다", () => {
  // 예전에는 "전체 중지 안 해도 돼" 가 킬 스위치를 당겼다. 사고 수준의 오인식이었다.
  assert.equal(classify("전체 중지 안 해도 돼").intent, "agent");
  assert.equal(classify("배포는 아직 하지 마").intent, "agent");
  assert.equal(classify("연결 안 해도 돼").intent, "agent");
  assert.equal(classify("SEO는 나중에").intent, "agent");
  assert.equal(classify("이관 안 할래").intent, "agent");
  // 부정이 아니면 그대로 잡힌다
  assert.equal(classify("전체 중지").intent, "kill");
});

/* 회귀: 텔레그램으로 보낸 사진에 봇이 아무 반응도 하지 않았다.
   원인은 폴링 루프의 `if (!msg?.text) continue` — 사진은 text 가 없어서 통째로 버려졌다. */
test("사진 메시지를 버리지 않는다", async () => {
  const { inbound } = await import("../src/bot/telegram.ts");
  const chat = { id: 1 };

  // 설명 없는 사진 — 예전에는 여기서 그냥 사라졌다
  const photo = inbound({ chat, photo: [{ file_id: "small" }, { file_id: "big" }] });
  assert.equal(photo.body, "");
  assert.equal(photo.image?.file_id, "big", "해상도 배열의 마지막(가장 큰 것)을 골라야 한다");

  // caption 이 본문이 된다
  const captioned = inbound({ chat, caption: "이거 봐줘", photo: [{ file_id: "f" }] });
  assert.equal(captioned.body, "이거 봐줘");
  assert.equal(captioned.image?.file_id, "f");

  // "파일로 보내기" 로 온 스크린샷도 이미지다
  const doc = inbound({ chat, document: { file_id: "d", mime_type: "image/png" } });
  assert.equal(doc.image?.file_id, "d");

  // 이미지가 아닌 첨부는 집지 않는다
  assert.equal(inbound({ chat, document: { file_id: "z", mime_type: "application/pdf" } }).image, null);

  // 평범한 텍스트는 그대로
  const plain = inbound({ chat, text: "상태 알려줘" });
  assert.equal(plain.body, "상태 알려줘");
  assert.equal(plain.image, null);
});
