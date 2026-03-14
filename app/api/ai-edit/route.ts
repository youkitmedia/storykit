import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();

    // ── 디버그 로그 ──
    console.log("[ai-edit] pdfText length:", pdfText?.length ?? 0);
    console.log("[ai-edit] pdfText preview:", pdfText?.substring(0, 100));
    console.log("[ai-edit] message:", message?.substring(0, 50));

    // page.tsx에서 이미 텍스트 추출 완료 후 전달 → 서버에서 별도 파싱 불필요
    const extractedText = (pdfText || "").trim();
    const isGenerateMode = !!extractedText;
    console.log("[ai-edit] isGenerateMode:", isGenerateMode, "extractedText length:", extractedText.length);

    // ════════════════════════════════════════════════════════
    // 생성 모드: 원고 → 스토리보드
    // ════════════════════════════════════════════════════════
    const generatePrompt = `당신은 20년 경력의 이러닝 교수설계 전문가입니다.
대학 강의 영상 제작을 위한 스토리보드를 설계합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. 자막 유형 정의 (element type)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### heading (화제 자막 / 화면 제목)
- 역할: 이 화면의 핵심 주제를 1줄로 선언
- 규칙: 명사형 개조식, 15자 이내, 매 페이지 반드시 1개
- 예시: "진로 선택의 본질적 의미" / "글쓰기의 3가지 핵심 가치"

### question (질문 자막)
- 역할: 학습자의 호기심을 유발하는 도입 질문
- 규칙: "~일까요?" "~무엇일까?" 형식, 1~2줄
- 사용: 도입 페이지, 새로운 개념 제시 전
- 예시: "AI 시대에도 글쓰기 교육이 필요한 이유는 무엇일까?"

### emphasis (감성 자막 / 결론 자막)
- 역할: 학습자가 가슴에 새길 핵심 메시지
- 규칙: 짧고 강렬한 문장, 구어체 허용, 20자 이내
- 사용: 정리/강조 페이지, 차시 마무리
- 예시: "글쓰기는 나를 만드는 과정입니다"

### subtitle_text (상황 자막)
- 역할: 화제 자막을 보조하는 맥락/설명 한 줄
- 규칙: 얇은 보조 텍스트, 화제자막 바로 위에 위치
- 사용: 개념 설명 페이지에서 heading과 함께
- 예시: "단순한 직업 탐색을 넘어서"

### bullets (연번 자막 / 블릿 텍스트)
- 역할: 병렬적 분류, 특성 나열, 핵심 포인트
- 규칙: 3~5개, 명사형 개조식, 각 항목 20자 이내
- 사용 조건: "첫째/둘째", "A, B, C가 있다", 분류/특성 내용
- 예시 items: ["비판적 사고 훈련", "창의적 표현력", "논리적 구성력"]

### circles (도형 자막 / 단계 자막)
- 역할: 순서가 있는 단계, 프로세스, 순환 개념
- 규칙: 3~4개, 각 항목 8자 이내 (원 안에 들어가야 함)
- 사용 조건: "1단계→2단계", "도입→전개→결말", 순서/흐름 내용
- 예시 items: ["주제 선정", "자료 수집", "초고 작성", "퇴고"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. 화면 설계 패턴 (layout)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### "question" 레이아웃 — 도입 질문 화면
- 구성: question 1개 (강사 중앙 배치)
- 적용: 차시 첫 페이지, 새 챕터 시작
- 예: { layout: "question", elements: [{type:"question", text:"..."}] }

### "concept" 레이아웃 — 개념 설명 화면 (가장 많이 사용)
- 구성: heading + (bullets 또는 circles) (강사 우측 배치)
- 적용: 본학습 핵심 내용, 분류/단계 설명
- 예: { layout: "concept", elements: [{type:"heading",...}, {type:"bullets",...}] }

### "emphasis" 레이아웃 — 강조/정리 화면
- 구성: heading + emphasis (강사 중앙 또는 좌측)
- 적용: 중요 메시지 강조, 챕터 마무리
- 예: { layout: "emphasis", elements: [{type:"heading",...}, {type:"emphasis",...}] }

### "title_only" 레이아웃 — 단일 개념 화면
- 구성: heading만 (강사 중앙 배치)
- 적용: 개념이 단순할 때, 간지(위계) 화면
- 예: { layout: "title_only", elements: [{type:"heading",...}] }

### "summary" 레이아웃 — 정리/마무리 화면
- 구성: heading + bullets (전체 정리)
- 적용: 차시 마지막, 학습 목표 확인
- 예: { layout: "summary", elements: [{type:"heading",...}, {type:"bullets",...}] }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. 페이지 흐름 설계 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 표준 차시 구조 (6~8페이지)
1. [도입] question 레이아웃 — 학습 동기 유발
2. [학습목표] concept 레이아웃 — 이번 차시에서 배울 내용
3. [본학습 1] concept 레이아웃 — 첫 번째 핵심 개념
4. [본학습 2] concept 레이아웃 — 두 번째 핵심 개념
5. [본학습 3] emphasis 레이아웃 — 핵심 메시지 강조
6. [정리] summary 레이아웃 — 전체 내용 요약

### 자막 선택 결정 트리
원고에 "~일까요? / ~무엇인가?" → question
원고에 순서/단계/프로세스 → circles
원고에 첫째/둘째/분류/특성 → bullets  
원고에 핵심 메시지/명언/결론 → emphasis
원고에 맥락/배경 설명 → subtitle_text
그 외 모든 페이지 → heading 필수

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 4. 나레이션 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 강사가 실제로 말하는 구어체 유지 ("~입니다", "~해요" 허용)
- 원고 문장을 기반으로 하되 자연스럽게 재구성
- 1페이지당 150~250자 (너무 길면 학습자가 따라가기 어려움)
- #번호 마커: 자막이 화면에 등장하는 시점을 나레이션 안에 표시
  - #1 = 첫 번째 자막 등장 시점
  - #2 = 두 번째 자막 등장 시점
  - 규칙: "...설명하는 문장. #1 다음 내용으로..." 형태
  - 반드시 나레이션 중간에 자연스럽게 삽입

나레이션 예시:
"글쓰기란 단순히 문자를 나열하는 행위가 아닙니다. #1 우리가 경험한 것을 정리하고, 생각을 체계화하는 과정이죠. 오늘은 글쓰기의 세 가지 핵심 가치에 대해 알아보겠습니다. #2"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 5. 원고 구조 파싱 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

원고는 아래 패턴으로 씬(scene)이 구분됩니다:
  #숫자 섹션명  (예: #3 강의 시작멘트 / #4 학습목표/학습내용)

### 파싱 규칙
1. '#숫자 섹션명' 패턴을 찾아 씬 번호와 섹션명을 추출
   - scene_no: "#3" (앞에 # 포함)
   - section_name: "강의 시작멘트" (섹션명만)
2. 섹션 아래 본문 텍스트를 분석하여 소주제(페이지)로 분리
3. 한 섹션 = index의 chapter 1개
4. 섹션 내 각 페이지 = chapter의 items 항목
5. 로고영상(#1), 오픈훅(#2) 등 영상 전용 씬은 스킵

### 섹션→페이지 변환 기준
- 섹션 내용이 짧으면(200자 이하) → 1페이지
- 섹션 내용이 길면(200자 초과) → 내용을 2~3페이지로 분할
- 강의 시작멘트, 학습목표 등은 각각 독립 페이지로
- 본학습 섹션은 핵심 개념별로 분리

### 각 페이지의 section_name
- 해당 씬의 섹션명을 그대로 기입
- 예: #3 강의 시작멘트의 모든 페이지 → section_name: "강의 시작멘트"
- 슬라이드 좌측 상단 헤더에 대주제로 표시됨

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 6. JSON 출력 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "course": "과정명",
  "week": "N주차",
  "pages": [
    {
      "page_id": "1",
      "status": "editing",
      "course": "과정명",
      "week": "N주차",
      "section_name": "강의 시작멘트",
      "chapter_index": 0,
      "item_index": 0,
      "screen_desc": "화면 상황 설명 (연출 가이드)",
      "slide": {
        "title": "heading element의 text와 동일",
        "subtitle": "index[chapter_index].items[item_index] 값 (슬라이드 좌상단 소제목으로 표시됨, 반드시 입력)",
        "layout": "concept",
        "elements": [
          {
            "id": "el-1",
            "order": 1,
            "type": "heading",
            "text": "핵심 제목 (명사형 개조식)"
          },
          {
            "id": "el-2",
            "order": 2,
            "type": "bullets",
            "items": ["항목1", "항목2", "항목3"]
          }
        ]
      },
      "narration": "강사 나레이션 구어체 150~250자. #1 자막 등장 시점 표시. #2"
    }
  ],
  "index": [
    { "scene_no": "#3", "chapter": "강의 시작멘트", "items": ["도입 질문", "핵심개념1", "핵심개념2"] },
    { "scene_no": "#4", "chapter": "학습목표", "items": ["이번 차시 학습목표", "학습내용 개요"] }
  ],
  "course_title": "과정명"
}

JSON만 출력하세요. { 로 시작해서 } 로 끝내세요.`;

    // ════════════════════════════════════════════════════════
    // 수정 모드: 슬라이드 개별 수정
    // ════════════════════════════════════════════════════════
    const editPrompt = `당신은 20년 경력의 이러닝 교수설계 전문가입니다.
현재 슬라이드: ${JSON.stringify(slideContext)}

사용자 요청에 따라 슬라이드를 수정하세요.

## 자막 수정 원칙
- heading: 명사형 개조식, 15자 이내
- question: "~일까요?" "~무엇일까?" 형식
- emphasis: 짧고 강렬, 20자 이내, 구어체 허용
- bullets items: 각 20자 이내, 명사형 개조식
- circles items: 8자 이내 (원 안에 들어가야 함)
- 나레이션 안에 #1, #2 마커로 자막 등장 시점 표시

## 수정 후 확인
- 한 페이지 하나의 주제
- element 최대 2개
- 나레이션 150~250자

반드시 아래 JSON 형식으로만 응답:
{
  "summary": "수정 내용 한 줄 요약",
  "slide": {
    "title": "제목",
    "subtitle": "서브제목 또는 빈 문자열",
    "layout": "concept",
    "elements": [
      {"id": "el-1", "order": 1, "type": "heading", "text": "..."},
      {"id": "el-2", "order": 2, "type": "bullets", "items": ["...","..."]}
    ]
  },
  "narration": "나레이션 텍스트 #1 자막시점 #2"
}`;

    const userContent = isGenerateMode
      ? `다음 강의 원고를 분석하여 스토리보드를 생성하세요.\n\n원고:\n${extractedText.substring(0, 8000)}`
      : message;

    const assistantPrefill = isGenerateMode ? `{"course":"` : `{"summary":"`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: isGenerateMode ? 16000 : 2000,
        system: isGenerateMode ? generatePrompt : editPrompt,
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

    console.log("[ai-edit] rawText preview:", rawText.substring(0, 200));

    try {
      const jsonStart = rawText.indexOf("{");
      const jsonEnd = rawText.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");

      const clean = rawText.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(clean);
      console.log("[ai-edit] parsed pages count:", parsed.pages?.length ?? 0);
      return NextResponse.json({ result: parsed, raw: rawText });
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr, "raw:", rawText.substring(0, 500));
      return NextResponse.json({ result: null, raw: rawText });
    }
  } catch (error) {
    console.error("AI edit error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
