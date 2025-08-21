"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Save, Wand2, FileText, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";


// 型が未定義なら仮置き（あとで整える）
type ClosedTrade = any;

/**
 * FX分析ツール（クライアントのみ）
 * シンプル & ミニマル版 UI
 * - 余計なグラデ/発光を削除し、余白・タイポ・コントラスト重視
 * - 解析は「保存」ボタンで反映
 */

export default function FXAnalyzer() {
  const [raw, setRaw] = useState(ExampleText.trim());

  // 保存後に反映される状態（自動更新しない）
  const [savedClosed, setSavedClosed] = useState<ClosedTrade[]>([]);
  const [savedErrors, setSavedErrors] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const summary = useMemo(() => summarize(savedClosed), [savedClosed]);

  function handleSave() {
    const parsed = parseFX(raw);
    const { merged, added } = mergeUniqueWithCount(savedClosed, parsed.closedTrades);
    setSavedClosed(merged);
    setSavedErrors((prev) => [...prev, ...parsed.errors]);

    const msg = added
      ? `追加：トレード ${added} 件（累計 ${merged.length} 件）`
      : parsed.errors.length
      ? `保存（追加なし・警告 ${parsed.errors.length} 件）`
      : "追加なし（重複）";
    setFlash(msg);
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="p-6 border-b border-neutral-800">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">FX分析ツール</h1>
        <p className="text-neutral-400 mt-1">テキストを貼り付け、「保存」を押すと新規/決済を突合して一覧とサマリーに反映します（USD/JPY想定・pips計算）。</p>
      </header>

      <main className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* 入力 */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold tracking-tight flex items-center gap-2"><FileText className="w-4 h-4 text-neutral-400"/>① ログ貼り付け</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRaw(ExampleText.trim())}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs flex items-center gap-1"
                title="サンプルを読み込む"
              >
                <Wand2 className="w-4 h-4"/> サンプル
              </button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
                title="解析して下の表に反映"
              >
                <Save className="w-4 h-4 inline -mt-0.5 mr-1"/>保存
              </motion.button>
            </div>
          </div>
          <textarea
            className="w-full h-72 md:h-96 resize-vertical rounded-lg bg-neutral-950 border border-neutral-800 focus:border-neutral-600 outline-none p-3 font-mono text-sm"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="ここに明細テキストを貼り付け（改行とタブはそのままでOK）"
          />
          <div className="mt-3 text-xs text-neutral-400">
            認識ヒント：<span className="font-mono">USD/JPY 成行 新規/決済</span> の行からブロックを検出し、 <span className="font-mono">買/売・数量・価格[成行]・約定済・日時・損益</span> を抽出します。
          </div>
        </Card>

        {/* サマリー（保存済） */}
        <Card>
          <h2 className="text-base font-semibold tracking-tight mb-3">② サマリー（保存済み）</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="トレード数" value={summary.count.toString()} />
            <Stat label="勝率" value={isFinite(summary.winRate) ? `${summary.winRate.toFixed(1)}%` : "-"} />
            <Stat label="合計P/L (pips)" value={fmtSigned(summary.totalPips)} intent={summary.totalPips >= 0 ? "up" : "down"} />
            <Stat label="平均P/L (pips)" value={isFinite(summary.avgPips) ? fmtSigned(summary.avgPips, 1) : "-"} intent={(summary.avgPips ?? 0) >= 0 ? "up" : "down"} />
            <Stat label="平均保有時間" value={summary.avgHold || "-"} />
            <Stat label="最大ドローダウン (pips)" value={fmtNum(summary.maxDD)} />
            {/* 追加: 損益合計 / 期待値 / ペイオフレシオ */}
            <Stat label="損益合計（数量×pips×100）" value={fmtSignedInt(summary.totalQtyPL)} intent={(summary.totalQtyPL ?? 0) >= 0 ? "up" : "down"} />
            <Stat label="期待値/回（数量×pips×100）" value={fmtSignedInt(summary.expectancyQty)} intent={(summary.expectancyQty ?? 0) >= 0 ? "up" : "down"} />
            <Stat label="ペイオフレシオ" value={isFinite(summary.payoff ?? NaN) ? (summary.payoff as number).toFixed(2) : "-"} />
          </div>

          {savedErrors.length > 0 && (
            <div className="mt-4 text-amber-300 text-sm">
              <p className="font-medium mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>警告（保存時のパース）</p>
              <ul className="list-disc pl-5 space-y-1">
                {savedErrors.map((e, i) => (
                  <li key={i} className="whitespace-pre-wrap">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* 決済済み一覧（保存済） */}
        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight mb-3">③ 決済済みトレード（保存済み）</h2>
          <DataTable
            columns={[
              { key: "symbol", label: "銘柄" },
              {
                key: "side",
                label: "方向",
                render: (r: ClosedTrade) => (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${r.side === "SELL" ? "border-rose-500/40 text-rose-300" : "border-emerald-500/40 text-emerald-300"}`}>
                    {r.side}
                  </span>
                ),
              },
              { key: "size", label: "数量", render: (r: ClosedTrade) => <span className="tabular-nums">{r.size.toFixed(1)}</span> },
              { key: "entryPrice", label: "建値", render: (r: ClosedTrade) => <span className="tabular-nums">{r.entryPrice?.toFixed(3) ?? ""}</span> },
              { key: "exitPrice", label: "決済", render: (r: ClosedTrade) => <span className="tabular-nums">{r.exitPrice?.toFixed(3) ?? ""}</span> },
              {
                key: "pips",
                label: "P/L (pips)",
                render: (r: ClosedTrade) => {
                  const v = r.pips ?? 0;
                  const signUp = v >= 0;
                  return (
                    <span className={`inline-flex items-center gap-1 tabular-nums ${signUp ? "text-emerald-300" : "text-rose-300"}`}>
                      {signUp ? <TrendingUp className="w-3.5 h-3.5"/> : <TrendingDown className="w-3.5 h-3.5"/>}
                      {Math.abs(v).toFixed(1)}
                    </span>
                  );
                },
              },
              {
                key: "plText",
                label: "損益（数量×pips×100）",
                render: (r: ClosedTrade) => {
                  const vExact = (r.pips ?? 0) * r.size * 100;
                  const v = Math.round(vExact);
                  const signUp = (v || 0) >= 0;
                  return (
                    <span className={`font-semibold tabular-nums ${signUp ? "text-emerald-200" : "text-rose-200"}`}>{isFinite(v as number) ? formatInt(v as number) : ""}</span>
                  );
                },
              },
              { key: "entryAt", label: "建玉日時", render: (r: ClosedTrade) => (r.entryAt ? fmtDate(r.entryAt) : "") },
              { key: "exitAt", label: "決済日時", render: (r: ClosedTrade) => (r.exitAt ? fmtDate(r.exitAt) : "") },
              { key: "hold", label: "保有", render: (r: ClosedTrade) => r.hold ?? "" },
            ]}
            rows={savedClosed}
          />
        </Card>

        {/* テストセクション */}
        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight mb-3">⑤ 内部テスト（β）</h2>
          <p className="text-neutral-400 text-sm mb-3">最低限の自己診断テストを実装。クリックで実行 → 結果が下に表示されます。</p>
          <TestSuite />
        </Card>
      </main>

      <footer className="px-6 pb-10 text-center text-xs text-neutral-500">
        解析ロジックは最小限のヒューリスティック（正規表現 & FIFO 突合）です。実データでズレる場合はその例を貼ってください。精度を上げます。
      </footer>

      {/* フラッシュトースト（控えめ）*/}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: flash ? 0 : 20, opacity: flash ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="pointer-events-none fixed bottom-6 right-6"
      >
        {flash && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
            <span className="text-sm">{flash}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 ${className}`}>
      {children}
    </div>
  );
}

function Stat({ label, value, intent }: { label: string; value: string; intent?: "up" | "down" }) {
  const Icon = intent === "down" ? TrendingDown : TrendingUp;
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
      <div className="text-xs text-neutral-400 flex items-center gap-1">
        {intent && <Icon className={`w-3.5 h-3.5 ${intent === "down" ? "text-rose-300" : "text-emerald-300"}`} />}
        {label}
      </div>
      <div className="text-xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[];
  rows: Record<string, any>[];
}) {
  return (
    <div className="overflow-auto rounded-lg border border-neutral-800">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="text-left bg-neutral-950">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium text-neutral-300 border-b border-neutral-800 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-neutral-400" colSpan={columns.length}>
                データなし
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-neutral-900 hover:bg-neutral-900/60">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 whitespace-nowrap align-middle">
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ========= パーサ & ロジック =========

type RawBlock = {
  header: string; // 例: "USD/JPY\t成行\t決済"
  lines: string[]; // ブロック内の残り行
};

type Event = {
  symbol: string;
  action: "新規" | "決済";
  side: "買" | "売";
  size: number; // ロット
  orderPrice?: number; // [成行] 左の数値（ユーザー仕様）
  fillPrice?: number; // 2行目の先頭値（参考、使わない）
  at?: Date; // 行のどこかにある日時
  ticket?: string; // 末尾のチケット番号
  rawPLText?: string; // "+108" 等（決済ブロックで見つかったら）
};

type ClosedTrade = {
  symbol: string;
  side: "BUY" | "SELL";
  size: number;
  entryPrice?: number;
  exitPrice?: number;
  entryAt?: Date;
  exitAt?: Date;
  pips?: number; // 推定pips（USDJPY想定）
  plText?: string; // 表示用（数量×pips×100 を入れる）
  hold?: string; // 保有時間テキスト
  ticketOpen?: string;
  ticketClose?: string;
};

type OpenPosition = {
  symbol: string;
  side: "BUY" | "SELL";
  size: number;
  entryPrice?: number;
  entryAt?: Date;
  ticketOpen?: string;
};

function parseFX(input: string) {
  const errors: string[] = [];
  const blocks = splitBlocks(input);

  const events: Event[] = [];

  for (const b of blocks) {
    const head = b.header.trim();
    const mHead = head.match(/^(\S+)\s+\S+\s+(新規|決済)$/);
    if (!mHead) {
      errors.push(`ブロック見出しを認識できませんでした: "${head}"`);
      continue;
    }
    const symbol = mHead[1];
    const action = mHead[2] as Event["action"];

    let side: Event["side"] | undefined;
    let size: number | undefined;
    let orderPrice: number | undefined;
    let fillPrice: number | undefined;
    let at: Date | undefined;
    let ticket: string | undefined;
    let rawPLText: string | undefined;

    // 1行目（側・数量・指値[成行]） → [成行] の左にある数値を orderPrice とする
    const l1 = (b.lines[0] ?? "").trim();
    const m1 = l1.match(/^\s*(買|売)\s*([\d.]+)\s*([\d.]+)\[(?:[^\]]+)\]/);
    if (m1) {
      side = m1[1] as Event["side"];
      size = parseFloat(m1[2]);
      orderPrice = safeNum(m1[3]);
    } else {
      errors.push(`方向/数量/建値を読めませんでした: "${l1}"`);
    }

    // 2行目（約定済 価格 … 日時） → 価格は使わず、日時のみ拾う
    const l2 = (b.lines[1] ?? "").trim();
    const m2a = l2.match(/^(\d+[\d.]*?)\s*\S*\s*(\d+[\d.]*)\s*(\d{2}\/\d{2}\/\d{2} \d{2}):(\d{2}):(\d{2})/);
    if (m2a) {
      // 参考として fillPrice を保持するが、エントリー/エグジットには使わない（ユーザー仕様）
      fillPrice = safeNum(m2a[1]);
      const ts = `${m2a[3]}:${m2a[4]}:${m2a[5]}`;
      at = parseJpDateTime(ts) || at;
    } else {
      // 日時だけでも拾う
      const dt = l2.match(/(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
      if (dt) at = parseJpDateTime(dt[1]);
    }

    // 3行目（損益 + 日時）
    const l3 = b.lines[2] ?? "";
    const m3 = l3.match(/([+\-]?\d[\d,]*)/);
    if (m3) rawPLText = m3[1].replace(/,/g, "");
    const dt3 = l3.match(/(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
    if (!at && dt3) at = parseJpDateTime(dt3[1]);

    // 4行目（ハイフン + チケット） or 他行
    for (const ln of b.lines) {
      const t = ln.match(/\b(\d{6,})\b/);
      if (t) {
        ticket = t[1];
        break;
      }
    }

    if (!side || size == null) {
      errors.push(`必須項目が不足しているため、このブロックを無視: "${head}"`);
      continue;
    }

    events.push({ symbol, action, side, size, orderPrice, fillPrice, at, ticket, rawPLText });
  }

  // 時系列で突合（FIFO）
  events.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));

  const openQueues: Record<string, OpenPosition[]> = {};
  const closedTrades: ClosedTrade[] = [];

  function pushOpen(e: Event) {
    const key = `${e.symbol}`;
    if (!openQueues[key]) openQueues[key] = [];
    openQueues[key].push({
      symbol: e.symbol,
      side: e.side === "買" ? "BUY" : "SELL",
      size: e.size,
      entryPrice: e.orderPrice, // ユーザー仕様：新規の [成行] 左の数値
      entryAt: e.at,
      ticketOpen: e.ticket,
    });
  }

  function popMatch(symbol: string, opposite: "BUY" | "SELL", size: number) {
    const key = `${symbol}`;
    const q = openQueues[key] || [];
    for (let i = 0; i < q.length; i++) {
      const pos = q[i];
      if (pos.side === opposite && Math.abs(pos.size - size) < 1e-6) {
        q.splice(i, 1);
        return pos;
      }
    }
    return undefined;
  }

  for (const e of events) {
    if (e.action === "新規") {
      pushOpen(e);
    } else {
      const sideClose: "BUY" | "SELL" = e.side === "買" ? "BUY" : "SELL"; // 決済側
      const needOpposite: "BUY" | "SELL" = sideClose === "BUY" ? "SELL" : "BUY";
      const matched = popMatch(e.symbol, needOpposite, e.size);

      const entryPrice = matched?.entryPrice;
      const exitPrice = e.orderPrice; // ユーザー仕様：決済の [成行] 左の数値

      const trade: ClosedTrade = {
        symbol: e.symbol,
        side: matched?.side || (needOpposite === "BUY" ? "BUY" : "SELL"), // 建玉側
        size: e.size,
        entryPrice,
        exitPrice,
        entryAt: matched?.entryAt,
        exitAt: e.at,
        ticketOpen: matched?.ticketOpen,
        ticketClose: e.ticket,
      };

      // pips 推定（USDJPYは 0.01 = 1pip として100倍）
      if (entryPrice != null && exitPrice != null) {
        const sign = trade.side === "BUY" ? 1 : -1;
        const pips = (exitPrice - entryPrice) * sign * 100; // USDJPY想定
        trade.pips = pips;
        // 表示用：数量×pips×100（整数）
        trade.plText = Math.round(pips * e.size * 100).toString();
      }

      // 保有時間
      if (trade.entryAt && trade.exitAt) {
        trade.hold = humanizeDuration(trade.exitAt.getTime() - trade.entryAt.getTime());
      }

      closedTrades.push(trade);
    }
  }

  // 未決済（UIでは使わないが関数は返す）
  const openPositions: OpenPosition[] = Object.values(openQueues).flat();

  return { closedTrades, openPositions, errors };
}

function splitBlocks(input: string): RawBlock[] {
  const lines = input.replace(/\r/g, "").split(/\n+/);
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  for (const ln of lines) {
    if (/^\S+\s+\S+\s+(新規|決済)$/.test(ln.trim())) {
      // 新しいブロック開始
      if (current) blocks.push(current);
      current = { header: ln, lines: [] };
    } else if (current) {
      current.lines.push(ln);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function parseJpDateTime(s: string): Date | undefined {
  // 例: 25/08/21 03:13:25 -> 2025-08-21T03:13:25 (ローカル)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const yy = parseInt(m[1], 10);
  const year = 2000 + yy; // 00-99 を 2000-2099 とみなす
  const mo = parseInt(m[2], 10) - 1;
  const da = parseInt(m[3], 10);
  const hh = parseInt(m[4], 10);
  const mm = parseInt(m[5], 10);
  const ss = parseInt(m[6], 10);
  return new Date(year, mo, da, hh, mm, ss);
}

function humanizeDuration(ms: number) {
  if (!isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [] as string[];
  if (h) parts.push(`${h}時間`);
  if (m) parts.push(`${m}分`);
  if (sec && !h) parts.push(`${sec}秒`);
  return parts.join("") || "0秒"; // 修正済み
}

function safeNum(x?: string | number | null) {
  if (x == null) return undefined;
  const n = typeof x === "number" ? x : parseFloat(String(x).replace(/,/g, ""));
  return isFinite(n) ? n : undefined;
}

function fmtNum(n?: number) {
  if (n == null || !isFinite(n)) return "-";
  return Math.round(n).toString();
}

function fmtSigned(n?: number, digits = 0) {
  if (n == null || !isFinite(n)) return "-";
  const s = (Math.abs(n)).toFixed(digits);
  return `${n >= 0 ? "+" : "-"}${s}`;
}

function fmtSignedInt(n?: number) {
  if (n == null || !isFinite(n)) return "-";
  const abs = Math.round(Math.abs(n));
  try {
    return `${n >= 0 ? "+" : "-"}${abs.toLocaleString()}`;
  } catch {
    return `${n >= 0 ? "+" : "-"}${abs}`;
  }
}

function formatInt(n: number) {
  try { return Math.round(n).toLocaleString(); } catch { return Math.round(n).toString(); }
}

function fmtDate(d?: Date) {
  if (!d) return "";
  const y = d.getFullYear();
  const mo = `${d.getMonth() + 1}`.padStart(2, "0");
  const da = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  const ss = `${d.getSeconds()}`.padStart(2, "0");
  return `${y}/${mo}/${da} ${hh}:${mm}:${ss}`;
}

function summarize(rows: ClosedTrade[]) {
  if (rows.length === 0) return { count: 0, winRate: NaN, totalPips: 0, avgPips: NaN, avgHold: "", maxDD: 0, totalQtyPL: 0, expectancyQty: NaN, payoff: NaN };

  let wins = 0;
  let totalPips = 0;
  let holds: number[] = [];
  let equity = 0;
  let maxDD = 0;
  let peak = 0;

  // 損益（数量×pips×100）関連
  let totalQtyPLExact = 0; // 小数で集計→最後に丸め
  const winsQty: number[] = [];
  const lossesQty: number[] = [];

  for (const r of rows) {
    const p = r.pips ?? 0;
    totalPips += p;
    equity += p;
    peak = Math.max(peak, equity);
    maxDD = Math.min(maxDD, equity - peak);
    if (p > 0) wins++;

    // 期待値・ペイオフ用
    const plQtyExact = p * (r.size ?? 0) * 100;
    totalQtyPLExact += plQtyExact;
    if (plQtyExact > 0) winsQty.push(plQtyExact);
    else if (plQtyExact < 0) lossesQty.push(plQtyExact);

    if (r.entryAt && r.exitAt) holds.push(r.exitAt.getTime() - r.entryAt.getTime());
  }

  const avgHoldMs = holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : 0;

  const avgWinQty = winsQty.length ? winsQty.reduce((a, b) => a + b, 0) / winsQty.length : NaN; // 正
  const avgLossQty = lossesQty.length ? lossesQty.reduce((a, b) => a + b, 0) / lossesQty.length : NaN; // 負
  const payoff = isFinite(avgWinQty) && isFinite(avgLossQty) && avgLossQty !== 0 ? Math.abs(avgWinQty / avgLossQty) : NaN;

  const totalQtyPL = Math.round(totalQtyPLExact);
  const expectancyQty = rows.length ? totalQtyPLExact / rows.length : NaN; // 1トレードあたり

  return {
    count: rows.length,
    winRate: (wins / rows.length) * 100,
    totalPips,
    avgPips: totalPips / rows.length,
    avgHold: humanizeDuration(avgHoldMs),
    maxDD: Math.abs(Math.round(maxDD)),
    totalQtyPL,
    expectancyQty,
    payoff,
  };
}

// === 追加: 既存 + 新規をユニーク結合 ===
function tradeKey(t: ClosedTrade): string {
  const ep = t.entryPrice != null ? t.entryPrice.toFixed(5) : "";
  const xp = t.exitPrice != null ? t.exitPrice.toFixed(5) : "";
  const ea = t.entryAt ? t.entryAt.getTime() : "";
  const xa = t.exitAt ? t.exitAt.getTime() : "";
  const sz = (t.size ?? 0).toFixed(4);
  return [t.symbol, t.side, sz, ep, xp, ea, xa, t.ticketOpen || "", t.ticketClose || ""].join("|");
}

function mergeUniqueWithCount(prev: ClosedTrade[], incoming: ClosedTrade[]) {
  const set = new Set(prev.map(tradeKey));
  const merged = [...prev];
  let added = 0;
  for (const t of incoming) {
    const k = tradeKey(t);
    if (!set.has(k)) {
      merged.push(t);
      set.add(k);
      added++;
    }
  }
  return { merged, added };
}

// ====== 簡易テストスイート ======
function TestSuite() {
  const [results, setResults] = useState<{ name: string; ok: boolean; detail?: string }[] | null>(null);

  function run() {
    const out: { name: string; ok: boolean; detail?: string }[] = [];

    function assert(name: string, cond: boolean, detail?: string) {
      out.push({ name, ok: !!cond, detail });
    }

    // T0: 日本語トークン（買/売）が正しくマッチする
    const sampleL1 = "買\t2.7\t147.170[成行]";
    const m1 = sampleL1.match(/^\s*(買|売)\s*([\d.]+)\s*([\d.]+)\[(?:[^\]]+)\]/);
    assert("T0-1 m1 matched", !!m1, `line='${sampleL1}'`);
    assert("T0-2 side=買", m1 && m1[1] === "買", `got ${m1 && m1[1]}`);

    // T1: 新規(売) → 決済(買) のFIFO突合と価格取り出し・pips計算
    const p1 = parseFX(ExampleText);
    const t1 = p1.closedTrades[0];
    assert("T1-1 no-parse-errors", p1.errors.length === 0, `errors: ${p1.errors.join(" | ")}`);
    assert("T1-2 closed=1", p1.closedTrades.length === 1, `got ${p1.closedTrades.length}`);
    assert("T1-3 open=0", p1.openPositions.length === 0, `got ${p1.openPositions.length}`);
    assert("T1-4 side SELL", t1?.side === "SELL", `got ${t1?.side}`);
    assert("T1-4b entryPrice=147.174", Math.abs((t1?.entryPrice ?? NaN) - 147.174) < 0.0005, `got ${t1?.entryPrice}`);
    assert("T1-4c exitPrice=147.170", Math.abs((t1?.exitPrice ?? NaN) - 147.170) < 0.0005, `got ${t1?.exitPrice}`);
    const pipsRounded = t1?.pips != null ? Math.round(t1.pips * 10) / 10 : NaN; // 1桁丸め
    assert("T1-5 pips ≈ 0.4", Math.abs((pipsRounded ?? NaN) - 0.4) < 0.11, `got ${pipsRounded}`);
    // T1-6 数量×pips×100 の表示値（整数化）
    const px100qty = t1?.pips != null ? Math.round(t1.pips * t1.size * 100) : NaN;
    assert("T1-6 qty×pips×100 = 108", Math.abs((px100qty ?? NaN) - 108) < 1, `got ${px100qty}`);

    // T5: サマリーの新指標
    const s = summarize(p1.closedTrades);
    assert("T5-1 損益合計=108", Math.abs((s.totalQtyPL ?? NaN) - 108) < 1, `got ${s.totalQtyPL}`);
    assert("T5-2 期待値=108/回", Math.abs(Math.round((s.expectancyQty ?? NaN)) - 108) < 1, `got ${s.expectancyQty}`);
    assert("T5-3 ペイオフは定義不能（-）", !isFinite(s.payoff ?? NaN), `got ${s.payoff}`);

    // T6: 追加保存は既存に追記（重複は無視）
    const m = mergeUniqueWithCount(p1.closedTrades, p1.closedTrades);
    assert("T6-1 追加0件", m.added === 0, `added=${m.added}`);
    assert("T6-2 長さ変わらず", m.merged.length === p1.closedTrades.length, `len=${m.merged.length}`);

    setResults(out);
  }

  return (
    <div>
      <button onClick={run} className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs">テストを実行</button>
      {results && (
        <ul className="mt-3 space-y-1 text-sm">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? "text-emerald-300" : "text-rose-300"}>
              {r.ok ? "✅" : "❌"} {r.name} {r.detail ? <span className="text-neutral-400">({r.detail})</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ExampleText = `
USD/JPY	成行	決済
買	2.7	147.170[成行]
147.210	約定済	147.170	25/08/21 03:13:25
25/08/20	+108		25/08/21 03:13:25
-	063257	
USD/JPY	成行	新規
売	2.7	147.174[成行]
147.208	約定済	147.174	25/08/21 03:06:26		0	25/08/21 03:06:26
-	063256	
`;
