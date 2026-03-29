"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { AuditCards, ExpiryTable, DeadCapitalList, StockoutList, TopMovers } from "./AuditCards";
import { DataTable } from "./DataTable";
import { ExportButtons } from "./ExportButtons";
import { AuditData, Metadata } from "@/app/page";
import {
  Layers,
  Table as TableIcon,
  FileText,
  BarChart3,
  Building2,
  Calendar,
  RefreshCw,
  Cpu,
  WifiOff,
} from "lucide-react";

interface SplitDashboardProps {
  extractedReport: Record<string, string>[];
  audit: AuditData;
  pdfUrl: string;
  distributorName: string;
  metadata: Metadata;
  onReset: () => void;
}

type ActiveTab = "overview" | "data" | "document";

const pageVariants: Variants = {
  hidden:  { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
  exit:    { opacity: 0, x: -12, transition: { duration: 0.2 } },
};

export function SplitDashboard({
  extractedReport,
  audit,
  pdfUrl,
  distributorName,
  metadata,
  onReset,
}: SplitDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",  label: "Audit Overview",   icon: <BarChart3 className="w-4 h-4" /> },
    { id: "data",      label: "Extracted Data",   icon: <TableIcon className="w-4 h-4" /> },
    { id: "document",  label: "Source Document",  icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm shrink-0">
        <div className="flex items-center justify-between mb-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 font-heading">
                Inventory Intelligence
              </h1>
              <p className="text-[11px] text-slate-400">Pharmaceutical Audit Platform</p>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200 shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New Document
          </button>
        </div>

        {/* Meta bar */}
        <div className="flex flex-wrap items-center gap-5 px-5 py-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
          <MetaPill icon={<Building2 className="w-3.5 h-3.5 text-indigo-500" />} label="Distributor" value={distributorName} />
          <div className="h-6 w-px bg-slate-200" />
          <MetaPill icon={<FileText className="w-3.5 h-3.5 text-slate-400" />} label="File" value={metadata.filename} truncate />
          <div className="h-6 w-px bg-slate-200" />
          <MetaPill icon={<BarChart3 className="w-3.5 h-3.5 text-amber-500" />} label="Products" value={String(metadata.row_count)} />
          <div className="h-6 w-px bg-slate-200" />
          <MetaPill icon={<Calendar className="w-3.5 h-3.5 text-violet-500" />} label="Analyzed" value={today} />
          <div className="h-6 w-px bg-slate-200" />
          <MetaPill
            icon={
              metadata.extraction_mode === "offline"
                ? <WifiOff className="w-3.5 h-3.5 text-orange-500" />
                : <Cpu className="w-3.5 h-3.5 text-emerald-600" />
            }
            label="Mode"
            value={metadata.extraction_mode === "offline" ? "Offline" : metadata.extraction_mode === "groq" ? "Groq AI" : "AI"}
            valueClass={metadata.extraction_mode === "offline" ? "text-orange-600" : "text-emerald-600"}
          />
        </div>
      </div>

      {/* ── Tab Navigation ──────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0 shrink-0">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200
                ${activeTab === tab.id
                  ? "bg-white text-indigo-700 shadow border border-indigo-100"
                  : "text-slate-500 hover:text-slate-700"}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <AnimatePresence mode="wait">

          {activeTab === "overview" && (
            <motion.div
              key="overview"
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-5"
            >
              <AuditCards audit={audit} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ExpiryTable audit={audit} />
                <StockoutList audit={audit} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <DeadCapitalList audit={audit} />
                <TopMovers audit={audit} />
              </div>
            </motion.div>
          )}

          {activeTab === "data" && (
            <motion.div
              key="data"
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Extracted Report Data</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {metadata.row_count} rows × {metadata.column_count} columns · {metadata.page_count} page{metadata.page_count > 1 ? "s" : ""} scanned
                  </p>
                </div>
                <ExportButtons data={extractedReport} />
              </div>
              <DataTable data={extractedReport} columnOrder={metadata.column_order} />
            </motion.div>
          )}

          {activeTab === "document" && (
            <motion.div
              key="document"
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col"
              style={{ height: "calc(100vh - 320px)" }}
            >
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Source Document
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 max-w-[200px] truncate">{metadata.filename}</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <iframe src={pdfUrl} className="w-full h-full border-0" title="PDF Preview" />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

function MetaPill({
  icon,
  label,
  value,
  truncate,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  truncate?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-[9px] uppercase tracking-widest text-slate-400 leading-none">{label}</p>
        <p className={`text-xs font-semibold text-slate-800 ${valueClass ?? ""} ${truncate ? "max-w-[160px] truncate" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
