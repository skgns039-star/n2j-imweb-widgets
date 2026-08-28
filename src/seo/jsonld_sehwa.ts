/* 세화 JSON-LD 정본. 값은 전부 공개 페이지·푸터에서 확인된 것만 쓴다 (INV-13).
   출처는 seo/sehwa/16_paste-ready.md 근거표와 같다. */
export const BODY = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "GeneralContractor",
      "@id": "https://xn--z69at79a6jasc240auy1a.kr/#organization",
      "name": "주식회사 세화건설산업",
      "alternateName": "Sehwa Construction",
      "url": "https://xn--z69at79a6jasc240auy1a.kr/",
      "foundingDate": "1999",
      "telephone": "+82-10-2067-0974",
      "email": "dark8201@hanmail.net",
      "taxID": "753-88-02681",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "칠성3길 116 (산북동)",
        "addressLocality": "군산시",
        "addressRegion": "전북특별자치도",
        "addressCountry": "KR"
      },
      "knowsAbout": ["조립식 건축", "모듈러 건축", "주거 건축", "산업 시설", "상업 시설", "건축물 리모델링"]
    },
    {
      "@type": "WebSite",
      "@id": "https://xn--z69at79a6jasc240auy1a.kr/#website",
      "url": "https://xn--z69at79a6jasc240auy1a.kr/",
      "name": "세화건설산업",
      "description": "조립식 건축의 미래, 세화가 짓습니다 25년의 축적된 기술력과 혁신적인 모듈러 시스템으로 더 견고하고 효율적인 공간의 가치를 실현합니다.",
      "publisher": { "@id": "https://xn--z69at79a6jasc240auy1a.kr/#organization" },
      "inLanguage": "ko"
    }
  ]
}
</script>`;
