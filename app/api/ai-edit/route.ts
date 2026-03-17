import { NextRequest } from "next/server";

// ╔══════════════════════════════════════════════════════════════════╗
// ║  StoryKit API Route — Dual Model + Streaming                    ║
// ║  ① Gemini 2.5 Flash  : 스토리보드 JSON 생성 / 슬라이드 편집     ║
// ║  ② Nano Banana 2     : 슬라이드 배경 이미지 생성 (선택적)        ║
// ║  ③ Streaming         : Vercel 타임아웃 우회                     ║
// ╚══════════════════════════════════════════════════════════════════╝

// ── Vercel 타임아웃 설정 (Hobby 최대 60초, Pro 300초) ─────────────
export const maxDuration = 60;

// ──────────────────────────────────────────────────────────────────
// 모델 & 엔드포인트 설정
// ──────────────────────────────────────────────────────────────────
const MODELS = {
  text:  "gemini-2.5-flash",
  image: "gemini-3.1-flash-image-preview", // Nano Banana 2
} as const;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const API_KEY  = process.env.GOOGLE_AI_API_KEY ?? "";

const endpoint = (model: string) =>
  `${API_BASE}/${model}:generateContent?key=${API_KEY}`;

// ──────────────────────────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────────────────────────
interface SlideElement {
  id: string;
  order: number;
  type: string;
  text?: string;
  items?: string[];
  style?: string;
  active?: number;
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

// ──────────────────────────────────────────────────────────────────
// 스트리밍 헬퍼 — SSE 이벤트 포맷
// ──────────────────────────────────────────────────────────────────
// 프론트엔드에서는 EventSource 또는 fetch + ReadableStream으로 수신
// 이벤트 타입:
//   progress  : { message: string }           — 진행 상황 텍스트
//   result    : { data: Storyboard | object } — 최종 결과
//   error     : { message: string }           — 오류
//   done      : {}                            — 스트림 종료

function sseEvent(type: string, payload: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

// ──────────────────────────────────────────────────────────────────
// 시스템 프롬프트
// ──────────────────────────────────────────────────────────────────
const STORYBOARD_SYSTEM_PROMPT = `
너는 10년 이상 경력의 이러닝 교수설계자다.
ADDIE 모델과 Gagne의 9단계 교수 이론에 기반하여
대학 강의, 기업 교육, 공공기관 이러닝 콘텐츠의 스토리보드를 작성한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 슬라이드 설계 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 1슬라이드 = 1핵심개념 (인지 부하 최소화)
- 나레이션과 화면 요소는 반드시 연동 (멀티미디어 학습 이론)
- 텍스트는 키워드 중심, 문장 금지 (bullets는 10자 이내)
- 시각적 위계: 크기·색상·배치로 중요도 표현

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 차시 구성 5단계 (반드시 준수)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1단계 [도입]       layout: title_intro
2단계 [전개-개념]  layout: concept_circles 또는 tabs_sequential
3단계 [전개-심화]  layout: emphasis_definition 또는 image_caption
4단계 [확인]       layout: speech_bubble 또는 question_check
5단계 [정리]       layout: summary_dark

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 레이아웃 타입 8종
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A. concept_circles   — 병렬 개념 3~4개
B. tabs_sequential   — 번호탭 순차 강조
C. speech_bubble     — 교수-학생 대화
D. label_list        — 4개 이하 역할/요소
E. instructor_speech — 강사 직접 강조
F. image_caption     — 이미지 포함 슬라이드
G. split_two         — 2개 개념 좌우 대칭
H. summary_dark      — 차시 마무리 정리

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 나레이션 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 150~200자, 구어체 (~이에요, ~이랍니다)
- #0 = 장면전환, #1~#5 = 요소 등장 순서 (문장 앞에만)
- 마지막 문장은 다음 슬라이드 연결어

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## element type 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
heading(15자↓필수1개) subtitle_text bullets(10자↓)
circles(4자↓) emphasis(30자↓) question tabs label_list speech

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 품질 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
도입·정리 각 1개이상 / 나레이션 150자이상 / #1큐포함 /
elements 2개이상 / heading필수 / layout 8종 중 하나

## 출력 (순수 JSON만)
{
  "course_title":"","week":"","chapter":"",
  "index":[{"section":"","items":[]}],
  "pages":[{
    "page_id":"02_01_01_01","section":"","sub_section":"",
    "layout":"title_intro","status":"review",
    "slide":{"title":"","subtitle":"","elements":[
      {"id":"el-1","order":1,"type":"heading","text":""},
      {"id":"el-2","order":2,"type":"bullets","items":[]}
    ]},
    "screen_desc":"","narration":""
  }]
}
`.trim();

const EDIT_SYSTEM_PROMPT = `
너는 이러닝 스토리보드 편집 전문 AI다.
사용자 요청에 따라 슬라이드를 수정하고 JSON만 반환한다.
{ "summary":"수정 내용 한 줄 요약", "slide":{...}, "narration":"150~200자 구어체 #큐포함" }
`.trim();

const IMAGE_PROMPT_SYSTEM = `
이러닝 슬라이드용 Nano Banana 2 영문 이미지 프롬프트 생성.
16:9 교육용 배경, 텍스트 오버레이 여백 확보 (좌측 1/3).
레이아웃별: title_intro→geometric bright, concept_circles→flow icons,
tabs_sequential→step gradient, speech_bubble→soft gradient,
split_two→contrast left/right, summary_dark→dark professional.
50~80단어 영어, JSON만: { "prompt":"..." }
`.trim();

// ──────────────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────────────
function cleanJson(raw: string): string {
  return raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
}

function safeParseJson<T>(text: string): T | null {
  try { return JSON.parse(cleanJson(text)) as T; }
  catch { return null; }
}

// ──────────────────────────────────────────────────────────────────
// Gemini 2.5 Flash 텍스트 호출
// ──────────────────────────────────────────────────────────────────
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
      generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini Text 오류: ${res.status} - ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ──────────────────────────────────────────────────────────────────
// Nano Banana 2 이미지 호출
// ──────────────────────────────────────────────────────────────────
async function callNanoBanana2(prompt: string): Promise<string> {
  const res = await fetch(endpoint(MODELS.image), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"], // IMAGE만 설정 시 오류
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

// ──────────────────────────────────────────────────────────────────
// 스토리보드 생성
// ──────────────────────────────────────────────────────────────────
async function generateStoryboard(pdfText: string): Promise<Storyboard | null> {
  const raw = await callGeminiText({
    systemPrompt: STORYBOARD_SYSTEM_PROMPT,
    userText: `아래 원고를 분석하여 교수설계 5단계에 따라 스토리보드 JSON을 생성해주세요.\n\n${pdfText.substring(0, 12000)}`,
    temperature: 0.4,
    maxOutputTokens: 8192,
  });
  return safeParseJson<Storyboard>(raw);
}

// ──────────────────────────────────────────────────────────────────
// 슬라이드 편집
// ──────────────────────────────────────────────────────────────────
async function editSlide(message: string, slideContext: unknown): Promise<string> {
  return callGeminiText({
    systemPrompt: EDIT_SYSTEM_PROMPT,
    userText: `현재 슬라이드:\n${JSON.stringify(slideContext, null, 2)}\n\n사용자 요청: ${message}`,
    temperature: 0.3,
    maxOutputTokens: 2048,
  });
}

// ──────────────────────────────────────────────────────────────────
// 슬라이드 이미지 생성 (2단계 파이프라인)
// ──────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────
// 메인 핸들러 — 스트리밍 SSE 응답
// ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(type, payload)));
      };

      try {
        const body = await req.json();
        const {
          mode, pdfText, message, slideContext, storyboard, targetPageIds,
        } = body;

        const resolvedMode: string =
          mode ?? (pdfText ? "generate" : message ? "edit" : "unknown");

        // ── generate ─────────────────────────────────────────────
        if (resolvedMode === "generate") {
          if (!pdfText) { send("error", { message: "pdfText 필요" }); controller.close(); return; }

          send("progress", { message: "원고 분석 중..." });
          const result = await generateStoryboard(pdfText);

          if (!result) { send("error", { message: "스토리보드 생성 실패" }); controller.close(); return; }

          send("result", { data: result });
          send("done", {});
          controller.close();
          return;
        }

        // ── generate_with_images ──────────────────────────────────
        if (resolvedMode === "generate_with_images") {
          if (!pdfText) { send("error", { message: "pdfText 필요" }); controller.close(); return; }

          send("progress", { message: "원고 분석 중..." });
          const board = await generateStoryboard(pdfText);
          if (!board) { send("error", { message: "스토리보드 생성 실패" }); controller.close(); return; }

          send("progress", { message: `스토리보드 완성 (${board.pages.length}슬라이드). 이미지 생성 중...` });

          // 슬라이드별 순차 처리 — 진행 상황을 실시간으로 전송
          const updatedPages: Page[] = [];
          for (let i = 0; i < board.pages.length; i++) {
            const page = board.pages[i];
            const shouldGenerate = !targetPageIds || targetPageIds.includes(page.page_id);

            if (shouldGenerate) {
              send("progress", { message: `이미지 생성 중 (${i + 1}/${board.pages.length}): ${page.slide.title}` });
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

        // ── image ─────────────────────────────────────────────────
        if (resolvedMode === "image") {
          if (slideContext) {
            send("progress", { message: "이미지 프롬프트 생성 중..." });
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
          send("error", { message: "slideContext 또는 storyboard 필요" });
          controller.close();
          return;
        }

        // ── edit ──────────────────────────────────────────────────
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

        send("error", { message: "알 수 없는 mode", validModes: ["generate", "generate_with_images", "image", "edit"] });
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
      // CORS 필요 시 아래 주석 해제
      // "Access-Control-Allow-Origin": "*",
    },
  });
}