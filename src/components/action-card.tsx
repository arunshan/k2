"use client";

import {
  Ticket,
  RefreshCcw,
  Phone,
  UserCheck,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import type { ToolCallResult } from "@/types";
import { cn } from "@/lib/utils";

const TOOL_META: Record<
  string,
  { label: string; icon: typeof Ticket; color: string }
> = {
  create_ticket: {
    label: "Create Ticket",
    icon: Ticket,
    color: "text-blue-600 bg-blue-50",
  },
  request_refund: {
    label: "Refund Request",
    icon: RefreshCcw,
    color: "text-amber-600 bg-amber-50",
  },
  schedule_call: {
    label: "Schedule Call",
    icon: Phone,
    color: "text-green-600 bg-green-50",
  },
  handoff_to_human: {
    label: "Human Handoff",
    icon: UserCheck,
    color: "text-purple-600 bg-purple-50",
  },
};

interface ActionCardProps {
  toolCall: ToolCallResult;
}

export function ActionCard({ toolCall }: ActionCardProps) {
  const meta = TOOL_META[toolCall.toolName] ?? {
    label: toolCall.toolName,
    icon: Ticket,
    color: "text-gray-600 bg-gray-50",
  };
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            meta.color,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-medium text-gray-900">{meta.label}</span>
        {toolCall.status === "success" ? (
          <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
        ) : toolCall.status === "error" ? (
          <XCircle className="ml-auto h-4 w-4 text-red-500" />
        ) : (
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
      {Object.keys(toolCall.input).length > 0 && (
        <div className="mt-2 space-y-1">
          {Object.entries(toolCall.input).map(([key, val]) => (
            <div key={key} className="flex gap-2 text-xs">
              <span className="font-medium text-gray-500">{key}:</span>
              <span className="text-gray-700">{String(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
