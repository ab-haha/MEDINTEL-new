"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Table, ChevronUp, ChevronDown, Search } from "lucide-react";

interface DataTableProps {
  data: Record<string, string>[];
  columnOrder?: string[];
}

export function DataTable({ data, columnOrder }: DataTableProps) {
  const [sortKey, setSortKey]     = useState<string>("");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");

  // Dynamic columns — always driven by explicit columnOrder if provided, else fallback to keys
  const columns = useMemo(() => {
    if (columnOrder && columnOrder.length > 0) return columnOrder;
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data, columnOrder]);

  const filteredAndSorted = useMemo(() => {
    let result = [...data];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) => String(val).toLowerCase().includes(term))
      );
    }

    if (sortKey) {
      result.sort((a, b) => {
        const aVal = String(a[sortKey] ?? "");
        const bVal = String(b[sortKey] ?? "");
        const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ""));
        const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ""));
        if (!isNaN(aNum) && !isNaN(bNum))
          return sortDir === "asc" ? aNum - bNum : bNum - aNum;
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      });
    }

    return result;
  }, [data, sortKey, sortDir, searchTerm]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm">
        <Table className="w-8 h-8 mx-auto mb-3 text-slate-300" />
        <p className="text-sm text-slate-400">No tabular data extracted from this document.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
    >
      {/* Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-800">Extracted Report</span>
          <span className="text-xs text-slate-400 ml-1">
            ({filteredAndSorted.length} / {data.length} rows · {columns.length} columns)
          </span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search rows…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 w-48 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Table — sticky headers */}
      <div className="overflow-auto max-h-[560px]">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="
                    px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider
                    bg-slate-100 border-b border-slate-200 cursor-pointer
                    hover:bg-indigo-50 hover:text-indigo-700 transition-colors
                    select-none whitespace-nowrap first:rounded-tl-none last:rounded-tr-none
                  "
                >
                  <div className="flex items-center gap-1">
                    <span>{col}</span>
                    {sortKey === col && (
                      sortDir === "asc"
                        ? <ChevronUp className="w-3 h-3 text-indigo-500" />
                        : <ChevronDown className="w-3 h-3 text-indigo-500" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors duration-150"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2.5 text-slate-800 whitespace-nowrap tabular-nums"
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
