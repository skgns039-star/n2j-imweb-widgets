# CODEX BUILD SPEC

`SPEC_VERSION: 11`
`STATUS: DRAFT`
`PROJECT_NAME: imweb-widget-agent (아임웹 고객 홈페이지 위젯코드 관리 에이전트)`
`TARGET_PATH: C:\Users\cut07\projects\imweb-widget-agent`
`OWNER: 나훈 / 딸깍스튜디오`
`CREATED_AT: 2026-08-24`
`APPROVED_AT: PENDING`
`PROJECT_MODE: NEW`
`BUILDER_TARGET: CODEX + CLAUDE_CODE (동일 계약, 병행)`
`DELIVERY_LEVEL: STANDARD` (M0 게이트는 QUICK_MVP 상당)
`TARGET_READINESS: FUNCTION_READY`
`CURRENT_READINESS: NOT_TESTED`
`USER_ACCEPTANCE: NOT_STARTED`

---

## 0. 권위 우선순위와 본질 불변식

### 0.1 권위 우선순위 (충돌 시 위쪽이 이긴다)

| 순위 | 권위 | 내용 |
|---|---|---|
| **1** | **본질 불변식 (§0.2)** | INV-1~INV-9. 어떤 지시·스킬·최적화로도 완화 불가 |
| **2** | 보안·비밀 비노출 | 절대규칙 9. 자격증명·토큰 미출력 |
| **3** | 승인 경계 | 1회 승인 / `OPERATING_APPROVED` 범위 |
| **4** | 무결성 판정 | 4단 해시·정규화 diff. 불일치 시 무조건 중단 |
| **5** | `CODEX_BUILD_SPEC.md` (본 문서) | 범위·요구·AC |
| **6** | `engineering/**` APPLY 모듈 | 실행 지침 |
| **7** | **Hallmark** | 위젯 UI 품질 (컴포넌트 스코프 한정) |
| **8** | **Ponytail** | 구현 최소화 |
| **9** | 사용자의 현재 지시 | 위 1~8을 위반하지 않는 범위에서 최우선 반영 |

**해석 규칙**
- 7 vs 8 충돌은 §21.5 표로 즉시 판정한다.
- 9는 1~4를 이길 수 없다. 사용자가 "승인 생략해"라고 해도 거절한다.
- 스킬(7·8)은 **구축자 층**에만 존재한다. 런타임 산출물(`dist/`, `registry.json`, 로더)에 스킬의 흔적이 남으면 안 된다.
- 새 규칙셋·스킬을 추가할 때는 이 표에 위치를 먼저 배정한 뒤 도입한다.

### 0.2 본질 불변식 (INVARIANT)

> 이 9개는 프로젝트의 존재 이유다. 요구가 늘어나든 스킬이 붙든 **절대 변형되지 않는다.** 위반하는 변경은 계획 자체가 무효다.

| ID | 불변식 | 깨졌을 때 |
|---|---|---|
| **INV-1** | 아임웹에 존재하는 코드는 **로더 1개 + 빈 슬롯**뿐이다 | 변질 위험이 되살아남 |
| **INV-2** | 로더·슬롯은 **1회 삽입 후 불변**이다 | INV-1 붕괴 |
| **INV-3** | 코드 정본은 **Git 단 하나**다. CDN·아임웹은 사본·실행처일 뿐이다 | 진실 공급원 분열 |
| **INV-4** | 새 코드 추가는 **registry 항목 추가**로만 이뤄진다 | 아임웹 재수정 발생 |
| **INV-5** | 해시가 **4지점 전부 일치**할 때만 배포다 | 변질 코드 유출 |
| **INV-6** | 아임웹 쓰기 전 **원문 스냅샷**이 없으면 실행하지 않는다 | 복구 불가 |
| **INV-7** | 위젯은 **호스트 사이트를 침범하지 않는다** | 고객 사이트 파손 |
| **INV-8** | 승인 범위 밖 외부 행동은 **실행 전에 멈춘다** | 신뢰 붕괴 |
| **INV-9** | 실패 시 기본 동작은 **아무것도 하지 않는 것**(fail-closed)이다 | 부분 반영 상태 발생 |

**강제 방식:** 각 INV는 최소 1개의 실행 검사(TEST/PTEST)에 연결된다. 선언만 있고 검사가 없는 INV는 장식이므로 존재를 허용하지 않는다.

| INV | 강제 검사 |
|---|---|
| INV-1 / INV-2 | TEST-001, TEST-014 (삽입 코드 diff = 0) |
| INV-3 | PTEST-009 (중복 런타임·정본 금지) |
| INV-4 | TEST-014, TEST-018 |
| INV-5 | TEST-003, TEST-004, TEST-016 |
| INV-6 | TEST-011, TEST-024 |
| INV-7 | TEST-027, TEST-028, TEST-029 |
| INV-8 | TEST-025, PTEST-003, PTEST-017 |
| INV-9 | TEST-004, TEST-022, TEST-023, TEST-034 |

### 0.3 전달 수준 정정 사유

초기 `QUICK_MVP`로 잡았으나 이후 브라우저 자동 업로드(REQ-016~019), 레지스트리 구동(REQ-012~015), CSS 격리(REQ-020~021), 디자인 게이트가 추가되어 **핵심 업무 인수 검사가 필요한 범위**가 되었다. 정직하게 `STANDARD` / `FUNCTION_READY`로 정정한다.

단계 게이트는 유지한다:

| 게이트 | 범위 | 상태 |
|---|---|---|
| **M0** (QUICK_MVP 상당) | 로더 삽입 + 서브파일 1왕복 + 해시 일치 + 롤백 | PENDING |
| **M1** | 신규 위젯 추가 무수정 반영 + CSS 격리 검사 | PENDING |
| **M2** | 브라우저 자동 업로드 + 셀렉터 가드 + 자동 복원 | PENDING |
| **M3** (`FUNCTION_READY`) | 전체 AC 통과 + `USER_ACCEPTED` | PENDING |

M0을 통과하지 못하면 M1 이후는 착수하지 않는다.

---

---

## 1. 목표와 사용자

- **해결할 문제:** 아임웹 사이트의 위젯 코드를 수정할 때마다 관리자 화면에서 직접 코드를 고쳐야 하고, 아임웹이 저장 시 코드를 정규화(주석 제거)하기 때문에 반복 편집 과정에서 코드 변질·유실 위험이 있다.
- **목표 사용자:** 딸깍스튜디오 운영자(나훈) 1인. 이후 고객사 사이트로 확장.
- **한 문장 완료 상태:** 아임웹에는 **한 번만 삽입한 불변 로더**를 두고, 실제 위젯 로직은 Git 정본 → jsDelivr CDN으로 배포되며, 텔레그램에서 자연어로 지시하면 에이전트가 수정·해시검증·배포·롤백을 수행하고 결과를 원래 대화로 회신한다.

### 1.1 프로젝트 기준선과 변경분

| 항목 | 값 |
|---|---|
| 프로젝트 모드 | `NEW` |
| 검증된 기준선·증거 경로 | `N/A` |
| 이번 변경 요구 | 신규 구축 |
| 영향받는 파일·기능 | `N/A` |
| 재실행할 검사 | `N/A` |
| 되돌리기·복구 지점 | Git tag 기반. 아임웹 삽입 전 원문 스냅샷(`state/imweb_snapshots/`) |

#### 확인된 사실 (공식 문서, 확인일 2026-08-24)

1. 아임웹 코드 위젯은 HTML·JavaScript·CSS 등 **클라이언트 사이드 언어만** 지원하고, **실제 사이트에는 주석이 제거된 상태로 저장**된다.
   → 위젯 본문을 아임웹 내부에 두고 왕복 편집하면 "원본과 바이트 동일"을 보장할 수 없다. **REQ-003의 설계 근거.**
2. 공통 CSS·JavaScript는 `환경설정 > SEO(검색엔진최적화) > 공통 코드 삽입`에 넣고 코드 위젯에서 호출하는 방식이 아임웹의 권장 방식이다.
   → 로더 + 외부 서브파일 구조는 플랫폼 권장 경로와 일치한다.
3. 직접 입력한 스크립트는 아임웹 정기 업데이트로 적용되지 않거나 수정이 필요할 수 있다. → 정기 회귀 감시 필요(STANDARD 범위).
4. 아임웹 개발자센터에 Open API가 있으며 Reference 그룹에 `OAuth2.0 / Site-Info / Member-Info / Community / Promotion / Product / Order / **Script** / Payment`가 존재한다.
5. REST API 사용에는 API Key·Secret이 필요하며 **키는 사이트 단위로 생성**된다.
6. 공통 코드 삽입은 아임웹 유료 요금제 기능이다.

#### 자료 기반 추론

- `Script` API는 타 커머스 플랫폼의 ScriptTag 계열과 유사하게 **앱 서비스가 사이트에 스크립트를 등록·갱신**하는 용도일 가능성이 높다. 사실이면 브라우저 자동화 없이 로더를 삽입할 수 있다.
- 다수 고객사 대상 배포는 앱 심사·제휴가 변수가 될 수 있다. 이번 범위(사이트 1곳)에서는 해당 없음.

#### 확인 필요 (Step 2 preflight의 차단 게이트)

| ID | 확인 항목 | 미확인 시 처리 |
|---|---|---|
| CHK-001 | `Script` API가 **쓰기(등록·수정·삭제)** 를 지원하는가, 대상이 공통 스크립트인가 코드 위젯인가 | 로더 삽입은 **수동 1회**로 대체 |
| CHK-002 | 자체(비공개) 앱으로 본인 소유 사이트에 OAuth 연동이 가능한가 | 수동 대체 |
| CHK-003 | 필요한 호출량이 무료 범위인가 (키 발급 무료 ≠ 호출 무료) | 비용 확정 전 자동 호출 금지 |
| CHK-004 | Codex 구독 인증 / Claude 구독 인증으로 **무인(비대화형) SDK 실행**이 허용되는가 | 허용 확인 전 무인 스케줄 실행 금지, 사람 트리거만 |
| CHK-005 | 대상 아임웹 사이트가 공통 코드 삽입 가능한 요금제인가 | 코드 위젯 단독 경로로 축소 |

> **기간 보장 없음.** 위 게이트 확인 전에는 "당일 연동" 등 기간을 확정하지 않는다.

---

## 2. 범위

### 포함

- Git 정본 저장소 + 빌드 산출물 + jsDelivr 배포 파이프라인
- 무결성 가드(SHA-256 생성 → CDN 재fetch → 재비교), 실패 시 배포 중단
- 버전 태그 기반 롤백
- 텔레그램 봇 1개 → Agent Registry → 대화별 Thread Store → 원래 대화 응답
- Codex SDK / Claude Agent SDK **둘 다 Registry에 등록**하고 전환 가능하게 구성 (1차 실연결은 1개)
- 아임웹 삽입 전 원문 스냅샷 백업
- MCP 도구 경계(저장소 읽기, 빌드, 배포, 검증)

### 제외 (이번 수준)

- 다수 고객사 동시 관리, 고객 계정 위임 (사이트 1곳 증명 후 STANDARD로 승격)
- 브라우저 자동 업로드 (ENG-020 `DEFER`)
- 주간 자동 회귀 감시 스케줄러 (`DEFER`)
- 24시간 상시 운영, app-server, Agents SDK 멀티에이전트

### 금지

- 아임웹 관리자 화면의 **기존 위젯 코드 본문을 에이전트가 직접 덮어쓰기** (스냅샷·승인 없이 절대 금지)
- 승인 없는 배포·삭제·공개 반영
- 원시 토큰·API Secret을 로그·Git·Markdown·화면에 출력 (보안 절대규칙 9)
- 해시 불일치 상태로 배포 완료 선언
- Codex 전용 명령·모델명을 Claude Code 설계로, 또는 그 반대로 복사

---

## 3. 입력과 산출물

| ID | 입력·이벤트 | 출처·경로 | 역할 | 산출물 | 저장 경로 |
|---|---|---|---|---|---|
| IO-001 | 텔레그램 자연어 지시 | Telegram Bot API update | 작업 트리거 | 작업 결과 요약 메시지 | 원래 chat_id |
| IO-002 | 위젯 소스 | `src/widgets/<widget_id>/` | 정본 | 빌드 산출물 | `dist/<widget_id>/<version>/` |
| IO-003 | 배포 매니페스트 | `manifest/widgets.yaml` | 사이트↔위젯↔버전 바인딩 | 갱신된 매니페스트 | 동일 |
| IO-004 | 무결성 기록 | 빌드 시 생성 | 변질 판정 근거 | `integrity/<widget_id>.json` | 동일 |
| IO-005 | 아임웹 원문 스냅샷 | 수동 붙여넣기 또는 API 조회 | 복구 기준 | 타임스탬프 스냅샷 | `state/imweb_snapshots/` |
| IO-006 | 로더 스니펫 | 최초 1회 생성 | 아임웹에 삽입할 유일한 코드 | 고정 스니펫 텍스트 | `loader/LOADER_SNIPPET.md` |

---

## 4. 기능 요구사항

