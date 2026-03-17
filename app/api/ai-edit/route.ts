import { NextRequest, NextResponse } from "next/server";

// ─── Gemini 단일 호출로 스토리보드 생성 ─────────────────────────
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
- #1 #2 #3 큐 삽입
- 마지막 문장은 다음 슬라이드 연결어

## 자막 규칙
- 명사형 개조식
- 10자 이내

## 출력 규칙
- 순수 JSON만 출력
- { 로 시작 } 로 끝
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-latest:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            parts: [
              {
                text: `아래 원고를 바탕으로 스토리보드 JSON을 생성해주세요.\n\n${pdfText.substring(0, 10000)}`,
              },
            ],
          },
        ],
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

// ─── 메인 핸들러 ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();
    const isGenerateMode = !!pdfText;

    if (isGenerateMode) {
      const rawText = await generateStoryboard(pdfText);

      const cleaned = rawText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();

      try {
        return NextResponse.json({ result: JSON.parse(cleaned) });
      } catch {
        return NextResponse.json({ result: rawText, raw: true });
      }
    }

    const editPrompt = `
너는 이러닝 스토리보드 편집 AI다.
사용자 요청에 따라 현재 슬라이드를 수정하고 JSON으로만 응답해.

현재 슬라이드:
${JSON.stringify(slideContext, null, 2)}

사용자 요청: ${message}

{
  "summary": "수정 내용 한 줄 요약",
  "slide": { ... },
  "narration": "수정된 나레이션"
}
`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-latest:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "이러닝 스토리보드 편집 AI. JSON만 반환." }],
          },
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

    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

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