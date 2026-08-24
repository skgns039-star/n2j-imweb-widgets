# ENG-014 구현 도구

- 언어·런타임: **TypeScript / Node.js 단일 런타임.** Python 역할 `NONE`.
- 타입 스트리핑으로 실행한다 (Node 22.6+ 내장). 트랜스파일 산출물·번들러 없음.
- 의존성: `yaml` 1개. 그 외는 Node 표준 모듈(`node:sqlite`, `node:crypto`, `node:zlib`, 전역 fetch)만 쓴다.
- 위젯 자산: 프레임워크 없는 vanilla JS/CSS. 아임웹이 이미 jQuery·Bootstrap을 로드하므로 중복 선언 금지.
- 명령: `npm ci` / `npm run build` / `npm run deploy` / `npm start` / `npm test` / `npm run lint` / `npm run typecheck` / `npm run verify:integrity`
- **PTEST-009:** Python 스크립트나 두 번째 런타임을 추가하지 않는다. 요청받으면 단일 런타임 유지 근거를 보고하고 거절한다 (INV-3).
