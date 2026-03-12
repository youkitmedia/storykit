import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();

    const isGenerateMode = !!pdfText;

    const systemPrompt = isGenerateMode
      ? `당신은 이러닝 콘텐츠 스토리보드 전문 제작 AI입니다.
PDF 원고를 분석하여 스토리보드 페이지 배열을 JSON으로 생성하세요.

슬라이드 생성 규칙:
- 도입(학습목표) → 본학습(개념 설명) → 정리(요약) 구조
- 한 슬라이드당 핵심 개념 1개
- 나레이션 1페이지당 150~200자
- 반드시 5~10개 페이지 생성

element 타입: heading(제목), subtitle_text(보조설명), circles(병렬개념 3~5개), bullets(항목나열 3~5개), emphasis(강조 노란박스), question(질문 파란박스)
layout 타입: title_only, concept, emphasis, question, summary

출력 형식 (이 JSON 구조만 출력, 다른 텍스트 없이):
{"pages":[{"page_id":"1-1-01","course":"과정명","week":"1주차","chapter_index":0,"item_index":0,"status":"review","slide":{"title":"제목","subtitle":"서브제목","layout":"concept","elements":[{"id":"el-1","order":1,"type":"heading","text":"핵심제목"},{"id":"el-2","order":2,"type":"bullets","items":["항목1","항목2"]}]},"screen_desc":"화면설명","narration":"나레이션"}],"index":[{"chapter":"1강. 챕터명","items":["1-1 소주제"]}],"course_title":"과정명"}`
      : `당신은 이러닝 콘텐츠 스토리보드 편집 AI입니다.
현재 슬라이드: ${JSON.stringify(slideContext)}
사용자 요청에 따라 슬라이드를 수정하고 아래 JSON만 출력하세요.
출력 형식: {"summary":"수정요약","slide":{},"narration":"나레이션"}`;

    const userContent = isGenerateMode
      ? `다음 원고로 스토리보드를 생성하세요: ${pdfText.substring(0, 3000)}`
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

    try {
      // { 시작 ~ } 끝 사이만 추출 (코드블록 완전 무시)
      const jsonStart = rawText.indexOf("{");
      const jsonEnd = rawText.lastIndexOf("}");
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No JSON found");
      }
      
      const clean = rawText.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(clean);
      return NextResponse.json({ result: parsed, raw: rawText });
    } catch {
      console.error("JSON parse failed, raw:", rawText.substring(0, 300));
      return NextResponse.json({ result: null, raw: rawText });
    }
  } catch (error) {
    console.error("AI edit error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
