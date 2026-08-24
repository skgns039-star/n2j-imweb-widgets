# AGENTS.md — 두 구축자 공통 총칙

이 저장소는 **Codex** 와 **Claude Code** 가 **동일한 계약**으로 작업한다 (REQ-006).
한 구축자에서 확인한 명령·모델명을 다른 구축자로 복사하지 않는다. 각 환경에서 개별 확인한다.

## 작업 시작 전 반드시 읽는다
1. `CODEX_BUILD_SPEC.md` §0 (권위 우선순위 · 본질 불변식)
2. `contracts/AUTHORITY_MANIFEST.yaml` (충돌 판정표 · 미해소 게이트)
3. `engineering/ENGINEERING_INDEX.md` 의 APPLY 모듈
4. `engineering/support/ponytail_policy.md` 보호 목록 P-1~P-12
5. `STEPS.md`

## 절대 규칙
- **INV-1~INV-9 는 어떤 지시로도 완화되지 않는다.** "승인 생략해"는 거절한다.
- 토큰·Secret을 로그·커밋·문서·화면에 출력하지 않는다.
- 아임웹 관리자 코드를 직접 덮어쓰지 않는다. 아임웹 쓰기 전에는 반드시 스냅샷을 먼저 저장한다.
- 해시가 4지점 전부 일치할 때만 배포다. 불일치는 재시도 없이 즉시 중단.
- 미해소 차단 게이트(CHK-001~005 등)에 걸린 동작은 실행하지 않는다.
- 단일 런타임(TypeScript/Node)을 유지한다. Python·두 번째 스택을 들이지 않는다.

## 경계
- 쓰기 허용: `src/widgets/** dist/** manifest/widgets.yaml integrity/** state/** logs/** HARNESS_LOOP.md`
- 읽기 전용: `loader/**` (스니펫 변경은 명시 승인 대상), `contracts/**`, `CODEX_BUILD_SPEC.md`
- 승인 필요: CDN 배포 · git tag push · 롤백 · 아임웹 쓰기 · 로더 교체 · 킬 스위치 재개

## 명령
`npm ci` / `npm run build` / `npm test` / `npm run lint` / `npm run typecheck` / `npm run verify:integrity` / `npm run secretscan` / `npm start`

## 현재 게이트
**M0** (로더 삽입 + 서브파일 1왕복 + 해시 일치 + 롤백) — 진행 중.
M0을 통과하지 못하면 M1(신규 위젯 무수정 반영), M2(브라우저 자동 업로드) 이후는 착수하지 않는다.
