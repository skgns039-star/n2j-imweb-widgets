/* hello-badge — M0 왕복 검증용 최소 위젯.
   호스트 침범 금지(REQ-020): window.__ddak 외 전역 금지, 폰트 상속, 리스너는 언마운트 시 해제.
   슬롯이 있으면 슬롯에, 없으면 자기 자리를 만들어 붙는다 (mount: none 경로). */
(function () {
  "use strict";
  var ns = (window.__ddak = window.__ddak || {});
  var SLOT = '[data-ddak-slot="content"]';

  function render(host, floating) {
    var root = document.createElement("div");
    root.className = "ddak-badge" + (floating ? " ddak-badge--float" : "");
    root.setAttribute("data-ddak-state", "loading");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ddak-badge__btn";
    btn.textContent = "세화건설 위젯 연결 확인";

    root.appendChild(btn);
    host.appendChild(root);

    // loading -> default. 네트워크로 렌더되는 위젯이므로 loading 상태가 실제로 발생한다.
    requestAnimationFrame(function () { root.setAttribute("data-ddak-state", "default"); });

    var onClick = function () {
      root.setAttribute("data-ddak-state", "success");
      btn.textContent = "정상 동작 " + (ns.loader ? "v" + ns.loader.version : "");
    };
    btn.addEventListener("click", onClick);

    return function unmount() {
      btn.removeEventListener("click", onClick);
      root.remove();
    };
  }

  function boot() {
    try {
      var slot = document.querySelector(SLOT);
      var host = slot || document.body;
      if (!host) return;                       // body조차 없으면 조용히 종료
      if (ns.helloBadgeUnmount) ns.helloBadgeUnmount();
      ns.helloBadgeUnmount = render(host, !slot);
    } catch (e) {
      try { console.warn("[ddak] hello-badge skipped"); } catch (e2) {}
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
