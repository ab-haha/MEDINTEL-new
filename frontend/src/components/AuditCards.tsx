"use client";

import { motion, type Variants } from "framer-motion";
import { AuditData } from "@/app/page";
import {
  IndianRupee,
  AlertTriangle,
  Clock,
  TrendingDown,
  ArrowUpRight,
} from "lucide-react";

interface AuditCardsProps {
  audit: AuditData;
}

function formatCurrency(val: number): string {
  if (val >= 10_000_000) return "₹" + (val / 10_000_000).toFixed(2) + " Cr";
  if (val >= 100_000)    return "₹" + (val / 100_000).toFixed(2) + " L";
  if (val >= 1_000)      return "₹" + (val / 1_000).toFixed(1) + "K";
  return "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: "easeOut" },
  }),
};

export function AuditCards({ audit }: AuditCardsProps) {
  const cards = [
    {
      id: "inventory",
      label: "Total Inventory Value",
      value: formatCurrency(audit.total_inventory_value ?? 0),
      sub: "Sum of all stock on hand",
      icon: IndianRupee,
      gradient: "from-violet-600 to-indigo-600",
      glow: "shadow-violet-500/20",
      border: "border-violet-200/40",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-300",
    },
    {
      id: "dead",
      label: "Dead Capital",
      value: formatCurrency(audit.dead_capital?.total_value ?? 0),
      sub: audit.dead_capital?.column_used
        ? `via ${audit.dead_capital.column_used} · ${audit.dead_capital?.item_count ?? 0} items`
        : `${audit.dead_capital?.item_count ?? 0} zero-sales items locked`,
      icon: TrendingDown,
      gradient: "from-rose-600 to-pink-600",
      glow: "shadow-rose-500/20",
      border: "border-rose-200/40",
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-300",
    },
    {
      id: "expiry",
      label: "Expiry Priority",
      value: String(audit.expiry_priority?.length ?? 0),
      sub: "Batches expiring soonest",
      icon: Clock,
      gradient: "from-amber-500 to-orange-600",
      glow: "shadow-amber-500/20",
      border: "border-amber-200/40",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-300",
    },
    {
      id: "stockout",
      label: "Stock-Out Risk",
      value: String(audit.stockout_risk?.length ?? 0),
      sub: "Items with closing qty < 5",
      icon: AlertTriangle,
      gradient: "from-emerald-600 to-teal-600",
      glow: "shadow-emerald-500/20",
      border: "border-emerald-200/40",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.id}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className={`
            relative overflow-hidden rounded-3xl border ${card.border}
            backdrop-blur-xl bg-white/10
            shadow-2xl ${card.glow}
            bg-gradient-to-br ${card.gradient}
            p-5 flex flex-col justify-between min-h-[148px]
            hover:scale-[1.02] transition-transform duration-300 cursor-default
          `}
        >
          {/* Background glow blob */}
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between">
            <div className={`w-10 h-10 rounded-2xl ${card.iconBg} backdrop-blur flex items-center justify-center`}>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
          </div>

          <div>
            <p className="text-2xl font-bold text-white tracking-tight leading-none mb-1">
              {card.value}
            </p>
            <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-0.5">
              {card.label}
            </p>
            <p className="text-[10px] text-white/50">{card.sub}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Expiry Detail Table ─────────────────────────────────────── */
export function ExpiryTable({ audit }: AuditCardsProps) {
  const rows = audit.expiry_priority ?? [];
  if (rows.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-slate-800">Top 5 Expiring Batches</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-400">Expiry Priority</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-50 border-b border-amber-100">
              {["Batch No.", "Product", "Expiry", "Qty"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-amber-800 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-amber-50/50 transition-colors">
                <td className="px-4 py-2.5 font-mono text-slate-700">{r.batch}</td>
                <td className="px-4 py-2.5 text-slate-900 font-medium">{r.product}</td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold text-[10px]">
                    {r.expiry}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{r.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* ── Dead Capital Detail ─────────────────────────────────────── */
export function DeadCapitalList({ audit }: AuditCardsProps) {
  const items = audit.dead_capital?.items ?? [];
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-rose-500" />
        <h3 className="text-sm font-semibold text-slate-800">Dead Capital Items</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-400">Zero Sales</span>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-xs font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Stockout Risk Detail ────────────────────────────────────── */
export function StockoutList({ audit }: AuditCardsProps) {
  const items = audit.stockout_risk ?? [];
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-800">Stock-Out Risk Items</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-400">Closing Qty &lt; 5</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-emerald-50 border-b border-emerald-100">
              {["Product", "Closing Qty"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-emerald-800 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/50 transition-colors">
                <td className="px-4 py-2.5 text-slate-900 font-medium">{r.product}</td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                    {r.closing_qty}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* ── Top Movers (ISSUE / SALES column) ──────────────────────── */
export function TopMovers({ audit }: AuditCardsProps) {
  const movers = audit.top_movers ?? [];
  const salesCol = audit.column_map?.sales;
  if (movers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <ArrowUpRight className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-800">Top Movers</h3>
        {salesCol && (
          <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-mono font-semibold">
            {salesCol}
          </span>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-400">By Issue / Sales Qty</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-indigo-50 border-b border-indigo-100">
              <th className="px-4 py-2.5 text-left font-semibold text-indigo-800 uppercase tracking-wider w-8">#</th>
              <th className="px-4 py-2.5 text-left font-semibold text-indigo-800 uppercase tracking-wider">Product</th>
              <th className="px-4 py-2.5 text-left font-semibold text-indigo-800 uppercase tracking-wider whitespace-nowrap">
                {salesCol ?? "Qty"}
              </th>
            </tr>
          </thead>
          <tbody>
            {movers.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-indigo-50/50 transition-colors">
                <td className="px-4 py-2.5 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                <td className="px-4 py-2.5 text-slate-900 font-medium">{r.product}</td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                    {r.qty}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
