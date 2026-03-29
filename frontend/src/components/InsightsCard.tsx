"use client";

import { Lightbulb } from "lucide-react";

interface InsightsCardProps {
  insights: string[];
}

export function InsightsCard({ insights }: InsightsCardProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-emerald-600" />
        </div>
        <h3 className="text-sm font-semibold font-heading text-slate-900">
          Executive Insights
        </h3>
      </div>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-[10px] font-bold text-emerald-600">{i + 1}</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {insight}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
