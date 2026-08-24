# RESUME — 다음 세션에서 이어가는 지점

작업 경로: `C:\Users\cut07\projects\imweb-widget-agent`
저장소: `https://github.com/skgns039-star/n2j-imweb-widgets` (public)

## 지금 상태 (2026-08-25 갱신)

| 항목 | 상태 |
|---|---|
| 검사 | **73/73 통과** · typecheck OK · lint OK · secretscan 유출 0건 |
| 텔레그램 봇 | `@n2j_IMWEB_WIDGET_bot` · chat_id `8995797720` · polling |
| 실행 엔진 | `claude_agent_sdk` (어댑터 왕복 실측 통과) |
| 사이트 | `sehwa` (세화건설) `https://sehwaconstruction.imweb.me` |
| 로더 | v1.1.0 · 4개 페이지 전부 부팅 확인 |
| 위젯 | `hello-badge@0.1.0` · `mount: none` · `enabled: true` · 태그 `w-hello-badge-0.1.0` 배포됨 (3지점 해시 일치) |
| registry | `raw.githubusercontent` (OPEN-REG-01 결정) · 반영 실측 **약 200초** |

## ★ M0 게이트 — **완료 (2026-08-25)**

| 항목 | 결과 |
|---|---|
| 로더 1회 삽입 | ✅ v1.1.0, 4개 페이지 전부 부팅 |
| 서브파일 수정 → 실사이트 반영 | ✅ 뱃지 렌더, 콘솔 에러 0 |
| 3지점 해시 일치 | ✅ `68ff35cc369a` |
| **롤백 왕복** | ✅ enabled:false → 뱃지 0개(사이트 정상) → true → 뱃지 복귀 |

실측: registry 반영 **약 200초**(정지 58초 / 재개 201초). 로더는 `cache:no-store` 로 읽으므로
브라우저 캐시는 개입하지 않고, 지연은 전적으로 raw 의 엣지 캐시(max-age=300)에서 온다.

## 다음 작업 후보

1. **실사용 위젯 제작** — hello-badge 는 검증용이다. 실제 팔 위젯을 `src/widgets/` 에 만든다
2. **슬롯 프리셋** (OPEN-REG-02) — 특정 위치에 붙일 위젯이 필요해지면 아임웹에 슬롯 div 1회 추가
3. **Cloudflare 이전** — 고객사 확장 시 REQ-022(60초) 충족용
4. **M1/M2** — 신규 위젯 무수정 추가 검증 / 브라우저 자동 업로드

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
