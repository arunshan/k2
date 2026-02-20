import { type NextRequest, NextResponse } from "next/server";
import {
  listConversations,
  getConversation,
  getAuditLog,
} from "@/lib/dynamodb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("id");
  const view = searchParams.get("view");

  try {
    if (conversationId && view === "audit") {
      const auditLog = await getAuditLog(conversationId);
      return NextResponse.json({ auditLog });
    }

    if (conversationId) {
      const messages = await getConversation(conversationId);
      return NextResponse.json({ messages });
    }

    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const conversations = await listConversations(limit);
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("Conversations API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}
