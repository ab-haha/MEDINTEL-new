"use client";

import { useCallback, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, ShieldCheck, Zap, BarChart2 } from "lucide-react";

interface UploadZoneProps {
  onUpload: (file: File) => void;
}

export function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      <div className="w-full max-w-2xl">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500 mb-3">
            Pharmaceutical Audit Platform
          </p>
          <h2 className="text-4xl font-bold mb-3 font-heading text-slate-900 tracking-tight">
            Inventory Intelligence
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
            Upload a pharmaceutical stock statement PDF. The engine mirrors the exact
            column structure and performs a 4-pillar financial audit — instantly.
          </p>
        </motion.div>

        {/* Drop Zone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onClick={() => fileInputRef.current?.click()}
          className={`
            cursor-pointer rounded-3xl border-2 border-dashed p-14
            flex flex-col items-center justify-center gap-5 transition-all duration-300
            ${isDragging
              ? "border-indigo-500 bg-indigo-50/60 scale-[1.01] shadow-lg shadow-indigo-100"
              : "border-slate-300 hover:border-indigo-400 bg-white hover:shadow-md hover:shadow-indigo-50"
            }
          `}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${
              isDragging ? "bg-indigo-100" : "bg-slate-100"
            }`}
          >
            {isDragging
              ? <FileText className="w-7 h-7 text-indigo-600" />
              : <Upload className="w-7 h-7 text-slate-400" />
            }
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">
              {isDragging ? "Release to analyze" : "Drop your stock statement PDF here"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              or <span className="text-indigo-500 font-medium">click to browse</span> · PDF files only
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="grid grid-cols-3 gap-4 mt-6"
        >
          {[
            { icon: ShieldCheck, label: "Mirror Extraction",   desc: "Exact PDF column order preserved",   color: "text-indigo-500",  bg: "bg-indigo-50"  },
            { icon: BarChart2,   label: "Financial Audit",     desc: "Dead capital, expiry & risk flags",  color: "text-violet-500",  bg: "bg-violet-50"  },
            { icon: Zap,         label: "Instant Export",      desc: "CSV & Excel with one click",         color: "text-amber-500",   bg: "bg-amber-50"   },
          ].map((feat) => (
            <div
              key={feat.label}
              className="bg-white rounded-2xl p-4 text-center border border-slate-200 shadow-sm hover:shadow transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className={`w-9 h-9 rounded-xl ${feat.bg} flex items-center justify-center mx-auto mb-2.5`}>
                <feat.icon className={`w-4.5 h-4.5 ${feat.color}`} />
              </div>
              <p className="text-xs font-semibold text-slate-800">{feat.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{feat.desc}</p>
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
