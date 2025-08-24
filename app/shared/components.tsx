"use client";
import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatInt, fmtSignedInt } from '../utils';

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
      <div className={`relative rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 ${className}`}>
        {children}
      </div>
    );
}

export function Stat({ label, value, intent, valueClassName }: { label: string; value: string; intent?: "up" | "down"; valueClassName?: string }) {
    const Icon = intent === "down" ? TrendingDown : TrendingUp;
    const intentColor = intent === "down" ? "text-rose-300" : intent === "up" ? "text-emerald-300" : "";
    const finalClassName = valueClassName || intentColor;
    return (
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
        <div className="text-xs text-neutral-400 flex items-center gap-1">
          {intent && <Icon className={`w-3.5 h-3.5 ${intentColor}`} />}
          {label}
        </div>
        <div className={`text-xl font-semibold mt-1 tabular-nums ${finalClassName}`}>{value}</div>
      </div>
    );
}

export function ProjectionStat({ label, balance, gain }: { label: string; balance: number; gain: number }) {
    return (
      <div>
        <div className="text-sm text-neutral-300">{label}</div>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-xl font-bold tabular-nums">{formatInt(balance)}円</span>
          <span className={`text-sm font-medium tabular-nums ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ({fmtSignedInt(gain)})
          </span>
        </div>
      </div>
    );
}
