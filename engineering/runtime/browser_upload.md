# ENG-020 / ENG-032~035 브라우저 자동 업로드 — **DEFER (M2)**

현재 상태: **미구현.** M0(로더 삽입 + 1왕복 + 해시 + 롤백)을 통과하기 전에는 착수하지 않는다 (§0.3).
차단 게이트: `OPEN-BRW-01`(약관 자동화 조항), `OPEN-BRW-02`(2차 인증 여부), `OPEN-BRW-03`(OPERATING_APPROVED 발급).
그때까지 로더 삽입 경로는 **수동 1회 삽입**(`loader/LOADER_SNIPPET.md`)이다.

## 착수 시 지켜야 할 계약 (축소 금지 — Ponytail 보호 목록 P-1~P-5)
파이프라인: preflight → snapshot → guard → write → save → verify → (restore) → live check → report

1. **preflight** 세션 유효성(관리자 페이지 200 + 로그인 마커). 실패 시 사람 개입 요청.
2. **snapshot** 대상 코드 영역 원문을 `state/imweb_snapshots/<ts>.txt` 로 저장. **실패하면 쓰기 금지** (INV-6).
3. **guard** `config/imweb_selectors.yaml` 의 모든 앵커 존재 확인. 1개라도 미발견 → 중단 + "UI 변경 감지". **비슷한 요소를 추측해 클릭하지 않는다.**
4. **write** append 방식. 기존 코드 임의 삭제 금지.
5. **save** 저장 버튼 클릭 → 완료 마커 대기(60초).
6. **verify** 재조회 → **주석 제거 정규화 diff**. 0일 때만 성공. 저장 버튼 클릭 성공은 성공이 아니다.
7. **restore** diff가 0이 아니면 스냅샷으로 되돌리고 BLOCKED.
8. **live check** 실사이트 로드 → 로더 실행·콘솔 에러 확인.

## 세션 (REQ-017)
- 최초 1회 headed 창에서 **사람이 직접 로그인**. storageState 를 `state/browser/` 에 저장(gitignore 필수).
- 자격증명은 한 번도 프로그램에 들어오지 않는다. 만료 시 텔레그램으로 재로그인 요청.

## 실행 모드
세션 유효 → headless / 최초·만료·2FA·CAPTCHA → headed 대기(최대 10분) / 셀렉터 파손 → 실행 안 함, 수동 안내로 강등.
