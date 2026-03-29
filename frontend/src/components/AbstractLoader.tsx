"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const LOADING_MESSAGES = [
  "Analyzing document structure...",
  "Optimizing token context...",
  "Extracting inventory metrics...",
  "Processing tabular data...",
  "Identifying stock patterns...",
  "Generating executive insights...",
  "Finalizing analysis...",
];

export function AbstractLoader() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        return prev + Math.random() * 3 + 0.5;
      });
    }, 500);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        {/* Animated spinner */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-600 animate-spin" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-b-teal-500 animate-spin"
            style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2
              className="w-6 h-6 text-emerald-600 animate-spin"
              style={{ animationDuration: "3s" }}
            />
          </div>
        </div>

        {/* Message */}
        <p className="text-sm font-medium text-slate-900 animate-subtle-pulse mb-2 h-5">
          {LOADING_MESSAGES[messageIndex]}
        </p>
        <p className="text-xs text-slate-500">
          Please wait while we process your document
        </p>

        {/* Progress bar */}
        <div className="mt-8 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 95)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
