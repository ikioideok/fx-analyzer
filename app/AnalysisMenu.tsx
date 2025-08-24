"use client";
import React from 'react';
import { BarChart2, CalendarDays, Target, Shield, History, Tags, TestTube2, Banknote } from 'lucide-react';

type Props = {
  activeAnalysis: string | null;
  setActiveAnalysis: (name: string | null) => void;
};

const analysisItems = [
  { id: 'calendar', label: '損益カレンダー', icon: CalendarDays },
  { id: 'balance', label: '口座残高', icon: Banknote },
  { id: 'long_term', label: '長期シミュレーション', icon: BarChart2 },
  { id: 'goal', label: '目標達成シミュレーター', icon: Target },
  { id: 'risk', label: 'リスク管理ルール', icon: Shield },
  { id: 'history', label: '保存履歴', icon: History },
  { id: 'tags', label: 'タグ別分析', icon: Tags },
  { id: 'tests', label: '内部テスト', icon: TestTube2 },
];

export default function AnalysisMenu({ activeAnalysis, setActiveAnalysis }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">分析メニュー</h3>
      <div className="flex flex-col space-y-1">
        {analysisItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveAnalysis(activeAnalysis === item.id ? null : item.id)}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeAnalysis === item.id
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
              }
            `}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
