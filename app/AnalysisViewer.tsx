"use client";
import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Calendar as CalendarIcon, Save, Trash2 } from 'lucide-react';
import CalendarView from './CalendarView';
import { ClosedTrade, Summary, LongTermProjection, GoalProjection, Snapshot, TagAnalysis } from './types';
import { DataTable } from './DataTable';
import { Card, Stat, ProjectionStat } from './shared/components';
import { fmtSignedInt, formatInt, getWinRateColor, fmtSigned, fmtNum, fmtDate } from './utils';

// Props definition
type Props = {
  activeAnalysis: string | null;
  dailyPL: { [key: string]: number };
  summary: Summary;
  startBalance: number;
  setStartBalance: (value: number) => void;
  isCooldownActive: boolean;
  remainingCooldownTime: string;
  longTermProjection: LongTermProjection | null;
  goalProjection: GoalProjection | null;
  targetBalance: number;
  setTargetBalance: (value: number) => void;
  cooldownMinutes: number;
  setCooldownMinutes: (value: number) => void;
  handleStartCooldown: () => void;
  snapshots: Snapshot[];
  selectedSnapshotKey: string | null;
  setSelectedSnapshotKey: (key: string | null) => void;
  handleResetHistory: () => void;
  tagAnalysis: TagAnalysis[];
  TestSuite: React.ComponentType;
};

