# ENG-046 아임웹 SEO 스킬 (포인터)

- 결정: APPLY (M1 진단 전용) / 층: Builder+Runtime 혼합, **격리 배치**
- 정본: `.claude/skills/imweb-seo/SKILL.md` (v2.0). **이 문서는 포인터다 — 내용을 복제하지 않는다.**
- 참조 4종: `.claude/skills/imweb-seo/references/{audit-checklists,templates-and-forms,vocabulary-and-site-types,source-priority-and-code-origin}.md`
- Codex 배치: `$CODEX_HOME/skills/imweb-seo/` (동일 구조). 경로는 각 환경에서 개별 확인했다 — 상호 복사하지 않았다.

## 격리 계약 (섞이지 않게 하는 지점)

| 항목 | 규칙 | 강제 |
|---|---|---|
| 코드 위치 | `src/seo/` 안에서만 | ITEST-001 |
| 마커 | `DDAK-SEO` 만. 로더 마커를 읽지도 쓰지도 않는다 | ITEST-002 |
| 마커 함수 | 로더와 공유하지 않는 별도 모듈 (`src/seo/marker.ts`) | ITEST-002 |
| 산출물 | `seo/<site_id>/` 안에서만. `dist/`·`registry.json`·`loader/` 접근 금지 | ITEST-002b |
| 테스트 | `tests/seo/` 에만 추가 | - |
| 의존성 | 추가 0건. 기존 Playwright·승인·스냅샷·secretscan 재사용 | - |
| secretscan | `seo/**` (exports 포함) 검사 대상 | STEST-013 |

**라우터 예외:** `src/bot/router.ts` 에 진입 8줄(import·인텐트·디스패치)만 추가했다.
[2]의 "src/bot 수정 0줄"과 [3]의 "라우터에 인텐트 추가"가 충돌해, 격리 의도를 지키는 최소 해석을 택했다.
SEO 로직은 한 줄도 `src/bot` 에 없다 — 판정·흐름 전부 `src/seo/route.ts` 에 있다.

## 이번 범위 = M1 (진단 전용)

- 1~8단계, `OBSERVE`/`PLAN`/`DRAFT` 까지. **아임웹 쓰기 0건.**
- 9~11단계 반영과 Naver·Daum 폼 자동입력은 M2 → `SEO-M2` 게이트가 차단한다.
- GSC·Bing API 는 `SCHK-001/002` 미해소 → `gateBlock` 이 차단한다.
- 산출물: 진단 보고서 + 붙여넣을 스니펫까지.

## 게이트

`contracts/AUTHORITY_MANIFEST.yaml` 에 `SCHK-001~006`, `SEO-M2` 를 등록했다.
하나라도 미해소면 **해당 엔진만 PENDING**이고 나머지는 진행한다. 전부 멈추지 않는다.

## 검사

- `STEST-001~028` 전량 실구현 (`tests/seo/*.test.ts`)
- `npm run stest:coverage` — 선언만 있고 테스트 없는 STEST 가 1건이라도 있으면 **종료코드 1**
- `ITEST-001~004` — 격리 계약 강제
- Ponytail 보호 목록에 `P-16: STEST 구현을 축소하지 않는다` 추가
