import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type { Message, Conversation, AuditLogEntry } from "@/types";

const conversationsTable =
  process.env.DYNAMODB_CONVERSATIONS_TABLE ?? "k2-conversations";
const sessionsTable =
  process.env.DYNAMODB_SESSIONS_TABLE ?? "k2-sessions";
const auditTable = process.env.DYNAMODB_AUDIT_TABLE ?? "k2-audit-log";
const region = process.env.AWS_REGION ?? "us-east-1";

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

export async function saveMessage(
  conversationId: string,
  message: Message
): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: conversationsTable,
        Item: {
          PK: conversationId,
          SK: message.timestamp,
          messageId: message.id,
          role: message.role,
          content: message.content,
          citations: message.citations,
          toolCalls: message.toolCalls,
        },
      })
    );
  } catch {
    // DynamoDB not available in local dev -- fail silently
  }
}

export async function getConversation(
  conversationId: string
): Promise<Message[]> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: conversationsTable,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": conversationId },
        ScanIndexForward: true,
      })
    );

    const items = (result.Items ?? []) as Array<{
      SK: string;
      messageId: string;
      role: string;
      content: string;
      citations?: Message["citations"];
      toolCalls?: Message["toolCalls"];
    }>;

    return items.map((item) => ({
      id: item.messageId,
      role: item.role as Message["role"],
      content: item.content,
      timestamp: item.SK,
      citations: item.citations,
      toolCalls: item.toolCalls,
    }));
  } catch (err) {
    console.error("getConversation failed:", err);
    return [];
  }
}

export async function listConversations(
  limit?: number
): Promise<Conversation[]> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: sessionsTable,
        Limit: limit ?? 50,
      })
    );

    const items = (result.Items ?? []) as Array<{
      PK: string;
      conversationId: string;
      userId?: string;
      createdAt: string;
      updatedAt: string;
      title?: string;
      messageCount?: number;
    }>;

    return items
      .map((item) => ({
        id: item.conversationId,
        title: item.title ?? "Untitled",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        messageCount: item.messageCount ?? 0,
        userId: item.userId,
      }))
      .sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, limit ?? 50);
  } catch (err) {
    console.error("listConversations failed:", err);
    return [];
  }
}

export async function saveSession(
  sessionId: string,
  conversationId: string,
  userId?: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: sessionsTable,
        Item: {
          PK: sessionId,
          conversationId,
          userId: userId ?? null,
          createdAt: now,
          updatedAt: now,
        },
      })
    );
  } catch {
    // DynamoDB not available in local dev -- fail silently
  }
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: auditTable,
        Item: {
          PK: entry.conversationId,
          SK: entry.eventTimestamp,
          ...entry,
        },
      })
    );
  } catch {
    // DynamoDB not available in local dev -- fail silently
  }
}

export async function getAuditLog(
  conversationId: string
): Promise<AuditLogEntry[]> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: auditTable,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": conversationId },
        ScanIndexForward: true,
      })
    );

    const items = (result.Items ?? []) as Array<{
      PK: string;
      SK: string;
      conversationId: string;
      eventTimestamp: string;
      eventType: AuditLogEntry["eventType"];
      data: Record<string, unknown>;
      latencyMs?: number;
      tokenUsage?: { inputTokens: number; outputTokens: number };
    }>;

    return items.map((item) => ({
      conversationId: item.conversationId,
      eventTimestamp: item.eventTimestamp,
      eventType: item.eventType,
      data: item.data,
      latencyMs: item.latencyMs,
      tokenUsage: item.tokenUsage,
    }));
  } catch (err) {
    console.error("getAuditLog failed:", err);
    return [];
  }
}