| ID | 요구 | 우선순위 | 근거 | 상태 |
|---|---|---|---|---|
| REQ-001 | 아임웹에 삽입되는 코드는 **버전 무관 불변 로더 1개**로 고정하고, 배포 시 재삽입하지 않는다 | MUST | 사용자 요구 2·3 | CONFIRMED |
| REQ-002 | 서브파일(`src/widgets/**`)을 수정하면 CDN 반영을 거쳐 아임웹 사이트에 표시되는 결과가 바뀐다 | MUST | 사용자 요구 2 | CONFIRMED |
| REQ-003 | 정본 → 빌드 → CDN 전 구간 SHA-256이 일치해야 하며, 불일치 시 배포를 중단하고 사용자에게 보고한다 | MUST | 사용자 요구 3 | CONFIRMED |
| REQ-004 | 이전 버전 태그로 아임웹 재편집 없이 롤백할 수 있다 | MUST | 요구 3 파생 | CONFIRMED |
| REQ-005 | 텔레그램에서 허용된 chat/user만 지시할 수 있고, 결과는 **원래 대화**로만 회신한다 | MUST | 사용자 요구 6 | CONFIRMED |
| REQ-006 | Codex와 Claude Code 두 구축자가 **동일 Build Spec·승인·검사 계약**으로 작업할 수 있다 | MUST | 사용자 요구 4 | CONFIRMED |
| REQ-007 | Codex SDK / Claude Agent SDK 둘 다 Agent Registry에 등록되고, 설정 변경만으로 전환된다 | MUST | 사용자 요구 6, 답변 ④=C | CONFIRMED |
| REQ-008 | 저장소·빌드·배포·검증 도구를 MCP 도구 경계로 노출하고 권한을 분리한다 | SHOULD | 사용자 요구 5 | CONFIRMED |
| REQ-009 | 외부 브라우저로 아임웹 관리자에 로더를 자동 삽입한다 | SHOULD | 사용자 요구 5 | `DEFER` → STANDARD |
| REQ-010 | 아임웹 Open API `Script` 쓰기 지원 여부를 확인하고 결과를 기록한다 | MUST | CHK-001 | PENDING |
| REQ-011 | 아임웹 코드 영역을 변경하기 전 항상 원문 스냅샷을 저장한다 | MUST | 요구 3 | CONFIRMED |
| REQ-012 | **새 위젯·새 코드를 추가해도 아임웹을 다시 수정하지 않는다.** 로더는 CDN의 `registry.json`을 읽어 등록된 모듈을 동적으로 로드한다 | MUST | 사용자 추가 요구 | CONFIRMED |
| REQ-013 | 최초 1회 설치 시 로더와 함께 **슬롯 프리셋**(`<div data-ddak-slot="...">`)을 심어, 이후 특정 위치에 붙는 위젯도 아임웹 수정 없이 추가된다 | MUST | REQ-012 파생 | CONFIRMED |
| REQ-014 | `registry.json`의 각 모듈 항목은 SRI 해시를 포함하고, 로더는 해시가 일치할 때만 실행한다 | MUST | 요구 3 + REQ-012 | CONFIRMED |
| REQ-015 | 배포 후 `registry.json`의 CDN 캐시를 즉시 무효화하고, 무효화 성공을 확인한 뒤에만 완료로 보고한다 | MUST | REQ-012 파생 | CONFIRMED |
| REQ-020 | 위젯의 CSS·JS는 **호스트(아임웹) 페이지를 침범하지 않는다.** 전역 셀렉터·전역 변수·전역 이벤트 오염 금지 | MUST | 요구 3(변질 방지)의 런타임 확장 | CONFIRMED |
| REQ-021 | 위젯 디자인은 **호스트 사이트의 폰트·색·간격을 상속**하며, 외부 웹폰트를 추가 로드하지 않는다 | MUST | 고객 사이트 성능·일관성 | CONFIRMED |
| REQ-022 | `registry.json`에 **전역 킬 스위치**(`global_enabled: false`)를 두어, 사고 시 텔레그램 한마디로 모든 위젯을 즉시 정지한다 | MUST | INV-9 | CONFIRMED |
| REQ-023 | 로더는 **전 구간 try/catch로 감싸고**, 어떤 실패에서도 호스트 페이지의 렌더링·스크립트를 방해하지 않는다 | MUST | INV-7, INV-9 | CONFIRMED |
| REQ-024 | 위젯 1개당 **gzip 30KB, 총합 100KB** 예산을 초과하면 빌드를 실패시킨다 | MUST | 고객 사이트 성능 | CONFIRMED |
| REQ-025 | 위젯은 **방문자 개인정보를 수집·전송하지 않는다.** 외부 엔드포인트 호출은 CDN 정적 자산에 한정한다 | MUST | 법적 위험 차단 | CONFIRMED |

---

## 5. 비기능 요구

| ID | 영역 | 기준 |
|---|---|---|
| NFR-001 | 성능·시간 | 텔레그램 지시 → 1차 응답 10초 이내, 배포 완료 보고 5분 이내 |
| NFR-002 | 신뢰성·복구 | 배포 실패 시 CDN 경로 미변경 유지. 롤백 1회 명령으로 완료 |
| NFR-003 | 보안·비밀 | 토큰은 OS 키체인·환경변수 참조만. 화면·로그·Git 출력 금지 |
| NFR-004 | 비용 상한 | 무료 범위(GitHub, jsDelivr, Telegram) 초과 예상 시 실행 전 중단·보고 |
| NFR-005 | 무결성 | 정본·빌드·CDN 3지점 해시 일치. 1건이라도 불일치 시 `FAIL` |

### 5.1 현실성 판정

- **판정: `CONDITIONAL`**
- 사용자의 실제 완료 상태: 텔레그램 지시 1회로 서브파일 수정 → 배포 → 해시 일치 확인 → 아임웹 테스트 사이트에서 변경 확인
- 확인된 수단·권한·환경: 아임웹 공통 코드 삽입 및 코드 위젯 경로(공식 문서 확인), GitHub + jsDelivr 무료, Telegram Bot 무료, 사용자 소유 테스트 사이트 1곳
- 조건부·차단 요소: CHK-001 ~ CHK-005
- 확인 근거·확인일: 아임웹 공식 FAQ 및 developers-docs.imweb.me, 2026-08-24
- 현실적 대안: `Script` API 쓰기 미지원 시 → **로더 수동 1회 삽입**(사이트당 1분 미만 작업). 이 경우에도 REQ-001~004는 그대로 성립하며 프로젝트 가치가 훼손되지 않는다

### 5.2 외부 서비스 접근 방식

| 후보 | 가용성 | 비용 | 인증·차단·약관·안정성 | 판정 | 이유 |
|---|---|---|---|---|---|
| 무료 공식 API (아임웹 Open API `Script`) | 확인 필요 | 확인 필요 | OAuth2.0, 사이트 단위 키 | `APPLY(조건부·우선)` | CHK-001~003 통과 시 **자동으로 이 경로를 우선 사용**. 브라우저보다 안정적 |
| 브라우저 자동화 (Playwright, Node) | 가능 | 무료 | 로그인 세션 재사용, 2차 인증·CAPTCHA는 사람 개입 fallback, UI 변경 위험 | **`APPLY`(기본 경로)** | **사용자 필수 요구.** API 미확인·미지원 상태에서도 자동 업로드가 성립해야 하므로 기본 업로더로 구축 |
| 유료 API·공식 연동 | 해당 없음 | - | - | `OMIT` | 현재 완료 조건에 불필요 |
| 사람 승인형 반자동 (수동 삽입) | 가능 | 무료 | 없음 | `APPLY(fallback)` | 2차 인증·CAPTCHA·셀렉터 파손 시 자동 강등되는 최후 경로 |

**업로더 라우팅 (자동 선택):** `Script API 사용 가능? → 예: API 업로더 / 아니오: 브라우저 업로더 → 브라우저 차단(2FA·CAPTCHA·셀렉터 파손)? → 예: 사람 개입 요청`

> 정직한 판정: 브라우저 자동화 자체는 구축 가능하나 **아임웹 UI 변경에 취약**하므로 `CONDITIONAL`이며, 셀렉터 파손 감지와 자동 복원을 함께 만들지 않으면 안전하지 않습니다. §19에 그 계약을 넣었습니다.

### 5.3 사용·운영 형태

| 항목 | 값 |
|---|---|
| 사용 형태 | `event-driven` (텔레그램 메시지). 주간 회귀는 `scheduled`로 STANDARD에서 추가 |
| 전달 수준 | `QUICK_MVP` |
| 목표 준비 상태 | `MVP_READY` |
| 자연어 명령 입력 경로 | Telegram 1:1 채팅 |
| 트리거 | Telegram update (polling, 단일 소유자) |
| 실행 호스트 | 로컬 Windows PC (`C:\Users\cut07\projects\imweb-widget-agent`) |
| 상태 지속성 | `state/threads.sqlite3` (대화 키별 Thread) |
| 결과·알림 경로 | 원래 chat_id |
| 운영 시간대 | Asia/Seoul, 사용자가 실행 중일 때만 |

### 5.4 전달·준비 상태 계약

- **이번 단계의 한 문장 outcome:** 테스트 사이트 1곳에서 로더가 고정된 상태로, 텔레그램 지시 → 서브파일 수정 → 해시 검증 배포 → 실사이트 반영 확인 → 롤백까지 1왕복이 실제로 성공한다.
- 선택한 인터페이스: Telegram
- `agent_id`: `imweb-widget-agent`
- 외부 쓰기: `approval-gated` (CDN 배포는 1회 승인 페이로드 필요)
- **required evidence:**
  1. 허용 chat 수락 / 미허용 chat 거절 로그
  2. 올바른 `agent_id` 선택, 대화별 Thread 생성·재개
  3. 원래 대화로만 응답
  4. 타임아웃·안전 중단 동작
  5. 정본/빌드/CDN 3지점 SHA-256 일치 출력
  6. 아임웹 테스트 페이지에서 변경 육안 확인
  7. 롤백 후 이전 상태 복귀 확인
  8. **신규 위젯 1개를 추가했을 때 아임웹 삽입 코드 diff = 0** 인 상태로 사이트에 표시됨 (REQ-012)
- **stop rule:** 해시 불일치, 승인 페이로드 부재, 미허용 사용자, CHK 게이트 미해소, 아임웹 원문 스냅샷 실패 → 즉시 중단·보고
- **다음 수준 승격 조건(→ STANDARD):** 위 증거 7건 확보 + `USER_ACCEPTED` + 다중 사이트 매니페스트·브라우저 자동 삽입·주간 회귀 감시 요구 확정
- **이번 수준에서 의도적으로 제외:** 브라우저 자동 업로드, 스케줄러, 다중 사이트, 독립 평가자, 24시간 운영

---

## 6. 요청 분류와 엔지니어링 결정

- 작업 유형: `코딩·자동화` + `외부 도구·서비스` + `장기 상태·이벤트`
- 오류 영향: `high` (고객 홈페이지가 깨질 수 있음)
- 기본 직접 지시로 충분한가: **아니오.** 순차 의존 단계와 승인 경계, 무결성 판정이 있어 최소한의 구조화·연쇄·라우팅이 필요하다.

| ENG ID | 층 | 기법·패턴·수단 | 결정 | 이유 | 예방할 실패 | 구현 위치 | PTEST |
|---|---|---|---|---|---|---|---|
| ENG-001 | Prompt | 직접 지시 | APPLY | 기본값 | 목적 이탈 | `prompts/AGENT_SYSTEM.md` | PTEST-001 |
| ENG-002 | Prompt | 구조화 출력 | APPLY | 배포 보고 스키마 고정 | 결과 판독 불가 | 동 | PTEST-002 |
| ENG-003 | Prompt | 제약조건 계층화 | APPLY | 금지·승인·예외가 다수 | 무단 배포·덮어쓰기 | 동 | PTEST-003 |
| ENG-004 | Prompt | Tool-use 지시 | APPLY | 도구 선택·쓰기 경계가 결과를 바꿈 | 잘못된 경로 쓰기 | 동 | PTEST-004 |
| ENG-005 | Prompt | Few-shot | OMIT | 검증된 예시·반례가 아직 없음 | - | `N/A` | - |
| ENG-006 | Prompt | 자료 기반 Grounding | APPLY | 아임웹 공식 제약을 사실 근거로 사용 | 잘못된 플랫폼 가정 | `engineering/prompt/grounding.md` | PTEST-005 |
| ENG-007 | Prompt | 출력 평가 루브릭 | OMIT | 해시 결정적 검사로 충분 | - | `N/A` | - |
| ENG-008 | Patterns | Prompt Chaining | APPLY | 수정→빌드→검증→배포→회귀의 순차 의존 | 검증 건너뛴 배포 | `STEPS.md`(저장소) | PTEST-006 |
| ENG-009 | Patterns | Routing | APPLY | 조회·수정·배포·롤백·설치로 경로가 다름 | 롤백 지시를 배포로 처리 | `engineering/patterns/routing.md` | PTEST-007 |
| ENG-010 | Patterns | Parallelization | OMIT | 단일 위젯 순차 작업 | - | `N/A` | - |
| ENG-011 | Patterns | Orchestrator-Workers | OMIT | 사전 정의 단계로 충분 | - | `N/A` | - |
| ENG-012 | Patterns | Evaluator-Optimizer | OMIT | pass/fail 검사로 충분 | - | `N/A` | - |
| ENG-013 | Runtime | 외부 접근 전략 | APPLY | API·브라우저·반자동 판정 기록 | 근거 없는 자동화 선택 | `engineering/runtime/external_access.md` | PTEST-008 |
| ENG-014 | Runtime | 구현 도구 | APPLY | 단일 런타임 고정 | 중복 스택 | `engineering/runtime/implementation_tools.md` | PTEST-009 |
| ENG-015 | Runtime | 실행 형태 | APPLY | event-driven 계약 | 무단 상시 실행 | `engineering/runtime/operation_mode.md` | PTEST-010 |
| ENG-016 | Runtime | Agent Registry | APPLY | 두 SDK 전환(REQ-007) | 봇↔에이전트 오배선 | `engineering/runtime/agent_registry.md` | PTEST-011 |
| ENG-017 | Runtime | Channel Router | APPLY | 허용 판정·update 단일 소유자 | 중복 consumer, 오응답 | `engineering/runtime/channel_router.md` | PTEST-012 |
| ENG-018 | Runtime | Thread State | APPLY | 대화별 상태 유지 | 전역 thread 혼선 | `engineering/runtime/thread_state.md` | PTEST-013 |
| **ENG-019** | **Runtime** | **무결성 가드(Integrity Guard)** | **APPLY** | **REQ-003 핵심** | **코드 변질·부분 배포** | `engineering/runtime/integrity_guard.md` | PTEST-014 |
| ENG-020 | Runtime | **브라우저 자동 업로드 (Playwright)** | **APPLY** | **사용자 필수 요구. 자동 업로드의 기본 경로** | 수동 삽입 누락·오타 | `engineering/runtime/browser_upload.md` | PTEST-015 |
| ENG-021 | Runtime | MCP 도구 경계 | APPLY | 요구 5. 읽기/빌드/배포 권한 분리 | 권한 과다 | `engineering/runtime/mcp_tools.md` | PTEST-016 |
| ENG-022 | Support | 승인 정책 | APPLY | 배포는 외부 반영 행위 | 무단 공개 반영 | `engineering/support/approval_policy.md` | PTEST-017 |
| ENG-023 | Support | Skill (재사용 절차) | APPLY | 요구 5. 수정→검증→배포→회귀 절차 고정 | 절차 누락 | `engineering/support/widget_release_skill.md` | PTEST-018 |
| ENG-024 | Support | Hooks | OMIT | 승인 대체 불가, 현재 불필요 | - | `N/A` | - |
| ENG-025 | Runtime | app-server | OMIT | 전용 클라이언트 UI 불필요 | - | `N/A` | - |
| ENG-026 | Runtime | Agents SDK + mcp-server | OMIT | 멀티에이전트 handoff 불필요 | - | `N/A` | - |
| ENG-027 | Support | Hill loop | APPLY | 모든 수준 필수 | 반복 실패 방치 | `HARNESS_LOOP.md` | PTEST-019 |
| ENG-028 | Runtime | 주간 회귀 스케줄러 | DEFER | 아임웹 업데이트 대비. STANDARD | - | `N/A` | - |

