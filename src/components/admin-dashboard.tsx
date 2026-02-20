"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  FileText,
  Shield,
  Clock,
  ChevronRight,
} from "lucide-react";
import type { Conversation } from "@/types";
import { cn, formatTimestamp } from "@/lib/utils";
import { DocumentUpload } from "./document-upload";
import { AuditLog } from "./audit-log";

type Tab = "conversations" | "documents" | "audit";

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("conversations");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/conversations?limit=50")
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tabs = [
    { id: "conversations" as Tab, label: "Conversations", icon: MessageSquare },
    { id: "documents" as Tab, label: "Documents", icon: FileText },
    { id: "audit" as Tab, label: "Audit Log", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conversations Tab */}
      {tab === "conversations" && (
        <div>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-500">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-center">
              <MessageSquare className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">No conversations yet</p>
              <p className="text-xs text-gray-400">
                Conversations will appear here when users start chatting
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white">
              <ul className="divide-y divide-gray-100">
                {conversations.map((conv) => (
                  <li key={conv.id}>
                    <button
                      onClick={() => {
                        setSelectedConversation(conv.id);
                        setTab("audit");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {conv.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(conv.updatedAt)}
                          <span className="text-gray-300">|</span>
                          {conv.messageCount} messages
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {tab === "documents" && <DocumentUpload />}

      {/* Audit Log Tab */}
      {tab === "audit" && <AuditLog conversationId={selectedConversation} />}
    </div>
  );
}
