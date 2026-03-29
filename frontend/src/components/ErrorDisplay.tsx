"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorDisplayProps {
  message: string;
  onRetry: () => void;
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold font-heading text-slate-900 mb-2">
          Processing Error
        </h3>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          {message}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all duration-200 shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