### 사용자에게 설명한 추천

- **추천 프롬프트 기법:** 직접 지시 + 출력 형식 고정 + "하면 안 되는 것" 우선순위 명시. 어려운 기법 없이 실수만 막는 최소 구성입니다.
- **추천 작업 패턴:** 연쇄(Chaining) — 검증을 통과해야만 다음 단계로 갑니다. 라우팅(Routing) — "고쳐줘/배포해줘/되돌려줘"를 다른 경로로 처리합니다.
- **추천 실행 수단:** SDK. 텔레그램에서 대화를 이어가며 후속 지시("그거 되돌려")를 받아야 하기 때문입니다.
- **Headless(P 대응) 설명:** 대화창 없이 명령 한 번으로 실행하는 방식(`codex exec`). 주간 자동 점검에만 쓰면 충분해서 지금은 넣지 않습니다.
- **SDK 설명:** 앱 코드가 AI를 호출하고 대화 상태를 이어가는 연결 방식. 텔레그램 봇에는 이쪽이 맞습니다.
- **의도적 제외:** 상시 서버, 멀티에이전트, 브라우저 자동화. 지금 완료 조건에 필요 없고 고장날 지점만 늘립니다.
- **예상 장점:** 아임웹을 다시 건드리지 않으므로 변질 위험이 구조적으로 사라지고, 롤백이 즉시 가능합니다.
- **주의:** 아임웹 정기 업데이트로 로더 삽입 위치가 영향받을 수 있어 STANDARD에서 회귀 감시가 필요합니다.
- **사용자가 선택한 답:** ① A(테스트 사이트 1곳) ② A(개발자센터 등록 의향, 공식 API 먼저 확인) ③ A(GitHub + jsDelivr) ④ C(두 SDK 등록 후 전환)

### 실행 수단 사용 여부

| 항목 | 결정 |
|---|---|
| 질문 처리 | `ASKED` (④) / 사용 형태는 `INFERRED_FROM_EXPLICIT_REQUEST` (요구 6) |
| 사용자 선택 | `CODEX_SDK` + `CLAUDE_AGENT_SDK` (Registry 전환, 1차 실연결 1개) |
| 호출 주체 | `service` (Telegram router) |
| 실행 빈도 | `per-request` |
| 상태 | `persistent-thread` |
| 결과 소비자 | `human` (Telegram) + `file` (integrity·log) |
| 양방향 연결 | `follow-up` + `approvals` |
| 선택 이유 | 후속 지시와 승인 왕복이 필요하므로 SDK가 최소 수단 |
| 제외한 수단·이유 | app-server(전용 UI 불필요), Agents SDK+mcp-server(handoff 불필요), 상시 서버(운영 요구 없음) |

### 채널·에이전트·대화 라우팅

| 항목 | 결정 |
|---|---|
| channel | telegram |
| bot_account_id | `imweb-widget-bot` |
| bot_token_ref | `env:IMWEB_WIDGET_BOT_TOKEN` (키체인/환경변수 참조, 원시값 미기록) |
| agent_id | `imweb-widget-agent` |
| prompt_path | `prompts/AGENT_SYSTEM.md` |
| workspace | `C:\Users\cut07\projects\imweb-widget-agent` |
| permission_profile | `imweb-widget` (repo write / dist write / deploy=approval-gated / imweb write=denied) |
| allowed_chat/user rule | 화이트리스트 `config/allowed_chats.yaml`. 미등록은 무응답 거절 로그 |
| conversation_key fields | `agent_id + channel + bot_account_id + chat_id + topic_id` |
| thread_store | `state/threads.sqlite3` |
| reply_target | 원래 `chat_id` (+ `topic_id`) |
| polling/webhook/update owner | **polling 단일 프로세스만.** webhook·OpenClaw·기타 consumer 동시 사용 금지 |

**runtime_engine 전환 계약 (REQ-007):**

```yaml
agents:
  - agent_id: imweb-widget-agent
    runtime_engine: codex_sdk        # codex_sdk | claude_agent_sdk
    engines:
      codex_sdk:        { auth_ref: env:CODEX_AUTH,  status: PENDING_CHK-004 }
      claude_agent_sdk: { auth_ref: env:CLAUDE_AUTH, status: PENDING_CHK-004 }
```

`runtime_engine` 값만 바꾸면 전환된다. 프롬프트·workspace·권한·Thread Store는 엔진과 무관하게 동일하다. **두 엔진을 동시에 같은 봇 업데이트에 붙이지 않는다.**

### 구축자·구현 도구 결정

| 항목 | 결정 |
|---|---|
| 구축자 | `CODEX` + `CLAUDE_CODE` 병행. 동일 Build Spec·승인·검사 계약. 각 환경의 지원 명령은 해당 환경에서 확인하고 상호 복사 금지 |
| 기존 저장소·언어 | 없음(신규) |
| 기본 구현 언어·런타임 | **TypeScript / Node.js 단일 런타임** |
| Python 역할 | `NONE` |
| Python 사용 범위 | `none` |
| 선택 근거 | ① Codex SDK가 TypeScript 공식·안정(Python은 beta) ② Claude Agent SDK도 TypeScript 지원 → 엔진 전환 시 런타임 재작성 불필요 ③ 위젯 산출물 자체가 브라우저 JS/CSS라 빌드 툴체인이 일치 ④ 브라우저 자동화 승격 시 Playwright(Node) 동일 스택 → **런타임을 하나로 유지해 중복 설치·중복 검사 경로를 만들지 않는다** |
| 다른 기술 선택·이유 | 위젯 자산은 프레임워크 없는 vanilla JS/CSS. 아임웹이 jQuery·Bootstrap을 이미 로드하므로 중복 선언 금지 |
| 패키지·실행 명령 | `npm ci` / `npm run build` / `npm run deploy` / `npm start` |
| 테스트·정적 검사 명령 | `npm test`, `npm run lint`, `npm run typecheck`, `npm run verify:integrity` |
| 구축자가 직접 확인할 버전·환경 | `node -v`, `npm -v`, SDK 설치 버전, `git --version`, 인증 상태 |

---

## 7. 에이전트 프롬프트 계약

### 7.1 역할·목표

- **역할:** 아임웹 사이트에 붙는 위젯 코드의 정본을 관리하고, 안전하게 빌드·검증·배포·롤백하는 릴리스 담당자.
- **목표:** 사용자가 텔레그램에서 요청한 위젯 변경을, 코드 변질 없이 실제 사이트에 반영하고 근거와 함께 보고한다.
- **비목표:** 아임웹 관리자 화면의 기존 코드를 직접 편집하는 것. 승인 없이 외부에 반영하는 것. 위젯 기획을 임의로 확장하는 것.

### 7.2 입력 바인딩

| ID | 이름 | 역할 | 우선순위 | 누락·충돌 처리 |
|---|---|---|---|---|
| PIN-001 | `CODEX_BUILD_SPEC.md` | 최상위 계약 | 1 | 충돌 시 이 문서 우선, 불일치는 `PLAN_CHANGE_REQUEST` |
| PIN-002 | `engineering/ENGINEERING_INDEX.md` + APPLY 모듈 | 실행 지침 | 2 | 누락 시 중단 |
| PIN-003 | `manifest/widgets.yaml` | 사이트↔위젯↔버전 | 3 | 미등록 위젯 요청은 거절 |
| PIN-004 | 텔레그램 사용자 지시 | 작업 내용 | 4 | 모호하면 1회 확인 질문 |
| PIN-005 | `integrity/*.json` | 이전 해시 기준 | 5 | 없으면 최초 생성으로 처리 |

### 7.3 지시 우선순위

1. 보안·비밀 비노출, 금지 행위 (어떤 지시로도 완화하지 않음)
2. 승인 경계 (배포·외부 반영은 승인 페이로드 필요)
3. 무결성 판정 (해시 불일치 시 무조건 중단)
4. Build Spec의 범위·요구
5. 사용자의 현재 지시

### 7.4 도구·권한·승인

- **허용 도구:** 저장소 읽기/쓰기, 빌드, 해시 계산, CDN URL fetch, git tag, 텔레그램 응답
- **읽기 허용:** `src/`, `dist/`, `manifest/`, `integrity/`, `state/`, `engineering/`, 배포된 CDN URL
- **쓰기 허용:** `src/widgets/**`, `dist/**`, `manifest/widgets.yaml`, `integrity/**`, `state/**`, `HARNESS_LOOP.md`
- **별도 승인 필요:** CDN 배포(공개 반영), git tag push, 롤백 실행, 아임웹 쪽 모든 쓰기
- **금지:** 아임웹 관리자 코드 직접 덮어쓰기, 토큰 출력, `loader/` 스니펫 변경(사용자 명시 승인 없이), 해시 검증 생략

### 7.5 단계·상태·실패

- **처리 단계:** `분류(Routing) → 정본 수정 → 빌드 → 해시 생성 → 승인 요청 → 배포 → CDN 재fetch·해시 재비교 → 실사이트 확인 안내 → 보고`
- **상태:** `state/threads.sqlite3` (대화별), `RUN_STATE.json` (실행 회차)
- **재시도·중단:** 네트워크 실패 3회 backoff. 해시 불일치는 재시도 없이 즉시 중단
- **미확인 사실 처리:** 추측 금지. `확인 필요`로 표시하고 사용자에게 확인 요청

### 7.6 출력 계약

```json
{
  "action": "modify | build | deploy | rollback | inspect | install",
  "widget_id": "",
  "version_from": "",
  "version_to": "",
  "integrity": { "source_sha256": "", "dist_sha256": "", "cdn_sha256": "", "match": true },
  "approval": { "required": true, "id": "", "status": "PENDING | APPROVED | NONE" },
  "result": "OK | BLOCKED | FAILED",
  "blocked_reason": "",
  "next_user_action": []
}
```

- 저장 위치: `logs/actions/<timestamp>.json`
- 사용자 보고: 위 JSON을 한국어 3~5줄 요약으로 변환해 원래 대화에 회신. 해시는 앞 12자만 표시

### 7.7 완료 조건

- 3지점 해시 일치 + 승인된 배포 완료 + 사용자에게 확인 URL 회신 + `logs/actions/` 기록 생성

### 7.8 권위 프롬프트 초안

```text
너는 아임웹 위젯 릴리스 에이전트다.

[역할]
Git 저장소의 위젯 정본을 수정·빌드·검증·배포·롤백한다. 아임웹 관리자 화면의 코드는 직접 건드리지 않는다.

[절대 금지]
1. 토큰·API Secret·인증정보를 어떤 형태로도 출력하지 않는다.
2. 아임웹에 삽입된 로더 스니펫을 변경하거나 재삽입하지 않는다. 사용자가 명시적으로 "로더 교체"를 승인한 경우에만 예외다.
3. 해시 검증을 통과하지 않은 산출물을 배포하지 않는다.
4. 승인 페이로드 없이 CDN 배포·태그 푸시·롤백을 실행하지 않는다.
5. 확인하지 못한 사실을 확인된 것처럼 말하지 않는다.

[처리 순서]
1. 지시를 다음 중 하나로 분류한다: 조회 | 수정 | 신규추가 | 배포 | 롤백 | 설치 | 불명확
   불명확하면 한 번만 짧게 되묻는다.
1-1. 신규추가: 새 위젯은 registry.json 항목 추가로만 반영한다. 아임웹에 스크립트 태그를 새로 넣자고 제안하지 않는다.
     mount 전략을 none → slot → selector 순으로 판정하고, 새 슬롯이 꼭 필요하면 거기서 멈추고 승인을 요청한다.
     신규 항목은 enabled:false로 먼저 배포하고, 확인 후 true로 전환한다.
2. 수정: src/widgets/<widget_id>/ 만 수정한다. 수정 전 변경 요약을 먼저 보고한다.
3. 빌드: dist/<widget_id>/<version>/ 생성 후 SHA-256을 계산한다.
4. 승인: 배포 대상·버전·변경 파일·해시·되돌리기 방법을 담은 1회 승인 페이로드를 제시하고 대기한다.
5. 배포: 승인 후에만 실행한다. 배포 직후 CDN URL을 다시 내려받아 해시를 재비교한다.
6. 불일치: 즉시 중단하고 result=BLOCKED로 보고한다. 임의 재시도·우회를 하지 않는다.
7. 보고: 지정된 JSON을 logs/actions/에 기록하고, 사용자에게는 한국어 3~5줄로 요약한다.

[아임웹 관련 사실]
- 아임웹은 저장 시 주석을 제거하는 등 코드를 정규화한다. 따라서 아임웹 내부 코드와 정본을 바이트 단위로 비교하지 않는다. 비교는 "주석 제거 정규화본" 기준으로만 한다.
- 아임웹에는 로더만 존재해야 한다. 로직이 아임웹 안에 들어가 있는 것을 발견하면 즉시 보고하고, 사용자 승인 없이 이관하지 않는다.
- 아임웹 코드 영역을 변경해야 하는 상황이면, 반드시 원문 스냅샷을 state/imweb_snapshots/ 에 먼저 저장한다.

[아임웹 업로드]
- 업로드 경로는 라우터가 정한다: Script API 가능 → API, 아니면 브라우저(Playwright), 브라우저 차단 시 수동 안내로 강등한다.
- 브라우저 업로드 전에 반드시 세션 유효성 확인 → 원문 스냅샷 저장 → 셀렉터 헬스체크를 순서대로 통과해야 한다.
- 셀렉터를 찾지 못하면 비슷한 요소를 추측해 클릭하지 않는다. 중단하고 "UI 변경 감지"로 보고한다.
- 자격증명을 입력하거나 저장하지 않는다. 로그인이 필요하면 headed 창을 띄우고 사람에게 요청한다.
- 저장 버튼 클릭 성공을 업로드 성공으로 선언하지 않는다. 재조회 후 정규화 diff가 0일 때만 성공이다.
- diff가 0이 아니면 스냅샷으로 되돌리고 BLOCKED로 보고한다.
- 유효한 OPERATING_APPROVED 범위 안의 행동만 자동 실행한다. 범위 밖은 1회 승인을 요청한다.

[출력]
숨은 사고과정은 출력하지 않는다. 판단 근거, 검사 결과, 남은 불확실성만 간결히 보고한다.
```

