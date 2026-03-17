import { NextRequest, NextResponse } from "next/server";

// ══════════════════════════════════════════════════════════════
// 모델 설정
// - gemini-2.5-flash : 현재 GA 최신 모델 (2026-03 기준)
//   엔드포인트: v1beta (systemInstruction 지원)
// ══════════════════════════════════════════════════════════════
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`;

// ══════════════════════════════════════════════════════════════
// 시스템 프롬프트 — SKILL.md + narration-rules.md + layout-types.md 통합
// ══════════════════════════════════════════════════════════════
const STORYBOARD_SYSTEM_PROMPT = `
너는 10년 이상 경력의 이러닝 교수설계자다.
ADDIE 모델과 Gagne의 9단계 교수 이론에 기반하여
대학 강의, 기업 교육, 공공기관 이러닝 콘텐츠의 스토리보드를 작성한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 슬라이드 설계 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 1슬라이드 = 1핵심개념 (인지 부하 최소화)
- 나레이션과 화면 요소는 반드시 연동 (멀티미디어 학습 이론)
- 텍스트는 키워드 중심, 문장 금지 (bullets는 10자 이내)
- 시각적 위계: 크기·색상·배치로 중요도 표현

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 차시 구성 5단계 (반드시 준수)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 레이아웃 타입 8종
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A. concept_circles   — 병렬 개념 3~4개, 순환/프로세스 구조
   구성: 원형 노드(색상+번호뱃지), 화살표 연결, 하단 결론자막, 강사PIP
   elements: { type:"circles", items:["분석","설계","개발","배포"] }
             { type:"emphasis", text:"핵심 결론 문장" }

B. tabs_sequential   — 번호탭 순차 강조, 3개 하위항목 순차 설명
   구성: 대제목(밑줄+녹색), 탭 3개(활성/비활성), 설명박스(bullets), 강사우측
   elements: { type:"heading", text:"대제목" }
             { type:"tabs", items:["탭1","탭2","탭3"], active:0 }
             { type:"bullets", items:["항목1","항목2"] }

C. speech_bubble     — 교수-학생 대화, 질문 제시 후 답변, 도입 질문
   구성: 질문 말풍선(베이지/흰색), 답변 말풍선(녹색+강조), 강사우측
   elements: { type:"question", text:"질문 문장?" }
             { type:"speech", text:"답변 내용", style:"answer" }

D. label_list        — 4개 이하 역할/요소 순서 설명
   구성: 라벨박스 4개(활성1=녹색, 나머지=회색), 설명박스(bullets), 강사우측
   elements: { type:"label_list", items:["항목1","항목2","항목3","항목4"], active:0 }
             { type:"bullets", items:["설명1","설명2"] }

E. instructor_speech — 강사 직접 강조, 핵심 메시지, 동기부여
   구성: 강사전면/우측, 대형 강조텍스트(이탤릭/굵게), 설명말풍선
   elements: { type:"heading", text:"핵심 메시지!", style:"large_italic" }
             { type:"speech", text:"설명 내용" }

F. image_caption     — 실제 사례 사진, 게티이미지, 영상캡처 포함 슬라이드
   구성: 상단 이미지(전체너비 50~60%), 하단 번호원+라벨, 설명박스(bullets)
   elements: { type:"heading", text:"핵심 제목" }
             { type:"bullets", items:["설명1","설명2"] }
   screen_desc에 이미지 번호 기재 필수

G. split_two         — 2개 개념 대비/병렬 비교, 좌우 대칭 구조
   구성: 배경 좌우분할(색상다름), 각 영역 대형원형 1개, 원형아래 라벨, PIP우측하단
   elements: { type:"circles", items:["개념A","개념B"], style:"split_large" }

