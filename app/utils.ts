import { ClosedTrade, RawBlock, Event, OpenPosition } from './types';

export function getWinRateColor(winRate?: number): string {
    if (winRate == null || !isFinite(winRate)) return "";
    if (winRate >= 50) return "text-emerald-300";
    if (winRate >= 40) return "text-yellow-300";
    if (winRate >= 30) return "text-orange-400";
    if (winRate >= 20) return "text-rose-400";
    return "text-rose-600";
}

export function fmtSignedInt(n?: number) {
    if (n == null || !isFinite(n)) return "-";
    const abs = Math.round(Math.abs(n));
    try { return `${n >= 0 ? "+" : "-"}${abs.toLocaleString()}`;
    } catch { return `${n >= 0 ? "+" : "-"}${abs}`; }
}

export function formatInt(n: number) {
    try { return Math.round(n).toLocaleString(); } catch { return Math.round(n).toString(); }
}

export function fmtSigned(n?: number, digits = 0) {
    if (n == null || !isFinite(n)) return "-";
    const s = (Math.abs(n)).toFixed(digits);
    return `${n >= 0 ? "+" : "-"}${s}`;
}

export function fmtNum(n?: number) {
    if (n == null || !isFinite(n)) return "-";
    return Math.round(n).toString();
}

export function fmtDate(d?: Date) {
    if (!d) return "";
    const y = d.getFullYear();
    const mo = `${d.getMonth() + 1}`.padStart(2, "0");
    const da = `${d.getDate()}`.padStart(2, "0");
    const hh = `${d.getHours()}`.padStart(2, "0");
    const mm = `${d.getMinutes()}`.padStart(2, "0");
    const ss = `${d.getSeconds()}`.padStart(2, "0");
    return `${y}/${mo}/${da} ${hh}:${mm}:${ss}`;
}