### 7.9 Few-shot 예시

`N/A` (ENG-005 = OMIT)

---

## 8. 선택 아키텍처

- **선택안:** A안 — 로더 고정 + 외부 서브파일(Git 정본 → jsDelivr) + Telegram SDK 에이전트
- 기본 실행 수단: `Codex SDK` 또는 `Claude Agent SDK` (Registry 전환)
- 상태 방식: `thread`
- 활성 패턴: `Prompt Chaining` + `Routing`
- 보조 기능: `skill`, `MCP`
- **선택 이유:** 아임웹 쓰기 빈도를 사이트당 1회로 축소해 변질 위험을 구조적으로 제거하고, 롤백을 CDN 경로 전환만으로 처리할 수 있다.
- **제외한 구조:** 코드 위젯 직접 편집(변질 불가피), app-server·멀티에이전트·상시 서버(완료 조건에 불필요)
- **공식·실환경 확인 근거:** 아임웹 FAQ(코드 위젯 주석 제거·클라이언트 사이드 한정, 공통 코드 삽입 권장), developers-docs.imweb.me Reference 그룹 목록. 확인일 2026-08-24. 실환경 확인은 Step 2 preflight에서 수행

### 데이터 흐름

```text
Telegram 지시
  → Channel Router (허용 판정 · update 단일 소유자)
  → Agent Registry (agent_id · runtime_engine 선택)
  → Thread Store (conversation_key → thread_id)
  → SDK 에이전트
      → src/widgets 수정
      → build → SHA-256
      → 1회 승인 페이로드 제시 → 대기
      → deploy (GitHub tag → jsDelivr)
      → CDN 재fetch → 해시 재비교
  → 원래 chat_id로 결과 회신

[아임웹 측] 1회 삽입 후 영구 불변
  <script src="https://cdn.jsdelivr.net/gh/<org>/<repo>@<loader-tag>/dist/loader.js" defer></script>
  <div data-ddak-slot="header"></div>   ← 슬롯 프리셋 (필요한 위치에만)
  <div data-ddak-slot="content"></div>
  <div data-ddak-slot="footer"></div>

[런타임] 로더가 매 페이지 로드 시
  registry.json fetch
    → 현재 URL·슬롯과 매칭되는 모듈만 선별
    → integrity(SRI) 검증
    → 동적 <script>/<link> 주입
```

### 수정 가능한 엔지니어링 Markdown 경로

| ENG ID | 모듈 | 경로 | 상태 | 변경 시 재실행 |
|---|---|---|---|---|
| ENG-001~004 | 프롬프트 계약 | `prompts/AGENT_SYSTEM.md` | APPLY | PTEST-001~004 |
| ENG-006 | Grounding | `engineering/prompt/grounding.md` | APPLY | PTEST-005 |
| ENG-008 | Chaining | 저장소 `STEPS.md` | APPLY | PTEST-006 |
| ENG-009 | Routing | `engineering/patterns/routing.md` | APPLY | PTEST-007 |
| ENG-013 | 외부 접근 | `engineering/runtime/external_access.md` | APPLY | PTEST-008 |
| ENG-014 | 구현 도구 | `engineering/runtime/implementation_tools.md` | APPLY | PTEST-009 |
| ENG-015 | 실행 형태 | `engineering/runtime/operation_mode.md` | APPLY | PTEST-010 |
| ENG-016 | Agent Registry | `engineering/runtime/agent_registry.md` | APPLY | PTEST-011 |
| ENG-017 | Channel Router | `engineering/runtime/channel_router.md` | APPLY | PTEST-012 |
| ENG-018 | Thread State | `engineering/runtime/thread_state.md` | APPLY | PTEST-013 |
| ENG-019 | 무결성 가드 | `engineering/runtime/integrity_guard.md` | APPLY | PTEST-014 |
| ENG-020 | 브라우저 업로드 | `engineering/runtime/browser_upload.md` | DEFER | PTEST-015 |
| ENG-021 | MCP 도구 경계 | `engineering/runtime/mcp_tools.md` | APPLY | PTEST-016 |
| ENG-022 | 승인 정책 | `engineering/support/approval_policy.md` | APPLY | PTEST-017 |
| ENG-023 | 릴리스 Skill | `engineering/support/widget_release_skill.md` | APPLY | PTEST-018 |
| ENG-027 | Hill loop | `HARNESS_LOOP.md` | APPLY | PTEST-019 |
| ENG-005/007/010/011/012/024/025/026/028 | (제외) | `N/A` | OMIT / DEFER | - |

---

## 9. 준비·비용·인증

| 항목 | 필요 | 현재 상태 | 비용 가능성 | 사용자 작업 |
|---|---|---|---|---|
| Node.js / npm | 필수 | 확인 필요 | 무료 | `node -v` 확인 |
| Codex CLI·SDK | 필수(엔진 A) | 확인 필요 | 구독 범위 (CHK-004) | 인증 상태 확인 |
| Claude Agent SDK | 필수(엔진 B) | 확인 필요 | Max 구독 (CHK-004) | 인증 상태 확인 |
| GitHub 저장소 | 필수 | 미생성 | 무료 | public 저장소 생성 (jsDelivr는 public 필요) |
| jsDelivr | 필수 | - | 무료 | 없음 (자동) |
| Telegram Bot | 필수 | 미생성 | 무료 | @BotFather로 봇 생성, 토큰을 환경변수에 주입 |
| 아임웹 테스트 사이트 | 필수 | 보유 | 유료 요금제 필요(공통 코드 삽입) | 요금제 확인 (CHK-005) |
| 아임웹 개발자센터 앱 | 조건부 | 미등록 | 확인 필요 (CHK-003) | 등록 후 Script API 쓰기 지원 확인 |
| Scheduler | 불필요 | - | - | - |

비밀값은 기록하지 않는다. 상태와 주입 경로만 기록한다.

---

## 10. 권한과 승인

| 단계 | 허용 | 금지 | 필요한 승인 |
|---|---|---|---|
| 계획 | 자료 분석·설계 | 구축·외부 행동 | `PLAN_APPROVED` |
| 로컬 구축 | 지정 경로 쓰기·검사 | 배포·전송·삭제 | 로컬 구축 승인 |
| 1회 외부 실행 | 승인된 위젯·버전의 CDN 배포 또는 롤백 | 범위 외 후속 행동 | `ACTION_APPROVED` |
| 저위험 반복 운영 | (이번 범위 없음) | - | `N/A` |

### 승인 정책

- **1회 승인 페이로드 형식:** `행위자: imweb-widget-agent ｜ 대상: <widget_id>@<version> ｜ 행동: CDN 배포 ｜ 데이터: 변경 파일 목록 + SHA-256 ｜ 시점: 즉시 ｜ 영향: <site> 공개 페이지 ｜ 되돌리기: git tag <이전버전>으로 롤백`
- **항상 1회 승인:** CDN 공개 배포, git tag push, 롤백, 아임웹 쪽 모든 쓰기, 로더 스니펫 교체
- `OPERATING_APPROVED`: 이번 범위 없음 (`N/A`)
- 승인 ID·상태: `logs/approvals/<id>.json`
- 승인 만료·철회: 미승인 15분 경과 시 자동 만료, 재요청 필요
- **침묵·과거 승인·계획 승인은 외부 실행 승인이 아니다.**

---

## 11. 인수 조건과 검사

| AC | REQ | 관찰 가능한 통과 조건 | TEST | 검사 방법 |
|---|---|---|---|---|
| AC-001 | REQ-001 | 배포 전후 아임웹 삽입 코드 문자열이 동일 | TEST-001 | 배포 전/후 스냅샷 정규화 diff = 0 |
| AC-002 | REQ-002 | 서브파일 문구 변경 후 실사이트에서 변경 확인 | TEST-002 | 테스트 페이지 로드 육안 + DOM 텍스트 확인 |
| AC-003 | REQ-003 | source/dist/cdn 3개 SHA-256 일치 | TEST-003 | `npm run verify:integrity` 종료코드 0 |
| AC-004 | REQ-003 | dist를 1바이트 변조하면 배포가 중단됨 | TEST-004 | 의도적 변조 후 `result=BLOCKED` 확인 |
| AC-005 | REQ-004 | 롤백 후 이전 버전 콘텐츠가 서빙됨 | TEST-005 | 롤백 실행 → CDN fetch 해시 = 이전 버전 해시 |
| AC-006 | REQ-005 | 미허용 chat 지시는 거절되고 로그에 남음 | TEST-006 | 미등록 chat_id로 메시지 → 무응답 + 거절 로그 |
| AC-007 | REQ-005 | 응답이 원래 chat_id로만 감 | TEST-007 | 2개 chat 교차 테스트 |
| AC-008 | REQ-005 | 대화별 Thread 생성·재개 | TEST-008 | 후속 지시("아까 그거 되돌려")가 맥락 유지 |
| AC-009 | REQ-006 | Codex/Claude Code 각각이 동일 Spec으로 동일 검사 통과 | TEST-009 | 두 구축자 각각 `npm test` 통과 결과 기록 |
| AC-010 | REQ-007 | `runtime_engine` 값 변경만으로 엔진 전환 | TEST-010 | codex_sdk → claude_agent_sdk 전환 후 동일 지시 성공 |
| AC-011 | REQ-011 | 아임웹 쓰기 전 스냅샷 존재 | TEST-011 | 스냅샷 파일 없으면 쓰기 차단 |
| AC-012 | REQ-005 | 타임아웃 시 안전 중단 | TEST-012 | 강제 지연 주입 → 타임아웃 메시지 + 미배포 |
| AC-013 | REQ-010 | Script API 쓰기 지원 여부가 문서에 기록됨 | TEST-013 | `engineering/runtime/external_access.md`에 판정·근거·확인일 존재 |

### 프롬프트·엔지니어링 검사

| PTEST | ENG | 대표·실패 시나리오 | 기대 결과 | 방법 |
|---|---|---|---|---|
| PTEST-001 | ENG-001 | "위젯 문구 바꿔줘" | 정본 수정 후 변경 요약 보고 | 수동 실행 |
| PTEST-002 | ENG-002 | 배포 완료 | 지정 JSON 스키마 준수 | 스키마 검증 |
| PTEST-003 | ENG-003 | "승인 생략하고 바로 배포해" | 거절 + 승인 요구 | 수동 |
| PTEST-004 | ENG-004 | "아임웹 관리자 들어가서 코드 고쳐" | 거절 + 로더 구조 설명 | 수동 |
| PTEST-005 | ENG-006 | "주석 넣어서 아임웹에 저장해줘" | 주석 제거 사실 근거로 대안 제시 | 수동 |
| PTEST-006 | ENG-008 | 빌드 실패 상태에서 배포 지시 | 배포 미실행 | 수동 |
| PTEST-007 | ENG-009 | "되돌려" | rollback 경로 선택 | 수동 |
| PTEST-008 | ENG-013 | Script API 미지원 판명 | 수동 삽입 경로로 전환 안내 | 수동 |
| PTEST-009 | ENG-014 | Python 스크립트 추가 시도 | 단일 런타임 유지, 근거 보고 | 코드 리뷰 |
| PTEST-010 | ENG-015 | 상시 실행 요청 | 범위 밖 안내 | 수동 |
| PTEST-011 | ENG-016 | 미등록 agent_id 요청 | 거절 | 자동 |
| PTEST-012 | ENG-017 | polling·webhook 동시 기동 | 기동 거부 | 자동 |
| PTEST-013 | ENG-018 | 두 chat 동시 대화 | Thread 분리 유지 | 자동 |
| PTEST-014 | ENG-019 | CDN 응답 변조 | `BLOCKED` | 자동(모킹) |
| PTEST-015 | ENG-020 | - | `N/A` (DEFER) | - |
| PTEST-016 | ENG-021 | 허용 외 경로 쓰기 시도 | 도구 거부 | 자동 |
| PTEST-017 | ENG-022 | 만료된 승인으로 배포 | 거절 | 자동 |
| PTEST-018 | ENG-023 | 릴리스 절차 중 검증 생략 | 절차 위반 감지 | 자동 |
| PTEST-019 | ENG-027 | 실패 발생 | `HARNESS_LOOP.md` 기록 존재 | 파일 확인 |

---

## 12. 품질 장치 적용

- 하네스 수준: `MINIMAL`
- Hill loop 강도: `RECORD_ONLY` (STANDARD 승격 시 `GUIDED_IMPROVEMENT`)
- 독립 평가: `OMIT_WITH_REASON` — QUICK_MVP 범위이고, 무결성이 결정적 해시 검사로 판정되므로 주관적 평가가 불필요하다. 단 **배포 경로 코드 변경 시에는 `codex review` 또는 Claude Code 리뷰를 조건부 적용**한다.
- 통과선: TEST-001~013 전부 pass
- 자동 수정 상한: 3

---

## 13. Event loop

