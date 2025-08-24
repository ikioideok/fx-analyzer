"use client";
import React from 'react';

export function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string | React.ReactNode; render?: (row: any) => React.ReactNode }[];
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
