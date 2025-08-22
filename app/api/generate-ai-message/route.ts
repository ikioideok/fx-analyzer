import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the structure of the summary data we expect
type TradeSummary = {
  count: number;
  winRate: number;
  totalPips: number;
  avgPips: number;
  avgHold: string;
  maxDD: number;
  totalQtyPL: number;
  expectancyQty: number;
  payoff: number;
};

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured on the server." },
      { status: 500 }
    );
  }

  let summary: TradeSummary;
  try {
    summary = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    count,
    winRate,
    totalPips,
    payoff,
    expectancyQty
  } = summary;

  // Do not call API if there's no data
  if (count === 0) {
    return NextResponse.json({ message: "トレードデータがありません。分析を開始するには、まずログを保存してください。" });
  }

  const prompt = `
あなたはプロのFXトレーディングコーチです。以下のトレード分析結果を基に、トレーダーへのアドバイスを日本語で、親しみやすく、かつ的確に150字以内で生成してください。

### トレード分析結果
- トレード回数: ${count}回
- 勝率: ${winRate.toFixed(1)}%
- 合計獲得pips: ${totalPips.toFixed(1)} pips
- ペイオフレシオ: ${isFinite(payoff) ? payoff.toFixed(2) : "算出不能"}
- 期待値 (1トレードあたり): ${isFinite(expectancyQty) ? expectancyQty.toFixed(2) : "算出不能"} 円

### 指示
- 勝率とペイオフレシオの関係性に注目してください。
- 期待値がプラスかマイナスかを基に、現状のトレードスタイルの評価をしてください。
- 今後改善すべき点を、具体的かつ簡潔に指摘してください。
- 全体として、ポジティブでモチベーションが上がるようなトーンでお願いします。
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using the latest powerful model
      messages: [
        {
          role: "system",
          content: "あなたはプロのFXトレーディングコーチです。親しみやすいトーンで、的確なアドバイスを日本語で提供します。",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 250,
      temperature: 0.7,
    });

    const message = response.choices[0]?.message?.content?.trim() || "AIからのメッセージ生成に失敗しました。";
    return NextResponse.json({ message });

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return NextResponse.json(
      { error: "Failed to get a response from OpenAI." },
      { status: 500 }
    );
  }
}
