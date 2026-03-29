"use client";

import { useMemo } from "react";
import {
  Package,
  TrendingUp,
  Warehouse,
  IndianRupee,
  FileStack,
  Columns3,
  ScanText,
} from "lucide-react";

interface StatsCardsProps {
  data: Record<string, string>[];
  metadata: {
    filename: string;
    page_count: number;
    char_count: number;
    row_count: number;
    column_count: number;
  };
}

function parseNum(val: unknown): number {
  if (typeof val === "number") return val;
  const n = parseFloat(String(val ?? "0").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatNum(n: number): string {
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(2) + " Cr";
  if (n >= 100_000) return (n / 100_000).toFixed(2) + " L";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

/** Try to find a key in the row that contains a given substring (case-insensitive) */
function findKey(row: Record<string, string>, ...needles: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const needle of needles) {
    const found = keys.find((k) => k.toLowerCase().includes(needle.toLowerCase()));
    if (found) return found;
  }
  return undefined;
}

export function StatsCards({ data, metadata }: StatsCardsProps) {
  const stats = useMemo(() => {
    if (!data || data.length === 0)
      return { totalSales: 0, totalClStock: 0, totalStockVal: 0, totalItems: 0 };

    const sample = data[0];
    const salesKey = findKey(sample, "SALES", "SALE", "SOLD");
    const clQtyKey = findKey(sample, "CL.QTY", "CL QTY", "CLOSING", "CLQTY", "CLS");
    const clValKey = findKey(sample, "CL.VAL", "CL VAL", "CLVAL", "VALUE", "STOCK VAL");

    let totalSales = 0;
    let totalClStock = 0;
    let totalStockVal = 0;

    for (const row of data) {
      if (salesKey) totalSales += parseNum(row[salesKey]);
      if (clQtyKey) totalClStock += parseNum(row[clQtyKey]);
      if (clValKey) totalStockVal += parseNum(row[clValKey]);
    }

    return {
      totalSales,
      totalClStock,
      totalStockVal,
      totalItems: data.length,
    };
  }, [data]);

  const cards = [
    {
      label: "Total Products",
      value: stats.totalItems.toString(),
      icon: Package,
      borderColor: "#0D9488",
      iconBg: "bg-teal-50",
      iconColor: "text-teal-600",
    },
    {
      label: "Total Sales (Qty)",
      value: formatNum(stats.totalSales),
      icon: TrendingUp,
      borderColor: "#3B82F6",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Closing Stock (Qty)",
      value: formatNum(stats.totalClStock),
      icon: Warehouse,
      borderColor: "#F59E0B",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      label: "Stock Value",
      value: stats.totalStockVal > 0 ? "₹" + formatNum(stats.totalStockVal) : "—",
      icon: IndianRupee,
      borderColor: "#8B5CF6",
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
  ];

  const extractionCards = [
    {
      label: "Pages Scanned",
      value: metadata.page_count.toString(),
      icon: FileStack,
      iconColor: "text-blue-500",
    },
    {
      label: "Rows Extracted",
      value: metadata.row_count.toString(),
      icon: ScanText,
      iconColor: "text-rose-500",
    },
    {
      label: "Columns Found",
      value: metadata.column_count.toString(),
      icon: Columns3,
      iconColor: "text-emerald-600",
    },
    {
      label: "Characters Parsed",
      value: formatNum(metadata.char_count),
      icon: ScanText,
      iconColor: "text-amber-500",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Main KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200"
            style={{
              borderLeftWidth: "3px",
              borderLeftColor: card.borderColor,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.iconBg}`}
              >
                <card.icon className={`w-4.5 h-4.5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold font-heading text-slate-900 mb-0.5">
              {card.value}
            </p>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Extraction stats strip */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 px-1">
          PDF Extraction Summary
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {extractionCards.map((card) => (
            <div
              key={card.label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-emerald-50 transition-all duration-200"
            >
              <card.icon className={`w-4 h-4 shrink-0 ${card.iconColor}`} />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {card.value}
                </p>
                <p className="text-[10px] text-slate-500">
                  {card.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
