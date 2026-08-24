# RESUME — 다음 세션에서 이어가는 지점

작업 경로: `C:\Users\cut07\projects\imweb-widget-agent`
저장소: `https://github.com/skgns039-star/n2j-imweb-widgets` (public)

## 지금 상태 (2026-08-24)

| 항목 | 상태 |
|---|---|
| 검사 | **73/73 통과** · typecheck OK · lint OK · secretscan 유출 0건 |
| 텔레그램 봇 | `@n2j_IMWEB_WIDGET_bot` · chat_id `8995797720` · polling |
| 실행 엔진 | `claude_agent_sdk` (어댑터 왕복 실측 통과) |
| 사이트 | `sehwa` (세화건설) `https://sehwaconstruction.imweb.me` |
| 로더 | v1.1.0 · 4개 페이지 전부 부팅 확인 |
| 위젯 | `hello-badge@0.1.0` · `mount: none` · `enabled: true` · 태그 `w-hello-badge-0.1.0` 배포됨 (3지점 해시 일치) |
| registry | `raw.githubusercontent` 로 서빙 (OPEN-REG-01 결정) |

## ★ 지금 막힌 지점 — 여기부터 시작

**아임웹 스니펫의 `data-registry` 한 줄을 교체해야 위젯이 화면에 뜬다.**

현재 아임웹에 박힌 값:
```
data-registry="https://cdn.jsdelivr.net/gh/skgns039-star/n2j-imweb-widgets@main/registry.json"
```
바꿀 값:
```
data-registry="https://raw.githubusercontent.com/skgns039-star/n2j-imweb-widgets/main/registry.json"
```

- 나머지 줄(`src`, `data-site`, `defer`)은 **그대로 둔다.**
- 교체 전 해당 코드 영역 원문을 복사해 보관한다 (INV-6).
- 교체 후 확인: `node -e "import('./src/bot/scan.ts')..."` 또는 텔레그램에 `상태`.

**이유:** jsDelivr `@main` 은 브랜치→커밋 해석을 12시간 캐시한다(`s-maxage=43200`).
purge 가 200 을 줘도 갱신되지 않아 배포·킬스위치가 반영되지 않는다.
커밋 고정 URL 과 raw 는 최신을 주는 것으로 실측 확인했다.

## 교체 후 할 일

1. 실사이트에서 뱃지(우측 하단 플로팅) 확인 — `window.__ddak.loaded` 에 `hello-badge` 가 잡히면 성공
2. **M0 게이트 완료 선언** → `RUN_STATE.json` 갱신
3. 롤백 왕복 1회 검증 (`npm run rollback -- hello-badge off <approval>`)

## 미해결 (추적 중)

| 항목 | 내용 |
|---|---|
| **REQ-022 완화** | 킬 스위치 반영이 60초 → **최대 5분** (raw 의 `max-age=300`). 고객사 확장 시 Cloudflare Pages(`max-age=60`)로 해소 |
| OPEN-REG-02 | 슬롯 프리셋 위치 미정. 현재 `mount: none` 이라 불필요 |
| CHK-001~003 | 아임웹 Open API. 키는 `.env` 에 `_SEHWA` 접미사로 보관, **호출은 gateBlock 이 차단 중** |
| OPEN-BRW-01~03 | 브라우저 자동 업로드 = M2. 미착수 |
| CHK-005 | **해소됨** — 공통 코드 삽입이 4개 페이지 전부 적용됨을 실측 |

## 되살리기

```
cd C:\Users\cut07\projects\imweb-widget-agent
npm ci
npm run setup:check     # 전 항목 OK 여야 한다
npm test                # 73/73
npm start               # 텔레그램 봇 기동
```

`.env` 는 커밋되지 않는다. 다른 PC에서는 `.env.example` 을 복사해 사람이 값을 채운다.

## 이 프로젝트에서 절대 완화하지 않는 것

INV-1~9 (`contracts/AUTHORITY_MANIFEST.yaml`), 승인 게이트, 4지점 해시 검증,
아임웹 쓰기 전 스냅샷, 비밀값 미노출. 자세한 건 `AGENTS.md` 를 먼저 읽는다.
