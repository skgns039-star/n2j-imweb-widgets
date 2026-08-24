# ENG-021 MCP 도구 경계 (REQ-008)

- 권한 프로파일: `config/agent_registry.yaml` → permission_profiles.imweb-widget
- 도구 경계는 **경로 단위**로 분리한다.

| 도구 | 허용 | 승인 |
|---|---|---|
| repo.read | `src/ dist/ manifest/ integrity/ engineering/ loader/ config/ state/` | - |
| repo.write | `src/widgets/** dist/** manifest/widgets.yaml integrity/** state/** logs/**` | - |
| build | `npm run build` | - |
| verify | `npm run verify:integrity` | - |
| deploy | git tag push · CDN purge | **필요** |
| rollback | manifest·registry 되돌리기 | **필요** |
| imweb.write | 아임웹 관리자 쓰기 | **필요** + 스냅샷 선행 |

- **PTEST-016:** 허용 밖 경로 쓰기 시도는 거부한다. `loader/` 는 읽기 전용이다 — 스니펫 변경은 명시 승인 대상(§7.4).
- 현재 수준에서는 MCP 서버를 별도 프로세스로 띄우지 않는다. 경계는 위 프로파일과 라우터 코드로 강제한다. MCP 서버화는 STANDARD 승격 시 재판정.
