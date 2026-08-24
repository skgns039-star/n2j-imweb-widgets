/* hello-badge — M0 왕복 검증용 최소 위젯.
   호스트 침범 금지(REQ-020): window.__ddak 외 전역 금지, 폰트 상속, 리스너는 언마운트 시 해제. */
(function () {
  "use strict";
  var ns = (window.__ddak = window.__ddak || {});
  var SLOT = '[data-ddak-slot="content"]';

  function render(host) {
    var root = document.createElement("div");
    root.className = "ddak-badge";
    root.setAttribute("data-ddak-state", "loading");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ddak-badge__btn";
    btn.textContent = "안녕하세요, 딸깍스튜디오";

    root.appendChild(btn);
    host.appendChild(root);

    // loading -> default. 네트워크로 렌더되는 위젯이므로 loading 상태가 실제로 발생한다.
    requestAnimationFrame(function () { root.setAttribute("data-ddak-state", "default"); });

    var onClick = function () {
      root.setAttribute("data-ddak-state", "success");
      btn.textContent = "확인됨";
    };
    btn.addEventListener("click", onClick);

    return function unmount() {
      btn.removeEventListener("click", onClick);
      root.remove();
    };
  }

  try {
    var host = document.querySelector(SLOT);
    if (!host) return;                       // 앵커 미발견 = 조용한 skip
    if (ns.helloBadgeUnmount) ns.helloBadgeUnmount();
    ns.helloBadgeUnmount = render(host);
  } catch (e) {
    try { console.warn("[ddak] hello-badge skipped"); } catch (e2) {}
  }
})();
