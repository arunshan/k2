"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  Bot,
  Wrench,
  Search,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";
import type { AuditLogEntry } from "@/types";
import { cn, formatTimestamp } from "@/lib/utils";

const EVENT_ICONS: Record<string, typeof MessageSquare> = {
  user_message: MessageSquare,
  assistant_response: Bot,
  tool_call: Wrench,
  retrieval: Search,
  error: AlertTriangle,
};

const EVENT_COLORS: Record<string, string> = {
  user_message: "bg-blue-50 text-blue-600",
  assistant_response: "bg-green-50 text-green-600",
  tool_call: "bg-amber-50 text-amber-600",
  retrieval: "bg-purple-50 text-purple-600",
  error: "bg-red-50 text-red-600",
};

interface AuditLogProps {
  conversationId: string | null;
}

export function AuditLog({ conversationId }: AuditLogProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setEntries([]);
      return;
    }

    setLoading(true);
    fetch(`/api/conversations?id=${conversationId}&view=audit`)
      .then((res) => res.json())
      .then((data) => setEntries(data.auditLog || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [conversationId]);

  if (!conversationId) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        Select a conversation to view its audit log
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        Loading audit log...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No audit entries found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const Icon = EVENT_ICONS[entry.eventType] || MessageSquare;
        const color = EVENT_COLORS[entry.eventType] || "bg-gray-50 text-gray-600";

        return (
          <div
            key={`${entry.eventTimestamp}-${i}`}
            className="flex gap-3 rounded-lg border border-gray-100 bg-white p-3"
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                color,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize text-gray-900">
                  {entry.eventType.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTimestamp(entry.eventTimestamp)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                {entry.latencyMs !== undefined && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {entry.latencyMs}ms
                  </span>
                )}
                {entry.tokenUsage && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {entry.tokenUsage.inputTokens} in / {entry.tokenUsage.outputTokens} out
                  </span>
                )}
              </div>
              {Object.keys(entry.data).length > 0 && (
                <pre className="mt-2 max-h-24 overflow-auto rounded bg-gray-50 p-2 text-[11px] text-gray-600">
                  {JSON.stringify(entry.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
