"use client";
import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

type DailyPL = {
  [date: string]: number;
};

type Props = {
  dailyPL: DailyPL;
};

export default function CalendarView({ dailyPL }: Props) {
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateString = toLocalDateKey(date);
      const pl = dailyPL[dateString];

      if (pl !== undefined) {
        const isPositive = pl > 0;
        const isZero = pl === 0;
        const plText = isZero ? '±0' : `${isPositive ? '+' : ''}${Math.round(pl / 1000)}k`;

        return (
          <div className={`text-xs mt-1 font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {plText}
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div>
      <Calendar
        tileContent={tileContent}
        className="react-calendar-overrides"
      />
    </div>
  );
}

function toLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const mo = `${d.getMonth() + 1}`.padStart(2, "0");
  const da = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