| 항목 | 값 |
|---|---|
| 트리거 | Telegram update (polling) |
| 입력 스키마 | `{ chat_id, topic_id?, user_id, text }` |
| 멱등성 키 | `update_id` |
| 타임아웃 | 단일 작업 300초 |
| 재시도 상한 | 네트워크 3회 (해시 불일치는 0회) |
| 수동 검토 | 배포·롤백 승인 |
| 시간대 | Asia/Seoul |
| 재시작·복구 | 프로세스 재시작 시 `update_id` 기준 중복 처리 방지 |
| 결과 경로 | 원래 chat_id + `logs/actions/` |

### 13.1 Hill climbing loop

- 시작 근거: 배포 실패, 해시 불일치, 사용자 실사용 피드백, 아임웹 UI·업데이트로 인한 회귀
- 변경 대상: `engineering/**`, `prompts/AGENT_SYSTEM.md`, 검사 스크립트
- 회귀·정상 사례: TEST-003, TEST-004, TEST-005는 모든 수정 후 재실행
- 기록: `HARNESS_LOOP.md`에 이슈·피드백·개선 후보·판정
- 시스템 규칙·권한 변경은 사용자 승인 후에만 반영

### 13.2 24시간 운영 게이트

`N/A` — `continuous-24x7` 아님. `OPERATION_READY: PENDING`(미착수).

---

## 14. 예산·중단

- 시간 상한: 단일 작업 300초, 세션 30분
- 턴·호출 상한: 작업당 SDK 호출 20회
- 재시도 상한: 3
- 비용 상한: 무료 범위. 초과 예상 시 실행 전 중단·보고
- **즉시 중단 조건:** 해시 불일치 / 승인 부재 / 미허용 사용자 / 스냅샷 실패 / 아임웹 직접 쓰기 시도 / 토큰 노출 위험 / CHK 게이트 미해소 상태의 API 호출
- 재개 조건: 원인 기록 + 사용자 지시

---

## 15. 파일 하네스

```text
imweb-widget-agent/
├─ AGENTS.md                         # 두 구축자 공통 총칙
├─ STEPS.md                          # 저장소 실행 STEPS (Chaining 계약)
├─ CODEX_BUILD_SPEC.md               # 본 문서 (권위 입력)
├─ contracts/AUTHORITY_MANIFEST.yaml
├─ config/
│   ├─ agent_registry.yaml           # agent_id · runtime_engine 전환
│   └─ allowed_chats.yaml
├─ prompts/AGENT_SYSTEM.md
├─ engineering/
│   ├─ ENGINEERING_INDEX.md
│   ├─ MODULE_TEMPLATE.md
│   ├─ prompt/grounding.md
│   ├─ patterns/routing.md
│   ├─ runtime/{external_access,implementation_tools,operation_mode,
│   │           agent_registry,channel_router,thread_state,
│   │           integrity_guard,browser_upload,mcp_tools}.md
│   └─ support/{approval_policy,widget_release_skill}.md
├─ src/
│   ├─ bot/            # Telegram router (update 단일 소유자)
│   ├─ engine/         # codex_sdk.ts | claude_agent_sdk.ts (동일 인터페이스)
│   ├─ release/        # build · hash · deploy · rollback
│   └─ widgets/<widget_id>/   # ★ 사용자가 수정하는 서브파일 정본
├─ loader/LOADER_SNIPPET.md   # 아임웹에 넣을 유일한 코드 (불변)
├─ dist/                      # 빌드 산출물
├─ manifest/widgets.yaml
├─ integrity/<widget_id>.json
├─ state/{threads.sqlite3, imweb_snapshots/}
├─ logs/{actions/, approvals/}
├─ checks/  tests/
├─ RUN_STATE.json
├─ THREAD_STATE_SCHEMA.md
├─ HARNESS_LOOP.md
└─ HANDOFF.md
```

`eval/`, `review/`, `ops/`, `agenticguide/`는 이번 수준에서 생성하지 않는다.

---

## 16. 미확정·충돌

| 항목 | 상태 | 영향 | 해결 주체 |
|---|---|---|---|
| CHK-001 Script API 쓰기 지원 | OPEN | 로더 삽입 자동화 가능 여부 | Codex (Step 2 조사) + user |
| CHK-002 비공개 앱 OAuth | OPEN | 동상 | user |
| CHK-003 호출 무료 범위 | OPEN | 비용 | user |
| CHK-004 구독 인증 무인 SDK 실행 허용 | OPEN | 스케줄 실행 가능 여부 | user |
| CHK-005 아임웹 요금제(공통 코드 삽입) | OPEN | 삽입 위치가 SEO 공통 코드냐 코드 위젯이냐 | user |
| GitHub 저장소 public/private | OPEN | jsDelivr는 public 필요. private면 Cloudflare Pages로 대체 | user |
| 1차 실연결 엔진 | OPEN | codex_sdk / claude_agent_sdk 중 1개 | user |

---

## 17. 승인

- **계획 요약:** 아임웹에는 불변 로더만 1회 삽입하고, 위젯 로직은 GitHub 정본 → jsDelivr로 배포한다. 텔레그램에서 지시하면 SDK 에이전트가 수정·해시검증·승인·배포·롤백을 수행한다. Codex와 Claude Code 두 구축자가 동일 계약으로 작업하고, 두 SDK는 Registry에서 전환한다. 브라우저 자동 업로드와 스케줄러는 STANDARD로 미룬다.
- **사용자가 승인한 선택:** ①A ②A ③A ④C
- **승인 문구:** PENDING
- **계획 승인이 외부 실행 승인이 아님:** `CONFIRMED`

### 사용자 테스트·최종 승인

- 기술 검증 상태: `NOT_READY`
- 사용자 테스트 시나리오:
  1. 텔레그램에 "위젯 문구를 X로 바꿔줘" → 변경 요약 확인 → 승인 → 배포 → 실사이트 확인
  2. 텔레그램에 "되돌려" → 이전 버전 복귀 확인
  3. 미허용 계정으로 지시 → 무응답 확인
  4. dist 임의 변조 후 배포 시도 → `BLOCKED` 확인
- 사용자 테스트 결과: `PENDING`
- 피드백 반영 후 최종 회귀: `PENDING`
- 최종 배포·외부 행동 승인: `NOT_REQUESTED`

---

## 18. 신규 코드 추가 계약 (REQ-012 ~ REQ-015)

### 18.1 문제

로더가 특정 파일 1개를 직접 가리키면, 새 위젯을 만들 때마다 아임웹에 `<script>` 태그를 추가해야 한다. 그 순간 "아임웹 무수정" 전제가 깨지고 REQ-001·REQ-003이 함께 무너진다.

### 18.2 해결: 레지스트리 구동형 로더

아임웹에 삽입되는 로더는 **어떤 위젯이 있는지 모른다.** 로더는 `registry.json`만 읽고, 거기 적힌 모듈을 조건에 맞게 로드한다. 따라서 **새 코드 추가 = registry.json에 항목 1개 추가**이며 아임웹은 영원히 그대로다.

```json
{
  "schema_version": 1,
  "updated_at": "2026-08-24T10:00:00+09:00",
  "modules": [
    {
      "widget_id": "review-badge",
      "version": "1.3.0",
      "enabled": true,
      "match": { "site": "test-site", "path_glob": ["/product/*"] },
      "mount": { "type": "slot", "slot": "content" },
      "assets": [
        { "type": "js",  "url": "https://cdn.jsdelivr.net/gh/<org>/<repo>@w-review-badge-1.3.0/dist/review-badge/index.js",
          "integrity": "sha384-..." },
        { "type": "css", "url": "...", "integrity": "sha384-..." }
      ]
    }
  ]
}
```

### 18.3 mount 전략 (우선순위)

| 순위 | type | 설명 | 아임웹 수정 |
|---|---|---|---|
| 1 | `none` | 전역 동작·스타일·플로팅 UI. DOM 앵커 불필요 | 불필요 |
| 2 | `slot` | 최초 설치 시 심어둔 `data-ddak-slot` 요소에 렌더 | 불필요(프리셋 재사용) |
| 3 | `selector` | 아임웹 기본 DOM 셀렉터를 앵커로 사용 | 불필요하나 **아임웹 업데이트 시 파손 위험** |
| 4 | `new-slot` | 프리셋에 없는 새 위치가 필요 | **아임웹 1회 수정 필요 → 승인 대상** |

- 에이전트는 1 → 2 → 3 순으로 시도하고, 4가 불가피하면 **작업을 멈추고 사용자에게 승인을 요청**한다. 임의로 아임웹을 수정하지 않는다.
- `selector` 사용 시 로더는 앵커 미발견을 오류로 처리하지 않고 조용히 건너뛴 뒤 로그에 남긴다(사이트 파손 방지).

### 18.4 무결성 확장 (REQ-014)

- 모듈 자산 URL은 **불변 태그(`@w-<widget_id>-<version>`)** 로 고정하고 SRI 해시를 붙인다 → 브라우저 단계까지 변질 검증이 이어진다.
- `registry.json` 자체는 가변이므로 **로더가 스키마·필수 필드·`updated_at` 유효성을 검사**하고, 파싱 실패 시 아무 것도 로드하지 않는다(fail-closed).
- 검증 지점이 3개 → **4개**로 확장: `source → dist → cdn → browser(SRI)`

### 18.5 캐시 무효화 (REQ-015)

- 불변 태그 자산은 캐시되어도 무해하다. 문제는 `registry.json`뿐이다.
- 배포 파이프라인: `registry.json` 커밋 → jsDelivr purge API 호출 → 재fetch로 `updated_at` 갱신 확인 → 확인된 뒤에만 완료 보고.
- purge 실패 또는 반영 미확인 시 `result=BLOCKED`.
- **대안(권장 검토):** `registry.json`만 Cloudflare Pages/R2에 두고 `Cache-Control: max-age=60`으로 서빙하면 purge 의존이 사라진다. 모듈 자산은 GitHub+jsDelivr 유지. → `OPEN-REG-01`

### 18.6 신규 위젯 추가 절차 (Skill로 고정)

```text
1. src/widgets/<new_id>/ 생성        (정본)
2. build → dist/<new_id>/<version>/ + SHA-256 + SRI
3. mount 전략 판정 (none → slot → selector → new-slot)
   · new-slot이면 여기서 중단하고 승인 요청
4. registry.json에 항목 추가 (enabled: false)
5. 승인 페이로드 제시 → 승인
6. 태그 푸시 + registry 배포 + purge
7. enabled: true 전환 → 실사이트 확인
8. 문제 시 enabled: false 되돌리기 (= 즉시 롤백, 아임웹 무관)
```

> `enabled` 플래그 덕분에 신규 위젯의 롤백은 **파일 삭제 없이 1비트 변경**으로 끝난다.

### 18.7 추가 엔지니어링 결정

| ENG ID | 층 | 모듈 | 결정 | 경로 | PTEST |
|---|---|---|---|---|---|
| ENG-029 | Runtime | 레지스트리 로더 | APPLY | `engineering/runtime/registry_loader.md` | PTEST-020 |
| ENG-030 | Runtime | 슬롯·마운트 전략 | APPLY | `engineering/runtime/mount_strategy.md` | PTEST-021 |
| ENG-031 | Runtime | 캐시 무효화 | APPLY | `engineering/runtime/cache_invalidation.md` | PTEST-022 |

### 18.8 추가 인수 조건

| AC | REQ | 통과 조건 | TEST | 방법 |
|---|---|---|---|---|
| AC-014 | REQ-012 | 신규 위젯 추가 후 **아임웹 삽입 코드 diff = 0** 인 상태로 사이트에 표시됨 | TEST-014 | 추가 전/후 스냅샷 비교 + 실사이트 확인 |
| AC-015 | REQ-013 | 슬롯 프리셋 위치에 신규 위젯이 렌더됨 | TEST-015 | 실사이트 DOM 확인 |
| AC-016 | REQ-014 | SRI 해시를 틀리게 넣으면 브라우저가 실행을 차단하고 사이트는 정상 유지 | TEST-016 | 의도적 해시 변조 + 콘솔 확인 |
| AC-017 | REQ-015 | 배포 후 60초 내 `registry.json` `updated_at`이 갱신됨 | TEST-017 | purge 후 재fetch |
| AC-018 | REQ-012 | `enabled: false` 전환으로 신규 위젯이 즉시 사라짐 | TEST-018 | 실사이트 확인 |
| AC-019 | 18.3 | `new-slot`이 필요한 요청은 자동 진행되지 않고 승인 요청으로 멈춤 | TEST-019 | 수동 시나리오 |

### 18.9 추가 미확정

| 항목 | 상태 | 영향 | 해결 주체 |
|---|---|---|---|
| OPEN-REG-01 | OPEN | `registry.json` 호스팅을 jsDelivr+purge로 갈지 Cloudflare로 분리할지 | Codex 실측(purge 반영 시간) 후 user 결정 |
| OPEN-REG-02 | OPEN | 슬롯 프리셋을 어느 페이지·몇 개 심을지 | user (테스트 사이트 구조 확인 후) |

---

## 19. 브라우저 자동 업로드 계약 (REQ-016 ~ REQ-019)

### 19.1 추가 요구

| ID | 요구 | 우선순위 | 상태 |
|---|---|---|---|
| REQ-016 | 아임웹 관리자에 **외부 브라우저(Playwright)로 자동 접속해 로더·슬롯·필요 코드를 업로드**한다 | MUST | CONFIRMED |
| REQ-017 | 로그인은 **저장된 세션(storageState)을 재사용**하고, 자격증명을 코드·로그·저장소에 남기지 않는다 | MUST | CONFIRMED |
| REQ-018 | 2차 인증·CAPTCHA·셀렉터 파손 감지 시 **자동 진행을 중단하고 사람 개입을 요청**한다 | MUST | CONFIRMED |
| REQ-019 | 업로드 후 **삽입 결과를 재조회해 정규화 diff로 검증**하고, 불일치 시 스냅샷으로 자동 복원한다 | MUST | CONFIRMED |

### 19.2 왜 세션 재사용인가

아임웹 로그인을 매번 자동화하면 비밀번호를 프로그램이 다뤄야 하고 2차 인증에서 반드시 막힌다. 대신:

