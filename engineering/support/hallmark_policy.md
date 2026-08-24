# ENG-037 Hallmark (위젯 디자인 규칙셋)

- 층: **Builder-side.** 적용 범위는 **`src/widgets/**` 의 UI 코드에만.** 봇 라우터·릴리스 파이프라인에는 미적용.
- 반드시 **컴포넌트 모드**로 쓴다.

| 사용 | 금지 |
|---|---|
| 컴포넌트 스코프 게이트(시각·마이크로인터랙션·대비·a11y·타이포) | 매크로구조 선택 |
| 8-state 체크리스트 | nav / footer / hero 아키타입 |
| 대비(APCA/WCAG) 검사 | 다양화 게이트 로테이션 |
| 정직한 카피 규칙(가짜 지표·가짜 후기 금지) | 카탈로그 테마 22종 |
| audit 동사(기존 위젯 점수화) | 페이지 전체 재구성 |

**테마를 쓰지 않는 이유:** 위젯은 고객 아임웹 사이트 **안에** 삽입된다. 테마를 입히면 호스트와 이질감이 생긴다.

## 8-state (축소 금지 — P-11)
default · hover · focus-visible · active · disabled · **loading** · **error** · success
위젯은 네트워크를 타고 렌더되므로 loading·error가 실제로 발생한다. 이 상태를 안 만들면 고객 사이트에 깨진 화면이 뜬다.

## 호스트 DNA 추출 (테마 대신)
```
온보딩 1회:  hallmark study <고객 아임웹 사이트 URL>
             → 타이포 페어링·색 앵커·간격 리듬 추출 → design/<site_id>.design.md
이후 빌드:   design/<site_id>.design.md 를 토큰 소스로 사용
```
읽기 전용·공개 페이지만 열람한다. → `OPEN-HLM-02`

## Ponytail 충돌 판정 (§21.5)
| 영역 | 우선 |
|---|---|
| 새 라이브러리·프레임워크 도입 | Ponytail (금지, 브라우저 네이티브 우선) |
| 추상화 레이어·래퍼 | Ponytail (만들지 않음) |
| 8-state 구현 | **Hallmark (축소 금지)** |
| 접근성·대비·focus-visible | **Hallmark (축소 금지)** |
| loading·error 상태 | **Hallmark (축소 금지)** |
| 애니메이션·모션 정교화 | Ponytail (CSS transition 수준까지) |
| 디자인 토큰 정의 | Hallmark (소스는 study 산출물) |
| 폴리필·빌드 도구 추가 | Ponytail (금지) |

**한 줄 규칙:** Ponytail은 "얼마나 많은 기계장치를 쓸 것인가"를, Hallmark는 "결과물이 어떻게 보이고 동작하는가"를 결정한다.

## 설치
저장소 `Nutlope/hallmark` (MIT). `SKILL.md` + `references/` 를 프로젝트 `.claude/skills` 에 설치·복사.
게이트 개수가 출처마다 다르므로 **설치본의 SKILL.md를 정본**으로 삼는다 → `OPEN-HLM-01`.
`.hallmark/log.json` 은 구축자 로컬 메모리 — `.gitignore` 에 포함되어 있다.

**CSS 격리는 Hallmark가 막아주지 않는다.** `engineering/runtime/css_scope_lint.md` 를 함께 지킨다.
