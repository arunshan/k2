import { Agent, BedrockModel } from "@strands-agents/sdk";
import type { AgentStreamEvent } from "@strands-agents/sdk";
import type { StreamEvent, TokenUsage } from "@/types";
import { ALL_TOOLS, buildToolCallResult } from "./tools";

const DEFAULT_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";

const SYSTEM_PROMPT_BASE = `You are K2, a helpful customer support agent. You answer questions using ONLY the provided context. If context is provided, cite it. If you don't know the answer from the provided context, say so. You can take actions using the available tools when the customer requests it. Be concise, professional, and helpful.`;

function buildSystemPrompt(retrievedContext?: string): string {
  if (retrievedContext) {
    return `${SYSTEM_PROMPT_BASE}\n\n## Retrieved Context\n${retrievedContext}`;
  }
  return SYSTEM_PROMPT_BASE;
}

function createAgent(retrievedContext?: string): Agent {
  const model = new BedrockModel({
    region: process.env.AWS_REGION || "us-west-2",
    modelId: process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID,
    maxTokens: 4096,
    temperature: 0.3,
  });

  return new Agent({
    model,
    tools: ALL_TOOLS,
    systemPrompt: buildSystemPrompt(retrievedContext),
  });
}

export async function* streamChat(
  messages: { role: string; content: string }[],
  retrievedContext?: string,
): AsyncGenerator<StreamEvent> {
  const agent = createAgent(retrievedContext);

  const lastUserMessage = messages[messages.length - 1]?.content || "";

  try {
    const stream = agent.stream(lastUserMessage);

    for await (const event of stream) {
      const mapped = mapEvent(event);
      if (mapped) {
        yield mapped;
      }
    }

    yield { type: "done", data: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[streamChat] Error:", message);
    yield { type: "error", data: message };
  }
}

function mapEvent(event: AgentStreamEvent): StreamEvent | null {
  if (!event || typeof event !== "object" || !("type" in event)) {
    return null;
  }

  switch (event.type) {
    case "modelContentBlockDeltaEvent": {
      const delta = (event as { delta?: { type?: string; text?: string } })
        .delta;
      if (delta?.type === "textDelta" && delta.text) {
        return { type: "text", data: delta.text };
      }
      return null;
    }

    case "modelMetadataEvent": {
      const usage = (
        event as { usage?: { inputTokens?: number; outputTokens?: number } }
      ).usage;
      if (usage) {
        return {
          type: "metadata",
          data: {
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
          } satisfies TokenUsage,
        };
      }
      return null;
    }

    case "beforeToolCallEvent": {
      const e = event as {
        toolUse?: {
          name?: string;
          input?: Record<string, unknown>;
          toolUseId?: string;
        };
      };
      if (e.toolUse?.name) {
        return {
          type: "tool_call",
          data: buildToolCallResult(
            e.toolUse.name,
            (e.toolUse.input as Record<string, unknown>) || {},
            {},
            "success",
          ),
        };
      }
      return null;
    }

    case "afterToolCallEvent": {
      const e = event as {
        toolUse?: {
          name?: string;
          input?: Record<string, unknown>;
        };
        result?: { content?: Array<{ text?: string }> };
        error?: Error;
      };
      if (e.toolUse?.name) {
        let output: Record<string, unknown> = {};
        try {
          const text = e.result?.content?.[0]?.text;
          if (text) output = JSON.parse(text);
        } catch {
          output = { raw: e.result?.content?.[0]?.text || "" };
        }
        return {
          type: "tool_result",
          data: buildToolCallResult(
            e.toolUse.name,
            (e.toolUse.input as Record<string, unknown>) || {},
            output,
            e.error ? "error" : "success",
          ),
        };
      }
      return null;
    }

    default:
      return null;
  }
}