export function toLocalDateKey(d: Date) {
    const y = d.getFullYear();
    const mo = `${d.getMonth() + 1}`.padStart(2, "0");
    const da = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${mo}-${da}`;
}

export function isSameLocalDate(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function reviveClosedTradeDates(t: any): ClosedTrade {
    const r: any = { ...t };
    if (r.entryAt && typeof r.entryAt === 'string') r.entryAt = new Date(r.entryAt);
    if (r.exitAt && typeof r.exitAt === 'string') r.exitAt = new Date(r.exitAt);
    return r as ClosedTrade;
}

export function saveTradesToLocalStorage(trades: ClosedTrade[]) {
    if (typeof window !== "undefined") try { window.localStorage.setItem("fx_analyzer_main_trades_v2", JSON.stringify(trades)); } catch (e) { console.error("Failed to save trades", e); }
}

export function summarize(rows: ClosedTrade[]) {
    if (rows.length === 0) return { count: 0, winRate: NaN, totalPips: 0, avgPips: NaN, avgHold: "", maxDD: 0, totalQtyPL: 0, expectancyQty: NaN, payoff: NaN };
    let totalPips = 0;
    let holds: number[] = [];
    let equity = 0;
    let maxDD = 0;
    let peak = 0;
    let totalQtyPLExact = 0;
    const winsQty: number[] = [];
    const lossesQty: number[] = [];
    for (const r of rows) {
        const p = r.pips ?? 0;
        totalPips += p;
        equity += p;
        peak = Math.max(peak, equity);
        maxDD = Math.min(maxDD, equity - peak);
        const plQtyExact = p * (r.size ?? 0) * 100;
        totalQtyPLExact += plQtyExact;
        if (plQtyExact > 0) winsQty.push(plQtyExact);
        else if (plQtyExact < 0) lossesQty.push(plQtyExact);
        if (r.entryAt && r.exitAt) holds.push(r.exitAt.getTime() - r.entryAt.getTime());
    }
    const avgHoldMs = holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : 0;
    const winRate = winsQty.length / rows.length;
    const lossRate = lossesQty.length / rows.length;
    const avgWinQty = winsQty.length ? winsQty.reduce((a, b) => a + b, 0) / winsQty.length : 0;
    const avgLossQty = lossesQty.length ? lossesQty.reduce((a, b) => a + b, 0) / lossesQty.length : 0;
    const payoff = isFinite(avgWinQty) && isFinite(avgLossQty) && avgLossQty !== 0 ? Math.abs(avgWinQty / avgLossQty) : NaN;
    return { count: rows.length, winRate: winRate * 100, totalPips, avgPips: totalPips / rows.length, avgHold: humanizeDuration(avgHoldMs), maxDD: Math.abs(Math.round(maxDD)), totalQtyPL: Math.round(totalQtyPLExact), expectancyQty: (avgWinQty * winRate) - (Math.abs(avgLossQty) * lossRate), payoff, };
}

export function tradeKey(t: ClosedTrade): string {
    const ep = t.entryPrice != null ? t.entryPrice.toFixed(5) : "";
    const xp = t.exitPrice != null ? t.exitPrice.toFixed(5) : "";
    const ea = t.entryAt ? t.entryAt.getTime() : "";
    const xa = t.exitAt ? t.exitAt.getTime() : "";
    const sz = (t.size ?? 0).toFixed(4);
    return [t.symbol, t.side, sz, ep, xp, ea, xa, t.ticketOpen || "", t.ticketClose || ""].join("|");
}

export function mergeUniqueWithCount(prev: ClosedTrade[], incoming: ClosedTrade[]) {
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

export function parseFX(input: string) {
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
        let at: Date | undefined;
        let ticket: string | undefined;
        const l1 = (b.lines[0] ?? "").trim();
        const m1 = l1.match(/^\s*(買|売)\s*([\d.]+)\s*([\d.]+)\[(?:[^\\\]]+)\]/);
        if (m1) {
            side = m1[1] as Event["side"];
            size = parseFloat(m1[2]);
            orderPrice = safeNum(m1[3]);
        } else {
            errors.push(`方向/数量/建値を読めませんでした: "${l1}"`);
        }
        const l2 = (b.lines[1] ?? "").trim();
        const dtMatch = l2.match(/(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
        if (dtMatch) at = parseJpDateTime(dtMatch[1]);
        const l3 = b.lines[2] ?? "";
        const dt3Match = l3.match(/(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
        if (!at && dt3Match) at = parseJpDateTime(dt3Match[1]);
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
        events.push({ symbol, action, side, size, orderPrice, at, ticket });
    }
    events.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
    const openQueues: Record<string, OpenPosition[]> = {};
    const closedTrades: ClosedTrade[] = [];
    for (const e of events) {
        if (e.action === "新規") {
            const key = `${e.symbol}`;
            if (!openQueues[key]) openQueues[key] = [];
            openQueues[key].push({
                symbol: e.symbol,
                side: e.side === "買" ? "BUY" : "SELL",
                size: e.size,
                entryPrice: e.orderPrice,
                entryAt: e.at,
                ticketOpen: e.ticket,
            });
        } else {
            const sideClose: "BUY" | "SELL" = e.side === "買" ? "BUY" : "SELL";
            const needOpposite: "BUY" | "SELL" = sideClose === "BUY" ? "SELL" : "BUY";
            const q = openQueues[`${e.symbol}`] || [];
            let matched: OpenPosition | undefined;
            let matchIndex = -1;
            for (let i = 0; i < q.length; i++) {
                if (q[i].side === needOpposite && Math.abs(q[i].size - e.size) < 1e-6) {
                    matched = q[i];
                    matchIndex = i;
                    break;
                }
            }
            if (matched && matchIndex > -1) q.splice(matchIndex, 1);
            const entryPrice = matched?.entryPrice;
            const exitPrice = e.orderPrice;
            const trade: ClosedTrade = {
                symbol: e.symbol,
                side: matched?.side || (needOpposite === "BUY" ? "BUY" : "SELL"),
                size: e.size,
                entryPrice,
                exitPrice,
                entryAt: matched?.entryAt,
                exitAt: e.at,
                ticketOpen: matched?.ticketOpen,
                ticketClose: e.ticket,
            };
            if (entryPrice != null && exitPrice != null) {
                const sign = trade.side === "BUY" ? 1 : -1;
                const pips = (exitPrice - entryPrice) * sign * 100;
                trade.pips = pips;
                trade.plText = Math.round(pips * e.size * 100).toString();
            }
            if (trade.entryAt && trade.exitAt) {
                trade.hold = humanizeDuration(trade.exitAt.getTime() - trade.entryAt.getTime());
            }
            closedTrades.push(trade);
        }
    }
    return { closedTrades, openPositions: Object.values(openQueues).flat(), errors };
}

function splitBlocks(input: string): RawBlock[] {
    const lines = input.replace(/\r/g, "").split(/\n+/);
    const blocks: RawBlock[] = [];
    let current: RawBlock | null = null;
    for (const ln of lines) {
        if (/^\S+\s+\S+\s+(新規|決済)$/.test(ln.trim())) {
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
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return undefined;
    const [, yy, mo, da, hh, mm, ss] = m.map(Number);
    return new Date(2000 + yy, mo - 1, da, hh, mm, ss);
}

function humanizeDuration(ms: number) {
    if (!isFinite(ms) || ms < 0) return "";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const parts = [];
    if (h) parts.push(`${h}時間`);
    if (m) parts.push(`${m}分`);
    if (sec && !h) parts.push(`${sec}秒`);
    return parts.join("") || "0秒";
}

function safeNum(x?: string | number | null) {
    if (x == null) return undefined;
    const n = typeof x === "number" ? x : parseFloat(String(x).replace(/,/g, ""));
    return isFinite(n) ? n : undefined;
}
