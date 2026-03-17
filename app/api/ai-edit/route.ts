import { NextRequest, NextResponse } from "next/server";

// ╔══════════════════════════════════════════════════════════════════╗
// ║  StoryKit API Route — Dual Model Architecture                   ║
// ║  ① Gemini 2.5 Flash  : 스토리보드 JSON 생성 / 슬라이드 편집     ║
// ║  ② Nano Banana 2     : 슬라이드 배경 이미지 생성 (선택적)        ║
// ╚══════════════════════════════════════════════════════════════════╝

// ──────────────────────────────────────────────────────────────────
// 모델 & 엔드포인트 설정
// ──────────────────────────────────────────────────────────────────
const MODELS = {
  text:  "gemini-2.5-flash",               // 스토리보드 생성 / 편집
  image: "gemini-3.1-flash-image-preview", // Nano Banana 2
} as const;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const API_KEY  = process.env.GOOGLE_AI_API_KEY ?? "";

const endpoint = (model: string) =>
  `${API_BASE}/${model}:generateContent?key=${API_KEY}`;

// ──────────────────────────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────────────────────────
interface Element {
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
  elements: Element[];
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
  background_image?: string; // base64 PNG — Nano Banana 2 생성
  image_prompt?: string;     // 디버깅용 프롬프트
}

interface Storyboard {
  course_title: string;
  week: string;
  chapter: string;
  index: { section: string; items: string[] }[];
  pages: Page[];
}

// ──────────────────────────────────────────────────────────────────
// 시스템 프롬프트 — SKILL.md + narration-rules.md + layout-types.md 통합
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
                   학습목표 제시, 동기유발 질문
                   나레이션: "이번 시간에는 ~을 학습합니다"

2단계 [전개-개념]  layout: concept_circles (병렬) 또는 tabs_sequential (순차)
                   핵심 개념 3~4개 병렬 또는 순차 제시

3단계 [전개-심화]  layout: emphasis_definition 또는 image_caption
                   핵심 정의 강조, 예시 제시

4단계 [확인]       layout: speech_bubble 또는 question_check
                   중간 점검 질문 1개, 학습자 사고 유도

5단계 [정리]       layout: summary_dark
                   핵심 3가지 요약, "정리하겠습니다"로 나레이션 시작

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 레이아웃 타입 8종
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A. concept_circles   — 병렬 개념 3~4개, 순환/프로세스 구조
   elements: { type:"circles", items:["개념1","개념2","개념3"] }
             { type:"emphasis", text:"핵심 결론 문장" }

B. tabs_sequential   — 번호탭 순차 강조, 3개 하위항목
   elements: { type:"heading", text:"대제목" }
             { type:"tabs", items:["탭1","탭2","탭3"], active:0 }
             { type:"bullets", items:["항목1","항목2"] }

C. speech_bubble     — 교수-학생 대화, 질문 제시 후 답변
   elements: { type:"question", text:"질문 문장?" }
             { type:"speech", text:"답변 내용", style:"answer" }

D. label_list        — 4개 이하 역할/요소 순서 설명
   elements: { type:"label_list", items:["항목1","항목2","항목3","항목4"], active:0 }
             { type:"bullets", items:["설명1","설명2"] }

E. instructor_speech — 강사 직접 강조, 핵심 메시지, 동기부여
   elements: { type:"heading", text:"핵심 메시지!", style:"large_italic" }
             { type:"speech", text:"설명 내용" }

F. image_caption     — 실제 사례 사진, 이미지 포함 슬라이드
   elements: { type:"heading", text:"핵심 제목" }
             { type:"bullets", items:["설명1","설명2"] }
   screen_desc에 이미지 번호 또는 설명 기재 필수

G. split_two         — 2개 개념 대비/병렬 비교, 좌우 대칭
   elements: { type:"circles", items:["개념A","개념B"], style:"split_large" }

H. summary_dark      — 차시/섹션 마무리, 핵심 3가지 요약
   elements: { type:"heading", text:"정리 제목" }
             { type:"bullets", items:["핵심1","핵심2","핵심3"] }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 나레이션 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
길이: 150~200자 (초당 6자, 약 25~33초)
문체: 구어체 강의 말투
  - ~입니다 → ~이에요 / ~이랍니다
  - ~하게 됩니다 → ~하게 돼요
마무리: 다음 슬라이드 연결어 필수

큐(Cue) 표기:
  #0 = 장면 전환, 섹션 시작
  #1 = 첫 번째 화면 요소 등장
  #2~#5 = 이후 요소 순서대로
  올바른 예: "#1 첫 번째는..." (문장 앞)
  금지 예: "첫 번째가 #1 중요" (문장 중간)
  금지 예: "#1 #2 두 가지" (연속 큐)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## element type 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
