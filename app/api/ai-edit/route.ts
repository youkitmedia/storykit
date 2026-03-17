import { NextRequest } from "next/server";

// ╔══════════════════════════════════════════════════════════════════╗
// ║  StoryKit API Route — Dual Model + Streaming                    ║
// ║  ① Gemini 2.5 Flash  : 스토리보드 JSON 생성 / 슬라이드 편집     ║
// ║  ② Nano Banana 2     : 슬라이드 배경 이미지 생성 (선택적)        ║
// ╚══════════════════════════════════════════════════════════════════╝

export const maxDuration = 60; // Hobby 최대 60초

const MODELS = {
  text:  "gemini-2.5-flash",
  image: "gemini-3.1-flash-image-preview",
} as const;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const API_KEY  = process.env.GOOGLE_AI_API_KEY ?? "";
const endpoint = (model: string) =>
  `${API_BASE}/${model}:generateContent?key=${API_KEY}`;

// ── 타입 ──────────────────────────────────────────────
interface SlideElement {
  id: string;
  order: number;
  type: string;
  text?: string;
  items?: string[];
  style?: string;
  active?: number;
  cue?: number; // ★ 핵심: 나레이션 #큐 번호와 1:1 매칭
}

interface Slide {
  title: string;
  subtitle?: string;
  elements: SlideElement[];
}

interface Page {
  page_id: string;
  section: string;
  sub_section: string;
  layout: string;
  status: string;
  slide: Slide;
  screen_desc: string;
  narration: string;
  background_image?: string;
  image_prompt?: string;
}

interface Storyboard {
  course_title: string;
  week: string;
  chapter: string;
  index: { section: string; items: string[] }[];
  pages: Page[];
}

