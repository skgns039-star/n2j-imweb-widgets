/* imweb-widget-agent loader — INV-1/INV-2: 아임웹에 존재하는 유일한 코드. 1회 삽입 후 불변.
   REQ-012 registry 구동 · REQ-014 SRI · REQ-022 킬 스위치 · REQ-023 fail-safe.
   원칙: 위젯이 안 뜨는 건 사고가 아니다. 호스트 페이지가 깨지는 게 사고다. */
(function () {
  "use strict";
  try {
    var s = document.currentScript;
    if (!s) return;
    var SITE = s.getAttribute("data-site") || "";
    var REG = s.getAttribute("data-registry") || "";
    if (!SITE || !REG) return;

    var ns = (window.__ddak = window.__ddak || { loaded: {} });
    var warn = function (m) { try { console.warn("[ddak] " + m); } catch (e) {} };

    // §24.2 자기식별 + 중복 무해화. 스캔(사전)과 로더(사후)의 이중 방어 (INV-1).
    if (ns.loader) { warn("duplicate loader ignored (already " + ns.loader.version + ")"); return; }
    ns.loader = { version: "1.1.0", site: SITE, bootAt: Date.now() };

    var globOk = function (globs, path) {
      if (!globs || !globs.length) return true;
      for (var i = 0; i < globs.length; i++) {
        var g = String(globs[i]).replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
        if (new RegExp("^" + g + "$").test(path)) return true;
      }
      return false;
    };

    // fail-closed 스키마 검증 (§18.4). 하나라도 어긋나면 아무것도 로드하지 않는다.
    var validate = function (r) {
      if (!r || typeof r !== "object") return false;
      if (r.schema_version !== 1) return false;
      if (typeof r.updated_at !== "string" || !r.updated_at) return false;
      if (!Array.isArray(r.modules)) return false;
      return true;
    };

    var anchorFor = function (m) {
      var mt = m.mount || { type: "none" };
      if (mt.type === "none") return document.body;
      if (mt.type === "slot") return document.querySelector('[data-ddak-slot="' + mt.slot + '"]');
      if (mt.type === "selector") return document.querySelector(mt.selector);
      return null;                    // new-slot 등 미지원 타입은 조용히 skip
    };

    var inject = function (a, mount) {
      return new Promise(function (res) {
        var el;
        if (a.type === "css") {
          el = document.createElement("link");
          el.rel = "stylesheet"; el.href = a.url;
        } else {
          el = document.createElement("script");
          el.src = a.url; el.defer = true;
        }
        if (a.integrity) { el.integrity = a.integrity; el.crossOrigin = "anonymous"; }
        if (mount) el.setAttribute("data-ddak-mount", mount);
        el.onload = function () { res(true); };
        el.onerror = function () { res(false); };   // SRI 불일치 포함 → 해당 모듈만 skip
        document.head.appendChild(el);
      });
    };

    var run = function (reg) {
      if (!validate(reg)) return;                        // INV-9
      if (reg.global_enabled === false) return;          // REQ-022 전역 킬 스위치
      var site = (reg.sites || {})[SITE];
      if (site && site.enabled === false) return;        // 사이트별 킬 스위치
      var path = location.pathname;

      (reg.modules || []).forEach(function (m) {
        try {
          if (!m || m.enabled !== true) return;
          if (m.match && m.match.site && m.match.site !== SITE) return;
          if (m.match && !globOk(m.match.path_glob, path)) return;
          if (ns.loaded[m.widget_id]) return;
          var anchor = anchorFor(m);
          if (!anchor) return;                           // §18.3 앵커 미발견 = 조용한 skip
          ns.loaded[m.widget_id] = m.version;
          var assets = m.assets || [];
          assets.forEach(function (a) {
            if (!a || !a.url || !a.integrity) return;    // integrity 없는 자산은 실행하지 않는다 (REQ-014)
            inject(a, m.mount && m.mount.type === "slot" ? m.mount.slot : "").then(function (ok) {
              if (!ok) { delete ns.loaded[m.widget_id]; warn("asset blocked: " + m.widget_id); }
            });
          });
        } catch (e) { warn("module skipped: " + (m && m.widget_id)); }   // 모듈 격리
      });
    };

    fetch(REG, { cache: "no-store", credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (reg) { try { if (reg) run(reg); } catch (e) { warn("run failed"); } })
      .catch(function () { /* registry fetch 실패 → 조용히 종료 */ });
  } catch (e) {
    try { console.warn("[ddak] loader aborted"); } catch (e2) {}
  }
})();
