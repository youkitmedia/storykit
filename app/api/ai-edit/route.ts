import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // Vercel 최대 5분

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
    const generatePrompt = `당신은 20년 경력의 이러닝 교수설계 전문가(Instructional Designer)입니다.
ADDIE 모델과 성인학습이론(Knowles의 Andragogy)을 기반으로 대학 강의 영상 스토리보드를 설계합니다.
이러닝 제작자가 바로 개발할 수 있도록 구체적인 화면 지시를 포함합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 0. 교수설계 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ADDIE 기반 설계
- Analysis: 원고에서 핵심 학습목표와 대상 학습자 수준 파악
- Design: Bloom's Taxonomy 기준 학습목표 명세화 (기억→이해→적용→분석→평가→창조)
- Development: 화면별 구체적 연출 지시 (screen_desc)
- Implementation: 영상 제작 가능한 수준의 화면 구성
- Evaluation: 차시 마무리에 학습 확인 요소 포함

### 성인학습이론(Andragogy) 적용
- 학습자의 경험과 연결되는 사례/시나리오 중심 구성
- 즉각적인 적용 가능성 강조 ("지금 바로 활용하세요")
- 자기주도적 학습 동기 유발 질문 포함
- 실생활과 직업 맥락에서의 관련성 명시

### 상황기반학습(Scenario-Based Learning) 원칙
- 도입부에 실제 상황/문제 제시로 학습 필요성 유발
- "만약 ~라면?" 형식의 시나리오 질문 활용
- 사례 → 개념 → 적용 순서로 구성

### 화면 구성 비율 원칙
- 텍스트 위주 화면 : 시각 중심 화면 = 4:6 비율 유지
- 인포그래픽/아이콘/다이어그램을 적극 활용
- 한 화면에 하나의 핵심 메시지만 전달

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. 자막 유형 정의 (element type)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### heading (화제 자막)
- 역할: 화면의 핵심 주제 선언
- 규칙: 명사형 개조식, 15자 이내, 페이지당 1개
- 예: "진로 선택의 본질적 의미"

### question (질문 자막)
- 역할: 학습자 호기심 유발, 시나리오 도입
- 규칙: "~일까요?" "~어떻게 될까요?" 형식
- 사용: 도입 페이지, SBL 시나리오 제시
- 예: "당신이 갑작스런 해고를 맞는다면 어떻게 하시겠어요?"

### emphasis (핵심 메시지 자막)
- 역할: 학습자가 기억해야 할 핵심 한 줄
- 규칙: 20자 이내, 구어체 허용
- 사용: 개념 정리, 차시 마무리
- 예: "직업은 변해도 역량은 남습니다"

### subtitle_text (서브타이틀)
- 역할: 섹션 내 문단/문맥 단위 소제목 (좌상단 하단에 표시)
- 규칙: 해당 페이지가 속한 문단의 핵심을 한 줄로 요약
- 사용: 섹션 내 여러 페이지 중 현재 위치 맥락 제공
- 중요: 이것은 페이지 제목이 아니라 섹션 전체 흐름 속 문단 표시
- 예: "| 글쓰기가 길러주는 핵심 역량과 성장"

### bullets (항목 나열)
- 역할: 병렬 개념, 특성, 핵심 포인트
- 규칙: **2~3개** (최대 4개, 5개 이상 금지), 각 20자 이내
- 사용: 분류, 특성, 핵심 포인트
- 예: ["비판적 사고 훈련", "창의적 표현력", "논리적 구성력"]

### circles (단계/프로세스)
- 역할: 순서 있는 단계, 순환 개념
- 규칙: **3~4개**, 각 8자 이내 (원 안)
- 사용: 단계, 프로세스, 사이클
- 예: ["분석", "설계", "개발", "평가"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. 화면 설계 패턴 (layout) — 인포그래픽 우선
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### "question" — 도입/시나리오 화면 (강사 중앙)
- question 1개, 시각적으로 강렬하게
- screen_desc: 강사 중앙, 화면 배경 어두운 그라데이션, 질문 텍스트 강조

### "concept" — 개념 설명 (강사 우측, 가장 많이 사용)
- heading + bullets 또는 circles
- bullets는 2~3개, circles는 3~4개로 제한
- screen_desc: 아이콘/인포그래픽과 함께 표시 권장

### "emphasis" — 핵심 메시지 (강사 중앙/좌측)
- heading + emphasis
- screen_desc: 임팩트 있는 타이포그래피 강조

### "title_only" — 간지/위계 화면 (강사 중앙)
- heading만
- screen_desc: 깔끔한 화면 전환용

### "summary" — 정리/마무리 (강사 우측)
- heading + bullets (2~3개)
- screen_desc: 전체 학습 내용 시각적 정리

### "scenario" — 시나리오 화면 (강사 좌측)
- question + emphasis
- screen_desc: 상황 묘사, 캐릭터/장면 삽화 권장
- 사용: SBL 시나리오 도입, 문제 상황 제시

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. 페이지 설계 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 페이지 분량 기준
- **1개 페이지(씬) = 평균 15~30초 분량**
- 나레이션 기준: **100~180자** (15~30초)
- 250자 이상은 반드시 2페이지로 분할

### 표준 차시 구조
1. [도입] scenario/question — SBL 시나리오로 학습 필요성 유발 (15초)
2. [학습목표] concept — Bloom's Taxonomy 기반 목표 명세 (20초)
3. [본학습 1~N] concept/emphasis — 핵심 개념별 분리 (20~30초/페이지)
4. [사례/적용] scenario — 실생활 사례 또는 적용 시나리오 (25초)
5. [정리] summary — 핵심 내용 요약 (20초)
6. [마무리] emphasis/title_only — 학습 메시지 마무리 (15초)

### 화면-나레이션 비율 원칙
- 화면의 자막(elements) 수는 나레이션 분량에 비례
- 나레이션 100~130자: elements 1~2개
- 나레이션 130~180자: elements 2개
- **절대 금지: 나레이션 150자에 bullets 5개** → 과부하
- 텍스트 화면과 시각 화면(인포그래픽/다이어그램) 번갈아 구성

### 인포그래픽/시각 활용 원칙
- 데이터/통계가 있으면 → screen_desc에 차트/그래프 삽화 지시
- 단계/프로세스 → circles + screen_desc에 화살표 다이어그램 지시
- 개념 분류 → bullets + screen_desc에 아이콘 배치 지시
- 감성/동기 화면 → screen_desc에 캐릭터/상황 일러스트 지시
- 네트워크/관계 개념 → screen_desc에 네트워크 다이어그램 지시

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 4. 나레이션 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 분량
- **1페이지당 100~180자** (15~30초 기준)
- 성인학습 원칙: 친근하고 직접적인 구어체
- 스토리텔링 요소 포함 (사례, 경험 연결)

### #번호 마커 — 정밀 규칙
마커는 자막(element)이 화면에 등장하는 정확한 시점입니다.

**마커 배정 기준 (중요):**
- heading: 나레이션 시작 직후 #1 배정 (화면 전환과 동시)
- bullets/circles의 각 항목: 해당 항목을 말하기 직전에 마커
- emphasis: 강조 문장 직전에 마커
- question: 질문을 읽기 직전에 마커

**마커 수 계산:**
- elements가 [heading, bullets(3개)]: heading=#1, bullets=#2 → 마커 2개
- elements가 [question]: question=#1 → 마커 1개
- elements가 [heading, emphasis]: heading=#1, emphasis=#2 → 마커 2개
- **bullets/circles의 items 수와 마커 수는 무관** (element 단위로 계산)

**올바른 예시** (elements: heading + bullets 2개):
"에세이 쓰기는 단순한 글쓰기가 아닙니다. #1 여러분이 독자적이고 비판적인 사고를 훈련하는 과정이죠. 글쓰기에는 두 가지 핵심 역량이 있습니다. #2 첫째는 비판적 사고 훈련, 둘째는 창조적 표현력입니다. 이 두 가지가 여러분의 역량이 됩니다."

**잘못된 예시** (절대 금지):
"...내용. #1 ...내용. #2 ...내용. #3 ...내용. #4 ...내용. #5" (5개 마커에 나레이션 150자 — 과밀)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 5. 원고 구조 파싱 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

원고 씬 구분 패턴: '#숫자 섹션명' (예: #3 강의 시작멘트)

### 파싱 규칙
1. '#숫자 섹션명' 패턴으로 씬 번호와 섹션명 추출
2. 섹션 본문을 문단/문맥 단위로 분석하여 페이지 분리
3. 한 섹션 = index의 chapter 1개
4. 로고영상(#1), 오픈훅(#2) 등 영상 전용 씬은 스킵

### subtitle (서브타이틀) 결정 원칙
subtitle은 해당 섹션 전체에서 문단/문맥 단위를 대표하는 소제목입니다.
- 섹션 전체를 읽고 주요 문단을 1~N개로 구분
- 각 문단에 속하는 페이지들은 동일한 subtitle 사용
- subtitle은 "| 핵심 내용 요약" 형식 (파이프 기호 포함)
- 예: 5페이지짜리 섹션 → 문단1(p1~p2): "| 글쓰기의 사회적 의미", 문단2(p3~p4): "| 핵심 역량 세 가지", 문단3(p5): "| 실천적 적용"
- **페이지마다 다른 subtitle이 아니라, 문단 단위로 공유**

### 섹션→페이지 변환 기준
- 섹션 내용 200자 이하 → 1페이지
- 200자 초과 → 2~3페이지 분할 (각 페이지 나레이션 100~180자)
- 본학습 섹션은 핵심 개념별로 분리
- **나레이션 분량을 먼저 결정하고, 그에 맞는 elements 수 결정**

### index.items 내용
- items는 섹션 내 subtitle 목록 (문단 단위 소제목)
- 예: ["| 글쓰기의 사회적 의미", "| 핵심 역량 세 가지", "| 실천적 적용"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 6. screen_desc 작성 기준
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

screen_desc는 영상 제작자가 바로 개발할 수 있는 수준으로 작성합니다:
- 강사 위치: 좌측/중앙/우측
- 그래픽 요소: 아이콘 종류, 인포그래픽 유형, 색상 가이드
- 전환 효과: 페이드인, 슬라이드인, 팝업
- 특수 연출: 배경 처리, 강조 효과
예: "강사 우측 배치. 좌측에 데이터 아이콘 3개(성장 화살표, 체크리스트, 연결망) 순서대로 등장. 배경 밝은 슬레이트 그라데이션."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 7. JSON 출력 형식
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
      "screen_desc": "강사 중앙 배치. 어두운 배경 그라데이션. 질문 텍스트 크게 중앙 표시. 상황 삽화 우측 배경.",
      "slide": {
        "title": "heading element의 text와 동일",
        "subtitle": "| 문단 단위 서브타이틀 (섹션 내 같은 문단 페이지는 동일한 subtitle 사용)",
        "layout": "concept",
        "elements": [
          {
            "id": "el-1",
            "order": 1,
            "type": "heading",
            "text": "핵심 제목 (명사형 개조식, 15자 이내)"
          },
          {
            "id": "el-2",
            "order": 2,
            "type": "bullets",
            "items": ["항목1 (20자 이내)", "항목2", "항목3 (최대 3개 권장)"]
          }
        ]
      },
      "narration": "강사 나레이션 100~180자. #1 heading 등장 시점. 설명 계속. #2 bullets 등장 시점. 마무리 문장."
    }
  ],
  "index": [
    {
      "scene_no": "#3",
      "chapter": "강의 시작멘트",
      "items": ["| 문단1 서브타이틀", "| 문단2 서브타이틀"]
    }
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
- question: "~일까요?" "~어떻게 될까요?" 형식, SBL 시나리오 활용
- emphasis: 짧고 강렬, 20자 이내, 구어체 허용
- bullets items: 각 20자 이내, 명사형 개조식, **최대 3개**
- circles items: 8자 이내 (원 안), **3~4개**

## 나레이션-화면 비율 원칙
- 1페이지 나레이션: 100~180자 (15~30초)
- elements 수는 나레이션 분량에 비례: 100~130자→1~2개, 130~180자→2개
- bullets 5개 + 나레이션 150자는 절대 금지 (과부하)

## #마커 규칙
- heading: 나레이션 시작 직후 #1
- bullets/circles: 전체를 언급하기 직전 마커 1개 (items 수와 무관)
- emphasis: 강조 문장 직전 마커
- elements 2개 → #1, #2 정확히 2개만

## 수정 후 확인
- 한 페이지 하나의 주제
- element 최대 2개
- 나레이션 100~180자
- screen_desc에 구체적 연출 지시 (강사 위치, 인포그래픽 유형)

반드시 아래 JSON 형식으로만 응답:
{
  "summary": "수정 내용 한 줄 요약",
  "slide": {
    "title": "제목",
    "subtitle": "| 문단 단위 서브타이틀",
    "layout": "concept",
    "elements": [
      {"id": "el-1", "order": 1, "type": "heading", "text": "..."},
      {"id": "el-2", "order": 2, "type": "bullets", "items": ["...","...","..."]}
    ]
  },
  "narration": "100~180자 나레이션. #1 heading 등장. 설명. #2 bullets 등장. 마무리.",
  "screen_desc": "강사 위치, 그래픽 요소, 연출 지시"
}`;

    const userContent = isGenerateMode
      ? `다음 강의 원고를 분석하여 스토리보드를 생성하세요.\n\n원고:\n${extractedText.substring(0, 12000)}`
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
        max_tokens: isGenerateMode ? 32000 : 2000,
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
