"use client";

import { useCallback, useState } from "react";
import { Upload, File, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Doc {
  key: string;
  name: string;
  size: number;
  type?: string;
  lastModified?: string;
}

export function DocumentUpload() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents || []);
      }
    } catch {
      // Documents listing may fail if S3 isn't configured
    }
  }, []);

  useState(() => {
    loadDocs();
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage(null);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload failed");
        }
      }

      setMessage({ type: "success", text: `${files.length} file(s) uploaded successfully` });
      await loadDocs();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.key !== key));
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete document" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleUpload(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
          dragOver
            ? "border-brand-400 bg-brand-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400",
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        ) : (
          <Upload className="h-8 w-8 text-gray-400" />
        )}
        <p className="mt-2 text-sm font-medium text-gray-700">
          {uploading ? "Uploading..." : "Drop files here or click to browse"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PDF, TXT, MD, CSV, JSON, DOCX (max 10MB)
        </p>
        <input
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json,.docx"
          onChange={(e) => handleUpload(e.target.files)}
          className="absolute inset-0 cursor-pointer opacity-0"
          style={{ position: "relative" }}
        />
      </div>

      {message && (
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700",
          )}
        >
          {message.text}
        </div>
      )}

      {/* Document List */}
      {docs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-900">
              Uploaded Documents ({docs.length})
            </h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <li
                key={doc.key}
                className="flex items-center gap-3 px-4 py-3"
              >
                <File className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {doc.name}
                  </p>
                  <p className="text-xs text-gray-500">{formatSize(doc.size)}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <button
                  onClick={() => handleDelete(doc.key)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
