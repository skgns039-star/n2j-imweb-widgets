# 템플릿·양식·보고서 형식 (원본 §9·§14·§15·§16·§19·§22 전량)

---

## 1. robots.txt 일반 템플릿

```
User-agent: *
Allow: /
Disallow: /site_join
Disallow: /site_join_agree
Disallow: /login
Disallow: /logout.cm
Disallow: /shop_cart
Disallow: /?mode
Disallow: /admin

Sitemap: https://<정식도메인>/sitemap.xml
```

- **실제 도메인으로 교체하기 전에는 반영하지 않는다.**
- 변경 전 기존 robots.txt를 백업한다.
- 사용자 승인 없이 변경하지 않는다.
- Header Code에 넣지 않는다. 아임웹 SEO 설정 영역에서 관리한다.

---

## 2. llms.txt 기본형

```
User-agent: *
Allow: /
Commercial-use: allowed
Research-use: allowed
```

상세형은 **직접 반영이 가능할 때만** 적용한다.

**금지:** 실제 페이지와 맞지 않는 키워드 · 미확인 상품 정보 · 미확인 재고 · 미확인 할인 · 미확인 후기 · 미확인 평점 · 미확인 오프라인 매장 · 보장성 표현

---

## 3. JSON-LD 최소 템플릿 (Organization + WebSite)

```html
<!-- DDAK-SEO:START type=json-ld-org v=1 -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization",
      "@id": "https://<도메인>/#organization",
      "name": "<브랜드명>",
      "url": "https://<도메인>/" },
    { "@type": "WebSite",
      "@id": "https://<도메인>/#website",
      "url": "https://<도메인>/",
      "name": "<브랜드명>",
      "description": "<사이트 설명>",
      "publisher": { "@id": "https://<도메인>/#organization" },
      "inLanguage": "ko" }
  ]
}
</script>
<!-- DDAK-SEO:END -->
```

**적용 전 확인:** 브랜드명 · 한글명 · 정식 도메인 · 사이트 설명 · 로고 URL 확인 여부 · SNS URL 확인 여부 · 전화번호 확인 여부 · 주소 확인 여부 · 다국어 URL 구조 · canonical · hreflang · 기존 JSON-LD 중복 여부

**절대 넣지 않음 (INV-13):** placeholder · 작업 메모 · 미확인 logo · 미확인 sameAs · 미확인 telephone · 미확인 address · 실제 FAQ 없는 FAQPage · 구조화 여부 확인 전 Product · 임의 가격/재고/후기/평점

정보가 부족하면 채우지 말고 `정보 부족` 또는 `최소 버전만 가능`으로 표시한다.

---

## 4. 소유확인 태그 블록 (4개 엔진 통합)

```html
<!-- DDAK-SEO:START type=owner-verification v=1 -->
<meta name="google-site-verification" content="<GSC>" />
<meta name="naver-site-verification" content="<NAVER>" />
<meta name="msvalidate.01" content="<BING>" />
<meta name="daum-site-verification" content="<DAUM>" />
<!-- DDAK-SEO:END -->
```

- 4개를 **한 블록으로 묶어** 관리한다. 개별 삽입하지 않는다.
- 값이 없는 엔진은 줄 자체를 생략한다. 빈 content를 남기지 않는다.
- 마커 구간만 치환한다. Header Code 전체를 덮어쓰지 않는다.

---

## 5. 승인 요청 양식

```
[승인 요청]
사이트:
작업 위치:
수정 전:
수정 후:
수정 이유:
영향 범위:
위험도:        낮음 / 중간 / 높음 / 보류
되돌림 방법:
백업 경로:
유효 기간:     15분
승인 필요 여부: 예
```

---

## 6. 상품 SEO 사용자 확인 질문 양식

```
[상품 SEO 사용자 확인 필요]
사이트:
문제 유형:
대상 상품 수:
대표 상품명:
대표 상품 URL:
현재 SEO 제목:
현재 SEO 설명:
문제 설명:
수정 후보:
처리 선택지:
  1. 기존값 유지
  2. 수정 후보로 변경
  3. 내가 직접 입력
  4. 이번 작업에서 제외
권장:
근거:
승인 필요 여부: 예
```

---

## 7. 상품 SEO 대량 수정 승인 요청서

```
[상품 SEO 대량 수정 승인 요청]
사이트:
총 상품 수:
수정 대상 상품 수:
기존값 유지 상품 수:
신규 입력 후보 상품 수:
이상 감지 상품 수:
중복 감지 상품 수:
수정 이유:
수정 전 백업 경로:
수정 후 예상 영향:
되돌림 방법:
승인 필요 여부: 예
```

대량 수정 기본값은 `OFF`다.

---

## 8. 상품 SEO 출력표

`상품 URL / 상품명 / 카테고리 / 현재 SEO 제목 / 현재 SEO 설명 / 진단 상태 / 문제 유형 / 수정 제목 후보 / 수정 설명 후보 / 처리 방식 / 사용자 확인 질문 / 적용 상태`

**처리 방식 (택1)**
기존값 유지 · 신규 입력 후보 · 이상 감지 후 사용자 확인 · 중복 감지 후 사용자 확인 · 반영 보류 · 승인 후 수정 가능

**적용 상태 (택1)**
미수정 · 승인 대기 · 승인 후 반영 · 반영 완료 · 보류

---

## 9. 최종 보고서

### A. 클라이언트 전달용 요약본

작업 완료 요약 · 사이트 유형 · 작업 대상 URL · 정식 도메인 · URL별 SEO 핵심 세팅표 · 메타 타이틀 요약 · 메타 디스크립션 요약 · OG 요약 · 다국어 SEO 상태 · robots.txt 상태 · llms.txt 상태 · Google Search Console 상태 · Naver Search Advisor 상태 · **Bing 상태** · **Daum 상태** · sitemap 상태 · GA4/GTM 상태 · 상품 SEO 상태 · 남은 확인 사항 · 추후 관리 권장 사항

**표:** `URL / 페이지유형 / SEO 타이틀 / 메타 디스크립션 / CTA / 작업상태`

**상품 SEO 요약:** 기존값 유지 수 / 신규 입력 후보 수 / 중복·이상 감지 수 / 사용자 확인 필요 수 / 반영 완료 수

### B. 내부 작업자용 상세본

URL별 SEO 상세표 · 상품페이지 SEO 상세표 · 디자인모드 확인표 · 이미지 ALT 확인표 · 코드 위젯 확인표 · Header/Body/Footer 대조표 · JSON-LD 적용표 · robots.txt 최종본 · llms.txt 초안 또는 상태 · GA4/GTM 중복 확인표 · 전환 이벤트 확인표 · 관리자 확인 필요 항목 · 추후 보완 목록 · **INV-11로 미적용된 권장사항 목록**

**표:** `URL / 기존 제목 / 수정 제목 후보 / 기존 설명 / 수정 설명 후보 / OG / CTA / H태그 / 이미지 ALT / JSON-LD / Header Code / 작업상태 / 확인 필요 항목`

### C. 실행 로그

실행 일시 · 사이트 · 작업 모드 · 접근 성공/실패 · 캡처 경로 · 백업 경로 · 수정 전 값 · 수정 후 값 · 승인 여부 · 오류 · 보류 사유 · 다음 작업
