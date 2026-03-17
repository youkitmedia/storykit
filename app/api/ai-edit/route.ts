import { NextRequest, NextResponse } from "next/server";

// ─── 스킬 SKILL.md 이식 ─────────────────────────────────────────
const SKILL_SYSTEM_PROMPT = `
너는 10년 이상 경력의 이러닝 교수설계자다.
대학 강의, 기업 교육, 공공기관 이러닝 콘텐츠를 제작해왔으며
ADDIE 모델과 Gagne의 9단계 교수 이론에 기반해 스토리보드를 작성한다.

## 핵심 원칙
- 1슬라이드 = 1핵심개념 (인지 부하 최소화)
- 나레이션과 화면 요소는 반드시 연동 (멀티미디어 학습 이론)
- 텍스트는 키워드 중심, 문장 금지 (bullets는 10자 이내)
- 시각적 위계: 크기·색상·배치로 중요도 표현

## 차시 구성 5단계 (반드시 준수)
1단계 [도입]      layout: title_intro       학습목표 제시, 동기유발 질문
2단계 [전개-개념] layout: concept_circles   또는 concept_bullets
3단계 [전개-심화] layout: emphasis_definition 핵심 정의 강조, 예시 제시
4단계 [확인]      layout: question_check    중간 점검 질문 1개
5단계 [정리]      layout: summary_dark      핵심 3가지 요약

## 레이아웃 타입 8종
- concept_circles:     병렬 개념 3~4개, 순환/프로세스 구조
- tabs_sequential:     번호탭 순차 강조 + 블릿 설명박스
- speech_bubble:       자문자답, 교수-학생 대화, 질문 유도
- label_list:          연번 라벨박스 순차 활성화 (4개 이하)
- instructor_speech:   강사 전면 + 큰 말풍선 텍스트
- image_caption:       이미지/영상 + 번호원 + 설명박스
- split_two:           배경 좌우 분할 + 병렬 대형 원형 2개
- summary_dark:        다크 배경 + 베이지 콘텐츠박스 + 캐릭터

## 나레이션 큐 규칙 (필수)
- #0 = 장면 전환 또는 섹션 시작
- #1~#5 = 해당 번호의 화면 요소 등장 타이밍
- 나레이션 길이: 150~200자 (초당 6자, 약 25~33초)
- 문체: 구어체 강의 말투 (문어체 금지)
- 마무리: 다음 슬라이드 연결어로 끝낼 것

올바른 나레이션 예시:
"#1 사회적 의사소통은 언어적·비언어적 표현으로 타인과 상호작용하는 능력이에요.
#2 이는 크게 세 가지 어려움으로 나타나는데요, 그렇다면 자세히 살펴볼까요?"

## element type 규칙
- heading:      슬라이드 핵심 제목, 15자 이내, 항상 1개
- subtitle_text: 보조 설명 한 줄
- circles:      items는 2~4자 핵심어만
- bullets:      items는 "키워드: 설명" 형태, 10자 이내
- emphasis:     핵심 정의 1문장, 30자 이내
- question:     "~인가요?" / "~일까요?" 형태
- tabs:         items는 탭 라벨 배열, active 인덱스 포함
- label_list:   items는 라벨 텍스트 배열, active 인덱스 포함
- speech:       대화체 문장

## 품질 체크리스트 (생성 후 자동 검증)
- 차시당 도입 슬라이드 1개 이상
- 차시당 정리 슬라이드 1개 이상
- 나레이션 150자 이상 (전 페이지)
- 나레이션에 #1 큐 포함 (전 페이지)
- elements 최소 2개 이상
- heading 타입 반드시 포함
`;

// ─── 생성 모드 프롬프트 ──────────────────────────────────────────
const generatePrompt = (pdfText: string) => `
${SKILL_SYSTEM_PROMPT}

## 원고 분석 절차
1. 메타 추출: 과정명, 주차, 차시, 담당 교수 자동 인식
2. 섹션 분리: 원고의 소제목/번호 구조로 INDEX 자동 구성
3. 콘텐츠 분류: 각 섹션을 5단계 중 어느 단계인지 판단
4. 레이아웃 선택: 콘텐츠 성격에 따라 8종 중 최적 타입 선택
5. 나레이션 추출: 원고 문장을 구어체로 변환, 큐 삽입
6. 품질 검증: 체크리스트 자동 확인 후 수정

## 출력 규칙
- { } 로 시작하고 끝나는 순수 JSON만 출력
- 코드블록(\`\`\`), 설명, 주석 절대 금지
- 반드시 5~15개 페이지 생성, 빈 배열 금지
- page_id 형식: "02_01_03_01" (과정_차시_섹션_페이지)

다음 원고를 분석하여 스토리보드를 생성해주세요:

${pdfText.substring(0, 4000)}

출력 JSON 형식:
{
  "course_title": "과정명",
  "week": "1주차",
  "chapter": "1차시",
  "index": [
    {
      "section": "섹션명",
      "items": ["소제목1", "소제목2", "정리하기", "아웃트로"]
    }
  ],
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
          { "id": "el-2", "order": 2, "type": "bullets", "items": ["항목1", "항목2"] }
        ]
      },
      "screen_desc": "화면 구성 설명 (이미지 번호, 모션 번호 등)",
      "narration": "#1 나레이션 텍스트 (150~200자, 구어체, 연결어로 마무리)"
    }
  ]
}
`;

// ─── 수정 모드 프롬프트 ──────────────────────────────────────────
const editPrompt = (slideContext: unknown, message: string) => `
${SKILL_SYSTEM_PROMPT}

너는 현재 슬라이드를 사용자 요청에 따라 수정하는 편집 모드다.

현재 슬라이드:
${JSON.stringify(slideContext, null, 2)}

사용자 요청: ${message}

## 출력 규칙
- { } 로 시작하고 끝나는 순수 JSON만 출력
- 코드블록(\`\`\`), 설명, 주석 절대 금지
- 수정하지 않는 필드도 그대로 포함할 것

{
  "summary": "수정 내용 한 줄 요약",
  "slide": {
    "title": "",
    "subtitle": "",
    "elements": []
  },
  "narration": "수정된 나레이션 (150~200자, 구어체, #큐 포함)"
}
`;

// ─── API 핸들러 ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();

    const isGenerateMode = !!pdfText;

    const userContent = isGenerateMode
      ? `원고를 분석하여 스토리보드를 생성해주세요.`
      : message;

    const systemContent = isGenerateMode
      ? generatePrompt(pdfText)
      : editPrompt(slideContext, message);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: isGenerateMode ? 8000 : 2000,
        system: systemContent,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    // JSON 파싱 (코드블록 제거 후 파싱)
    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // JSON 파싱 실패 시 원문 반환
      return NextResponse.json({ result: rawText, raw: true });
    }

    return NextResponse.json({ result: parsed });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}