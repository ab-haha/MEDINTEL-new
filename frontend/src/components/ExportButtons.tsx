"use client";

import { useCallback } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface ExportButtonsProps {
  data: Record<string, string>[];
}

export function ExportButtons({ data }: ExportButtonsProps) {
  const exportCSV = useCallback(() => {
    if (!data || data.length === 0) return;

    const columns = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Header row
    csvRows.push(columns.map((col) => `"${col}"`).join(","));

    // Data rows
    data.forEach((row) => {
      csvRows.push(
        columns
          .map((col) => {
            const val = String(row[col] ?? "").replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(",")
      );
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "medical_report.csv");
  }, [data]);

  const exportExcel = useCallback(() => {
    if (!data || data.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Medical Report");

    // Auto-size columns
    const columns = Object.keys(data[0]);
    ws["!cols"] = columns.map((col) => {
      const maxLen = Math.max(
        col.length,
        ...data.map((row) => String(row[col] ?? "").length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "medical_report.xlsx");
  }, [data]);

  if (!data || data.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={exportCSV}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-900 transition-all duration-200 border border-slate-200 shadow-sm"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
      <button
        onClick={exportExcel}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all duration-200 shadow-sm"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Export Excel
      </button>
    </div>
  );
}
