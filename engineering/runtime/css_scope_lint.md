# ENG-040 CSS 스코프 린터 (REQ-020, REQ-021, INV-7)

구현: `src/release/css_scope_lint.ts` — 빌드에 물려 있어 위반 시 **빌드가 실패**한다.

| 규칙 | 강제 |
|---|---|
| 네임스페이스 | 모든 셀렉터에 `.ddak-` / `--ddak-` / `[data-ddak` 중 하나가 있어야 한다 |
| 전역 셀렉터 금지 | `*`, `html`, `body`, `:root` 로 시작하는 셀렉터 거부 |
| 리셋·외부 폰트 금지 | `@import`, `@font-face` 거부 |
| 전역 오염 금지 | window 할당은 `window.__ddak` 만 허용 |
| 웹폰트 요청 금지 | fonts.googleapis / fonts.gstatic 문자열 거부 |
| z-index 상한 | 9000 초과 거부 (아임웹 UI 침범 방지) |

- 이벤트: document 전역 리스너는 언마운트 시 반드시 해제한다(린터가 잡지 못하므로 리뷰 항목).
- Shadow DOM 적용 범위는 `OPEN-HLM-03` (미결).
- **PTEST-037 / AC-027·AC-028.**
