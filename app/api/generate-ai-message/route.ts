import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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

type ClosedTrade = {
  symbol: string;
  side: "BUY" | "SELL";
  size: number;
  entryPrice?: number;
  exitPrice?: number;
  entryAt?: Date;
  exitAt?: Date;
  pips?: number;
  hold?: string;
};

type RequestBody = {
  summary: TradeSummary;
  recentTrades: ClosedTrade[];
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured on the server." },
      { status: 500 }
    );
  }
  const openai = new OpenAI({ apiKey });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { summary, recentTrades } = body;
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

  const recentTradesText = recentTrades
    .map(t => `- Pips: ${(t.pips ?? 0).toFixed(1)}, 保有時間: ${t.hold || 'N/A'}`)
    .join('\n');

  const prompt = `
おい、新人。てめえのトレード結果だ、よく見やがれ。

### 総合成績
- トレード回数: ${count}回
- 勝率: ${winRate.toFixed(1)}%
- 合計獲得pips: ${totalPips.toFixed(1)} pips
- ペイオフレシオ: ${isFinite(payoff) ? payoff.toFixed(2) : "算出不能"}
- 期待値/回: ${isFinite(expectancyQty) ? expectancyQty.toFixed(2) : "算出不能"} 円

### 直近のトレード（最大3件）
${recentTradesText.length > 0 ? recentTradesText : "データなし"}

### 指示
1.  まず、直近のトレード内容を分析しろ。特に、連敗していないか、損失が大きくなっていないか、無駄に短い時間でガチャガチャ取引していないか確認しろ。
2.  もし危険な兆候（3連敗、ロットを急に上げるなど）が見えたら、「おい、頭を冷やせ。30分PCから離れろ」「ロットを半分に落とせ」のように、具体的で強制力のある行動を命令しろ。
3.  直近に問題がなければ、総合成績を評価しろ。期待値がマイナスなら「そのやり方じゃ一生勝てねえぞ」と厳しく指摘し、改善点を一つだけ挙げろ。
4.  期待値がプラスでも、ペイオフレシオが1未満など、改善すべき点があれば指摘しろ。
5.  絶対に甘やかすな。慰めは不要だ。150字以内で、的を射た厳しい一言を叩きつけろ。
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "貴様は超一流のFXトレーダーであり、新人トレーダーを育てる鬼コーチだ。口調は常にタメ口で、厳しく、遠慮がない。相手を突き放すような厳しい言葉で、本質的なアドバイスを叩き込む。感情的な慰めは一切不要。目標はただ一つ、トレーダーを本気で勝たせることだ。",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 250,
      temperature: 0.8, // 少し上げて多様性を出す
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