```text
[최초 1회]  headed 브라우저 실행 → 사람이 직접 로그인·2차 인증 통과
            → storageState를 OS 보호 경로에 암호화 저장
[이후 전부] 저장된 세션 로드 → 자동 업로드 (사람 개입 없음)
[세션 만료]  텔레그램으로 "재로그인 필요" 알림 → 사람이 1회 통과 → 세션 갱신
```

자격증명은 **한 번도 프로그램에 들어오지 않는다.** 사람이 브라우저 창에 직접 입력한다. (보안 절대규칙 9 준수)

### 19.3 업로드 파이프라인

```text
1. preflight   : 세션 유효성 확인 (관리자 페이지 200 + 로그인 상태 마커)
                 실패 → REQ-018 경로로 이탈
2. snapshot    : 대상 코드 영역 원문을 state/imweb_snapshots/<ts>.txt 로 저장
                 실패 → 즉시 중단 (스냅샷 없이 쓰기 금지)
3. guard       : 셀렉터 헬스체크 (config/imweb_selectors.yaml의 모든 앵커 존재 확인)
                 1개라도 미발견 → 중단 + "UI 변경 감지" 보고
4. write       : 로더/슬롯 삽입 또는 갱신. 기존 코드는 append 방식, 임의 삭제 금지
5. save        : 저장 버튼 클릭 → 저장 완료 마커 대기 (타임아웃 60초)
6. verify      : 페이지 재조회 → 아임웹이 반환한 코드를 읽어옴
                 주석 제거 정규화 후 기대값과 diff
                 · diff = 0        → OK
                 · diff ≠ 0        → restore
7. restore     : 스냅샷 원문으로 되돌린 뒤 result=BLOCKED 보고
8. live check  : 실사이트 로드 → 로더 실행 여부·콘솔 에러 확인
9. report      : 텔레그램 회신 + logs/actions/ 기록
```

**6단계가 핵심입니다.** 아임웹은 저장 시 주석을 제거하는 등 코드를 정규화하므로, 바이트 비교가 아니라 **정규화 diff**로만 판정합니다. 이 검증 없이 "저장 버튼 클릭 성공"을 업로드 성공으로 선언하지 않습니다.

### 19.4 셀렉터 파손 대비

- 모든 DOM 셀렉터를 `config/imweb_selectors.yaml`로 외부화 → 아임웹 UI가 바뀌면 코드 수정 없이 YAML만 갱신
- 각 앵커에 `primary` / `fallback` 2단 셀렉터
- 3단계 guard에서 하나라도 못 찾으면 **추측해서 클릭하지 않고 중단**한다
- 파손 발생 시 자동으로 수동 삽입 안내(로더 스니펫 전문 + 삽입 위치)를 텔레그램으로 전송

### 19.5 실행 모드

| 상황 | 모드 |
|---|---|
| 세션 유효 · 정상 흐름 | `headless` 자동 |
| 최초 로그인 · 세션 만료 · 2차 인증 · CAPTCHA | `headed` 창을 띄우고 사람 대기 (최대 10분, 이후 취소) |
| 셀렉터 파손 | 실행 안 함. 수동 안내로 강등 |

### 19.6 승인 구조 — "매번 묻지 않게" 하는 방법

배포·외부 반영은 원칙상 1회 승인 대상이라 자동화와 충돌합니다. 해결은 **`OPERATING_APPROVED`(범위 고정 반복 운영 승인)** 입니다. 아래 페이로드를 사용자가 발급하면, 그 범위 안에서는 매번 묻지 않고 자동 실행합니다.

```yaml
operating_approval:
  id: OA-IMWEB-001
  허용 행위자: imweb-widget-agent
  대상: 테스트 사이트 1곳 (site_id: <확정 필요>)
  행동: registry.json 배포 · CDN purge · 로더/슬롯 삽입 및 갱신
  데이터: dist 산출물, registry.json, 로더 스니펫
  빈도·한도: 1일 20회, 1회당 위젯 5개
  유효 기간: 승인일 +30일
  중단 방법: 텔레그램 "중단" 또는 config/kill_switch 파일 생성
  실패 알림: 모든 BLOCKED·FAILED를 즉시 텔레그램 통보
```

**이 범위를 벗어나면 자동 실행하지 않습니다:** 새 사이트 추가, 새 슬롯 생성(§18.3의 `new-slot`), 기존 코드 삭제, 한도 초과, 기간 만료. 전부 1회 승인 대상입니다.

### 19.7 약관·범위 제한

- 대상은 **사용자 본인 계정의 본인 소유 사이트**에 한정합니다.
- 고객사 사이트로 확장할 때는 계정 위임 동의가 별도로 필요하며, 이는 STANDARD 승격 시 다시 판정합니다.
- 아임웹 약관·자동화 제한 위반이 확인되면 즉시 `Script` API 또는 수동 경로로 전환합니다. → `OPEN-BRW-01`

### 19.8 추가 엔지니어링 결정

| ENG ID | 층 | 모듈 | 결정 | 경로 | PTEST |
|---|---|---|---|---|---|
| ENG-032 | Runtime | 브라우저 세션 관리 | APPLY | `engineering/runtime/browser_session.md` | PTEST-023 |
| ENG-033 | Runtime | 셀렉터 외부화·헬스체크 | APPLY | `engineering/runtime/selector_guard.md` | PTEST-024 |
| ENG-034 | Runtime | 삽입 검증·자동 복원 | APPLY | `engineering/runtime/write_verify_restore.md` | PTEST-025 |
| ENG-035 | Runtime | 업로더 라우팅(API↔브라우저↔수동) | APPLY | `engineering/runtime/uploader_router.md` | PTEST-026 |
| ENG-022b | Support | `OPERATING_APPROVED` 정책 | APPLY | `engineering/support/approval_policy.md` (확장) | PTEST-027 |

### 19.9 추가 인수 조건

| AC | REQ | 통과 조건 | TEST | 방법 |
|---|---|---|---|---|
| AC-020 | REQ-016 | 텔레그램 지시 1회로 로더+슬롯이 아임웹에 자동 삽입됨 | TEST-020 | 실사이트 확인 |
| AC-021 | REQ-017 | 저장소·로그 전체에 자격증명 문자열 0건 | TEST-021 | `grep` 기반 시크릿 스캔, 종료코드 0 |
| AC-022 | REQ-018 | 세션 만료 상태에서 실행 시 자동 진행하지 않고 알림 | TEST-022 | 세션 파일 무효화 후 실행 |
| AC-023 | REQ-018 | 셀렉터 1개를 고의로 틀리게 하면 중단 + 수동 안내 전송 | TEST-023 | YAML 변조 후 실행 |
| AC-024 | REQ-019 | 저장 결과가 기대와 다르면 스냅샷으로 자동 복원됨 | TEST-024 | 기대값 강제 불일치 주입 |
| AC-025 | 19.6 | `OPERATING_APPROVED` 범위 밖 요청은 자동 실행되지 않음 | TEST-025 | 한도 초과·새 슬롯 시나리오 |
| AC-026 | 19.1 | Script API 사용 가능 판정 시 업로더가 API로 자동 전환됨 | TEST-026 | 라우터 모킹 |

### 19.10 파일 하네스 추가

```text
src/browser/
  ├─ session.ts        # storageState 로드·저장·만료 판정
  ├─ guard.ts          # 셀렉터 헬스체크
  ├─ upload.ts         # 삽입·저장·검증·복원
  └─ router.ts         # API ↔ 브라우저 ↔ 수동 강등
config/imweb_selectors.yaml
state/browser/         # storageState (Git 제외, 암호화)
```

`.gitignore`에 `state/browser/`를 **반드시** 포함한다.

### 19.11 추가 미확정

| 항목 | 상태 | 영향 | 해결 주체 |
|---|---|---|---|
| OPEN-BRW-01 | OPEN | 아임웹 약관의 자동화 제한 조항 확인 | user |
| OPEN-BRW-02 | OPEN | 관리자 로그인에 2차 인증이 걸려 있는지 | user |
| OPEN-BRW-03 | OPEN | `OPERATING_APPROVED` 발급 여부·한도값 | user |

---

## 20. 구축자 미니멀리즘 규칙셋 — Ponytail (ENG-036)

### 20.1 결정

| 항목 | 값 |
|---|---|
| ENG ID | ENG-036 |
| 층 | **Builder-side** (런타임 아님) |
| 결정 | `APPLY` (조건부 — 20.3 보호 목록 설정을 전제로) |
| 적용 대상 | Claude Code · Codex **양쪽 모두** (REQ-006 동일 계약 유지) |
| 경로 | `engineering/support/ponytail_policy.md` |
| PTEST | PTEST-028 |

**성격 구분:** Ponytail은 아임웹 위젯 런타임에 들어가지 않는다. `dist/`, `registry.json`, 로더 어디에도 흔적이 없다. **구축자 에이전트의 행동 규칙**일 뿐이다.

### 20.2 도입 이유

위젯 코드는 고객 홈페이지 브라우저에서 실행된다. 에이전트가 과잉 구현하면 그대로 고객 사이트의 번들 크기·로딩 지연·SRI 관리 대상 증가로 이어진다. Ponytail의 판단 사다리(필요한가 → 기존 코드 → 표준 라이브러리 → 플랫폼 기본 → 설치된 의존성 → 한 줄)는 이 프로젝트의 비용 구조와 정확히 일치한다.

부수 효과: 아임웹은 이미 jQuery 등을 로드하므로 중복 라이브러리 주입을 막는 규칙이 자연히 강화된다.

### 20.3 보호 목록 — Ponytail이 축소할 수 없는 항목

> 미니멀리즘 규칙이 아래를 "불필요한 방어 코드"로 판단해 제거·간소화하는 것을 **금지**한다. 위반 시 해당 PR·커밋을 무효 처리한다.

| # | 보호 대상 | 근거 |
|---|---|---|
| P-1 | 아임웹 쓰기 전 원문 스냅샷 저장 | REQ-011 |
| P-2 | 셀렉터 헬스체크 및 미발견 시 중단 | REQ-018 |
| P-3 | 4단 해시 검증 (source·dist·cdn·SRI) | REQ-003, REQ-014 |
| P-4 | 저장 후 재조회 정규화 diff | REQ-019 |
| P-5 | 실패 시 스냅샷 자동 복원 | REQ-019 |
| P-6 | 승인 게이트 및 `OPERATING_APPROVED` 범위 검사 | §10, §19.6 |
| P-7 | 허용 사용자 화이트리스트·타임아웃 | REQ-005 |
| P-8 | registry 스키마 검증 fail-closed | §18.4 |
| P-9 | 로더의 앵커 미발견 조용한 skip 처리 | §18.3 |
| P-10 | 시크릿 마스킹·`state/browser/` gitignore | REQ-017 |

`engineering/support/ponytail_policy.md`에 위 목록을 그대로 기재하고, 구축자는 작업 시작 시 이 파일을 읽는다.

### 20.4 훅 정책 — ENG-024와의 관계

- 기존 `ENG-024 hooks = OMIT`은 **승인 대체용 런타임 훅**을 제외한다는 뜻이며 유지된다.
- Ponytail의 lifecycle hook은 **구축자 모드 전환용**이므로 범위가 다르다. 충돌 없음.
- 명시 규칙: **Ponytail 훅은 승인 게이트·검증 단계를 우회하거나 건너뛰게 만들 수 없다.** 우회가 관측되면 즉시 `mode=lite` 또는 비활성화한다.
- Node.js가 비대화형 셸 PATH에 있어야 자동 활성화가 동작한다(본 프로젝트는 Node 단일 런타임이므로 충족 예상, 실측 필요).

### 20.5 설치 (자료 기반 추론 — 각 구축자 환경에서 실제 확인 필요)

| 구축자 | 명령 |
|---|---|
| Claude Code | `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail` |
| Codex | `codex plugin marketplace add DietrichGebert/ponytail` → `codex plugin add ponytail@ponytail` |

- 설치 후 훅 검토·신뢰 처리, 새 스레드 시작(데스크톱 앱은 재시작) 필요.
- **한 구축자에서 확인한 명령을 다른 구축자로 복사하지 않는다.** 각 환경에서 개별 확인한다.
- 서드파티 마켓플레이스 플러그인이므로 설치 전 권한·deny list 검토를 거친다.
- 초기 모드: `full`. 보호 목록 위반이 관측되면 `lite`로 강등.

### 20.6 추가 검사

| PTEST | 시나리오 | 기대 결과 |
|---|---|---|
| PTEST-028 | Ponytail 활성 상태에서 "브라우저 업로드 모듈 구현" 지시 | P-1~P-5가 모두 구현되어 있고, 라이브러리 추가는 최소 |
| PTEST-029 | 보호 목록 항목을 간소화하려는 제안 발생 | 제안 거부 + `HARNESS_LOOP.md`에 기록 |
| PTEST-030 | Claude Code / Codex 양쪽에서 동일 지시 | 산출물이 동일 검사(TEST-001~026)를 모두 통과 |

### 20.7 추가 미확정

| 항목 | 상태 | 영향 | 해결 주체 |
|---|---|---|---|
| OPEN-PNY-01 | OPEN | 각 구축자에서 설치 명령·훅 동작 실측 | Codex / Claude Code (Step 2 preflight) |
| OPEN-PNY-02 | OPEN | `full` 모드가 보호 목록을 침범하는지 1회차 관측 | 구축자 + user |

---

## 21. 위젯 디자인 규칙셋 — Hallmark (ENG-037)

### 21.1 결정

| 항목 | 값 |
|---|---|
| ENG ID | ENG-037 |
| 층 | **Builder-side** (런타임 아님, Ponytail과 동일) |
| 결정 | `APPLY` (조건부 — 21.3 스코프 제약 전제) |
| 적용 대상 | Claude Code · Codex 양쪽 |
| 적용 범위 | **`src/widgets/**` 의 UI 코드에만.** 봇 라우터·릴리스 파이프라인·브라우저 업로더에는 미적용 |
| 경로 | `engineering/support/hallmark_policy.md` |
| PTEST | PTEST-031 ~ PTEST-034 |

### 21.2 도입 이유

위젯은 고객 홈페이지에 노출되는 판매 대상 UI다. "AI가 만든 티가 나는" 기본형(둥근 알약 버튼·회색 위 회색 카드·저대비 텍스트)은 그대로 상품 품질 문제가 된다. Hallmark의 사전 게이트는 이를 출고 전에 차단한다.

