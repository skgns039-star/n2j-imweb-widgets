# ENG-013 외부 접근 전략

| 후보 | 판정 | 확인일 | 근거 |
|---|---|---|---|
| 아임웹 Open API `Script` | `APPLY(조건부·우선)` — **미확인** | 2026-08-24 | 개발자센터 Reference에 Script 그룹 존재. **쓰기 지원 여부 미확인 → CHK-001** |
| 브라우저 자동화 (Playwright) | `APPLY` — **M2로 DEFER** | 2026-08-24 | 사용자 필수 요구. UI 변경 취약 → §19 계약 필요 |
| 유료 API | `OMIT` | - | 완료 조건에 불필요 |
| 수동 삽입 (사람 승인형) | `APPLY(fallback)` — **현재 기본 경로** | - | 사이트당 1분 미만. REQ-001~004는 그대로 성립 |
| Hallmark study (공개 페이지 읽기) | `APPLY` | - | 온보딩 1회, 읽기 전용 |

## 라우팅
Script API 사용 가능? → 예: API 업로더 / 아니오: 브라우저 업로더 → 브라우저 차단(2FA·CAPTCHA·셀렉터 파손)? → 예: 사람 개입 요청

## AC-013 기록
- **CHK-001 상태: OPEN.** Script API 쓰기 지원 여부 **미확인**. 확인 주체: 사용자(개발자센터 앱 등록 후) + 구축자 조사.
- 미확인 상태에서 아임웹 API를 호출하지 않는다 (`contracts/AUTHORITY_MANIFEST.yaml` blocking_gates).
- 현재 M0의 로더 삽입 경로 = **수동 1회 삽입** (`loader/LOADER_SNIPPET.md`).