// ── SSE 헬퍼 ──────────────────────────────────────────
function sseEvent(type: string, payload: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

// ── 시스템 프롬프트 ───────────────────────────────────
const STORYBOARD_SYSTEM_PROMPT = `
너는 10년 이상 경력의 이러닝 교수설계자다.
ADDIE 모델과 Gagne의 9단계 교수 이론에 기반하여 스토리보드를 작성한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 가장 중요한 규칙: 나레이션 #큐와 element cue 1:1 매칭
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
나레이션에 #0, #1, #2, #3 큐를 삽입하고,
각 element에 반드시 cue 필드를 추가한다.
나레이션의 #N이 등장할 때 cue:N인 element가 화면에 나타난다.

올바른 예시:
  narration: "#0 화면 활성화. #1 타이포그래피는 활자를 가지고 디자인하는 기술이에요. #2 여기서 핵심 단어는 바로 기술이랍니다."
  elements:
    { type:"emphasis", cue:1, text:"타이포그래피는 활자를 가지고 디자인하는 기술을 말한다." }
    { type:"bullets",  cue:2, items:["기술: 숙련·원리·반복"] }

잘못된 예시 (절대 금지):
  elements에 cue 필드 없음 → 화면과 나레이션 타이밍 불일치

큐 규칙:
  #0 = 장면 전환/강사 등장 (cue:0 element 없어도 됨)
  #1~#5 = 각 element 등장 타이밍
  문장 앞에만 위치 ("#1 설명..." O / "설명 #1..." X)
  연속 큐 금지 ("#1 #2 두 가지" X)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 차시 구성 5단계
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1단계 [도입]       layout: title_intro        (학습목표, 동기유발)
2단계 [전개-개념]  layout: concept_circles    (병렬 개념 3~4개)
                   또는   tabs_sequential      (순차 3개)
3단계 [전개-심화]  layout: emphasis_definition (핵심 정의 강조)
                   또는   image_caption        (이미지+설명)
4단계 [확인]       layout: speech_bubble      (질문 유도)
5단계 [정리]       layout: summary_dark       (핵심 3가지 요약)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 레이아웃 타입 8종
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
concept_circles  — 병렬 개념 3~4개 원형
tabs_sequential  — 번호탭 순차 강조
speech_bubble    — 질문-답변 말풍선
label_list       — 4개 이하 라벨 목록
instructor_speech — 강사 강조 메시지
image_caption    — 이미지+번호+설명
split_two        — 좌우 2개 대비
summary_dark     — 다크 배경 정리

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 나레이션 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 150~200자, 구어체 (~이에요, ~이랍니다, ~해요)
- #0~#5 큐 삽입 (문장 앞, 연속 금지)
- 마지막 문장: 다음 슬라이드 연결어
- 도입: "이번 시간에는 ~을 살펴보겠습니다"
- 정리: "정리하겠습니다"로 시작

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## element type 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
heading(15자↓, 필수1개, cue 생략가능)
subtitle_text(보조설명, 한줄)
circles(items: 2~4자 핵심어)
bullets(items: 10자↓)
emphasis(30자↓ 1문장, 핵심 정의)
question("~인가요?" / "~일까요?")
tabs(items: 탭 라벨)
label_list(items: 라벨 텍스트)
speech(대화체 문장)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 품질 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 모든 element에 cue 필드 포함 (heading 제외 가능)
- 나레이션의 #N 개수 = cue가 있는 element 수
- 도입/정리 슬라이드 각 1개 이상
- 나레이션 150자 이상, #1 큐 포함
- elements 최소 2개, heading 필수

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 출력 JSON 스키마 (순수 JSON만)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "course_title": "과정명",
  "week": "2주차",
  "chapter": "1차시",
  "index": [{ "section": "섹션명", "items": ["항목1","항목2"] }],
  "pages": [
    {
      "page_id": "02_01_01_01",
      "section": "섹션명",
      "sub_section": "소섹션명",
      "layout": "title_intro",
      "status": "review",
      "slide": {
        "title": "슬라이드 제목 (15자 이내)",
        "subtitle": "서브 제목",
        "elements": [
          { "id":"el-1", "order":1, "type":"heading", "text":"핵심 제목" },
          { "id":"el-2", "order":2, "type":"emphasis", "cue":1, "text":"핵심 정의 문장" },
          { "id":"el-3", "order":3, "type":"bullets",  "cue":2, "items":["항목1","항목2"] }
        ]
      },
      "screen_desc": "화면 구성 설명",
      "narration": "#0 화면 활성화. #1 나레이션 첫 번째 요소 설명. #2 두 번째 요소 설명. 다음 슬라이드 연결어."
    }
  ]
}
`.trim();

const EDIT_SYSTEM_PROMPT = `
너는 이러닝 스토리보드 편집 전문 AI다.
나레이션의 #큐 번호와 element의 cue 필드가 반드시 1:1 매칭되어야 한다.
JSON만 반환:
{
  "summary": "수정 내용 한 줄 요약",
  "slide": { ...수정된 슬라이드 (모든 element에 cue 포함)... },
  "narration": "수정된 나레이션 (#큐와 cue가 정확히 매칭)"
}
`.trim();

const IMAGE_PROMPT_SYSTEM = `
이러닝 슬라이드 배경 이미지용 Nano Banana 2 영문 프롬프트 생성.
16:9 교육용 배경, 텍스트 여백 확보 (좌측 1/3).
레이아웃별 스타일:
  title_intro→bright geometric clean
  concept_circles→connected circles flow abstract
  tabs_sequential→horizontal step gradient
  speech_bubble→soft dialogue gradient
  split_two→contrasting left-right color
  summary_dark→dark professional closing
  image_caption→realistic educational photo center
  instructor_speech→warm motivational
50~80단어 영어. JSON만: { "prompt":"..." }
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

// ── Nano Banana 2 이미지 호출 ─────────────────────────
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
  return parts.find((p) => p.inlineData)?.inlineData?.data ?? "";
}

// ── 스토리보드 생성 ───────────────────────────────────
async function generateStoryboard(pdfText: string): Promise<Storyboard | null> {
  const raw = await callGeminiText({
    systemPrompt: STORYBOARD_SYSTEM_PROMPT,
    userText: `아래 원고를 분석하여 교수설계 5단계에 따라 스토리보드 JSON을 생성해주세요.
모든 element에 반드시 cue 필드를 포함하고, 나레이션의 #큐 번호와 정확히 매칭하세요.

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

// ── 슬라이드 이미지 생성 ──────────────────────────────
async function generateSlideImage(page: Page): Promise<{ base64: string; prompt: string }> {
  const rawPrompt = await callGeminiText({
    systemPrompt: IMAGE_PROMPT_SYSTEM,
    userText: `제목:${page.slide.title} / 레이아웃:${page.layout} / 섹션:${page.section} / 요소:${
      page.slide.elements.map((e) => e.text ?? e.items?.join(",") ?? "").join("|")
    }`,
    temperature: 0.7,
    maxOutputTokens: 200,
  });
  const promptData = safeParseJson<{ prompt: string }>(rawPrompt);
  const imagePrompt = promptData?.prompt ??
    `Professional educational slide background for "${page.slide.title}", 16:9, clean modern, text space left third`;
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

        // ── generate ────────────────────────────────────
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

        // ── generate_with_images ─────────────────────────
        if (resolvedMode === "generate_with_images") {
          if (!pdfText) { send("error", { message: "pdfText 필요" }); controller.close(); return; }
          send("progress", { message: "원고 분석 중..." });
          const board = await generateStoryboard(pdfText);
          if (!board) { send("error", { message: "스토리보드 생성 실패" }); controller.close(); return; }
          send("progress", { message: `스토리보드 완성 (${board.pages.length}슬라이드). 이미지 생성 시작...` });

          const updatedPages: Page[] = [];
          for (let i = 0; i < board.pages.length; i++) {
            const page = board.pages[i];
            const shouldGenerate = !targetPageIds || targetPageIds.includes(page.page_id);
            if (shouldGenerate) {
              send("progress", { message: `이미지 생성 중 (${i + 1}/${board.pages.length}): ${page.slide.title}` });
              try {
                const { base64, prompt } = await generateSlideImage(page);
                updatedPages.push({ ...page, background_image: base64, image_prompt: prompt });
              } catch {
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

        // ── image ────────────────────────────────────────
        if (resolvedMode === "image") {
          if (slideContext) {
            send("progress", { message: "이미지 생성 중..." });
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

        // ── edit ─────────────────────────────────────────
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

        send("error", { message: "알 수 없는 mode" });
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}