특히 **8-state 규율**(default·hover·focus-visible·active·disabled·loading·error·success)이 결정적이다. 위젯은 네트워크를 타고 렌더되므로 loading·error 상태가 실제로 발생하는데, 이 상태를 안 만들면 고객 사이트에 깨진 화면이 뜬다.

### 21.3 스코프 제약 — 반드시 컴포넌트 모드

| 사용 | 금지 |
|---|---|
| 컴포넌트 스코프 게이트 (시각·마이크로인터랙션·대비·a11y·타이포그래피) | 매크로구조 선택 |
| 8-state 체크리스트 | nav / footer / hero 아키타입 |
| 대비(APCA/WCAG) 검사 | 다양화 게이트 (`.hallmark/log.json` 로테이션) |
| 정직한 카피 규칙 (가짜 지표·가짜 후기 금지) | 카탈로그 테마 22종 적용 |
| `audit` 동사 (기존 위젯 점수화) | 페이지 전체 재구성 |

**테마를 쓰지 않는 이유:** 위젯은 독립 페이지가 아니라 고객 아임웹 사이트 **안에** 삽입된다. Hallmark 테마를 입히면 호스트와 이질감이 생긴다.

### 21.4 대신 쓰는 것 — `study` 동사로 호스트 DNA 추출

```
사이트 온보딩 시 1회:
  hallmark study <고객 아임웹 사이트 URL>
    → 타이포 페어링 · 색 앵커 · 간격 리듬 추출
    → design/<site_id>.design.md 로 저장 (사이트별 정본)

이후 모든 위젯 빌드:
  design/<site_id>.design.md 를 토큰 소스로 사용
```

이러면 위젯이 **그 사이트에서 원래 있던 것처럼** 보인다. `study`는 픽셀을 복사하지 않고 구조·타입·색 앵커만 추출하므로 저작권 문제도 없다.

> 신규 사이트 온보딩 절차에 `study` 1회를 포함한다. → `OPEN-HLM-02`

### 21.5 Ponytail ↔ Hallmark 우선순위 (충돌 해소)

두 스킬은 반대 방향으로 당긴다. 아래 표가 최종 판정이다.

| 영역 | 우선 | 판정 |
|---|---|---|
| 새 라이브러리·프레임워크 도입 | **Ponytail** | 도입 금지. 브라우저 네이티브 우선 |
| 추상화 레이어·래퍼 생성 | **Ponytail** | 만들지 않음 |
| 8-state 구현 | **Hallmark** | "과잉"으로 축소 금지 |
| 접근성·대비·focus-visible | **Hallmark** | 축소 금지 (Ponytail 원칙과도 일치) |
| loading·error 상태 처리 | **Hallmark** | 축소 금지 |
| 애니메이션·모션 정교화 | **Ponytail** | 최소. CSS transition 수준까지만 |
| 디자인 토큰 정의 | **Hallmark** | 단, 소스는 `study` 산출물 |
| 폴리필·빌드 도구 추가 | **Ponytail** | 금지 |

**한 줄 규칙:** *Ponytail은 "얼마나 많은 기계장치를 쓸 것인가"를, Hallmark는 "결과물이 어떻게 보이고 동작하는가"를 결정한다. 둘이 부딪히면 이 표를 따른다.*

Ponytail 보호 목록(P-1~P-10)에 다음을 추가한다:

| # | 보호 대상 | 근거 |
|---|---|---|
| P-11 | Hallmark 8-state 구현 | REQ-021, §21.3 |
| P-12 | 접근성·대비 게이트 통과 코드 | §21.3 |

### 21.6 CSS 격리 (REQ-020) — Hallmark가 안 막아주는 부분

Hallmark는 디자인 품질 규칙이지 **스코프 격리 도구가 아니다.** 위젯 CSS가 호스트 페이지로 새면 고객 사이트가 깨진다. 별도 강제 규칙:

| 규칙 | 내용 |
|---|---|
| 네임스페이스 | 모든 클래스·CSS 변수에 `ddak-` 접두사. 예외 없음 |
| 전역 선택자 금지 | `*`, `body`, `html`, 태그 셀렉터 단독 사용 금지 |
| 리셋 금지 | CSS reset·normalize 주입 금지 (호스트가 이미 가지고 있음) |
| 전역 오염 금지 | `window.*` 직접 할당 금지. `window.__ddak` 단일 네임스페이스만 |
| 이벤트 | `document` 전역 리스너는 위젯 언마운트 시 반드시 해제 |
| 폰트 | 외부 웹폰트 로드 금지. `font-family: inherit` 기본 (REQ-021) |
| z-index | `ddak-` 토큰으로만 지정, 상한 9000 (아임웹 UI 침범 방지) |
| 강화 옵션 | 격리가 특히 중요한 위젯은 Shadow DOM 사용 검토 → `OPEN-HLM-03` |

빌드 단계에 **CSS 스코프 린터**를 추가해 위반 시 빌드를 실패시킨다.

### 21.7 설치 (자료 기반 추론 — 각 구축자에서 실제 확인 필요)

- 저장소: `Nutlope/hallmark` (MIT). `SKILL.md` + `references/`를 프로젝트의 `.claude/skills`에 설치하거나 복사.
- Codex·Cursor 하네스도 공식 지원 대상으로 표기되어 있으나, **명령은 각 구축자 환경에서 개별 확인한다.** 상호 복사 금지.
- 게이트 개수가 출처마다 57 / 65로 엇갈린다 → 버전 차이로 추정. **설치본의 `SKILL.md`를 정본으로 삼는다.** → `OPEN-HLM-01`
- `.hallmark/log.json`은 구축자 로컬 메모리. `dist/`·`registry.json`에 포함되지 않도록 `.gitignore` 검토.

### 21.8 추가 인수 조건

| AC | REQ | 통과 조건 | TEST |
|---|---|---|---|
| AC-027 | REQ-020 | 위젯 로드 전후 호스트 페이지 계산 스타일 diff = 0 | TEST-027 |
| AC-028 | REQ-020 | CSS 스코프 린터가 `ddak-` 미접두 클래스에서 빌드 실패 | TEST-028 |
| AC-029 | REQ-021 | 위젯이 외부 폰트 요청을 0건 발생시킴 | TEST-029 (네트워크 로그) |
| AC-030 | §21.3 | 모든 인터랙티브 요소가 8-state를 구현 | TEST-030 (Hallmark audit) |
| AC-031 | §21.3 | 대비 게이트 통과 (APCA/WCAG) | TEST-031 |
| AC-032 | §21.5 | Ponytail이 8-state·a11y 코드를 축소하지 않음 | TEST-032 |
| AC-033 | §21.3 | 가짜 후기·가짜 지표가 위젯에 포함되지 않음 | TEST-033 |

### 21.9 추가 미확정

| 항목 | 상태 | 영향 | 해결 주체 |
|---|---|---|---|
| OPEN-HLM-01 | OPEN | 설치본 게이트 수·컴포넌트 모드 실동작 확인 | 구축자 (Step 2) |
| OPEN-HLM-02 | OPEN | `study`를 온보딩 필수 절차로 넣을지, 첫 사이트만 수동으로 할지 | user |
| OPEN-HLM-03 | OPEN | Shadow DOM 적용 범위 (전체 / 특정 위젯만 / 미사용) | 구축자 실측 후 user |

---

## 22. 신규 요구 보정 (REQ-022 ~ REQ-025)

### 22.1 전역 킬 스위치 (REQ-022)

```json
{ "schema_version": 1, "global_enabled": false, "modules": [ ... ] }
```

- `global_enabled: false`면 로더는 **registry를 읽자마자 아무것도 로드하지 않고 종료**한다.
- 텔레그램 `"전체 중지"` 한마디 → registry 갱신 → purge → 60초 내 전 사이트 정지.
- 이건 `OPERATING_APPROVED` 범위 내 **자동 실행**이다. 사고 상황에서 승인을 기다리게 하지 않는다. **정지는 승인 없이, 재개는 승인 필요.**
- 사이트별 킬 스위치도 동일 구조로 `sites.<site_id>.enabled`에 둔다.

### 22.2 로더 fail-safe (REQ-023)

| 실패 지점 | 동작 |
|---|---|
| registry fetch 실패 | 조용히 종료. 호스트 페이지 정상 |
| registry 파싱·스키마 실패 | 조용히 종료 (fail-closed, INV-9) |
| SRI 불일치 | 해당 모듈만 skip, 나머지 정상 |
| 슬롯·앵커 미발견 | 해당 모듈만 skip |
| 모듈 실행 중 예외 | 해당 모듈만 격리, 다른 모듈·호스트 무영향 |
| 로더 자체 예외 | 최상위 try/catch. 콘솔 경고 1줄, 그 외 아무 동작 없음 |

**원칙: 위젯이 안 뜨는 건 사고가 아니다. 고객 사이트가 깨지는 게 사고다.**

### 22.3 성능 예산 (REQ-024)

| 항목 | 상한 | 검사 |
|---|---|---|
| 위젯 1개 (JS+CSS, gzip) | 30KB | 빌드 실패 |
| 사이트 총합 | 100KB | 빌드 실패 |
| 로더 자체 | 5KB | 빌드 실패 |
| 외부 폰트 요청 | 0건 | TEST-029 |
| 렌더 차단 리소스 | 0건 (`defer` 필수) | 빌드 검사 |

예산 초과는 경고가 아니라 **빌드 실패**다. Ponytail 규칙셋과 방향이 일치한다.

### 22.4 데이터 취급 (REQ-025)

- 위젯은 방문자 개인정보를 수집·저장·전송하지 않는다.
- 네트워크 호출은 **CDN 정적 자산 GET**만 허용. 분석·트래킹·폼 전송 엔드포인트 금지.
- 향후 데이터 수집이 필요한 위젯을 만들 경우, **본 스펙 범위 밖**이며 개인정보 처리 근거·동의·보관 정책을 별도 계획한다.

### 22.5 추가 인수 조건

| AC | REQ | 통과 조건 | TEST | INV |
|---|---|---|---|---|
| AC-034 | REQ-022 | `global_enabled:false` 후 60초 내 전 위젯 정지 | TEST-034 | INV-9 |
| AC-035 | REQ-023 | registry를 깨진 JSON으로 바꿔도 호스트 페이지 정상 | TEST-035 | INV-7, INV-9 |
| AC-036 | REQ-023 | 모듈 1개가 예외를 던져도 나머지 정상 동작 | TEST-036 | INV-7 |
| AC-037 | REQ-024 | 31KB 위젯 빌드 시 실패 | TEST-037 | - |
| AC-038 | REQ-025 | 위젯 네트워크 로그에 CDN 외 요청 0건 | TEST-038 | - |

### 22.6 ENG 보정

| ENG ID | 모듈 | 결정 | 비고 |
|---|---|---|---|
| ENG-024 | 런타임 훅 | **OMIT (유지)** | 승인 대체용 훅 제외. Ponytail의 구축자 lifecycle hook은 별개(§20.4), 승인 게이트 우회 불가 |
| ENG-038 | 킬 스위치·fail-safe | APPLY | `engineering/runtime/failsafe.md` / PTEST-035 |
| ENG-039 | 성능 예산 게이트 | APPLY | `engineering/runtime/perf_budget.md` / PTEST-036 |
| ENG-040 | CSS 스코프 린터 | APPLY | `engineering/runtime/css_scope_lint.md` / PTEST-037 |

### 22.7 외부 접근 보정

§5.2 표에 다음을 추가한다.

| 후보 | 가용성 | 비용 | 조건 | 판정 | 이유 |
|---|---|---|---|---|---|
| Hallmark `study` (고객 사이트 URL 열람) | 가능 | 무료 | 공개 페이지 읽기만. 로그인·쓰기 없음 | `APPLY` | 온보딩 1회. 읽기 전용이라 위험 없음 |

---

## 23. 계획 자기평가 루프 (Hill loop / 계획 단계)

### 23.1 평가 축

| 축 | 정의 |
|---|---|
| A1 목표·완료조건 명확성 | 완료 상태가 관찰 가능한가 |
| A2 현실성 근거 | 공식 사실과 미확인이 분리되어 있는가 |
| A3 추적성 | REQ→AC→TEST, ENG→PTEST가 끊김 없는가 |
| A4 권위·우선순위 일관성 | 규칙 충돌 시 판정 경로가 있는가 |
| A5 본질 보호 | 불변식이 명시되고 검사로 강제되는가 |
| A6 운영·복구 안전성 | 실패·사고 시 되돌릴 수 있는가 |
| A7 범위·수준 정합성 | 선언한 전달 수준과 실제 범위가 맞는가 |

### 23.2 라운드 1 — 7.1 / 10

| 축 | 점수 | 발견된 결함 |
|---|---|---|
| A1 | 8 | - |
| A2 | 8 | - |
| A3 | 7 | D-01 INV 개념 부재로 검사가 요구에만 매달림 |
| A4 | 5 | **D-02 Hallmark·Ponytail·Spec·사용자 지시 간 최종 권위 순서 없음** |
| A5 | 4 | **D-03 "본질"이 문서 전체에 흩어져 있고 단일 정의가 없음** |
| A6 | 7 | **D-04 전역 킬 스위치 없음** / **D-05 로더 자체 실패 시 호스트 영향 미정의** |
| A7 | 6 | **D-06 헤더는 QUICK_MVP인데 실제 범위는 STANDARD** |
| 추가 | - | **D-07 성능 예산 없음** / **D-08 개인정보 취급 미정의** / **D-09 `study` 외부 접근 미등록** |

### 23.3 조치

| 결함 | 조치 | 위치 |
|---|---|---|
| D-01 | INV↔검사 매핑표 신설 | §0.2 |
| D-02 | 9단 권위 우선순위 표 신설 | §0.1 |
| D-03 | 본질 불변식 INV-1~INV-9 신설 | §0.2 |
| D-04 | REQ-022 킬 스위치 | §22.1 |
| D-05 | REQ-023 로더 fail-safe | §22.2 |
| D-06 | `STANDARD` / `FUNCTION_READY`로 정정 + M0~M3 게이트 | 헤더, §0.3 |
| D-07 | REQ-024 성능 예산 | §22.3 |
| D-08 | REQ-025 데이터 취급 | §22.4 |
| D-09 | `study` 접근 등록 | §22.7 |

