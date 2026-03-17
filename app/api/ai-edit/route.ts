import { NextRequest } from "next/server";

// ╔══════════════════════════════════════════════════════════════════╗
// ║  StoryKit API Route                                             ║
// ║  ① Gemini 2.5 Flash  : 스토리보드 JSON 생성 / 슬라이드 편집     ║
// ║  ② Nano Banana 2     : 슬라이드 전체를 인포그래픽 이미지로 생성  ║
// ╚══════════════════════════════════════════════════════════════════╝

export const maxDuration = 60;

const MODELS = {
  text:  "gemini-2.5-flash",
  image: "gemini-3.1-flash-image-preview", // Nano Banana 2
} as const;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const API_KEY  = process.env.GOOGLE_AI_API_KEY ?? "";
const endpoint = (model: string) =>
  `${API_BASE}/${model}:generateContent?key=${API_KEY}`;

// ── 타입 ──────────────────────────────────────────────
interface SlideElement {
  id: string; order: number; type: string;
  text?: string; items?: string[];
  cue?: number; style?: string; active?: number;
}
interface Slide {
  title: string; subtitle?: string;
  layout: string; elements: SlideElement[];
}
interface Page {
  page_id: string; section: string; sub_section: string;
  layout: string; status: string;
  slide: Slide; screen_desc: string; narration: string;
  background_image?: string; image_prompt?: string;
}
interface Storyboard {
  course_title: string; week: string; chapter: string;
  index: { section: string; items: string[] }[];
  pages: Page[];
}

