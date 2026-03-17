import { NextRequest, NextResponse } from "next/server";

// ─── Gemini로 원고 구조 분석 ──────────────────────────────────────
async function analyzeWithGemini(pdfText: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `다음 이러닝 원고를 분석해서 아래 JSON 형식으로만 반환해줘.
다른 텍스트 없이 { 로 시작해서 } 로 끝나는 순수 JSON만 출력.

{
  "course_title": "과정명",
  "week": "주차명",
  "chapter": "차시명",
  "sections": [
    {
      "section_id": "01",
      "section_name": "섹션명",
      "section_type": "intro | concept | emphasis | question | summary",
      "key_concepts": ["핵심개념1", "핵심개념2"],
      "keywords": ["강조키워드1", "강조키워드2"],
      "content_summary": "이 섹션의 핵심 내용 요약 (2~3문장)",
      "recommended_layout": "title_intro | concept_circles | tabs_sequential | speech_bubble | label_list | instructor_speech | image_caption | split_two | summary_dark",
      "image_keyword": "게티이미지 검색용 영문 키워드",
      "narration_source": "원고에서 나레이션으로 쓸 핵심 문장들 추출"
    }
  ],
  "index": ["섹션1명", "섹션2명", "섹션3명"]
}

원고:
${pdfText.substring(0, 8000)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API 오류: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── Gemini로 스토리보드 생성 ────────────────────────────────────
async function generateWithGemini(
  geminiAnalysis: string,
  pdfText: string
): Promise<string> {
  const systemPrompt = `
너는 10년 이상 경력의 이러닝 교수설계자다.
아래 원고 분석 결과를 바탕으로 교수설계 원칙에 따라 슬라이드 스토리보드 JSON을 생성한다.

## 교수설계 5단계 (차시별 반드시 준수)
1단계 [도입]      layout: title_intro       학습목표 제시
2단계 [전개-개념] layout: concept_circles 또는 tabs_sequential
3단계 [전개-심화] layout: emphasis_definition 또는 image_caption
4단계 [확인]      layout: speech_bubble     질문 유도
5단계 [정리]      layout: summary_dark      핵심 요약

## 나레이션 규칙
- 구어체 필수 ("~이에요", "~랍니다")
- 150~200자
- #1 #2 #3 큐 삽입 (화면 요소 등장 0.5초 전)
- 마지막 문장은 다음 슬라이드 연결어로 끝낼 것

## 자막(bullets items) 규칙
- 명사형 개조식 필수 (문장 금지)
- 10자 이내
- 올바른 예: "기능 중심 형태 결정"
- 잘못된 예: "기능이 형태를 결정한다"

## 출력 규칙
- 순수 JSON만 출력 (코드블록 금지)
- { 로 시작 } 로 끝

출력 형식:
{
  "course_title": "과정명",
  "week": "주차",
  "chapter": "차시",
  "index": [{ "section": "섹션명", "items": ["소제목1", "소제목2"] }],
  "pages": [
    {
      "page_id": "02_01_01_01",
      "section": "섹션명",
      "sub_section": "소섹션명",
      "layout": "title_intro",
      "status": "review",
      "slide": {
        "title": "슬라이드 제목 15자 이내",
        "subtitle": "서브 제목",
        "elements": [
          { "id": "el-1", "order": 1, "type": "heading", "text": "핵심 제목" },
          { "id": "el-2", "order": 2, "type": "bullets", "items": ["항목1", "항목2"] }
        ]
      },
      "image_keyword": "getty image search keyword in english",
      "emphasis_keywords": ["강조1", "강조2"],
      "screen_desc": "(#1 Fade-in 0.5s) 요소 등장 → (#2 Fade-in 0.5s) 다음 요소",
      "narration": "#1 나레이션 텍스트 (150~200자, 구어체)"
    }
  ]
}`;

  const userContent = `
아래는 Gemini가 분석한 원고 구조입니다. 이를 바탕으로 스토리보드를 생성해주세요.

[Gemini 분석 결과]
${geminiAnalysis}

[원본 원고 일부]
${pdfText.substring(0, 3000)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userContent }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API 오류: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── 메인 핸들러 ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();
    const isGenerateMode = !!pdfText;

    // ── 생성 모드: Gemini 분석 → Gemini 생성 ─────────────────────
    if (isGenerateMode) {
      console.log("[1단계] Gemini로 원고 구조 분석 중...");
      let geminiResult = "";
      try {
        geminiResult = await analyzeWithGemini(pdfText);
      } catch (e) {
        console.warn("Gemini 분석 실패, 단독 생성 모드로 전환:", e);
      }

      console.log("[2단계] Gemini로 스토리보드 생성 중...");
      const rawText = await generateWithGemini(geminiResult, pdfText);
      const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      try {
        return NextResponse.json({ result: JSON.parse(cleaned) });
      } catch {
        return NextResponse.json({ result: rawText, raw: true });
      }
    }

    // ── 수정 모드: Gemini 사용 ─────────────────────────────────────
    const editPrompt = `
너는 이러닝 스토리보드 편집 AI다.
사용자 요청에 따라 현재 슬라이드를 수정하고 JSON으로만 응답해.
순수 JSON만 출력 (코드블록 금지)

현재 슬라이드:
${JSON.stringify(slideContext, null, 2)}

사용자 요청: ${message}

{
  "summary": "수정 내용 한 줄 요약",
  "slide": { ... },
  "narration": "수정된 나레이션 (150~200자, 구어체, #큐 포함)"
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "이러닝 스토리보드 편집 AI. JSON만 반환." }] },
          contents: [{ parts: [{ text: editPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    try {
      return NextResponse.json({ result: JSON.parse(cleaned) });
    } catch {
      return NextResponse.json({ result: rawText, raw: true });
    }

  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}