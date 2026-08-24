# ENG-029 레지스트리 구동형 로더 (REQ-012, INV-4)

- 구현: `loader/loader.js` (아임웹 삽입본, **불변**), `src/release/registry.ts` (생성기)
- 로더는 **어떤 위젯이 있는지 모른다.** `registry.json` 만 읽고 조건에 맞는 모듈을 로드한다.
- 따라서 **새 코드 추가 = registry 항목 1개 추가**이며 아임웹은 영원히 그대로다 (AC-014, diff = 0).
- 로더가 받는 값은 스크립트 태그의 `data-site`, `data-registry` 둘뿐이다.
- **fail-closed 스키마 검증:** schema_version === 1, updated_at 문자열, modules 배열. 하나라도 어긋나면 아무것도 로드하지 않는다.
- integrity 없는 자산은 실행하지 않는다 (REQ-014).
- 중복 삽입 방어: `window.__ddak.booted`.
- **PTEST-020 / TEST-014·TEST-018.**
