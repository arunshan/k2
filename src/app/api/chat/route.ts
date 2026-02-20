import { type NextRequest, NextResponse } from "next/server";
import type { ChatRequest, StreamEvent } from "@/types";
import { Agent, BedrockModel } from "@strands-agents/sdk";
import { ALL_TOOLS } from "@/lib/tools";
import { retrieveContext } from "@/lib/knowledge-base";
import { sanitizeInput, buildSystemPrompt } from "@/lib/guardrails";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { saveMessage, logAuditEvent } from "@/lib/dynamodb";
import { getBedrockCredentials, getBedrockRegion } from "@/lib/bedrock-credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sseEncode(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateResult = checkRateLimit(ip);
  const rateLimitHeaders = getRateLimitHeaders(rateResult);

  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json(
      { error: "messages is required" },
      { status: 400 },
    );
  }

  const conversationId = body.conversationId || crypto.randomUUID();
  const lastUserMessage = body.messages[body.messages.length - 1];
  const sanitizedContent = sanitizeInput(lastUserMessage.content);
  const startTime = Date.now();

  logAuditEvent({
    conversationId,
    eventTimestamp: new Date().toISOString(),
    eventType: "user_message",
    data: { content: sanitizedContent },
  }).catch(() => {});

  let retrievedContext = "";
  let citations: Awaited<ReturnType<typeof retrieveContext>>["citations"] = [];

  try {
    const retrieved = await retrieveContext(sanitizedContent);
    retrievedContext = retrieved.context;
    citations = retrieved.citations;
  } catch {
    // RAG not configured -- continue without context
  }

  const systemPrompt = buildSystemPrompt(
    retrievedContext || undefined,
    true,
  );

  const bedrockCredentials = getBedrockCredentials();
  const model = new BedrockModel({
    region: getBedrockRegion(),
    modelId:
      process.env.BEDROCK_MODEL_ID ||
      "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    maxTokens: 4096,
    temperature: 0.3,
    ...(bedrockCredentials
      ? { clientConfig: { credentials: bedrockCredentials } }
      : {}),
  });

  const agent = new Agent({
    model,
    tools: ALL_TOOLS,
    systemPrompt,
  });

  let fullResponse = "";

  try {
    const result = await agent.invoke(sanitizedContent);
    fullResponse = result.toString();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat] Agent error:", message);

    const encoder = new TextEncoder();
    const errStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(sseEncode({ type: "error", data: message })),
        );
        controller.close();
      },
    });
    return new Response(errStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        ...rateLimitHeaders,
      },
    });
  }

  const latencyMs = Date.now() - startTime;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(sseEncode(event)));
      };

      // Stream the response text in chunks for a typing effect
      const chunkSize = 8;
      for (let i = 0; i < fullResponse.length; i += chunkSize) {
        send({
          type: "text",
          data: fullResponse.slice(i, i + chunkSize),
        });
      }

      // Send citations
      const relevantCitations = citations.filter((c) => c.score >= 0.5);
      for (const citation of relevantCitations) {
        send({ type: "citation", data: citation });
      }

      send({ type: "done", data: null });
      controller.close();

      // Fire-and-forget persistence
      saveMessage(conversationId, {
        id: crypto.randomUUID(),
        role: "user",
        content: sanitizedContent,
        timestamp: new Date(startTime).toISOString(),
      }).catch(() => {});

      saveMessage(conversationId, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullResponse,
        timestamp: new Date().toISOString(),
        citations: relevantCitations,
      }).catch(() => {});

      logAuditEvent({
        conversationId,
        eventTimestamp: new Date().toISOString(),
        eventType: "assistant_response",
        data: { contentLength: fullResponse.length },
        latencyMs,
      }).catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...rateLimitHeaders,
    },
  });
}