heading      — 15자 이내, 슬라이드당 1개 필수
subtitle_text — 보조 설명, 한 줄
circles      — items: 2~4자 핵심어만
bullets      — items: 10자 이내
emphasis     — 30자 이내 1문장
question     — "~인가요?" / "~일까요?" 형태
tabs         — items: 탭 라벨 배열
label_list   — items: 라벨 텍스트 배열
speech       — 대화체 문장

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 품질 체크리스트 (미충족 시 자동 수정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 차시당 [도입] 슬라이드 1개 이상
- 차시당 [정리] 슬라이드 1개 이상
- 나레이션 150자 이상 (전 페이지)
- 나레이션에 #1 큐 포함 (전 페이지)
- elements 최소 2개 이상
- heading 타입 반드시 포함
- bullets items 10자 이내
- circles items 4자 이내
- layout 값이 8종 중 하나

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 출력 JSON 스키마 (순수 JSON만, { 로 시작 } 로 끝)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "course_title": "과정명",
  "week": "1주차",
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
          { "id": "el-1", "order": 1, "type": "heading", "text": "핵심 제목" },
          { "id": "el-2", "order": 2, "type": "bullets", "items": ["항목1","항목2"] }
        ]
      },
      "screen_desc": "화면 구성 설명",
      "narration": "#1 나레이션 (150~200자, 구어체)"
    }
  ]
}
`.trim();

const EDIT_SYSTEM_PROMPT = `
너는 이러닝 스토리보드 편집 전문 AI다.
사용자 요청에 따라 현재 슬라이드를 수정하고 반드시 JSON만 반환한다.
응답 형식:
{
  "summary": "수정 내용 한 줄 요약",
  "slide": { ...수정된 슬라이드 전체... },
  "narration": "수정된 나레이션 (150~200자, 구어체, #큐 포함)"
}
`.trim();

const IMAGE_PROMPT_SYSTEM = `
너는 이러닝 슬라이드용 이미지 프롬프트 전문가다.
슬라이드 정보를 분석해서 Nano Banana 2(gemini-3.1-flash-image-preview)용
영문 이미지 프롬프트를 생성한다.

규칙:
- 16:9 교육용 슬라이드 배경에 최적화
- 깔끔하고 전문적인 스타일 (corporate / educational)
- 텍스트 오버레이를 위한 여백 확보 (좌측 1/3 또는 상단 여백)
- 한국 교육 콘텐츠에 적합한 톤

레이아웃별 스타일 가이드:
  title_intro      → bright, clean geometric graphic background
  concept_circles  → connected circular icons, abstract flow graphic
  tabs_sequential  → horizontal step-flow background, gradient progression
  speech_bubble    → soft gradient, communication / dialogue feel
  image_caption    → relevant realistic or illustrated image center
  split_two        → contrasting left/right color background
  summary_dark     → dark professional background, closing feel
  label_list       → clean minimal background suggesting ordered list
  instructor_speech → warm, motivational background
  question_check   → light, open background suggesting thinking space

- 반드시 영어로만 출력
- 50~80단어 이내의 간결한 프롬프트
- JSON 형식으로만 출력: { "prompt": "..." }
`.trim();

// ──────────────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────────────
function cleanJson(raw: string): string {
  return raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(cleanJson(text)) as T;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────
// [공통] Gemini 2.5 Flash 텍스트 호출
// ──────────────────────────────────────────────────────────────────
async function callGeminiText({
  systemPrompt,
  userText,
  temperature = 0.4,
  maxOutputTokens = 8192,
}: {
  systemPrompt: string;
  userText: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const res = await fetch(endpoint(MODELS.text), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Text 오류: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ──────────────────────────────────────────────────────────────────
// [이미지] Nano Banana 2 호출
// ──────────────────────────────────────────────────────────────────
async function callNanoBanana2(prompt: string): Promise<string> {
  const res = await fetch(endpoint(MODELS.image), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"], // ← 필수 (IMAGE만 설정 시 오류)
        imageConfig: { aspectRatio: "16:9" },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Nano Banana 2 오류: ${res.status} - ${err}`);
  }

  const data = await res.json();
  type Part = { text?: string; inlineData?: { data: string; mimeType: string } };
  const parts: Part[] = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData);
  return imagePart?.inlineData?.data ?? "";
}

