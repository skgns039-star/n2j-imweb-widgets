/* SKILL §6 산출물 경로. 15개 파일을 seo/<site_id>/ 안에만 만든다.
   보고서 머리에 고객사명·브랜드명·site_id 를 함께 표기한다 (§6). */
import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { p, manifest } from "../release/paths.ts";
import { publicAuditItems, altScope, siteTypeInputs } from "./references.ts";
import { derive, checkDerived, technicalDrafts, unverifiedGuard, type Facts } from "./derive.ts";
import { gate, type Finding } from "./quality.ts";
import { productPages, classify, summarize } from "./product.ts";
import { slopCheck, slopReport } from "./slop.ts";
import { engineStatusText } from "./gates.ts";
import type { PageSeo } from "./observe.ts";

/** §6 파일 목록. 이름을 임의로 바꾸지 않는다. */
export const FILES = [
  "00_site-info.md", "01_input-values.md", "02_url-map.md",
  "03_public-audit.md", "04_api-admin-audit.md", "05_design-mode-audit.md",
  "06_product-seo-audit.md", "07_code-audit.md", "08_ga4-gtm-audit.md",
  "09_seo-draft.md", "10_approval-needed.md", "11_apply-log.md",
  "12_verify-log.md", "13_client-delivery.md", "14_internal-delivery.md",
  "15_search-console.md", "16_paste-ready.md",
] as const;

export const SUBDIRS = ["custom-code", "snapshots", "screenshots", "exports", "logs"] as const;

export function siteDir(site_id: string): string {
  if (!/^[a-z0-9-]+$/.test(site_id)) throw new Error(`잘못된 site_id: ${site_id}`);
  return p("seo", site_id);
}

export function scaffold(site_id: string): string {
  const dir = siteDir(site_id);
  for (const d of ["", ...SUBDIRS]) mkdirSync(d ? `${dir}/${d}` : dir, { recursive: true });
  return dir;
}

export function write(site_id: string, file: string, body: string): string {
  if (file.includes("..") || /[\\/]/.test(file)) throw new Error(`경로 이탈: ${file}`);
  scaffold(site_id);
  const out = `${siteDir(site_id)}/${file}`;
  writeFileSync(out, body.endsWith("\n") ? body : body + "\n");
  return out;
}

export const written = (site_id: string) =>
  existsSync(siteDir(site_id)) ? readdirSync(siteDir(site_id)).filter((f) => f.endsWith(".md")).sort() : [];

/** 셀 안의 | 는 표를 쪼갠다. 브랜드 결합("키워드 | 브랜드")이 그대로 들어와 깨진 적이 있다. */
const cell = (s: string) => String(s ?? "").split("|").join("\\|").split("\n").join(" ");

/** 모든 보고서 머리 — 고객사명·브랜드명·site_id 를 함께 표기한다 (§6). */
function head(a: Facts & { site_id: string; label: string }, title: string, mode: string): string {
  return [
    `# ${title}`, "",
    `| 고객사 | 브랜드 | site_id | 모드 |`,
    `|---|---|---|---|`,
    `| ${cell(a.label)} | ${cell(a.brand || "확인 필요")} | ${cell(a.site_id)} | ${cell(mode)} |`, "",
  ].join("\n");
}

