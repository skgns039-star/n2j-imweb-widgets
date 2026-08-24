# 아임웹에 삽입할 유일한 코드 (IO-006)

> **INV-1 / INV-2.** 이 스니펫은 사이트당 **한 번만** 삽입하고, 그 뒤로는 절대 바꾸지 않는다.
> 새 위젯 추가·수정·롤백은 전부 `registry.json` 갱신으로 처리되며 이 코드는 손대지 않는다.
> 교체가 필요하면 §7.4에 따라 사용자 **명시 승인**이 있어야 한다.

## 삽입 위치

`환경설정 > SEO(검색엔진최적화) > 공통 코드 삽입` (아임웹 권장 경로, 유료 요금제 기능 — CHK-005)
불가하면 코드 위젯 1개에 넣는다.

## 스니펫

```html
<script
  src="https://cdn.jsdelivr.net/gh/skgns039-star/n2j-imweb-widgets@loader-1.1.0/loader/loader.js"
  data-site="sehwa"
  data-registry="https://raw.githubusercontent.com/skgns039-star/n2j-imweb-widgets/main/registry.json"
  defer></script>
```

## 슬롯 프리셋 (REQ-013)

위젯을 특정 위치에 붙이려면, **최초 설치 때 함께** 빈 슬롯을 심는다. 이후 어떤 위젯이 와도 아임웹을 다시 고치지 않는다.

```html
<div data-ddak-slot="header"></div>
<div data-ddak-slot="content"></div>
<div data-ddak-slot="footer"></div>
```

몇 개를 어디에 심을지는 `OPEN-REG-02` (사용자 결정 대기).

## 삽입 전 필수 절차

1. 기존 코드 영역 원문을 `state/imweb_snapshots/<timestamp>.txt`로 저장한다 (INV-6, 스냅샷 없으면 실행 금지).
2. 기존 코드는 지우지 않고 **append**한다.
3. 저장 후 재조회 → 주석 제거 정규화 diff = 0 확인. 아임웹은 저장 시 주석을 제거하므로 바이트 비교를 하지 않는다.
4. diff ≠ 0이면 스냅샷으로 되돌리고 `BLOCKED` 보고.

## registry 호스팅 (OPEN-REG-01 결정: 2026-08-24)

`registry.json` 만 raw.githubusercontent 로 서빙한다. 모듈 자산(JS/CSS)은 jsDelivr 불변 태그 + SRI 그대로다.

**이유:** jsDelivr 의 `@main` 은 브랜치→커밋 해석을 12시간 캐시한다(`s-maxage=43200`). purge 가 200을 줘도 갱신되지 않아
REQ-015(배포 즉시 반영)와 REQ-022(60초 내 전 사이트 정지)를 지킬 수 없다. raw 는 `max-age=300`(5분)이다.

**완화 기록:** 이 구성에서 킬 스위치 반영은 **최대 5분**이다. REQ-022 의 60초를 충족하지 못한다.
고객사 확장 시 Cloudflare Pages(`max-age=60`)로 옮겨 해소한다.

## 검증

- 실사이트 콘솔에서 `window.__ddak.loaded` → 로드된 위젯 목록이 보이면 정상.
- 아무것도 안 뜨는 것은 정상 동작일 수 있다(fail-closed). 호스트 페이지가 깨지면 그때가 사고다.
