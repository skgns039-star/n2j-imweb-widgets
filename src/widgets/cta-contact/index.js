/* cta-contact — 메인 하단 전환 CTA. 아임웹 원본 "문의하기"(/18)를 대체한다.
   링크는 원본 그대로 /18 을 쓴다. 목적지를 바꾸지 않는다.
   호스트 침범 금지(REQ-020): ddak- 네임스페이스, window.__ddak 외 전역 없음, 폰트 상속. */
(function () {
  "use strict";
  var ns = (window.__ddak = window.__ddak || {});
  var SLOT = '[data-ddak-slot="cta-contact"]';
  var HREF = "/18";

  function render(host) {
    var root = document.createElement("div");
    root.className = "ddak-cta";
    root.setAttribute("data-ddak-state", "default");

    var link = document.createElement("a");
    link.className = "ddak-cta__btn";
    link.href = HREF;
    link.setAttribute("aria-describedby", "ddak-cta-note");

    var label = document.createElement("span");
    label.className = "ddak-cta__label";
    label.textContent = "문의하기";

    // 장식용 화살표. 스크린리더에는 노출하지 않는다.
    var arrow = document.createElement("span");
    arrow.className = "ddak-cta__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    link.appendChild(label);
    link.appendChild(arrow);

    var note = document.createElement("p");
    note.className = "ddak-cta__note";
    note.id = "ddak-cta-note";
    note.textContent = "상담 문의는 고객지원 페이지에서 접수됩니다.";

    root.appendChild(link);
    root.appendChild(note);
    host.appendChild(root);

    // 클릭 → 이동까지의 공백을 loading 으로 채운다. 네트워크가 느린 환경에서 두 번 누르는 것을 막는다.
    var onClick = function () {
      root.setAttribute("data-ddak-state", "loading");
      label.textContent = "이동 중";
    };
    link.addEventListener("click", onClick);

    // 뒤로가기로 돌아왔을 때 loading 이 남아 있지 않게 되돌린다.
    var onShow = function () {
      root.setAttribute("data-ddak-state", "default");
      label.textContent = "문의하기";
    };
    window.addEventListener("pageshow", onShow);

    return function unmount() {
      link.removeEventListener("click", onClick);
      window.removeEventListener("pageshow", onShow);   // 전역 리스너는 반드시 해제한다
      root.remove();
    };
  }

  function boot() {
    try {
      var host = document.querySelector(SLOT);
      if (!host) return;                       // 앵커 미발견 = 조용한 skip (사이트 파손 방지)
      if (ns.ctaContactUnmount) ns.ctaContactUnmount();
      ns.ctaContactUnmount = render(host);
    } catch (e) {
      try { console.warn("[ddak] cta-contact skipped"); } catch (e2) {}
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