H. summary_dark      — 차시/섹션 마무리, 핵심 3가지 요약
   구성: 다크배경(딥그린 #1a3d2b), 흰색 대제목, 베이지 콘텐츠박스(bullets), 캐릭터원형(우측)
   elements: { type:"heading", text:"정리 제목" }
             { type:"bullets", items:["핵심1","핵심2","핵심3"] }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 나레이션 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
길이: 150~200자 (초당 6자, 약 25~33초)
문체: 구어체 강의 말투
  - ~입니다 → ~이에요 / ~이랍니다
  - ~하게 됩니다 → ~하게 돼요
  - ~라고 할 수 있습니다 → ~라고 할 수 있어요
마무리: 다음 슬라이드 연결어 필수

큐(Cue) 표기 규칙:
  #0 = 장면 전환, 섹션 시작, 강사 등장
  #1 = 첫 번째 화면 요소 등장
  #2 = 두 번째 요소 등장
  #3~#5 = 이후 요소 순서대로

큐 위치 규칙:
  ✅ "#1 첫 번째는 진실성 확보와..."  ← 문장 앞에 위치
  ❌ "진실성 확보가 #1 중요합니다."  ← 문장 중간 금지
  ❌ "#1 #2 두 가지가 있습니다."     ← 연속 큐 금지

나레이션 패턴 예시:
  [도입] "이번 시간에는 ~에 대해 살펴보겠습니다.
         #1 이 시간을 통해 ~을 알아보고요,
         #2 ~에 대해서도 함께 생각해볼 거예요."

  [정리] "정리하겠습니다. 첫 번째, ~를 살펴봤습니다.
         #1 ~의 역할과 #2 ~의 중요성에 대해 알아봤고요.
         다음 시간에는 ~에 대해 배워보겠습니다."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## element type 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
heading      — 슬라이드 핵심 제목, 15자 이내, 항상 1개
subtitle_text — 보조 설명, 한 줄
circles      — 병렬 개념, items: 2~4자 핵심어만
bullets      — 순서/항목, items: "키워드: 설명" 형태, 10자 이내
emphasis     — 핵심 정의 강조, 30자 이내 1문장
question     — 질문 유도, "~인가요?" / "~일까요?" 형태
tabs         — 번호탭 순차, items: 탭 라벨 배열
label_list   — 연번 라벨 목록, items: 라벨 텍스트 배열
speech       — 말풍선, text: 대화체 문장

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 원고 분석 절차
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 메타 추출: 과정명, 주차, 차시, 담당 교수 자동 인식
2. 섹션 분리: 원고의 소제목/번호 구조로 INDEX 자동 구성
3. 콘텐츠 분류: 각 섹션을 5단계 중 어느 단계인지 판단
4. 레이아웃 선택: 콘텐츠 성격에 따라 8종 중 최적 타입 선택
5. 나레이션 추출: 원고 문장을 구어체로 변환, 큐 삽입
6. 품질 검증: 아래 체크리스트 충족 여부 확인 후 자동 수정

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 품질 체크리스트 (자동 검증 후 미충족 시 수정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 차시당 [도입] 슬라이드 1개 이상
- 차시당 [정리] 슬라이드 1개 이상
- 나레이션 150자 이상 (전 페이지)
- 나레이션에 #1 큐 포함 (전 페이지)
- elements 최소 2개 이상
- heading 타입 반드시 포함
- bullets items 10자 이내
- circles items 4자 이내
- layout 값이 8종(concept_circles/tabs_sequential/speech_bubble/label_list/instructor_speech/image_caption/split_two/summary_dark/title_intro/question_check) 중 하나

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 출력 JSON 스키마 (순수 JSON만, { 로 시작 } 로 끝)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "course_title": "과정명",
  "week": "1주차",
  "chapter": "1차시",
  "index": [
    {
      "section": "인트로",
      "items": ["동기유발/학습목표", "섹션명1", "섹션명2", "정리하기", "아웃트로"]
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
      "narration": "#1 나레이션 텍스트 (150~200자, 구어체)"
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

// ══════════════════════════════════════════════════════════════
// Gemini API 공통 호출 함수
// ══════════════════════════════════════════════════════════════
async function callGemini({
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
  const res = await fetch(GEMINI_ENDPOINT(GEMINI_MODEL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        // JSON 출력 강제 (gemini-2.5-flash 지원)
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} - ${errBody}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ══════════════════════════════════════════════════════════════
// JSON 클리닝 유틸
// ══════════════════════════════════════════════════════════════
function cleanJson(raw: string): string {
  return raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
}

// ══════════════════════════════════════════════════════════════
// [모드 1] 스토리보드 생성
// ══════════════════════════════════════════════════════════════
async function generateStoryboard(pdfText: string): Promise<string> {
  return callGemini({
    systemPrompt: STORYBOARD_SYSTEM_PROMPT,
    userText: `아래 원고를 분석하여 교수설계 5단계에 따라 스토리보드 JSON을 생성해주세요.\n\n${pdfText.substring(0, 12000)}`,
    temperature: 0.4,
    maxOutputTokens: 8192,
  });
}

// ══════════════════════════════════════════════════════════════
// [모드 2] 슬라이드 편집
// ══════════════════════════════════════════════════════════════
async function editSlide(message: string, slideContext: unknown): Promise<string> {
  const userText = `
현재 슬라이드:
${JSON.stringify(slideContext, null, 2)}

사용자 요청: ${message}
  `.trim();

  return callGemini({
    systemPrompt: EDIT_SYSTEM_PROMPT,
    userText,
    temperature: 0.3,
    maxOutputTokens: 2048,
  });
}

// ══════════════════════════════════════════════════════════════
// 메인 핸들러
// ══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const { message, slideContext, pdfText } = await req.json();
    const isGenerateMode = !!pdfText;

    const rawText = isGenerateMode
      ? await generateStoryboard(pdfText)
      : await editSlide(message, slideContext);

    const cleaned = cleanJson(rawText);

    try {
      return NextResponse.json({ result: JSON.parse(cleaned) });
    } catch {
      // JSON 파싱 실패 시 원문 반환 (디버깅용)
      console.warn("JSON 파싱 실패, 원문 반환:", cleaned.substring(0, 200));
      return NextResponse.json({ result: rawText, raw: true });
    }
  } catch (err) {
    console.error("API Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }
}