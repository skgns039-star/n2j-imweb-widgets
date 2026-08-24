# ENG-031 캐시 무효화 (REQ-015)

- 모듈 자산은 **불변 태그**(`@w-<id>-<version>`)로 고정 → 캐시돼도 무해하다.
- 가변인 것은 `registry.json` 하나뿐이다.
- 파이프라인: registry.json 커밋·푸시 → `https://purge.jsdelivr.net/gh/<owner>/<repo>@main/registry.json` 호출 → CDN 재fetch로 updated_at 갱신 확인(최대 60초, 5초 간격) → **확인된 뒤에만 완료 보고**.
- purge 실패 또는 반영 미확인 → `result=BLOCKED`. "저장했으니 됐다"고 선언하지 않는다.
- 구현: `src/release/deploy.ts` purge() / confirmRegistry() / publishRegistry()
- **OPEN-REG-01:** registry를 Cloudflare Pages(max-age=60)로 분리하면 purge 의존이 사라진다. purge 실측 반영 시간을 본 후 사용자 결정.