export default function AnalysisViewer({ activeAnalysis, ...props }: Props) {
  if (!activeAnalysis) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-neutral-700 text-neutral-500">
        <p>メニューから分析項目を選択</p>
      </div>
    );
  }

  const { TestSuite } = props;

  const renderContent = () => {
    switch (activeAnalysis) {
      case 'calendar':
        return (
          <Card>
            <h2 className="text-base font-semibold tracking-tight mb-3 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-neutral-400" />
              損益カレンダー
            </h2>
            <CalendarView dailyPL={props.dailyPL} />
          </Card>
        );
      case 'balance':
        return (
            <Card>
            <h2 className="text-base font-semibold tracking-tight mb-3">口座残高</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-400">開始残高 (円)</label>
                <input
                  type="number"
                  value={props.startBalance}
                  onChange={(e) => props.setStartBalance(Number(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 mt-1 tabular-nums"
                  placeholder="100000"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400">損益合計 (円)</label>
                <div className={`text-xl font-semibold mt-2 tabular-nums ${props.summary.totalQtyPL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {fmtSignedInt(props.summary.totalQtyPL)}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-neutral-400">現在残高 (円)</label>
                <div className="text-2xl font-bold mt-1 tabular-nums">
                  {formatInt(props.startBalance + props.summary.totalQtyPL)}
                </div>
              </div>
            </div>
            {props.isCooldownActive && (
              <div className="mt-4 pt-4 border-t border-rose-500/30">
                <div className="text-center">
                  <p className="font-semibold text-rose-400">🚨 クールダウン中 🚨</p>
                  <p className="text-2xl font-bold my-2 tabular-nums">{props.remainingCooldownTime}</p>
                  <p className="text-xs text-neutral-400">感情的なトレードを避けるため、休憩しましょう。</p>
                </div>
              </div>
            )}
          </Card>
        );
      case 'long_term':
        return (
            <Card>
            <h2 className="text-base font-semibold tracking-tight mb-3">長期シミュレーション (未来予測)</h2>
            {props.longTermProjection ? (
              <div>
                <div className="mb-4 text-sm text-neutral-400">
                  計算の前提：1日あたりの平均利益 <span className={`font-semibold tabular-nums ${props.longTermProjection.avgDailyPL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtSignedInt(props.longTermProjection.avgDailyPL)}</span>
                </div>
                <div className="space-y-3">
                  <ProjectionStat
                    label="1週間後"
                    balance={props.longTermProjection.weekly.balance}
                    gain={props.longTermProjection.weekly.gain}
                  />
                  <ProjectionStat
                    label="1ヶ月後"
                    balance={props.longTermProjection.monthly.balance}
                    gain={props.longTermProjection.monthly.gain}
                  />
                  <ProjectionStat
                    label="1年後"
                    balance={props.longTermProjection.yearly.balance}
                    gain={props.longTermProjection.yearly.gain}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-400">トレード履歴が1日分以上になると表示されます。</div>
            )}
          </Card>
        );
      case 'goal':
        return (
            <Card>
            <h2 className="text-base font-semibold tracking-tight mb-3">目標達成シミュレーター</h2>
            <div>
              <label className="text-xs text-neutral-400">目標金額 (円)</label>
              <input
                type="number"
                value={props.targetBalance}
                onChange={(e) => props.setTargetBalance(Number(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 mt-1 tabular-nums"
                placeholder="1000000"
                step="100000"
              />
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-800">
              {(() => {
                if (!props.goalProjection) return null;
                switch (props.goalProjection.status) {
                  case 'achieved':
                    return <div className="text-emerald-400 font-semibold text-center">✓ 目標達成済みです！</div>;
                  case 'unreachable':
                    return <div className="text-rose-400 font-semibold text-center">× 現在のペースでは目標達成できません。</div>;
                  case 'projected':
                    return (
                      <div className="text-center">
                        <p className="text-sm text-neutral-400">目標達成まで…</p>
                        <p className="text-3xl font-bold mt-1">
                          あと約 <span className="text-emerald-300 tabular-nums">{props.goalProjection.days}</span> 日
                        </p>
                      </div>
                    );
                  default:
                    return null;
                }
              })()}
            </div>
          </Card>
        );
    case 'risk':
        return (
            <Card>
                <h2 className="text-base font-semibold tracking-tight mb-3">リスク管理</h2>
                <div className="space-y-4">
                <div>
                    <label className="text-xs text-neutral-400">クールダウン時間（分）</label>
                    <p className="text-xs text-neutral-500 mb-1">手動でクールダウンを開始する際の時間を設定します。</p>
                    <input
                    type="number"
                    value={props.cooldownMinutes}
                    onChange={(e) => props.setCooldownMinutes(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 mt-1 tabular-nums"
                    placeholder="30"
                    min="0"
                    />
                </div>
                </div>
                <button
                    onClick={props.handleStartCooldown}
                    disabled={props.isCooldownActive}
                    className="mt-4 w-full px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:bg-neutral-600 disabled:cursor-not-allowed"
                >
                    クールダウン開始
                </button>
            </Card>
        );
    case 'history':
        return (
            <Card>
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-base font-semibold tracking-tight">保存履歴</h2>
                    <button
                        onClick={props.handleResetHistory}
                        className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-xs flex items-center gap-1"
                        title="すべての保存履歴を削除します"
                    >
                        <Trash2 className="w-3.5 h-3.5 mr-1"/>
                        履歴をリセット
                    </button>
                </div>
                {props.snapshots.length === 0 ? (
                <div className="text-sm text-neutral-400">保存履歴がありません。「トレードを保存」で保存できます。</div>
                ) : (
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-sm text-neutral-300">日付を選択:</label>
                    <select
                        className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm"
                        value={props.selectedSnapshotKey || ''}
                        onChange={(e) => props.setSelectedSnapshotKey(e.target.value)}
                    >
                        {props.snapshots.map(s => (
                        <option key={s.key} value={s.key}>{s.dateKey}（{s.count}件）</option>
                        ))}
                    </select>
                    {(() => {
                        const s = props.snapshots.find(x => x.key === props.selectedSnapshotKey) || props.snapshots[0];
                        if (!s) return null;
                        return (
                        <div className="text-xs text-neutral-400">保存時刻: {new Date(s.savedAt).toLocaleString()}</div>
                        );
                    })()}
                    </div>

                    {(() => {
                    const s = props.snapshots.find(x => x.key === props.selectedSnapshotKey) || props.snapshots[0];
                    if (!s) return null;
                    return (
                        <>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <Stat label="トレード数" value={s.summary.count.toString()} />
                            <Stat label="勝率" value={s.summary.winRate != null && isFinite(s.summary.winRate) ? `${s.summary.winRate.toFixed(1)}%` : '-'} />
                            <Stat label="合計P/L (pips)" value={fmtSigned(s.summary.totalPips)} intent={s.summary.totalPips >= 0 ? 'up' : 'down'} />
                            <Stat label="期待値/回（数量×pips×100）" value={fmtSignedInt(s.summary.expectancyQty)} intent={(s.summary.expectancyQty ?? 0) >= 0 ? 'up' : 'down'} />
                            <Stat label="ペイオフレシオ" value={isFinite(s.summary.payoff ?? NaN) ? (s.summary.payoff as number).toFixed(2) : '-'} />
                        </div>

                        <div className="mt-3">
                            <DataTable
                            columns={[
                                { key: 'symbol', label: '銘柄' },
                                { key: 'side', label: '方向' },
                                { key: 'size', label: '数量', render: (r: ClosedTrade) => <span className="tabular-nums">{(r.size ?? 0).toFixed(1)}</span> },
                                { key: 'entryPrice', label: '建値', render: (r: ClosedTrade) => <span className="tabular-nums">{r.entryPrice != null ? r.entryPrice.toFixed(3) : ''}</span> },
                                { key: 'exitPrice', label: '決済', render: (r: ClosedTrade) => <span className="tabular-nums">{r.exitPrice != null ? r.exitPrice.toFixed(3) : ''}</span> },
                                { key: 'pips', label: 'P/L (pips)', render: (r: ClosedTrade) => {
                                const v = r.pips ?? 0; const up = v >= 0; return (
                                    <span className={`inline-flex items-center gap-1 tabular-nums ${up ? 'text-emerald-300' : 'text-rose-300'}`}>{Math.abs(v).toFixed(1)}</span>
                                );
                                }},
                                { key: 'entryAt', label: '建玉日時', render: (r: ClosedTrade) => (r.entryAt ? fmtDate(r.entryAt as any) : '') },
                                { key: 'exitAt', label: '決済日時', render: (r: ClosedTrade) => (r.exitAt ? fmtDate(r.exitAt as any) : '') },
                            ]}
                            rows={s.trades as any}
                            />
                        </div>
                        </>
                    );
                    })()}
                </div>
                )}
            </Card>
        );
    case 'tags':
        return (
            <Card>
                <h2 className="text-base font-semibold tracking-tight mb-3">タグ別分析</h2>
                {props.tagAnalysis.length === 0 ? (
                <div className="text-sm text-neutral-400">タグ付けされたトレードがありません。</div>
                ) : (
                <DataTable
                    columns={[
                    { key: "tagName", label: "タグ名", render: (r) => <span className="font-semibold">{r.tagName}</span> },
                    { key: "count", label: "トレード数", render: (r) => r.summary.count },
                    { key: "winRate", label: "勝率", render: (r) => <span className={getWinRateColor(r.summary.winRate)}>{isFinite(r.summary.winRate) ? `${r.summary.winRate.toFixed(1)}%` : "-"}</span> },
                    { key: "totalQtyPL", label: "損益合計 (円)", render: (r) =>
                        <span className={`font-semibold ${r.summary.totalQtyPL >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                            {fmtSignedInt(r.summary.totalQtyPL)}
                        </span>
                    },
                    { key: "totalPips", label: "合計Pips", render: (r) => fmtSigned(r.summary.totalPips, 1) },
                    { key: "avgPips", label: "平均Pips", render: (r) => fmtSigned(r.summary.avgPips, 1) },
                    { key: "payoff", label: "ペイオフレシオ", render: (r) => isFinite(r.summary.payoff ?? NaN) ? (r.summary.payoff as number).toFixed(2) : "-" },
                    ]}
                    rows={props.tagAnalysis}
                />
                )}
          </Card>
        );
    case 'tests':
        return (
            <Card>
                <h2 className="text-base font-semibold tracking-tight mb-3">内部テスト</h2>
                <TestSuite />
            </Card>
        );
      default:
        return null;
    }
  };

  return <div className="space-y-6">{renderContent()}</div>;
}
