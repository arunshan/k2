"use client";

import { FileText, ExternalLink } from "lucide-react";
import type { Citation } from "@/types";
import { cn } from "@/lib/utils";

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const confidence =
    citation.score >= 0.8
      ? "high"
      : citation.score >= 0.5
        ? "medium"
        : "low";

  return (
    <div className="group flex gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">
            [{index + 1}]
          </span>
          <span className="truncate text-sm font-medium text-gray-900">
            {citation.documentName}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              confidence === "high" &&
                "bg-green-50 text-green-700",
              confidence === "medium" &&
                "bg-yellow-50 text-yellow-700",
              confidence === "low" &&
                "bg-red-50 text-red-700",
            )}
          >
            {Math.round(citation.score * 100)}%
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-gray-600">
          {citation.text}
        </p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
