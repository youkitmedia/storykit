import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();

    const isGenerateMode = !!pdfText;

    const systemPrompt = isGenerateMode
      ? `당신은 10년 차 베테랑 이러닝 교수설계자입니다.
원고의 맥락을 정확히 파악하여 학습자에게 최적의 가독성을, 제작자에게 명확한 가이드를 제공하는 스토리보드를 설계합니다.

## 자막 유형 분류 및 설계 전략

### A. 하단 요약형 (감성/상황/질문 자막)
복잡한 도식을 지양하고 핵심 메시지를 단 한 줄 명사형 개조식으로 처리한다.
- 감성 자막: 가치, 태도, 철학적 메시지 → emphasis 타입 사용
- 상황 자막: 배경 설명, 문제 제기 → subtitle_text 타입 사용
- 질문 자막: 학습 동기 유발 → question 타입 사용

### B. 중앙 도식화형 (정보/구조 자막)
순서, 분류, 단계, 대비가 포함된 경우에만 도식화 적용.
- 프로세스/단계: 흐름이 있는 경우 → circles 타입 사용
- 분류/특성: 종류, 특징 나열 → bullets 타입 사용

## 교수설계 핵심 원칙
- 위계: [대제목 - 소제목 - 본문] 3단계 구조 명확히 할 것
- 요약: "~합니다", "~입니다" 삭제하고 반드시 명사형 개조식으로 가공
- 구조: 한 페이지에 하나의 주제만 담아 인지 과부하 방지
- 시각화: 중요 키워드는 emphasis 또는 question 박스로 강조
- 페이지당 element는 최대 2개로 제한
- 나레이션은 원고 문장을 직접 활용, 1페이지당 200~300자

## 슬라이드 설계 규칙
- 원고에서 과정명, 주차, 챕터 정보를 추출하여 course, week, index에 반영
- 도입(학습목표/질문) → 본학습(개념/구조 설명) → 정리(요약/강조) 구조
- slide.title: 명사형 개조식 핵심 제목 (예: "진로 선택의 본질적 의미")
- slide.subtitle: 한 줄 보조 설명
- screen_desc: 촬영 유형 [크로마키 강사형 / 호리존 대담형 / 화면녹화형] 중 최적안 명시
- 반드시 5~8개 페이지 생성

## element 타입
- heading: 슬라이드 핵심 대제목 (항상 1개)
- subtitle_text: 보조 설명 한 줄 (상황 자막)
- circles: 병렬 개념 3~5개 (프로세스/단계)
- bullets: 항목 나열 3~5개 (분류/특성), 반드시 명사형 개조식
- emphasis: 강조 문구 노란 박스 (감성 자막)
- question: 질문/도입 파란 박스 (질문 자막)

## layout 타입
- title_only: 도입 제목 슬라이드
- concept: 개념 설명 (heading + bullets 또는 circles)
- emphasis: 강조 (heading + emphasis)
- question: 질문 도입 (question)
- summary: 정리 (heading + bullets)

JSON만 출력하세요. { 로 시작해서 } 로 끝내세요.`
      : `당신은 10년 차 베테랑 이러닝 교수설계자입니다.
현재 슬라이드: ${JSON.stringify(slideContext)}

사용자 요청에 따라 슬라이드를 수정하세요.

수정 원칙:
- 자막은 반드시 명사형 개조식으로 가공 ("~합니다" 삭제)
- 한 페이지 하나의 주제 원칙 유지
- element는 최대 2개로 제한

JSON만 출력하세요. { 로 시작해서 } 로 끝내세요.`;

    const userContent = isGenerateMode
      ? `다음 원고로 스토리보드를 생성하세요: ${pdfText.substring(0, 3000)}`
      : message;

    const assistantPrefill = isGenerateMode
      ? `{"pages":[`
      : `{"summary":"`;

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
        messages: [
          { role: "user", content: userContent },
          { role: "assistant", content: assistantPrefill },
        ],
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
    const rawText = assistantPrefill + (data.content?.[0]?.text || "");

    try {
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
