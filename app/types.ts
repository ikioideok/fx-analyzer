export type ClosedTrade = {
    symbol: string;
    side: "BUY" | "SELL";
    size: number;
    entryPrice?: number;
    exitPrice?: number;
    entryAt?: Date;
    exitAt?: Date;
    pips?: number;
    plText?: string;
    hold?: string;
    ticketOpen?: string;
    ticketClose?: string;
    tags?: string[];
};

export type Summary = {
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

export type LongTermProjection = {
    avgDailyPL: number;
    weekly: { balance: number; gain: number };
    monthly: { balance: number; gain: number };
    yearly: { balance: number; gain: number };
};

export type GoalProjection = {
    status: 'achieved' | 'unreachable' | 'projected';
    days: number;
};

export type Snapshot = {
    key: string;
    dateKey: string;
    savedAt: string;
    count: number;
    summary: Summary;
    trades: ClosedTrade[];
};

export type TagAnalysis = {
    tagName: string;
    summary: Summary;
};

export type RawBlock = {
  header: string;
  lines: string[];
};

export type Event = {
  symbol: string;
  action: '新規' | '決済';
  side: '買' | '売';
  size: number;
  orderPrice?: number;
  at?: Date;
  ticket?: string;
};

export type OpenPosition = {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entryPrice?: number;
  entryAt?: Date;
  ticketOpen?: string;
};