// ──────────────────────────────────────────────────────────────────
// [모드 1] 스토리보드 생성
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
// [모드 2] 슬라이드 편집
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
// [모드 3] 슬라이드 배경 이미지 생성
// ──────────────────────────────────────────────────────────────────
async function generateSlideImage(page: Page): Promise<{ base64: string; prompt: string }> {
  // Step 1 — Gemini 2.5 Flash로 최적 이미지 프롬프트 생성
  const rawPrompt = await callGeminiText({
    systemPrompt: IMAGE_PROMPT_SYSTEM,
    userText: `
슬라이드 정보:
- 제목: ${page.slide.title}
- 서브제목: ${page.slide.subtitle ?? ""}
- 레이아웃: ${page.layout}
- 섹션: ${page.section}
- 화면 설명: ${page.screen_desc}
- 핵심 요소: ${page.slide.elements.map((e) => e.text ?? e.items?.join(", ") ?? "").join(" | ")}
    `.trim(),
    temperature: 0.7,
    maxOutputTokens: 300,
  });

  const promptData = safeParseJson<{ prompt: string }>(rawPrompt);
  const imagePrompt =
    promptData?.prompt ??
    `Professional educational slide background for "${page.slide.title}", clean modern design, 16:9, space for text overlay on left third`;

  // Step 2 — Nano Banana 2로 이미지 생성
  const base64 = await callNanoBanana2(imagePrompt);
  return { base64, prompt: imagePrompt };
}

// ──────────────────────────────────────────────────────────────────
// [모드 4] 전체 스토리보드 이미지 배치 생성
// ──────────────────────────────────────────────────────────────────
async function generateImagesForStoryboard(
  storyboard: Storyboard,
  targetPageIds?: string[]
): Promise<Storyboard> {
  const results = await Promise.allSettled(
    storyboard.pages.map(async (page) => {
      if (targetPageIds && !targetPageIds.includes(page.page_id)) return page;

      try {
        const { base64, prompt } = await generateSlideImage(page);
        return { ...page, background_image: base64, image_prompt: prompt };
      } catch (err) {
        console.warn(`[이미지 생성 실패] ${page.page_id}:`, err);
        return page; // 실패해도 원본 유지
      }
    })
  );

  return {
    ...storyboard,
    pages: results.map((r) => (r.status === "fulfilled" ? r.value : storyboard.pages[0])),
  };
}

// ──────────────────────────────────────────────────────────────────
// 메인 핸들러
// ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode,          // "generate" | "generate_with_images" | "image" | "edit"
      pdfText,       // 원고 텍스트
      message,       // 편집 요청 메시지
      slideContext,  // 단일 슬라이드 컨텍스트
      storyboard,    // 전체 스토리보드 (이미지 추가용)
      targetPageIds, // 이미지 생성 대상 page_id 배열 (미지정 시 전체)
    } = body;

    // 하위 호환 — mode 미지정 시 자동 감지
    const resolvedMode: string =
      mode ?? (pdfText ? "generate" : message ? "edit" : "unknown");

    // ── generate ──────────────────────────────────────────────────
    if (resolvedMode === "generate") {
      if (!pdfText) return NextResponse.json({ error: "pdfText 필요" }, { status: 400 });

      const result = await generateStoryboard(pdfText);
      if (!result) return NextResponse.json({ error: "스토리보드 생성 실패" }, { status: 500 });

      return NextResponse.json({ result });
    }

    // ── generate_with_images ──────────────────────────────────────
    if (resolvedMode === "generate_with_images") {
      if (!pdfText) return NextResponse.json({ error: "pdfText 필요" }, { status: 400 });

      const board = await generateStoryboard(pdfText);
      if (!board) return NextResponse.json({ error: "스토리보드 생성 실패" }, { status: 500 });

      const boardWithImages = await generateImagesForStoryboard(board, targetPageIds);
      return NextResponse.json({ result: boardWithImages });
    }

    // ── image (기존 스토리보드에 이미지 추가) ──────────────────────
    if (resolvedMode === "image") {
      if (slideContext) {
        // 단일 슬라이드
        const { base64, prompt } = await generateSlideImage(slideContext as Page);
        return NextResponse.json({ result: { background_image: base64, image_prompt: prompt } });
      }
      if (storyboard) {
        // 전체 스토리보드
        const boardWithImages = await generateImagesForStoryboard(storyboard as Storyboard, targetPageIds);
        return NextResponse.json({ result: boardWithImages });
      }
      return NextResponse.json({ error: "slideContext 또는 storyboard 필요" }, { status: 400 });
    }

    // ── edit ──────────────────────────────────────────────────────
    if (resolvedMode === "edit") {
      if (!message) return NextResponse.json({ error: "message 필요" }, { status: 400 });

      const raw = await editSlide(message, slideContext);
      const parsed = safeParseJson(raw);
      return NextResponse.json(parsed ? { result: parsed } : { result: raw, raw: true });
    }

    // ── unknown ───────────────────────────────────────────────────
    return NextResponse.json(
      { error: "알 수 없는 mode", validModes: ["generate", "generate_with_images", "image", "edit"] },
      { status: 400 }
    );
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}