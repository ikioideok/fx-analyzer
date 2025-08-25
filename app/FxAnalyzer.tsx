"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Save, Wand2, FileText, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Edit, Tag, Trash2 } from "lucide-react";
import AnalysisMenu from "./AnalysisMenu";
import AnalysisViewer from "./AnalysisViewer";
import { ClosedTrade, Snapshot, GoalProjection } from './types';
import { DataTable } from "./DataTable";
import { Card, Stat } from './shared/components';
import {
  summarize, isSameLocalDate, toLocalDateKey, parseFX, mergeUniqueWithCount,
  saveTradesToLocalStorage, reviveClosedTradeDates, tradeKey, fmtSignedInt,
  formatInt, getWinRateColor, fmtSigned, fmtNum, fmtDate
} from './utils';

// Main component
export default function FXAnalyzer() {
  const [raw, setRaw] = useState(ExampleText.trim());
  const [savedClosed, setSavedClosed] = useState<ClosedTrade[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem("fx_analyzer_main_trades_v2");
      return saved ? JSON.parse(saved).map(reviveClosedTradeDates) : [];
    } catch (e) { return []; }
  });
  const [savedErrors, setSavedErrors] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [selectedTrades, setSelectedTrades] = useState(new Set<string>());
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>('calendar');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useState<string | null>(null);
  const [startBalance, setStartBalance] = useState(165541);
  const [targetBalance, setTargetBalance] = useState(1000000);

  const summary = useMemo(() => summarize(savedClosed), [savedClosed]);

  const projectedPl = useMemo(() => {
    const now = new Date();
    const todaysTrades = savedClosed.filter(t => t.exitAt && isSameLocalDate(now, t.exitAt));
    if (todaysTrades.length < 2) return null;
    todaysTrades.sort((a, b) => (a.exitAt?.getTime() ?? 0) - (b.exitAt?.getTime() ?? 0));
    const firstTradeTime = todaysTrades[0].exitAt!.getTime();
    const lastTradeTime = todaysTrades[todaysTrades.length - 1].exitAt!.getTime();
    const durationMs = lastTradeTime - firstTradeTime;
    if (durationMs <= 0) return null;
    const durationHours = durationMs / (1000 * 60 * 60);
    const todayPl = todaysTrades.reduce((sum, trade) => sum + (trade.pips ?? 0) * trade.size * 100, 0);
    const profitRatePerHour = todayPl / durationHours;
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const remainingMs = endOfDay.getTime() - lastTradeTime;
    const remainingHours = Math.max(0, remainingMs / (1000 * 60 * 60));
    return todayPl + (profitRatePerHour * remainingHours);
  }, [savedClosed]);

  const tagAnalysis = useMemo(() => {
    const allTags = new Set<string>();
    savedClosed.forEach(trade => trade.tags?.forEach(tag => allTags.add(tag)));
    const uniqueTags = Array.from(allTags);
    if (uniqueTags.length === 0) return [];
    const analysisResults = uniqueTags.map(tag => ({
      tagName: tag,
      summary: summarize(savedClosed.filter(trade => trade.tags?.includes(tag))),
    }));
    analysisResults.sort((a, b) => b.summary.count - a.summary.count);
    return analysisResults;
  }, [savedClosed]);

  const longTermProjection = useMemo(() => {
    if (savedClosed.length === 0) return null;
    const tradeDays = new Set(savedClosed.map(t => t.exitAt ? toLocalDateKey(t.exitAt) : null).filter(Boolean));
    const numberOfDays = tradeDays.size;
    if (numberOfDays === 0) return null;
    const avgDailyPL = summary.totalQtyPL / numberOfDays;
    const currentBalance = startBalance + summary.totalQtyPL;
    return {
      avgDailyPL,
      weekly: { balance: currentBalance + (avgDailyPL * 7), gain: avgDailyPL * 7 },
      monthly: { balance: currentBalance + (avgDailyPL * 30), gain: avgDailyPL * 30 },
      yearly: { balance: currentBalance + (avgDailyPL * 365), gain: avgDailyPL * 365 },
    };
  }, [savedClosed, startBalance, summary.totalQtyPL]);

  const goalProjection = useMemo((): GoalProjection => {
    const currentBalance = startBalance + summary.totalQtyPL;
    if (targetBalance <= currentBalance) return { status: 'achieved', days: 0 };
    if (!longTermProjection || longTermProjection.avgDailyPL <= 0) return { status: 'unreachable', days: Infinity };
    const profitNeeded = targetBalance - currentBalance;
    return { status: 'projected', days: Math.ceil(profitNeeded / longTermProjection.avgDailyPL) };
  }, [targetBalance, startBalance, summary.totalQtyPL, longTermProjection]);

  const dailyPL = useMemo(() => {
    return savedClosed.reduce((acc, trade) => {
      if (trade.exitAt && trade.pips != null) {
        const dateKey = toLocalDateKey(trade.exitAt);
        const pl = trade.pips * trade.size * 100;
        acc[dateKey] = (acc[dateKey] || 0) + pl;
      }
      return acc;
    }, {} as { [key: string]: number });
  }, [savedClosed]);

  function handleSave() {
    const parsed = parseFX(raw);
    const { merged, added } = mergeUniqueWithCount(savedClosed, parsed.closedTrades);
    setSavedClosed(merged);
    saveTradesToLocalStorage(merged);
    setSavedErrors(prev => [...prev, ...parsed.errors]);
    const msg = added ? `追加：トレード ${added} 件（累計 ${merged.length} 件）` : parsed.errors.length ? `保存（追加なし・警告 ${parsed.errors.length} 件）` : "追加なし（重複）";
    setFlash(msg);
  }

  function handleSaveTrades() {
    if (savedClosed.length === 0) return setFlash("保存するトレードがありません");
    const tradesByDate = savedClosed.reduce((acc, trade) => {
      const d = trade.exitAt ?? trade.entryAt;
      if (d) {
        const dateKey = toLocalDateKey(d);
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(trade);
      }
      return acc;
    }, {} as Record<string, ClosedTrade[]>);

    let savedCount = 0;
    let lastKey = '';
    Object.keys(tradesByDate).forEach(dateKey => {
      const trades = tradesByDate[dateKey];
      const key = `fx_trades:${dateKey}`;
      const payload = { date: dateKey, count: trades.length, trades: trades, summary: summarize(trades), savedAt: new Date().toISOString() };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(payload));
        savedCount += trades.length;
        lastKey = key;
      }
    });

    if (savedCount > 0) {
      setFlash(`保存しました（${Object.keys(tradesByDate).length}日分、合計 ${savedCount}件）`);
      refreshSnapshots();
      if (lastKey) setSelectedSnapshotKey(lastKey);
    } else {
      setFlash("保存対象のトレードが見つかりませんでした");
    }
  }

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(timer);
  }, [flash]);

  function refreshSnapshots() {
    if (typeof window === "undefined") return;
    const list: Snapshot[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("fx_trades:")) {
        try {
          const rawData = window.localStorage.getItem(k);
          if (rawData) {
            const obj = JSON.parse(rawData);
            list.push({
              key: k,
              dateKey: obj.date || k.split(":")[1],
              savedAt: obj.savedAt || new Date().toISOString(),
              count: obj.count ?? obj.trades?.length ?? 0,
              summary: obj.summary ?? summarize([]),
              trades: (obj.trades || []).map(reviveClosedTradeDates),
            });
          }
        } catch {}
      }
    }
    list.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    setSnapshots(list);
    if (!selectedSnapshotKey && list.length > 0) setSelectedSnapshotKey(list[0].key);
  }

  useEffect(refreshSnapshots, []);

  function handleEditTags() {
    if (selectedTrades.size === 0) return setFlash("タグを編集するトレードを選択してください");
    const first = savedClosed.find(t => selectedTrades.has(tradeKey(t)));
    const input = prompt(`${selectedTrades.size}件のトレードにタグを付けます`, first?.tags?.join(", ") || "");
    if (input === null) return;
    const newTags = input.trim() ? input.split(',').map(tag => tag.trim()).filter(Boolean) : [];
    const newSavedClosed = savedClosed.map(t => selectedTrades.has(tradeKey(t)) ? { ...t, tags: newTags } : t);
    setSavedClosed(newSavedClosed);
    saveTradesToLocalStorage(newSavedClosed);
    setFlash(`${selectedTrades.size}件のトレードのタグを更新しました`);
    setSelectedTrades(new Set());
  }

  function handleDelete() {
    const newSavedClosed = savedClosed.filter(t => !selectedTrades.has(tradeKey(t)));
    setSavedClosed(newSavedClosed);
    saveTradesToLocalStorage(newSavedClosed);
    setFlash(`削除：トレード ${selectedTrades.size} 件`);
    setSelectedTrades(new Set());
  }

  function handleResetHistory() {
    if (typeof window === "undefined") return;
    const keys = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)).filter(k => k?.startsWith("fx_trades:"));
    if (keys.length > 0 && confirm(`${keys.length}件の保存履歴を削除しますか？`)) {
      keys.forEach(k => window.localStorage.removeItem(k!));
      setFlash("保存履歴をリセットしました");
      refreshSnapshots();
      setSelectedSnapshotKey(null);
    }
  }

  function handleEdit() { alert('編集機能は未実装です。'); }

  function handleSelectTrade(key: string) {
    const newSelection = new Set(selectedTrades);
    newSelection.has(key) ? newSelection.delete(key) : newSelection.add(key);
    setSelectedTrades(newSelection);
  }

  function handleSelectAll() {
    setSelectedTrades(selectedTrades.size === savedClosed.length ? new Set() : new Set(savedClosed.map(tradeKey)));
  }

  const analysisViewerProps = {
    activeAnalysis, dailyPL, summary, startBalance, setStartBalance, longTermProjection,
    goalProjection, targetBalance, setTargetBalance,
    snapshots, selectedSnapshotKey, setSelectedSnapshotKey,
    handleResetHistory, tagAnalysis, TestSuite,
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="p-6 border-b border-neutral-800">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">FX分析ツール</h1>
        <p className="text-neutral-400 mt-1">テキストを貼り付け、「保存」を押すと新規/決済を突合して一覧とサマリーに反映します（USD/JPY想定・pips計算）。</p>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold tracking-tight flex items-center gap-2"><FileText className="w-4 h-4 text-neutral-400"/>① ログ貼り付け</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRaw(ExampleText.trim())} className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs flex items-center gap-1" title="サンプルを読み込む"><Wand2 className="w-4 h-4"/> サンプル</button>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium" title="解析して下の表に反映"><Save className="w-4 h-4 inline -mt-0.5 mr-1"/>保存</motion.button>
                  </div>
                </div>
                <textarea className="w-full h-72 md:h-96 resize-vertical rounded-lg bg-neutral-950 border border-neutral-800 focus:border-neutral-600 outline-none p-3 font-mono text-sm" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="ここに明細テキストを貼り付け（改行とタブはそのままでOK）" />
                <div className="mt-3 text-xs text-neutral-400">認識ヒント：<span className="font-mono">USD/JPY 成行 新規/決済</span> の行からブロックを検出し、 <span className="font-mono">買/売・数量・価格[成行]・約定済・日時・損益</span> を抽出します。</div>
              </Card>

              <Card>
                <h2 className="text-base font-semibold tracking-tight mb-3">② サマリー（保存済み）</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="トレード数" value={summary.count.toString()} />
                  <Stat label="勝率" value={isFinite(summary.winRate) ? `${summary.winRate.toFixed(1)}%` : "-"} valueClassName={getWinRateColor(summary.winRate)} />
                  <Stat label="合計P/L (pips)" value={fmtSigned(summary.totalPips)} intent={summary.totalPips >= 0 ? "up" : "down"} />
                  <Stat label="平均P/L (pips)" value={isFinite(summary.avgPips) ? fmtSigned(summary.avgPips, 1) : "-"} intent={(summary.avgPips ?? 0) >= 0 ? "up" : "down"} />
                  <Stat label="平均保有時間" value={summary.avgHold || "-"} />
                  <Stat label="最大ドローダウン (pips)" value={fmtNum(summary.maxDD)} intent="down" />
                  <Stat label="損益合計（円）" value={fmtSignedInt(summary.totalQtyPL)} intent={(summary.totalQtyPL ?? 0) >= 0 ? "up" : "down"} />
                  <Stat label="期待値/回（円）" value={fmtSignedInt(summary.expectancyQty)} intent={(summary.expectancyQty ?? 0) >= 0 ? "up" : "down"} />
                </div>
                {savedErrors.length > 0 && (
                  <div className="mt-4 text-amber-300 text-sm">
                    <p className="font-medium mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>警告</p>
                    <ul className="list-disc pl-5 space-y-1">{savedErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </div>
                )}
                <div className="mt-4 border-t border-neutral-800 pt-4">
                  <h3 className="text-sm font-semibold tracking-tight mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-neutral-400"/> 本日の着地予想</h3>
                  <div className="text-2xl font-bold tabular-nums">{projectedPl !== null ? <span className={projectedPl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fmtSignedInt(projectedPl)}</span> : <span className="text-sm text-neutral-500">本日2トレード以上で表示</span>}</div>
                  <p className="text-xs text-neutral-500 mt-1">現在のペースでトレードを続けた場合の損益予測です。</p>
                </div>
              </Card>
            </div>

            <Card>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-semibold tracking-tight">③ 決済済みトレード（保存済み）</h2>
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveTrades} className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs flex items-center gap-1" title="表示中のトレードを日付ごとにローカル保存"><Save className="w-3.5 h-3.5 mr-1"/>トレードを保存</button>
                  <button onClick={handleEditTags} disabled={selectedTrades.size === 0} className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"><Tag className="w-3.5 h-3.5 mr-1"/>タグ編集 ({selectedTrades.size})</button>
                  <button onClick={handleEdit} disabled={selectedTrades.size === 0} className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"><Edit className="w-3.5 h-3.5 mr-1"/>編集</button>
                  <button onClick={handleDelete} disabled={selectedTrades.size === 0} className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 className="w-3.5 h-3.5 mr-1"/>削除 ({selectedTrades.size})</button>
                </div>
              </div>
              <DataTable columns={[ { key: "select", label: <input type="checkbox" checked={savedClosed.length > 0 && selectedTrades.size === savedClosed.length} onChange={handleSelectAll} className="form-checkbox h-4 w-4 bg-neutral-800 border-neutral-700 text-emerald-600 focus:ring-emerald-500 rounded" />, render: (r: ClosedTrade) => <input type="checkbox" checked={selectedTrades.has(tradeKey(r))} onChange={() => handleSelectTrade(tradeKey(r))} className="form-checkbox h-4 w-4 bg-neutral-800 border-neutral-700 text-emerald-600 focus:ring-emerald-500 rounded" /> }, { key: "symbol", label: "銘柄" }, { key: "side", label: "方向", render: (r: ClosedTrade) => <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${r.side === "SELL" ? "border-rose-500/40 text-rose-300" : "border-emerald-500/40 text-emerald-300"}`}>{r.side}</span> }, { key: "size", label: "数量", render: (r: ClosedTrade) => <span className="tabular-nums">{r.size.toFixed(1)}</span> }, { key: "entryPrice", label: "建値", render: (r: ClosedTrade) => <span className="tabular-nums">{r.entryPrice?.toFixed(3) ?? ""}</span> }, { key: "exitPrice", label: "決済", render: (r: ClosedTrade) => <span className="tabular-nums">{r.exitPrice?.toFixed(3) ?? ""}</span> }, { key: "pips", label: "P/L (pips)", render: (r: ClosedTrade) => <span className={`inline-flex items-center gap-1 tabular-nums ${r.pips! >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{r.pips! >= 0 ? <TrendingUp className="w-3.5 h-3.5"/> : <TrendingDown className="w-3.5 h-3.5"/>}{Math.abs(r.pips!).toFixed(1)}</span> }, { key: "plText", label: "損益（円）", render: (r: ClosedTrade) => <span className={`font-semibold tabular-nums ${parseInt(r.plText!) >= 0 ? "text-emerald-200" : "text-rose-200"}`}>{formatInt(parseInt(r.plText!))}</span> }, { key: "entryAt", label: "建玉日時", render: (r: ClosedTrade) => (r.entryAt ? fmtDate(r.entryAt) : "") }, { key: "exitAt", label: "決済日時", render: (r: ClosedTrade) => (r.exitAt ? fmtDate(r.exitAt) : "") }, { key: "hold", label: "保有", render: (r: ClosedTrade) => r.hold ?? "" }, { key: "tags", label: "タグ", render: (r: ClosedTrade) => r.tags?.length ? <div className="flex flex-wrap gap-1">{r.tags.map(tag => <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-neutral-700 text-neutral-200">{tag}</span>)}</div> : <span className="text-neutral-500">-</span> }, ]} rows={savedClosed} />
            </Card>
          </div>
          <div className="space-y-6">
            <AnalysisMenu activeAnalysis={activeAnalysis} setActiveAnalysis={setActiveAnalysis} />
            <AnalysisViewer {...analysisViewerProps} />
          </div>
        </div>
      </main>

      <footer className="px-6 pb-10 text-center text-xs text-neutral-500">
        解析ロジックは最小限のヒューリスティック（正規表現 & FIFO 突合）です。実データでズレる場合はその例を貼ってください。精度を上げます。
      </footer>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: flash ? 0 : 20, opacity: flash ? 1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="pointer-events-none fixed bottom-6 right-6">
        {flash && <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 shadow-lg"><CheckCircle2 className="w-4 h-4 text-emerald-400"/><span className="text-sm">{flash}</span></div>}
      </motion.div>
    </div>
  );
}

const TestSuite = () => { const [results, setResults] = useState<{ name: string; ok: boolean; detail?: string }[] | null>(null); function run() { const out: { name: string; ok: boolean; detail?: string }[] = []; const assert = (name: string, cond: boolean, detail?: string) => out.push({ name, ok: !!cond, detail }); const p1 = parseFX(ExampleText); const t1 = p1.closedTrades[0]; assert("T1-1 no-parse-errors", p1.errors.length === 0, `errors: ${p1.errors.join(" | ")}`); assert("T1-2 closed=1", p1.closedTrades.length === 1); assert("T1-5 pips ≈ 0.4", Math.abs((t1?.pips ?? NaN) - 0.4) < 0.11); setResults(out); } return <div><button onClick={run} className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs">テストを実行</button>{results && <ul className="mt-3 space-y-1 text-sm">{results.map((r, i) => <li key={i} className={r.ok ? "text-emerald-300" : "text-rose-300"}>{r.ok ? "✅" : "❌"} {r.name} {r.detail && <span className="text-neutral-400">({r.detail})</span>}</li>)}</ul>}</div>; };

const ExampleText = `
USD/JPY	成行	決済
買	2.7	147.170[成行]
147.210	約定済	147.170	25/08/22 03:13:25
25/08/21	+108		25/08/22 03:13:25
-	063257	
USD/JPY	成行	新規
売	2.7	147.174[成行]
147.208	約定済	147.174	25/08/22 03:06:26		0	25/08/22 03:06:26
-	063256	
`;
