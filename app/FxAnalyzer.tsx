"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Save, Wand2, FileText, CheckCircle2, AlertTriangle, TrendingUp, Edit, Tag } from "lucide-react";
import AnalysisMenu from "./AnalysisMenu";
import AnalysisViewer from "./AnalysisViewer";
import { ClosedTrade, Snapshot } from './types';
import { DataTable } from "./DataTable";

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
  const [consecutiveLossLimit, setConsecutiveLossLimit] = useState(3);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [isCooldownActive, setIsCooldownActive] = useState(false);
  const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(null);
  const [remainingCooldownTime, setRemainingCooldownTime] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEndTime = window.localStorage.getItem('cooldownEndTime');
      if (savedEndTime) {
        const endTime = parseInt(savedEndTime, 10);
        if (endTime > Date.now()) {
          setIsCooldownActive(true);
          setCooldownEndTime(endTime);
        } else {
          window.localStorage.removeItem('cooldownEndTime');
        }
      }
    }
  }, []);

  useEffect(() => {
    if (isCooldownActive && cooldownEndTime) {
      const intervalId = setInterval(() => {
        const remainingMs = Math.max(0, cooldownEndTime - Date.now());
        if (remainingMs === 0) {
          setIsCooldownActive(false);
          setCooldownEndTime(null);
          if (typeof window !== 'undefined') window.localStorage.removeItem('cooldownEndTime');
          setFlash("クールダウンが終了しました。");
          setRemainingCooldownTime("");
        } else {
          const totalSeconds = Math.floor(remainingMs / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          setRemainingCooldownTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);
      return () => clearInterval(intervalId);
    }
  }, [isCooldownActive, cooldownEndTime]);

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

  const goalProjection = useMemo(() => {
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

  useEffect(() => {
    if (consecutiveLossLimit <= 0 || isCooldownActive) return;
    const sortedTrades = [...savedClosed].sort((a, b) => (b.exitAt?.getTime() ?? 0) - (a.exitAt?.getTime() ?? 0));
    if (sortedTrades.length < consecutiveLossLimit) return;
    let consecutiveLosses = 0;
    for (const trade of sortedTrades) {
      if ((trade.pips ?? 0) < 0) consecutiveLosses++; else break;
      if (consecutiveLosses >= consecutiveLossLimit) {
        const endTime = Date.now() + cooldownMinutes * 60 * 1000;
        setCooldownEndTime(endTime);
        setIsCooldownActive(true);
        if (typeof window !== 'undefined') window.localStorage.setItem('cooldownEndTime', endTime.toString());
        setFlash(`🚨 ${consecutiveLossLimit}連敗しました。${cooldownMinutes}分間のクールダウンを開始します。`);
        break;
      }
    }
  }, [savedClosed, consecutiveLossLimit, cooldownMinutes, isCooldownActive]);

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

  // Props for AnalysisViewer
  const analysisViewerProps = {
    activeAnalysis, dailyPL, summary, isCooldownActive, remainingCooldownTime, longTermProjection,
    goalProjection, targetBalance, setTargetBalance, consecutiveLossLimit, setConsecutiveLossLimit,
    cooldownMinutes, setCooldownMinutes, snapshots, selectedSnapshotKey, setSelectedSnapshotKey,
    handleResetHistory, tagAnalysis, TestSuite,
    // Pass down helper components and functions
    Card, Stat, ProjectionStat, fmtSignedInt, formatInt, getWinRateColor, fmtSigned, fmtNum, fmtDate
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="p-6 border-b border-neutral-800">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">FX分析ツール</h1>
        <p className="text-neutral-400 mt-1">テキストを貼り付け、「保存」を押すと新規/決済を突合して一覧とサマリーに反映します（USD/JPY想定・pips計算）。</p>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold tracking-tight flex items-center gap-2"><FileText className="w-4 h-4 text-neutral-400"/>① ログ貼り付け</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRaw(ExampleText.trim())} className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs flex items-center gap-1" title="サンプルを読み込む"><Wand2 className="w-4 h-4"/> サンプル</button>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:bg-neutral-600 disabled:cursor-not-allowed" title="解析して下の表に反映" disabled={isCooldownActive}><Save className="w-4 h-4 inline -mt-0.5 mr-1"/>保存</motion.button>
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
          <div className="lg:col-span-1 space-y-6">
            <AnalysisMenu activeAnalysis={activeAnalysis} setActiveAnalysis={setActiveAnalysis} />
            <AnalysisViewer {...analysisViewerProps} />
          </div>
        </div>
      </div>

      <footer className="px-6 pb-10 text-center text-xs text-neutral-500">
        解析ロジックは最小限のヒューリスティック（正規表現 & FIFO 突合）です。実データでズレる場合はその例を貼ってください。精度を上げます。
      </footer>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: flash ? 0 : 20, opacity: flash ? 1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="pointer-events-none fixed bottom-6 right-6">
        {flash && <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 shadow-lg"><CheckCircle2 className="w-4 h-4 text-emerald-400"/><span className="text-sm">{flash}</span></div>}
      </motion.div>
    </div>
  );
}

// Helper components and functions that are now passed to AnalysisViewer
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (<div className={`relative rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 ${className}`}>{children}</div>);
const Stat = ({ label, value, intent, valueClassName }: { label: string; value: string; intent?: "up" | "down"; valueClassName?: string }) => { const Icon = intent === "down" ? TrendingDown : TrendingUp; const intentColor = intent === "down" ? "text-rose-300" : intent === "up" ? "text-emerald-300" : ""; const finalClassName = valueClassName || intentColor; return <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3"><div className="text-xs text-neutral-400 flex items-center gap-1">{intent && <Icon className={`w-3.5 h-3.5 ${intentColor}`} />}{label}</div><div className={`text-xl font-semibold mt-1 tabular-nums ${finalClassName}`}>{value}</div></div>; };
const ProjectionStat = ({ label, balance, gain }: { label: string; balance: number; gain: number }) => (<div><div className="text-sm text-neutral-300">{label}</div><div className="flex items-end gap-2 mt-1"><span className="text-xl font-bold tabular-nums">{formatInt(balance)}円</span><span className={`text-sm font-medium tabular-nums ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>({fmtSignedInt(gain)})</span></div></div>);
const getWinRateColor = (winRate?: number): string => { if (winRate == null || !isFinite(winRate)) return ""; if (winRate >= 50) return "text-emerald-300"; if (winRate >= 40) return "text-yellow-300"; if (winRate >= 30) return "text-orange-400"; if (winRate >= 20) return "text-rose-400"; return "text-rose-600"; };
const fmtSignedInt = (n?: number) => { if (n == null || !isFinite(n)) return "-"; const abs = Math.round(Math.abs(n)); try { return `${n >= 0 ? "+" : "-"}${abs.toLocaleString()}`; } catch { return `${n >= 0 ? "+" : "-"}${abs}`; }};
const formatInt = (n: number) => { try { return Math.round(n).toLocaleString(); } catch { return Math.round(n).toString(); }};
const fmtSigned = (n?: number, digits = 0) => { if (n == null || !isFinite(n)) return "-"; const s = (Math.abs(n)).toFixed(digits); return `${n >= 0 ? "+" : "-"}${s}`; };
const fmtNum = (n?: number) => { if (n == null || !isFinite(n)) return "-"; return Math.round(n).toString(); };
const fmtDate = (d?: Date) => { if (!d) return ""; const y = d.getFullYear(); const mo = `${d.getMonth() + 1}`.padStart(2, "0"); const da = `${d.getDate()}`.padStart(2, "0"); const hh = `${d.getHours()}`.padStart(2, "0"); const mm = `${d.getMinutes()}`.padStart(2, "0"); const ss = `${d.getSeconds()}`.padStart(2, "0"); return `${y}/${mo}/${da} ${hh}:${mm}:${ss}`; };

// ========= Parser & Logic =========
// These functions remain in FxAnalyzer as they are core to its functionality
type RawBlock = { header: string; lines: string[]; };
type Event = { symbol: string; action: "新規" | "決済"; side: "買" | "売"; size: number; orderPrice?: number; fillPrice?: number; at?: Date; ticket?: string; rawPLText?: string; };
type OpenPosition = { symbol: string; side: "BUY" | "SELL"; size: number; entryPrice?: number; entryAt?: Date; ticketOpen?: string; };
function parseFX(input: string) { const errors: string[] = []; const blocks = splitBlocks(input); const events: Event[] = []; for (const b of blocks) { const head = b.header.trim(); const mHead = head.match(/^(\S+)\s+\S+\s+(新規|決済)$/); if (!mHead) { errors.push(`ブロック見出しを認識できませんでした: "${head}"`); continue; } const symbol = mHead[1]; const action = mHead[2] as Event["action"]; let side: Event["side"] | undefined; let size: number | undefined; let orderPrice: number | undefined; let at: Date | undefined; let ticket: string | undefined; const l1 = (b.lines[0] ?? "").trim(); const m1 = l1.match(/^\s*(買|売)\s*([\d.]+)\s*([\d.]+)\[(?:[^\\\]]+)\]/); if (m1) { side = m1[1] as Event["side"]; size = parseFloat(m1[2]); orderPrice = safeNum(m1[3]); } else { errors.push(`方向/数量/建値を読めませんでした: "${l1}"`); } const l2 = (b.lines[1] ?? "").trim(); const dtMatch = l2.match(/(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/); if (dtMatch) at = parseJpDateTime(dtMatch[1]); const l3 = b.lines[2] ?? ""; const dt3Match = l3.match(/(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/); if (!at && dt3Match) at = parseJpDateTime(dt3Match[1]); for (const ln of b.lines) { const t = ln.match(/\b(\d{6,})\b/); if (t) { ticket = t[1]; break; } } if (!side || size == null) { errors.push(`必須項目が不足しているため、このブロックを無視: "${head}"`); continue; } events.push({ symbol, action, side, size, orderPrice, at, ticket }); } events.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0)); const openQueues: Record<string, OpenPosition[]> = {}; const closedTrades: ClosedTrade[] = []; for (const e of events) { if (e.action === "新規") { const key = `${e.symbol}`; if (!openQueues[key]) openQueues[key] = []; openQueues[key].push({ symbol: e.symbol, side: e.side === "買" ? "BUY" : "SELL", size: e.size, entryPrice: e.orderPrice, entryAt: e.at, ticketOpen: e.ticket, }); } else { const sideClose: "BUY" | "SELL" = e.side === "買" ? "BUY" : "SELL"; const needOpposite: "BUY" | "SELL" = sideClose === "BUY" ? "SELL" : "BUY"; const q = openQueues[`${e.symbol}`] || []; let matched: OpenPosition | undefined; let matchIndex = -1; for (let i = 0; i < q.length; i++) { if (q[i].side === needOpposite && Math.abs(q[i].size - e.size) < 1e-6) { matched = q[i]; matchIndex = i; break; } } if (matched && matchIndex > -1) q.splice(matchIndex, 1); const entryPrice = matched?.entryPrice; const exitPrice = e.orderPrice; const trade: ClosedTrade = { symbol: e.symbol, side: matched?.side || (needOpposite === "BUY" ? "BUY" : "SELL"), size: e.size, entryPrice, exitPrice, entryAt: matched?.entryAt, exitAt: e.at, ticketOpen: matched?.ticketOpen, ticketClose: e.ticket, }; if (entryPrice != null && exitPrice != null) { const sign = trade.side === "BUY" ? 1 : -1; const pips = (exitPrice - entryPrice) * sign * 100; trade.pips = pips; trade.plText = Math.round(pips * e.size * 100).toString(); } if (trade.entryAt && trade.exitAt) trade.hold = humanizeDuration(trade.exitAt.getTime() - trade.entryAt.getTime()); closedTrades.push(trade); } } return { closedTrades, openPositions: Object.values(openQueues).flat(), errors }; }
function splitBlocks(input: string): RawBlock[] { const lines = input.replace(/\r/g, "").split(/\n+/); const blocks: RawBlock[] = []; let current: RawBlock | null = null; for (const ln of lines) { if (/^\S+\s+\S+\s+(新規|決済)$/.test(ln.trim())) { if (current) blocks.push(current); current = { header: ln, lines: [] }; } else if (current) { current.lines.push(ln); } } if (current) blocks.push(current); return blocks; }
function parseJpDateTime(s: string): Date | undefined { const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/); if (!m) return undefined; const [, yy, mo, da, hh, mm, ss] = m.map(Number); return new Date(2000 + yy, mo - 1, da, hh, mm, ss); }
function humanizeDuration(ms: number) { if (!isFinite(ms) || ms < 0) return ""; const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; const parts = []; if (h) parts.push(`${h}時間`); if (m) parts.push(`${m}分`); if (sec && !h) parts.push(`${sec}秒`); return parts.join("") || "0秒"; }
function safeNum(x?: string | number | null) { if (x == null) return undefined; const n = typeof x === "number" ? x : parseFloat(String(x).replace(/,/g, "")); return isFinite(n) ? n : undefined; }
function toLocalDateKey(d: Date) { const y = d.getFullYear(); const mo = `${d.getMonth() + 1}`.padStart(2, "0"); const da = `${d.getDate()}`.padStart(2, "0"); return `${y}-${mo}-${da}`; }
function isSameLocalDate(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function reviveClosedTradeDates(t: any): ClosedTrade { const r: any = { ...t }; if (r.entryAt && typeof r.entryAt === 'string') r.entryAt = new Date(r.entryAt); if (r.exitAt && typeof r.exitAt === 'string') r.exitAt = new Date(r.exitAt); return r as ClosedTrade; }
function saveTradesToLocalStorage(trades: ClosedTrade[]) { if (typeof window !== "undefined") try { window.localStorage.setItem("fx_analyzer_main_trades_v2", JSON.stringify(trades)); } catch (e) { console.error("Failed to save trades", e); } }
function summarize(rows: ClosedTrade[]) { if (rows.length === 0) return { count: 0, winRate: NaN, totalPips: 0, avgPips: NaN, avgHold: "", maxDD: 0, totalQtyPL: 0, expectancyQty: NaN, payoff: NaN }; let totalPips = 0; let holds: number[] = []; let equity = 0; let maxDD = 0; let peak = 0; let totalQtyPLExact = 0; const winsQty: number[] = []; const lossesQty: number[] = []; for (const r of rows) { const p = r.pips ?? 0; totalPips += p; equity += p; peak = Math.max(peak, equity); maxDD = Math.min(maxDD, equity - peak); const plQtyExact = p * (r.size ?? 0) * 100; totalQtyPLExact += plQtyExact; if (plQtyExact > 0) winsQty.push(plQtyExact); else if (plQtyExact < 0) lossesQty.push(plQtyExact); if (r.entryAt && r.exitAt) holds.push(r.exitAt.getTime() - r.entryAt.getTime()); } const avgHoldMs = holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : 0; const winRate = winsQty.length / rows.length; const lossRate = lossesQty.length / rows.length; const avgWinQty = winsQty.length ? winsQty.reduce((a, b) => a + b, 0) / winsQty.length : 0; const avgLossQty = lossesQty.length ? lossesQty.reduce((a, b) => a + b, 0) / lossesQty.length : 0; const payoff = isFinite(avgWinQty) && isFinite(avgLossQty) && avgLossQty !== 0 ? Math.abs(avgWinQty / avgLossQty) : NaN; return { count: rows.length, winRate: winRate * 100, totalPips, avgPips: totalPips / rows.length, avgHold: humanizeDuration(avgHoldMs), maxDD: Math.abs(Math.round(maxDD)), totalQtyPL: Math.round(totalQtyPLExact), expectancyQty: (avgWinQty * winRate) - (Math.abs(avgLossQty) * lossRate), payoff, }; }
function tradeKey(t: ClosedTrade): string { const ep = t.entryPrice != null ? t.entryPrice.toFixed(5) : ""; const xp = t.exitPrice != null ? t.exitPrice.toFixed(5) : ""; const ea = t.entryAt ? t.entryAt.getTime() : ""; const xa = t.exitAt ? t.exitAt.getTime() : ""; const sz = (t.size ?? 0).toFixed(4); return [t.symbol, t.side, sz, ep, xp, ea, xa, t.ticketOpen || "", t.ticketClose || ""].join("|"); }
function mergeUniqueWithCount(prev: ClosedTrade[], incoming: ClosedTrade[]) { const set = new Set(prev.map(tradeKey)); const merged = [...prev]; let added = 0; for (const t of incoming) { const k = tradeKey(t); if (!set.has(k)) { merged.push(t); set.add(k); added++; } } return { merged, added }; }
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
