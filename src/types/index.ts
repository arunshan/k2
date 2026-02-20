export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  citations?: Citation[];
  toolCalls?: ToolCallResult[];
  isStreaming?: boolean;
}

export interface Citation {
  id: string;
  text: string;
  documentName: string;
  score: number;
  location?: string;
}

export interface ToolCallResult {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: "success" | "error";
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  userId?: string;
}

export interface AuditLogEntry {
  conversationId: string;
  eventTimestamp: string;
  eventType:
    | "user_message"
    | "assistant_response"
    | "tool_call"
    | "retrieval"
    | "error";
  data: Record<string, unknown>;
  latencyMs?: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface DocumentRecord {
  id: string;
  name: string;
  s3Key: string;
  uploadedAt: string;
  status: "processing" | "indexed" | "error";
  size: number;
  type: string;
}

export interface StreamEvent {
  type:
    | "text"
    | "citation"
    | "tool_call"
    | "tool_result"
    | "error"
    | "done"
    | "metadata";
  data: unknown;
}

export interface ChatRequest {
  messages: Pick<Message, "role" | "content">[];
  conversationId?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}
