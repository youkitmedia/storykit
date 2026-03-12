import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();

    // PDF 생성 모드 (업로드 시 전체 스토리보드 생성)
    const isGenerateMode = !!pdfText;

    const systemPrompt = isGenerateMode
      ? `당신은 이러닝 콘텐츠 스토리보드 전문 제작 AI입니다.
PDF 원고를 분석하여 아래 JSON 형식으로 스토리보드 페이지 배열을 생성하세요.

## 슬라이드 생성 규칙

### 페이지 구성 원칙
- 도입(학습목표) → 본학습(개념 설명) → 정리(요약) 구조로 분리
- 한 슬라이드당 핵심 개념 1개 원칙
- 나레이션은 원고에서 직접 추출, 1페이지당 150~200자

### element 타입별 사용 규칙
- heading: 슬라이드 핵심 제목 (항상 1개)
- subtitle_text: 보조 설명 한 줄
- circles: 3~5개의 병렬 개념 (순환/관계 구조)
- bullets: 3~5개 항목 나열 (순서 있는 설명)
- emphasis: 강조 문구, 핵심 정의 (노란 박스)
- question: 생각해볼 질문, 도입 질문 (파란 박스)

### 레이아웃 타입
- "title_only": 제목 슬라이드
- "concept": 개념 설명 (heading + bullets/circles)
- "emphasis": 강조 슬라이드 (heading + emphasis)
- "question": 질문 슬라이드 (question)
- "summary": 정리 슬라이드 (heading + bullets)

반드시 아래 JSON만 출력하세요. 다른 텍스트 없이.

{
  "pages": [
    {
      "page_id": "1-1-01",
      "course": "과정명",
      "week": "1주차",
      "chapter_index": 0,
      "item_index": 0,
      "status": "review",
      "slide": {
        "title": "슬라이드 제목",
        "subtitle": "서브 제목",
        "layout": "concept",
        "elements": [
          {
            "id": "el-1",
            "order": 1,
            "type": "heading",
            "text": "핵심 제목"
          },
          {
            "id": "el-2",
            "order": 2,
            "type": "bullets",
            "items": ["항목1", "항목2", "항목3"]
          }
        ]
      },
      "screen_desc": "화면 설명: 강사 PIP + 슬라이드",
      "narration": "나레이션 텍스트"
    }
  ],
  "index": [
    {
      "chapter": "1강. 챕터명",
      "items": ["1-1 소주제1", "1-2 소주제2"]
    }
  ],
  "course_title": "과정명"
}`
      : `당신은 이러닝 콘텐츠 스토리보드 편집 AI입니다.
사용자 요청에 따라 현재 슬라이드를 수정하고 반드시 아래 JSON 형식으로만 응답하세요.

현재 슬라이드:
${JSON.stringify(slideContext, null, 2)}

element 타입: heading, subtitle_text, circles(items[]), bullets(items[]), emphasis, question
layout 타입: title_only, concept, emphasis, question, summary

반드시 JSON만 출력. 다른 텍스트 없이.
{
  "summary": "수정 내용 한 줄 요약",
  "slide": { 수정된 slide 객체 전체 },
  "narration": "수정된 나레이션 (변경 없으면 원본 그대로)"
}`;

    const userContent = isGenerateMode
      ? `다음 원고를 분석하여 스토리보드를 생성해주세요:\n\n${pdfText}`
      : message;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: isGenerateMode ? 4096 : 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      return NextResponse.json(
        { error: "AI API 호출 중 오류가 발생했습니다." },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "{}";

    // JSON 파싱 시도
    try {
      let clean = rawText.trim();
      clean = clean.replace(/^```json\s*/i, "").replace(/\s*```\s*$/g, "").trim();
      const jsonStart = clean.indexOf("{");
      const jsonEnd = clean.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        clean = clean.substring(jsonStart, jsonEnd + 1);
      }
      const parsed = JSON.parse(clean);
      return NextResponse.json({ result: parsed, raw: rawText });
    } catch {
      return NextResponse.json({ result: null, raw: rawText });
    }
  } catch (error) {
    console.error("AI edit error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
