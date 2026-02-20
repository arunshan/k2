"use client";

import { Bot, User } from "lucide-react";
import type { Message } from "@/types";
import { cn, formatTimestamp } from "@/lib/utils";
import { CitationCard } from "./citation-card";
import { ActionCard } from "./action-card";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn("flex max-w-[75%] flex-col gap-1", isUser && "items-end")}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-brand-600 text-white"
              : "bg-white text-gray-800 shadow-sm ring-1 ring-gray-100",
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.isStreaming && !message.content && (
            <div className="typing-indicator flex gap-1 py-1">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-1 flex w-full flex-col gap-1.5">
            {message.toolCalls.map((tc) => (
              <ActionCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="mt-1 flex w-full flex-col gap-1.5">
            {message.citations.map((c, i) => (
              <CitationCard key={c.id} citation={c} index={i} />
            ))}
          </div>
        )}

        <span className="mt-0.5 text-[10px] text-gray-400">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
