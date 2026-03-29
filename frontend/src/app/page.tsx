"use client";

import { useState, useCallback } from "react";
import { UploadZone } from "@/components/UploadZone";
import { AbstractLoader } from "@/components/AbstractLoader";
import { SplitDashboard } from "@/components/SplitDashboard";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { Layers } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface AuditData {
  dead_capital: {
    total_value: number;
    item_count: number;
    items: string[];
    column_used?: string;
  };
  expiry_priority: {
    batch: string;
    product: string;
    expiry: string;
    qty: string;
  }[];
  stockout_risk: {
    product: string;
    closing_qty: string;
  }[];
  total_inventory_value: number;
  top_movers?: {
    product: string;
    qty: string;
  }[];
  column_map?: Record<string, string | null>;
}

export interface Metadata {
  filename: string;
  page_count: number;
  char_count: number;
  row_count: number;
  column_count: number;
  extraction_mode?: string;
  column_order?: string[];
}

export interface ProcessedResult {
  extracted_report: Record<string, string>[];
  audit: AuditData;
  pdf_url: string;
  metadata?: Metadata;
}

type AppState = "upload" | "loading" | "results" | "error";

function guessDistributor(filename: string): string {
  let name = filename.replace(/\.pdf$/i, "");
  name = name.replace(/[_\-]+/g, " ");
  name = name
    .replace(
      /\b(stock|statement|report|sales|march|april|may|june|july|aug|sept|oct|nov|dec|jan|feb|2[0-9]{3})\b/gi,
      ""
    )
    .trim();
  name = name.replace(/\s{2,}/g, " ").trim();
  if (name.length < 2) return filename.replace(/\.pdf$/i, "");
  return name;
}

export default function Home() {
  const [state, setState] = useState<AppState>("upload");
  const [result, setResult] = useState<ProcessedResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [uploadedFilename, setUploadedFilename] = useState<string>("");

  const handleUpload = useCallback(async (file: File) => {
    setState("loading");
    setErrorMessage("");
    setUploadedFilename(file.name);

    const formData = new FormData();
    formData.append("file", file);
    const localPdfUrl = URL.createObjectURL(file);

    try {
      const res = await fetch(`${API_BASE}/api/process-document`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");

      setResult(data);
      setPdfUrl(localPdfUrl);
      setState("results");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to process this document. Please ensure it is a valid pharmaceutical stock report."
      );
      setState("error");
      URL.revokeObjectURL(localPdfUrl);
    }
  }, []);

  const handleReset = useCallback(() => {
    setState("upload");
    setResult(null);
    setPdfUrl("");
    setErrorMessage("");
    setUploadedFilename("");
  }, []);

  const distributorName = guessDistributor(uploadedFilename || "Document");

  const defaultMetadata: Metadata = {
    filename: uploadedFilename || "document.pdf",
    page_count: 0,
    char_count: 0,
    row_count: result?.extracted_report?.length ?? 0,
    column_count: result?.extracted_report?.[0]
      ? Object.keys(result.extracted_report[0]).length
      : 0,
  };

  const metadata = result?.metadata ?? defaultMetadata;

  return (
    <main className="min-h-screen flex flex-col bg-[#f0f4f8]">
      {/* Minimal brand header — shown on non-results states */}
      {state !== "results" && (
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 font-heading">
              Inventory Intelligence
            </h1>
            <p className="text-[11px] text-slate-400 tracking-wide">
              Pharmaceutical Audit Platform
            </p>
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col">
        {state === "upload"  && <UploadZone onUpload={handleUpload} />}
        {state === "loading" && <AbstractLoader />}
        {state === "results" && result && (
          <SplitDashboard
            extractedReport={result.extracted_report}
            audit={result.audit}
            pdfUrl={pdfUrl}
            distributorName={distributorName}
            metadata={metadata}
            onReset={handleReset}
          />
        )}
        {state === "error" && (
          <ErrorDisplay message={errorMessage} onRetry={handleReset} />
        )}
      </div>
    </main>
  );
}
