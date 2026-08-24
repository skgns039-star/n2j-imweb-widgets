# STEPS — 실행 연쇄 계약 (ENG-008)

검증을 통과해야만 다음 단계로 간다. 단계를 건너뛴 배포는 절차 위반이다 (PTEST-006).

| # | 단계 | 통과 조건 | 실패 시 |
|---|---|---|---|
| 1 | 분류 (Routing) | 조회·수정·신규추가·배포·롤백·설치 중 하나로 확정 | 불명확하면 **한 번만** 되묻는다 |
| 2 | 정본 수정 | `src/widgets/<id>/` 만 변경, 변경 요약 보고 | 다른 경로 수정 시 중단 |
| 3 | 빌드 | `npm run build` 종료코드 0 (린트·예산·해시 포함) | 배포 진행 금지 |
| 4 | 로컬 무결성 | source == dist 전부 일치 | 즉시 중단 (재시도 0회) |
| 5 | 승인 요청 | 1회 승인 페이로드 제시 후 **대기** | 무응답 15분 → 만료 |
| 6 | 배포 | 승인 확인 → 태그 푸시 → registry 푸시 → purge | 승인 없으면 실행 안 함 |
| 7 | CDN 재검증 | 재fetch 해시 = dist, SRI 일치, registry updated_at 반영 확인 | `result=BLOCKED` |
| 8 | 실사이트 확인 안내 | 확인 URL 회신 | - |
| 9 | 보고 | `logs/actions/<ts>.json` 기록 + 한국어 3~5줄 요약 | - |

## 최초 설치 (1회)
1. GitHub public 저장소 생성 → `manifest/widgets.yaml` 의 cdn.owner/repo 와 `.env` 를 채운다
2. `npm ci && npm run build`
3. 아임웹 코드 영역 **원문 스냅샷**을 `state/imweb_snapshots/` 에 저장 (INV-6)
4. `loader/LOADER_SNIPPET.md` 의 스니펫 + 슬롯 프리셋을 **1회** 삽입 (append, 기존 코드 삭제 금지)
5. 저장 후 재조회 → 정규화 diff = 0 확인. 아니면 스냅샷 복원
6. 실사이트 콘솔에서 `window.__ddak.loaded` 확인
7. 이후 이 코드는 **영원히 손대지 않는다** (INV-2)
