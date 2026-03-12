import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, slideContext } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `당신은 이러닝 콘텐츠 스토리보드 편집 AI 어시스턴트입니다.
사용자가 슬라이드 수정을 요청하면 현재 슬라이드 컨텍스트를 분석하고 수정 내용을 요약해서 제공합니다.

현재 열려 있는 슬라이드 정보:
${JSON.stringify(slideContext, null, 2)}

응답은 반드시 한국어로 작성하고, 수정 내용을 1~2줄로 간결하게 요약해주세요.`,
        messages: [
          {
            role: "user",
            content: message,
          },
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
    const aiMessage = data.content?.[0]?.text || "수정 내용을 처리했습니다.";

    return NextResponse.json({ result: aiMessage });
  } catch (error) {
    console.error("AI edit error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