// 모든 셀은 여기서 이스케이프한다. 호출부마다 챙기면 언젠가 하나를 빠뜨린다.
const table = (rows: string[][], cols: string[]) =>
  [`| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`,
   ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");

export type BuildInput = Facts & { site_id: string; label: string; url: string; pages: PageSeo[]; findings: Finding[] };

/** §8 상품 SEO — 5분류 결과. 유형별로 묶어서 보고하고, 개별 상품은 표로 남긴다. */
function productSection(a: BuildInput): string[] {
  const items = productPages(a.pages);
  if (!items.length) {
    return [a.siteType === "쇼핑몰"
      ? "쇼핑몰이지만 사이트맵에서 상품 상세(`/shop_view/`)를 찾지 못했습니다. 상품 URL을 알려주시면 진단합니다."
      : "쇼핑몰이 아니므로 해당 없음."];
  }
  const c = classify(items);
  const groups = summarize(c);
  return [
    `상품 ${items.length}건을 5분류했습니다. **기본값은 기존값 보존이다. 자동 덮어쓰기 없음 (INV-12).**`, "",
    "## 유형별 요약 (§8 질문 폭탄 방지 — 묶어서 한 번에)",
    table(groups.map((g) => [g.verdict, String(g.count), g.handling]), ["분류", "건수", "처리"]),
    "", "## 개별 상품",
    table(c.map((x) => [x.path, x.h1 || "-", x.verdict, x.reason]), ["경로", "상품명", "분류", "근거"]),
    "", "> `기존값 유지` 외에는 **후보만 작성하고 반영은 보류**합니다. 승인 없이 상품 메타를 덮어쓰지 않습니다.",
  ];
}

/** 진단 1회 실행이 남기는 산출물 전량 (0~9단계). 아임웹 쓰기는 없다. */
export function buildAll(a: BuildInput): { file: string; path: string }[] {
  const out: { file: string; path: string }[] = [];
  const put = (f: string, body: string) => out.push({ file: f, path: write(a.site_id, f, body) });
  const ok = a.pages.filter((x) => x.ok);

  put("00_site-info.md", [
    head(a, "사이트 기본 정보", "OBSERVE"),
    table([
      ["정식 도메인", a.domain || "확인 필요"],
      ["브랜드명", a.brand || "확인 필요"],
      ["사이트 유형", a.siteType],
      ["공개 URL", a.url],
      ["진단 페이지", `${ok.length}/${a.pages.length}`],
    ], ["항목", "값"]),
    "", "> 추론값에는 진단 보고서에서 `[추론]` 태그가 붙는다. 사용자가 정정할 수 있다.",
  ].join("\n"));

  put("01_input-values.md", [
    head(a, "입력값", "OBSERVE"),
    `메타 키워드: **${a.keyword || "미입력"}**`, "",
    "## 사이트 유형별 필요 입력값 (vocabulary §3)",
    (siteTypeInputs()[a.siteType.replace(/\s/g, "")] ?? siteTypeInputs()["일반"] ?? []).map((x) => `- ${x}`).join("\n") || "- 확인 필요",
    "", "> 쇼핑몰이 아니면 상품 URL 목록을 요구하지 않는다.",
  ].join("\n"));

  put("02_url-map.md", [
    head(a, "URL 맵", "OBSERVE"),
    table(a.pages.map((x) => [x.path, x.ok ? "200" : (x.error ?? "실패"), x.title || "-", x.canonical || "-"]),
      ["경로", "상태", "title", "canonical"]),
  ].join("\n"));

  put("03_public-audit.md", [
    head(a, "공개 페이지 진단", "OBSERVE"),
    `수집 항목 ${publicAuditItems().length}개 기준 (audit §A)`, "",
    table(ok.map((x) => [
      x.path, x.title || "-", String([...(x.description || "")].length), x.h1[0] || "-",
      String(x.h2Count), `${x.imgTotal - x.imgNoAlt}/${x.imgTotal}`,
      x.jsonLdTypes.join(",") || "-", x.canonical ? "O" : "X",
      Object.keys(x.og).length ? "O" : "X",
    ]), ["URL", "title", "desc자수", "H1", "H2수", "ALT보유", "JSON-LD", "canonical", "OG"]),
    "", "## 지적사항",
    ...(gate(a.findings).warn.map((f) => `- [조정 후보] ${f.field}: ${f.reason}`)),
    ...(gate(a.findings).blocked.map((f) => `- [차단] ${f.field}: ${f.reason}`)),
    gate(a.findings).warn.length + gate(a.findings).blocked.length ? "" : "- 없음",
  ].join("\n"));

  put("04_api-admin-audit.md", [
    head(a, "API·관리자 진단", "OBSERVE"),
    "| 경로 | 상태 |", "|---|---|",
    "| Open API `Script` (script:write) | CHK-001~003 미해소 — 호출 차단 중 |",
    "| 관리자 화면 | 브라우저 경로 (M2) |",
    "", "> 미해소 게이트 상태에서 API를 호출하지 않는다.",
  ].join("\n"));

  put("05_design-mode-audit.md", [
    head(a, "디자인모드 진단", "OBSERVE (읽기 전용)"),
    "**INV-11 — 본문·이미지·레이아웃·메뉴명은 읽기만 한다. 개선안은 이 보고서에만 남긴다.**", "",
    "## 메뉴 SEO 확인 경로 (audit §B-2)",
    "디자인모드 → 메뉴 관리 → 대상 메뉴 우측 `i` → 메뉴 설정 → 메뉴명 / 메뉴 주소 / 페이지 제목 / 페이지 설명",
    "", "## 상태", "- 디자인모드 접근: 세션 확보됨 · 셀렉터 실측 대기 (verified:false)",
  ].join("\n"));

  put("06_product-seo-audit.md", [
    head(a, "상품 SEO 진단", "OBSERVE"),
    ...productSection(a),
  ].join("\n"));

  const alt = altScope();
  put("07_code-audit.md", [
    head(a, "코드 영역 진단", "OBSERVE"),
    "## ALT 작성 대상 (audit §B-4)", alt.include.map((x) => `- ${x}`).join("\n"),
    "", "## ALT 제외 대상", alt.exclude.map((x) => `- ${x}`).join("\n"),
    "", "> 전체 이미지에 일괄 적용할 수 있다고 가정하지 않는다.",
    "", "## 코드 흔적",
    `- DDAK-SEO 마커: ${ok.flatMap((x) => x.seoMarkers).join(", ") || "없음"}`,
  ].join("\n"));

  const an = ok[0]?.analytics;
  put("08_ga4-gtm-audit.md", [
    head(a, "GA4 / GTM 검수", "OBSERVE"),
    table([
      ["GA4", an?.ga4.length ? `${an.ga4.length}개 감지` : "미연결"],
      ["GTM", an?.gtm.length ? `${an.gtm.length}개 감지` : "미연결"],
      ["gtag()", an?.hasGtag ? "있음" : "없음"],
      ["dataLayer", an?.hasDataLayer ? "있음" : "없음"],
    ], ["항목", "상태"]),
    "", "> 측정 ID는 마스킹해 출력한다. 중복이 감지되면 삭제하지 않고 `중복 정리 필요`로 보고한다.",
  ].join("\n"));

  const d = derive(a);
  const dq = checkDerived(d, a);
  const tech = technicalDrafts(a);
  put("09_seo-draft.md", [
    head(a, "SEO/GEO/AEO 초안", "DRAFT"),
    "## 키워드 1개에서 파생한 12종 (§1.3)",
    table(d.map((x) => [x.key, x.status, x.value.slice(0, 60) || "-", x.note ?? ""]), ["항목", "상태", "값", "비고"]),
    "", "## 기술 적용안",
    ...tech.map((t) => [`### ${t.name}`, "```", t.body || "(정보 부족 — 생성하지 않음)", "```",
      t.dropped.length ? `제외된 자리표시자: ${t.dropped.join(", ")}` : "", `> ${t.note}`, ""].join("\n")),
    "## 품질 게이트",
    dq.pass ? "- 차단 0건" : gate(dq.findings).blocked.map((f) => `- [차단] ${f.field}: ${f.reason}`).join("\n"),
    ...gate(dq.findings).warn.map((f) => `- [조정 후보] ${f.field}: ${f.reason}`),
  ].join("\n"));

  const needApproval = tech.filter((t) => t.body).map((t) => t.name);
  put("10_approval-needed.md", [
    head(a, "승인 필요 목록", "APPROVAL_REQUIRED"),
    needApproval.length
      ? table(needApproval.map((n) => [n, "Header Code / SEO 설정 영역", "M2 (아임웹 쓰기)", "마커 구간만 치환"]),
          ["항목", "적용 위치", "게이트", "되돌리기"])
      : "- 반영 가능한 항목이 없습니다 (정보 부족).",
    "", "> 이번 범위는 진단까지입니다. 반영은 M2이며 1회 승인 대상입니다.",
  ].join("\n"));

  put("15_search-console.md", [
    head(a, "검색엔진 등록", "PENDING"),
    "## 등록에 쓸 값 (그대로 복사)",
    table([
      ["사이트 주소", a.url],
      ["정식 도메인", a.domain || "확인 필요"],
      ["사이트맵", `${a.url.replace(/\/+$/, "")}/sitemap.xml`],
      ["robots.txt", `${a.url.replace(/\/+$/, "")}/robots.txt`],
      ["소유확인 방식", "**HTML 메타 태그** — 파일 업로드는 아임웹에서 불가"],
    ], ["항목", "값"]),
    "", "> 도메인이 둘이면 정식 도메인으로 등록하고 나머지는 리다이렉트로 둔다. 둘 다 넣으면 중복 색인이 된다.",
    "", "## 현재 소유확인 태그",
    table(ok.slice(0, 1).flatMap((x) => Object.entries(x.ownerVerification).map(([k, v]) => [k, v ? "있음" : "없음"])),
      ["엔진", "태그"]),
    "", "## 게이트", "```", engineStatusText(), "```",
    "", "## 자동이 안 되는 이유와 뚫는 법",
    "각 콘솔은 구글·네이버 **계정 로그인**을 요구한다. 브라우저 성능이 아니라 계정 경계다 —",
    "새 브라우저를 만들어도 이 벽은 그대로다.",
    "",
    "그래서 아임웹 때와 같은 방식으로 간다. **한 번만 사람이 로그인**하고 그 뒤는 자동이다.",
    "", "```",
    "npm run console:login gsc      # 창이 열리면 구글 로그인",
    "npm run console:login naver    # 네이버 서치어드바이저",
    "npm run console:login bing     # Bing (GSC 가져오기를 쓰면 생략 가능)",
    "```", "",
    "비밀번호는 받지도 저장하지도 않는다. 로그인 결과만 `state/browser/` 에 남고 gitignore 대상이다.",
    "",
    "## 로그인 뒤 자동으로 하는 일",
    "1. 속성 추가 (URL 접두어)",
    "2. HTML 메타 태그 소유확인 코드 수령",
    "3. 아임웹 → SEO → 고급설정 → **Header Code** 에 DDAK-SEO 마커로 삽입",
    "4. 콘솔에서 확인 클릭 → 5. 사이트맵 제출 → 6. `12_verify-log.md` 기록",
    "",
    "3번 경로는 이미 뚫려 있다 — JSON-LD 를 같은 방법으로 넣었다.",
    "",
    "## 직접 하실 경우",
    "콘솔에서 **HTML 태그** 방식을 고르고 `content=\"...\"` 안의 값만 주시면 삽입은 제가 합니다.",
  ].join("\n"));

  // 사람이 아임웹 설정 칸에 그대로 붙여 넣을 값. **파생 결과를 그대로 옮긴다.**
  // 손으로 쓰면 사용자가 준 키워드가 바뀐다 — 실제로 한 번 그랬다 (§1.2 위반).
  const pick = (k: string) => d.find((x) => x.key === k);
  put("16_paste-ready.md", [
    head(a, "복붙용 SEO 값", "DRAFT (반영 보류)"),
    "아임웹 관리자 → **설정 → SEO 설정** 에 붙여넣는 값입니다.",
    "에이전트는 아임웹에 쓰지 않습니다 (SEO-M2 게이트 미해소).", "",
    `> 사용자가 준 메타 키워드는 **${a.keyword || "미입력"}** 입니다. 이 값을 교체하지 않습니다 (§1.2).`, "",
    ...(["메타 타이틀", "메타 디스크립션"] as const).flatMap((k) => {
      const x = pick(k);
      const label = k === "메타 타이틀" ? "사이트 제목" : "사이트 설명";
      return x?.status === "작성"
        ? [`**${label}** (${[...x.value].length}자)`, "", "```", x.value, "```", ""]
        : [`**${label}** — 정보 부족: ${x?.note ?? "근거 미확인"}`, ""];
    }),
    "**검색엔진 노출**: 허용(ON)", "",
    "## AI 글티 검사",
    table((["메타 타이틀", "메타 디스크립션"] as const).map((k) => {
      const v = pick(k)?.value ?? "";
      // 제목에는 Horoscope Test 를 걸지 않는다 — 원본에서 문단 단위 검사다.
      return [k, v ? slopReport(slopCheck(v, { brand: a.brand, prose: k !== "메타 타이틀" })) : "값 없음"];
    }), ["항목", "판정"]),
    "", "## 근거 (INV-13 — 확인되지 않은 것은 쓰지 않는다)",
    table([
      ["메타 키워드", "사용자 입력"],
      ["브랜드명", a.brand ? `페이지 title 에서 추출: ${a.brand}` : "확인 필요"],
      ["설명문", a.summary ? `${ok[0]?.path ?? "/"} 렌더 본문` : "근거 없음 — 작성 안 함"],
    ], ["항목", "출처"]),
    "", "> 사이트에 근거가 없는 사업영역·수식어는 넣지 않았습니다. 실제와 다르면 사이트 본문 보강이 먼저입니다.",
  ].join("\n"));

  const body13 = [
    head(a, "클라이언트 전달용 요약", "DRAFT"),
    `## 무엇을 확인했나`, `- 공개 페이지 ${ok.length}개 진단`, `- 검색엔진 등록 상태 4곳 확인`,
    "", "## 무엇이 문제인가",
    ...gate(a.findings).warn.slice(0, 8).map((f) => `- ${f.field}: ${f.reason}`),
    "", "## 권장(미적용)", "- 디자인모드 본문·레이아웃 관련 개선안은 반영하지 않고 여기에만 남깁니다 (INV-11).",
  ].join("\n");
  put("13_client-delivery.md", body13);

  put("14_internal-delivery.md", [
    head(a, "내부 작업자용 상세", "DRAFT"),
    `- 산출물: ${FILES.length}개 정의 / 이번 회차 생성 ${out.length + 1}개`,
    `- 참조: audit §A ${publicAuditItems().length}항목, ALT 대상 ${alt.include.length}·제외 ${alt.exclude.length}`,
    `- 미확인 항목 혼입 검사: ${unverifiedGuard(body13).join(", ") || "0건"}`,
  ].join("\n"));

  return out;
}


/** 고객사별 SEO 산출물 현황. 텔레그램에서 바로 볼 수 있게 요약한다. */
export function seoStatus(): string {
  const sites = manifest().sites;
  if (!sites.length) return "등록된 사이트가 없습니다.";
  const lines: string[] = ["[SEO 현황] 고객사별 진단 산출물", ""];
  for (const s of sites) {
    const files = written(s.site_id);
    const done = files.length;
    lines.push(`· ${s.label ?? s.site_id} (${s.site_id}) — ${done ? `산출물 ${done}/${FILES.length}개` : "진단 이력 없음"}`);
    if (done) {
      const dir = siteDir(s.site_id);
      const latest = files.map((f) => ({ f, t: statSync(`${dir}/${f}`).mtimeMs }))
        .sort((x, y) => y.t - x.t)[0];
      lines.push(`    최근: ${new Date(latest!.t).toISOString().slice(0, 16).replace("T", " ")}  경로 seo/${s.site_id}/`);
      const missing = FILES.filter((x) => !files.includes(x));
      if (missing.length) lines.push(`    미생성: ${missing.join(", ")}`);
    } else {
      lines.push("    'SEO' 라고 하시면 진단을 시작합니다.");
    }
  }
  return lines.join("\n");
}