// ── SSE 헬퍼 ──────────────────────────────────────────
function sseEvent(type: string, payload: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

// ══════════════════════════════════════════════════════
// 슬라이드 전체 이미지 프롬프트 생성기
// 레이아웃 타입별로 실제 슬라이드 구성을 묘사
// ══════════════════════════════════════════════════════
function buildSlideImagePrompt(page: Page): string {
  const el      = page.slide.elements ?? [];
  const title   = page.slide.title ?? "";
  const subtitle = page.slide.subtitle ?? "";
  const layout  = page.layout ?? page.slide.layout ?? "";
  const narr    = page.narration ?? "";

  // 나레이션에서 큐 제거하고 하단 텍스트용으로 정리
  const narrClean = narr.replace(/#\d+\s*/g, "").trim().slice(0, 120);

  // element별 텍스트 추출
  const heading   = el.find(e => e.type === "heading")?.text ?? title;
  const subtitleEl = el.find(e => e.type === "subtitle_text")?.text ?? subtitle;
  const emphasis  = el.find(e => e.type === "emphasis")?.text ?? "";
  const question  = el.find(e => e.type === "question")?.text ?? "";
  const bullets   = el.find(e => e.type === "bullets")?.items ?? [];
  const circles   = el.find(e => e.type === "circles")?.items ?? [];
  const tabs      = el.find(e => e.type === "tabs")?.items ?? [];
  const labels    = el.find(e => e.type === "label_list")?.items ?? [];
  const speech    = el.find(e => e.type === "speech")?.text ?? "";

  // ── 공통 스타일 지시 ────────────────────────────────
  const BASE = [
    "Korean e-learning slide, 16:9 ratio, 1920x1080px",
    "white or very light gray background",
    "clean professional infographic style",
    "Noto Sans KR font, Korean text rendered accurately",
    "thin grid pattern background (light gray, subtle)",
    "instructor silhouette (simple gray human shape) on right side",
    "small 'StoryKit' watermark bottom-right corner",
  ].join(", ");

  // ── 나레이션 하단 박스 ──────────────────────────────
  const NARR_BOX = narrClean
    ? `dark navy narration bar at very bottom with white small text: "${narrClean}"`
    : "";

  // ── 레이아웃별 프롬프트 ─────────────────────────────

  // A. title_intro — 타이틀 + 학습목표
  if (layout === "title_intro") {
    const bulletItems = bullets.length > 0
      ? bullets.map((b, i) => `bullet point ${i + 1}: "${b}"`).join(", ")
      : "";
    return [
      BASE,
      `LAYOUT: title slide with large bold Korean title "${heading}" on left side`,
      subtitle ? `subtitle badge with dark background: "${subtitle}"` : "",
      subtitleEl ? `subtitle text: "${subtitleEl}"` : "",
      bulletItems
        ? `learning objectives box (dark background, white text): ${bulletItems}`
        : "",
      `right side: abstract geometric shapes (circles, rectangles) in black and red accent`,
      `top-left area has the main title text block`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // B. split_two — 좌우 2분할 원형
  if (layout === "split_two") {
    const [leftLabel, rightLabel] = circles.length >= 2
      ? [circles[0], circles[1]]
      : ["개념 A", "개념 B"];
    return [
      BASE,
      `LAYOUT: split two-column layout`,
      `bold Korean title at top-left: "${heading}"`,
      subtitle ? `subtitle badge below title: "${subtitle}"` : "",
      `left half: large circle with thick black border (white inside), bold text inside: "${leftLabel}"`,
      `right half: large circle with gray fill, bold text inside: "${rightLabel}"`,
      `between the two circles: large bold blue right-pointing arrow (→)`,
      `cue markers: "#1" red badge on left circle, "#2" red badge on right circle`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // C. concept_circles — 원형 프로세스
  if (layout === "concept_circles" || layout === "concept_bullets") {
    const circleList = circles.length > 0
      ? circles.map((c, i) => `circle ${i + 1} (${["blue", "green", "orange", "purple"][i % 4]} fill): "${c}"`).join(", ")
      : "";
    return [
      BASE,
      `LAYOUT: circular process diagram`,
      `bold title at top: "${heading}"`,
      subtitle ? `subtitle: "${subtitle}"` : "",
      circleList ? `row of connected circles with arrows between them: ${circleList}` : "",
      emphasis ? `conclusion emphasis box at bottom (yellow/amber background): "${emphasis}"` : "",
      `red cue badge "#1" on first circle`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // D. tabs_sequential — 번호탭 순차
  if (layout === "tabs_sequential") {
    const tabItems = tabs.length > 0
      ? tabs.map((t, i) => `tab ${i + 1}: "${t}"`).join(", ")
      : bullets.map((b, i) => `tab ${i + 1}: "${b}"`).join(", ");
    return [
      BASE,
      `LAYOUT: sequential numbered tabs`,
      `bold title at top-left: "${heading}"`,
      subtitle ? `subtitle in small text: "${subtitle}"` : "",
      emphasis ? `large emphasis banner (cyan/blue background, white bold text): "${emphasis}"` : "",
      tabItems
        ? `three vertical card boxes below: ${tabItems}, each with a numbered circle at top`
        : "",
      `cue markers: red "#1" on emphasis banner, "#2" "#3" "#4" on each tab card`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // E. emphasis_definition — 핵심 정의 강조
  if (layout === "emphasis_definition" || layout === "image_caption") {
    const bulletList = bullets.length > 0
      ? bullets.map((b, i) => `row ${i + 1}: "${b}"`).join(", ")
      : "";
    return [
      BASE,
      `LAYOUT: definition emphasis with side content`,
      `title at top: "${heading}"`,
      subtitle ? `subtitle: "${subtitle}"` : "",
      emphasis
        ? `large emphasis box (amber/yellow left border, light yellow background): bold text "${emphasis}"`
        : "",
      bulletList
        ? `numbered bullet rows (white cards with slight shadow): ${bulletList}`
        : "",
      `red cue badge "#1" on emphasis box, "#2" on bullet list`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // F. label_list — 연번 라벨 목록
  if (layout === "label_list") {
    const labelItems = labels.length > 0
      ? labels.map((l, i) => `label ${i + 1}: "${l}"`).join(", ")
      : bullets.map((b, i) => `label ${i + 1}: "${b}"`).join(", ");
    return [
      BASE,
      `LAYOUT: numbered label list`,
      `bold title at top: "${heading}"`,
      subtitle ? `subtitle: "${subtitle}"` : "",
      labelItems
        ? `four horizontal label buttons in a column: ${labelItems}. First label highlighted in green, others gray`
        : "",
      `red cue badge "#1" on first label`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // G. speech_bubble — 말풍선 자문자답
  if (layout === "speech_bubble" || layout === "question_check") {
    return [
      BASE,
      `LAYOUT: speech bubble Q&A`,
      `title at top: "${heading}"`,
      subtitle ? `subtitle: "${subtitle}"` : "",
      question
        ? `large question speech bubble (beige/white background): bold text "${question}"`
        : "",
      speech
        ? `answer speech bubble (green background, white text): "${speech}"`
        : emphasis
          ? `answer speech bubble (green background, white text): "${emphasis}"`
          : "",
      `red cue badge "#1" on question bubble, "#2" on answer bubble`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // H. instructor_speech — 강사 강조
  if (layout === "instructor_speech") {
    return [
      BASE,
      `LAYOUT: instructor speech full-width`,
      `very large italic bold text in center: "${heading}"`,
      subtitle ? `subtitle badge: "${subtitle}"` : "",
      speech ? `speech bubble box (white, rounded): "${speech}"` : "",
      emphasis ? `underlined emphasis text: "${emphasis}"` : "",
      `instructor silhouette larger and more prominent on right`,
      `red cue badge "#1" on main text`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // I. summary_dark — 다크 정리 슬라이드
  if (layout === "summary_dark") {
    const summaryItems = bullets.length > 0
      ? bullets.map((b, i) => `summary row ${i + 1} (beige card): "${b}"`).join(", ")
      : "";
    return [
      BASE,
      `LAYOUT: dark summary slide`,
      `DARK BACKGROUND: deep dark green (#1a3d2b) or very dark navy`,
      `white bold title at top-left: "${heading}"`,
      subtitle ? `light green subtitle: "${subtitle}"` : "",
      summaryItems
        ? `three beige/cream colored summary cards stacked vertically: ${summaryItems}`
        : "",
      `red "#1" "#2" "#3" cue badges on each card`,
      `circular instructor avatar (outline circle) on right side`,
      `overall dark professional closing slide feel`,
      NARR_BOX,
    ].filter(Boolean).join(". ");
  }

  // ── Fallback — 기본 프롬프트 ──────────────────────
  const allText = el.map(e => e.text ?? e.items?.join(", ") ?? "").filter(Boolean).join(" | ");
  return [
    BASE,
    `LAYOUT: general educational slide`,
    `title: "${heading}"`,
    subtitle ? `subtitle: "${subtitle}"` : "",
    allText ? `content elements: ${allText.slice(0, 200)}` : "",
    NARR_BOX,
  ].filter(Boolean).join(". ");
}

// ── 시스템 프롬프트 ───────────────────────────────────
const STORYBOARD_SYSTEM_PROMPT = `
너는 10년 이상 경력의 이러닝 교수설계자다.
ADDIE 모델과 Gagne의 9단계 교수 이론에 기반하여 스토리보드를 작성한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 핵심 규칙: 나레이션 #큐 ↔ element cue 1:1 매칭
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
나레이션: "#0 화면 등장. #1 첫 번째 요소 설명. #2 두 번째 요소 설명."
elements:  { type:"emphasis", cue:1, text:"..." }
           { type:"bullets",  cue:2, items:[...] }

큐 규칙:
  #0 = 장면전환/강사 등장
  #1~#5 = 화면 요소 등장 순서
  문장 앞에만 위치 / 연속 큐 금지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 차시 구성 5단계
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1단계 [도입]       layout: title_intro
2단계 [전개-개념]  layout: concept_circles / tabs_sequential
3단계 [전개-심화]  layout: emphasis_definition / image_caption
4단계 [확인]       layout: speech_bubble / question_check
5단계 [정리]       layout: summary_dark

레이아웃 타입 8종:
concept_circles / tabs_sequential / speech_bubble / label_list /
instructor_speech / image_caption / split_two / summary_dark

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 나레이션 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
150~200자, 구어체, #0~#5 큐 포함, 마지막 문장은 연결어

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## element type
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
heading(15자↓필수) subtitle_text emphasis(30자↓)
circles(4자↓) bullets(10자↓) question tabs label_list speech

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 출력 JSON (순수 JSON만)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "course_title":"","week":"","chapter":"",
  "index":[{"section":"","items":[]}],
  "pages":[{
    "page_id":"02_01_01_01",
    "section":"","sub_section":"",
    "layout":"title_intro","status":"review",
    "slide":{
      "title":"","subtitle":"",
      "elements":[
        {"id":"el-1","order":1,"type":"heading","text":""},
        {"id":"el-2","order":2,"type":"emphasis","cue":1,"text":""},
        {"id":"el-3","order":3,"type":"bullets","cue":2,"items":[]}
      ]
    },
    "screen_desc":"",
    "narration":"#0 화면 활성화. #1 설명. #2 설명. 다음 연결어."
  }]
}
`.trim();

const EDIT_SYSTEM_PROMPT = `
이러닝 스토리보드 편집 AI. 나레이션 #큐 ↔ element cue 1:1 매칭 유지.
JSON만 반환:
{"summary":"한 줄 요약","slide":{...cue 포함...},"narration":"...#큐 매칭..."}
`.trim();

// ── 유틸 ──────────────────────────────────────────────
function cleanJson(raw: string): string {
  return raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
}
function safeParseJson<T>(text: string): T | null {
  try { return JSON.parse(cleanJson(text)) as T; }
  catch { return null; }
}

// ── Gemini 2.5 Flash 텍스트 호출 ─────────────────────
async function callGeminiText({
  systemPrompt, userText, temperature = 0.4, maxOutputTokens = 8192,
}: {
  systemPrompt: string; userText: string;
  temperature?: number; maxOutputTokens?: number;
}): Promise<string> {
  const res = await fetch(endpoint(MODELS.text), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: {
        temperature, maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini Text 오류: ${res.status} - ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Nano Banana 2 이미지 생성 ─────────────────────────
async function callNanoBanana2(prompt: string): Promise<string> {
  const res = await fetch(endpoint(MODELS.image), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "16:9" },
      },
    }),
  });
  if (!res.ok) throw new Error(`Nano Banana 2 오류: ${res.status} - ${await res.text()}`);
  const data = await res.json();
  type Part = { text?: string; inlineData?: { data: string } };
  const parts: Part[] = data.candidates?.[0]?.content?.parts ?? [];
  return parts.find(p => p.inlineData)?.inlineData?.data ?? "";
}

// ── 스토리보드 생성 ───────────────────────────────────
async function generateStoryboard(pdfText: string): Promise<Storyboard | null> {
  const raw = await callGeminiText({
    systemPrompt: STORYBOARD_SYSTEM_PROMPT,
    userText: `아래 원고를 분석하여 교수설계 5단계에 따라 스토리보드 JSON을 생성해주세요.
모든 element에 cue 필드 포함, 나레이션 #큐와 정확히 매칭하세요.

원고:
${pdfText.substring(0, 12000)}`,
    temperature: 0.4,
    maxOutputTokens: 8192,
  });
  return safeParseJson<Storyboard>(raw);
}

// ── 슬라이드 편집 ─────────────────────────────────────
async function editSlide(message: string, slideContext: unknown): Promise<string> {
  return callGeminiText({
    systemPrompt: EDIT_SYSTEM_PROMPT,
    userText: `현재 슬라이드:\n${JSON.stringify(slideContext, null, 2)}\n\n사용자 요청: ${message}`,
    temperature: 0.3,
    maxOutputTokens: 2048,
  });
}

// ══════════════════════════════════════════════════════
// ★ 슬라이드 전체 이미지 생성
//   buildSlideImagePrompt()로 레이아웃별 상세 프롬프트 생성
//   → Nano Banana 2가 슬라이드 전체를 인포그래픽으로 그림
// ══════════════════════════════════════════════════════
async function generateSlideImage(page: Page): Promise<{ base64: string; prompt: string }> {
  const imagePrompt = buildSlideImagePrompt(page);
  console.log(`[이미지 생성] ${page.page_id} / layout: ${page.layout}`);
  console.log(`[프롬프트] ${imagePrompt.slice(0, 200)}...`);
  const base64 = await callNanoBanana2(imagePrompt);
  return { base64, prompt: imagePrompt };
}

// ── 메인 핸들러 ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(type, payload)));

      try {
        const body = await req.json();
        const { mode, pdfText, message, slideContext, storyboard, targetPageIds } = body;
        const resolvedMode: string =
          mode ?? (pdfText ? "generate" : message ? "edit" : "unknown");

        // ── generate ──────────────────────────────────
        if (resolvedMode === "generate") {
          if (!pdfText) { send("error", { message: "pdfText 필요" }); controller.close(); return; }
          send("progress", { message: "원고 분석 중..." });
          const result = await generateStoryboard(pdfText);
          if (!result) { send("error", { message: "스토리보드 생성 실패" }); controller.close(); return; }
          send("progress", { message: `스토리보드 완성 (${result.pages.length}슬라이드)` });
          send("result", { data: result });
          send("done", {});
          controller.close();
          return;
        }

        // ── generate_with_images ───────────────────────
        if (resolvedMode === "generate_with_images") {
          if (!pdfText) { send("error", { message: "pdfText 필요" }); controller.close(); return; }
          send("progress", { message: "원고 분석 중..." });
          const board = await generateStoryboard(pdfText);
          if (!board) { send("error", { message: "스토리보드 생성 실패" }); controller.close(); return; }
          send("progress", { message: `스토리보드 완성. 슬라이드 이미지 생성 시작...` });

          const updatedPages: Page[] = [];
          for (let i = 0; i < board.pages.length; i++) {
            const page = board.pages[i];
            const shouldGenerate = !targetPageIds || targetPageIds.includes(page.page_id);
            if (shouldGenerate) {
              send("progress", { message: `슬라이드 이미지 생성 중 (${i + 1}/${board.pages.length}): ${page.slide.title}` });
              try {
                const { base64, prompt } = await generateSlideImage(page);
                updatedPages.push({ ...page, background_image: base64, image_prompt: prompt });
              } catch (err) {
                console.warn(`[이미지 실패] ${page.page_id}:`, err);
                updatedPages.push(page);
              }
            } else {
              updatedPages.push(page);
            }
          }
          send("result", { data: { ...board, pages: updatedPages } });
          send("done", {});
          controller.close();
          return;
        }

        // ── image (단일 슬라이드 or 전체) ─────────────
        if (resolvedMode === "image") {
          if (slideContext) {
            send("progress", { message: "슬라이드 이미지 생성 중..." });
            const { base64, prompt } = await generateSlideImage(slideContext as Page);
            send("result", { data: { background_image: base64, image_prompt: prompt } });
            send("done", {});
            controller.close();
            return;
          }
          if (storyboard) {
            const board = storyboard as Storyboard;
            const updatedPages: Page[] = [];
            for (let i = 0; i < board.pages.length; i++) {
              const page = board.pages[i];
              const shouldGenerate = !targetPageIds || targetPageIds.includes(page.page_id);
              if (shouldGenerate) {
                send("progress", { message: `이미지 생성 중 (${i + 1}/${board.pages.length}): ${page.slide.title}` });
                try {
                  const { base64, prompt } = await generateSlideImage(page);
                  updatedPages.push({ ...page, background_image: base64, image_prompt: prompt });
                } catch { updatedPages.push(page); }
              } else {
                updatedPages.push(page);
              }
            }
            send("result", { data: { ...board, pages: updatedPages } });
            send("done", {});
            controller.close();
            return;
          }
          send("error", { message: "slideContext 또는 storyboard 필요" });
          controller.close();
          return;
        }

        // ── edit ──────────────────────────────────────
        if (resolvedMode === "edit") {
          if (!message) { send("error", { message: "message 필요" }); controller.close(); return; }
          send("progress", { message: "슬라이드 수정 중..." });
          const raw = await editSlide(message, slideContext);
          const parsed = safeParseJson(raw);
          send("result", { data: parsed ?? raw });
          send("done", {});
          controller.close();
          return;
        }

        send("error", { message: "알 수 없는 mode", validModes: ["generate","generate_with_images","image","edit"] });
        controller.close();

      } catch (err) {
        console.error("API Error:", err);
        controller.enqueue(encoder.encode(
          sseEvent("error", { message: err instanceof Error ? err.message : String(err) })
        ));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}