import { NextRequest, NextResponse } from "next/server";

// ─── Gemini 단일 호출로 스토리보드 생성 (분석+생성 통합) ──────────
async function generateStoryboard(pdfText: string): Promise<string> {
  const systemPrompt = `너는 10년 이상 경력의 이러닝 교수설계자다.
원고를 읽고 교수설계 원칙에 따라 슬라이드 스토리보드 JSON을 바로 생성한다.

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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: `아래 원고를 바탕으로 스토리보드 JSON을 생성해주세요.\n\n${pdfText.substring(0, 10000)}` }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} - ${errBody}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── 메인 핸들러 ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();
    const isGenerateMode = !!pdfText;

    // ── 생성 모드: Gemini 단일 호출 ───────────────────────────────
    if (isGenerateMode) {
      console.log("[Gemini] 스토리보드 생성 중...");
      const rawText = await generateStoryboard(pdfText);
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
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