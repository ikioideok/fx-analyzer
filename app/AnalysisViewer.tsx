"use client";
import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Calendar as CalendarIcon, Save, Trash2 } from 'lucide-react';
import CalendarView from './CalendarView';
import { ClosedTrade, Summary, LongTermProjection, GoalProjection, TagAnalysis } from './types';
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
  longTermProjection: LongTermProjection | null;
  goalProjection: GoalProjection | null;
  targetBalance: number;
  setTargetBalance: (value: number) => void;
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
    case 'settings':
        return (
            <Card>
                <h2 className="text-base font-semibold tracking-tight mb-3">設定</h2>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium text-neutral-300">データ管理</h3>
                        <div className="mt-2">
                             <button
                                onClick={props.handleResetHistory}
                                className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-xs flex items-center gap-1"
                                title="サーバーに保存されているすべての履歴を削除します"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1"/>
                                全履歴をリセット
                            </button>
                            <p className="text-xs text-neutral-500 mt-1">この操作は元に戻せません。すべてのデータがサーバーから削除されます。</p>
                        </div>
                    </div>
                </div>
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