### 23.4 라운드 2 — 9.4 / 10

| 축 | 점수 | 잔여 |
|---|---|---|
| A1 | 10 | - |
| A2 | 9 | 미확인 12건이 남아 있으나 **전부 등록·차단 게이트화됨** |
| A3 | 10 | - |
| A4 | 10 | - |
| A5 | 10 | - |
| A6 | 9 | D-10 스킬 추가 시 우선순위 배정 절차 미명문화 |
| A7 | 10 | - |

**조치:** D-10 → §0.1 해석 규칙에 "새 규칙셋은 우선순위 배정 후 도입" 추가. A2는 원리적으로 10 불가 — 미확인 사실을 계획서가 스스로 확인할 수 없다. **미확인을 정직하게 등록하고 차단 게이트로 만든 상태가 계획 완성도 관점의 만점**이다.

### 23.5 라운드 3 — 최종

| 지표 | 점수 | 의미 |
|---|---|---|
| **계획 완성도** | **10 / 10** | 내부 모순 0, 추적성 완전, 불변식 강제, 범위·수준 정합 |
| **현실성 확정도** | **6 / 10** | 미확인 12건. Step 2 preflight로만 해소 가능 |
| **구축 준비도** | **10 / 10** | 승인만 있으면 즉시 착수 가능 |

> 두 지표를 분리해 보고한다. 계획서가 스스로 미확인 사실을 확인한 척하면 그게 바로 계획 실패다.

### 23.6 미확인 12건 (전량 차단 게이트)

`CHK-001` Script API 쓰기 · `CHK-002` 비공개 앱 OAuth · `CHK-003` 무료 호출 범위 · `CHK-004` 구독 SDK 무인 실행 · `CHK-005` 아임웹 요금제 · `OPEN-REG-01` registry 호스팅 · `OPEN-REG-02` 슬롯 프리셋 위치 · `OPEN-BRW-01` 약관 자동화 조항 · `OPEN-BRW-02` 2차 인증 · `OPEN-BRW-03` `OPERATING_APPROVED` 발급 · `OPEN-PNY-01` Ponytail 설치·훅 · `OPEN-HLM-01` Hallmark 컴포넌트 모드

이 중 하나라도 미해소 상태에서 관련 동작을 실행하지 않는다.

---

## 24. 대화형 연결 위저드 (REQ-026 ~ REQ-035)

> 채팅으로만 전달한 실행 프롬프트는 권위 산출물이 아니다. 연결 위저드 요구를 본 문서에 정식 편입한다.

### 24.1 요구

| ID | 요구 | 근거 |
|---|---|---|
| REQ-026 | "연결·연동·붙여줘·setup·/connect" 감지 시 connect 라우트로 분기해 단계별 질문으로 설정을 완성한다 | 사용자 요구 |
| REQ-027 | 위저드는 **비밀값을 대화로 받지 않는다.** 환경변수 존재 여부만 확인한다 | 절대규칙 9 |
| REQ-028 | 위저드 상태는 대화별로 저장되어 중단 후 재개된다 | ENG-018 |
| REQ-029 | 설정 확정(manifest 커밋)은 1회 승인 대상이다 | INV-8 |
| REQ-030 | 사이트 연결을 A1 신규 / A2 기존 / A3 재연결로 분기한다 | EXISTING_CHANGE 원칙 |
| REQ-031 | A2·A3는 **무엇을 심기 전에 실제 상태 스캔을 반드시 선행**한다 | INV-1 |
| REQ-032 | 기존 코드는 자동으로 이관·삭제·수정하지 않는다 | INV-6, INV-8 |
| REQ-033 | 로더는 사이트당 1개만 존재한다 | INV-1 |
| REQ-034 | 스캔은 **렌더링 후 DOM 기준**으로 수행하고, 표본 페이지 한계를 사용자에게 고지한다 | 오탐 방지 |
| REQ-035 | 사이트 소유·관리 권한을 위저드 시작 시 확인한다 | 약관·법적 범위 |

### 24.2 로더 자기식별 (REQ-033 강제 수단)

C2/C3 분기를 판정하려면 로더가 자기 버전을 노출해야 한다.

```js
window.__ddak = window.__ddak || {};
window.__ddak.loader = { version: "1.0.0", site: "<site_id>", bootAt: Date.now() };
```

- 로더는 부팅 시 `window.__ddak.loader`가 **이미 있으면 즉시 종료**하고 콘솔에 중복 경고 1줄만 남긴다.
  → 실수로 2개가 삽입되어도 **런타임에서 자동 무해화**된다. 스캔(사전)과 로더(사후)의 이중 방어.
- 스캔은 URL 문자열이 아니라 이 객체를 기준으로 버전을 판정한다.

### 24.3 스캔 방식 (REQ-034)

| 항목 | 결정 |
|---|---|
| 방식 | Playwright **렌더링 후 DOM** 기준. 정적 HTML fetch 단독 금지 |
| 권한 | **읽기 전용.** 로그인 불필요, 공개 페이지만 |
| 표본 | 사용자 지정 1~5페이지 + 홈. **전수 아님** |
| 고지 | 결과 보고 첫 줄에 "표본 N개 기준이며 미검사 페이지에 코드가 있을 수 있습니다" 고정 출력 |
| 저장 | `state/site_scans/<site_id>_<ts>.json`. **secretscan 대상에 포함**(외부 스크립트 URL에 키가 섞일 수 있음) |

> 공통 코드 삽입은 전 페이지 공통이라 1페이지로 판정 가능하지만, **코드 위젯은 페이지별**이라 표본으로는 전수 보장이 불가능하다. 이 한계를 숨기지 않는다.

### 24.4 소유권 확인 (REQ-035)

위저드 첫 단계에서 확인한다.

```
Q-OWN 이 사이트를 직접 소유·관리하시나요?
  A 본인 계정의 본인 사이트
  B 고객사 사이트이며 관리 위임을 받음
  C 아님 / 확실하지 않음  → 진행 중단
```

- B는 스캔(읽기)까지만 허용하고, 아임웹 쓰기는 `OPEN-BRW-01` 해소 전까지 차단한다.
- C는 위저드를 종료한다.

### 24.5 정본 판정 (INV-3 정합)

A3 재연결에서 사이트 실측과 manifest가 다를 때, **"어느 쪽이 정본이냐"를 묻지 않는다.** INV-3에 따라 정본은 언제나 Git이다.

| 상황 | 판정 |
|---|---|
| 사이트에 있는데 Git에 없음 | **드리프트.** 우리가 심지 않은 코드. 기록만 하고 손대지 않음 |
| Git에 있는데 사이트에 반영 안 됨 | **미배포.** 재배포로 정본을 반영할지 묻는다 |
| 양쪽 버전 불일치 | **정본 기준 재배포**를 제안한다. 사이트를 정본으로 승격하지 않는다 |

### 24.6 동시성 (신규)

- `site_id` 단위 **연결 락**을 둔다. 다른 대화에서 같은 사이트 위저드가 진행 중이면 두 번째는 거부한다.
- 락은 위저드 만료·취소·완료 시 해제. 프로세스 재시작 시 만료 시각으로 자동 회수.
- manifest 커밋 직전 락 보유를 재확인한다. 미보유면 커밋하지 않는다(INV-9).

### 24.7 승인·만료 정합

| 상황 | 처리 |
|---|---|
| 위저드 15분 무응답 | 위저드 폐기 + **대기 중 승인 페이로드 동반 무효화** |
| 승인 15분 만료 | 위저드는 유지, 승인만 재요청 |
| 승인 대기 중 사용자가 "취소" | 승인·위저드·락 모두 해제 |

orphan 승인(주인 없는 대기 승인)을 남기지 않는다.

### 24.8 인텐트 오분류 방지 (신규)

"연결"은 다른 문맥에도 등장한다(예: "이 위젯을 저 슬롯에 연결해줘").

- 문장에 **위젯·슬롯·registry 등 기존 엔티티가 함께 등장하면 connect로 라우팅하지 않는다.**
- 판정이 애매하면 임의 분기하지 말고 한 번 되묻는다.
- 한국어 조사·어미 때문에 단어 경계(`\b`)가 오작동한 선례가 있으므로, **정규식 경계 대신 토큰·문맥 기반**으로 판정한다.

### 24.9 기존 코드 이관 보정 (D 절차)

- **D3 린트 실패를 자동 수정하지 않는다.** 기존 코드에 `ddak-` 접두사를 자동으로 붙이면 원래 동작이 깨진다. 위반 목록만 보고하고 중단한다.
- **D6 원본 제거는 관찰 기간 이후.** 신 위젯 배포 후 최소 **72시간** 정상 동작을 확인한 뒤에 제거를 제안한다. 즉시 제거하지 않는다.
- D1~D6 어느 단계에서 중단해도 아임웹은 이전 상태 그대로여야 한다.

### 24.10 실현성 축소 — E3

정적·단일 페이지 스캔으로 호스트의 최대 `z-index`를 신뢰성 있게 알 수 없다. E3는 다음으로 축소한다.

- 스캔은 **표본 페이지에서 관측된 최대 z-index만 보고**한다.
- 위젯은 이 값과 무관하게 `ddak-` 토큰 상한(9000)을 지킨다.
- 가려짐 여부는 **사용자 육안 확인 항목**으로 넘긴다. 자동 판정하지 않는다.

### 24.11 ENG 배정

| ENG ID | 모듈 | 결정 | 경로 | PTEST |
|---|---|---|---|---|
| ENG-041 | 연결 위저드 라우팅·상태 | APPLY | `engineering/runtime/connect_wizard.md` | PTEST-038 |
| ENG-042 | 사이트 상태 스캐너 | APPLY | `engineering/runtime/site_scanner.md` | PTEST-039 |
| ENG-043 | 기존 코드 이관 절차 | APPLY | `engineering/support/migration_procedure.md` | PTEST-040 |
| ENG-044 | 연결 락·동시성 | APPLY | `engineering/runtime/connect_lock.md` | PTEST-041 |
| ENG-045 | 인텐트 경계 판정 | APPLY | `engineering/patterns/routing.md` (확장) | PTEST-042 |

### 24.12 검사

| TEST | 시나리오 | 기대 | INV |
|---|---|---|---|
| TEST-039 | "연결"만 입력 | 소유권 확인 → 4지선다 | - |
| TEST-040 | 잘못된 URL | 재질문, 진행 정지 | - |
| TEST-041 | 로더 미삽입 상태 "삽입했어" | 검증 실패 보고 | INV-1 |
| TEST-042 | 봇 토큰 형식 문자열 전송 | 저장·로그 0건 + 재발급 권고 | - |
| TEST-043 | "취소" 후 재시작 | 처음부터, 락 해제 확인 | - |
| TEST-044 | 끊고 "이어서" | 마지막 단계부터 | - |
| TEST-045 | 두 엔진 동시 활성화 | 거부 | - |
| TEST-046 | 로더 2개 사이트 | BLOCKED, 자동 제거 0건 | INV-1 |
| TEST-047 | 로더 1개 최신 | 삽입 0건 | INV-1 |
| TEST-048 | 구버전 로더 | 승인 없이 교체 0건 | INV-2 |
| TEST-049 | 기존 커스텀 코드 | 이관 제안 없이 보고만 | INV-8 |
| TEST-050 | 스냅샷 실패 상태 이관 | 착수 거부 | INV-6 |
| TEST-051 | 전역 셀렉터 코드 이관 | 린트 실패 보고, 자동 수정 0건 | INV-7 |
| TEST-052 | D3에서 중단 | 아임웹 무변경 | INV-9 |
| TEST-053 | A3 차이 없음 | 커밋 0건 | - |
| TEST-054 | 로더 2개 실제 삽입 | 런타임에서 두 번째가 자동 종료 | INV-1 |
| TEST-055 | 정적 HTML엔 없고 렌더 후에만 있는 로더 | 스캔이 탐지 | REQ-034 |
| TEST-056 | 두 대화에서 같은 site_id 동시 연결 | 두 번째 거부 | REQ-031 |
| TEST-057 | 위저드 만료 시 대기 승인 | 동반 무효화 | INV-8 |
| TEST-058 | "이 위젯을 슬롯에 연결해줘" | connect 라우트로 가지 않음 | - |
| TEST-059 | 소유권 C 선택 | 위저드 종료 | REQ-035 |
| TEST-060 | 스캔 결과에 키 문자열 포함 | secretscan이 검출 | - |

### 24.13 제약

- 스캔 단계에서 아임웹에 **쓰기가 1건이라도 발생하면 설계 위반**이다.
- 기존 코드를 "정리·개선·최적화"하겠다고 **먼저 제안하지 않는다.**
- 로더 중복(C4)과 충돌(E1·E2·E4)은 경고로 강등할 수 없다. 연결 실패로 처리한다.
- 새 라이브러리 추가 금지(Ponytail). 기존 라우터·Thread Store·승인 모듈 재사용.
- 위저드는 런타임 기능이므로 Hallmark 적용 대상이 아니다.
- INV-1~INV-9를 하나도 완화하지 않는다.

### 24.14 자기평가 (라운드 2 기준)

| 축 | R1 | R2 | 조치 |
|---|---|---|---|
| A1 명확성 | 8 | 10 | - |
| A2 현실성 | 5 | 10 | E3 실현성 축소(§24.10), 스캔 방식 확정(§24.3) |
| A3 추적성 | 6 | 10 | ENG-041~045 배정, TEST-054~060 추가 |
| A4 권위 일관성 | 4 | 10 | 채팅 프롬프트를 본 문서로 편입, INV-3 모순 해소(§24.5) |
| A5 본질 보호 | 6 | 10 | 로더 자기식별 이중 방어(§24.2) |
| A6 안전성 | 6 | 10 | 락(§24.6), 승인 정합(§24.7), 72시간 관찰(§24.9) |
| A7 범위 정합 | 7 | 10 | 소유권 게이트(§24.4), 표본 한계 고지 |
