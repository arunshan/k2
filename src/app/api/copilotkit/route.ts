import {
  CopilotRuntime,
  EmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { BuiltInAgent, defineTool } from "@copilotkitnext/agent";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v3";
import { sanitizeInput } from "@/lib/guardrails";
import { logAuditEvent } from "@/lib/dynamodb";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBedrockCredentials, getBedrockRegion } from "@/lib/bedrock-credentials";
import { checkBugflixHealth } from "@/lib/datadog-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const creds = getBedrockCredentials();
const modelId = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-sonnet-20241022-v2:0";

const bedrock = createAmazonBedrock({
  region: getBedrockRegion(),
  accessKeyId: creds?.accessKeyId,
  secretAccessKey: creds?.secretAccessKey,
  sessionToken: creds?.sessionToken,
});

const bedrockModel = bedrock(modelId);

const baseActions: any[] = [
    {
      name: "create_ticket",
      description:
        "Creates a support ticket for the customer. Use when the customer reports an issue that needs to be tracked.",
      parameters: [
        {
          name: "subject",
          type: "string",
          description: "Brief subject of the ticket",
          required: true,
        },
        {
          name: "description",
          type: "string",
          description: "Detailed description of the issue",
          required: true,
        },
        {
          name: "priority",
          type: "string",
          description: "Priority level: low, medium, or high",
          enum: ["low", "medium", "high"],
          required: true,
        },
      ],
      handler: async ({
        subject,
        description,
        priority,
      }: {
        subject: string;
        description: string;
        priority: string;
      }) => {
        const ticketId = uuidv4();
        console.log("[create_ticket]", { subject, description, priority });
        return `Support ticket created successfully. Ticket ID: ${ticketId}. Priority: ${priority}. A representative will follow up shortly.`;
      },
    },
    {
      name: "request_refund",
      description:
        "Submits a refund request for an order. Use when the customer wants a refund.",
      parameters: [
        {
          name: "order_id",
          type: "string",
          description: "The order ID to refund",
          required: true,
        },
        {
          name: "reason",
          type: "string",
          description: "Reason for the refund request",
          required: true,
        },
        {
          name: "amount",
          type: "number",
          description: "Refund amount in the order currency",
          required: true,
        },
      ],
      handler: async ({
        order_id,
        reason,
        amount,
      }: {
        order_id: string;
        reason: string;
        amount: number;
      }) => {
        const refundRequestId = uuidv4();
        console.log("[request_refund]", { order_id, reason, amount });
        return `Refund request submitted for order ${order_id}. Refund ID: ${refundRequestId}. Amount: $${amount}. You will receive a confirmation email within 24 hours.`;
      },
    },
    {
      name: "schedule_call",
      description:
        "Schedules a callback for the customer. Use when the customer requests to be called back.",
      parameters: [
        {
          name: "customer_name",
          type: "string",
          description: "Name of the customer",
          required: true,
        },
        {
          name: "phone",
          type: "string",
          description: "Phone number for the callback",
          required: true,
        },
        {
          name: "preferred_time",
          type: "string",
          description: "Customer's preferred callback time",
          required: true,
        },
      ],
      handler: async ({
        customer_name,
        phone,
        preferred_time,
      }: {
        customer_name: string;
        phone: string;
        preferred_time: string;
      }) => {
        const callbackId = uuidv4();
        console.log("[schedule_call]", {
          customer_name,
          phone,
          preferred_time,
        });
        return `Callback scheduled for ${preferred_time}. Callback ID: ${callbackId}. We will call ${customer_name} at ${phone}.`;
      },
    },
    {
      name: "handoff_to_human",
      description:
        "Hands off the conversation to a human agent. Use when the customer needs human assistance, the issue is complex, or the customer explicitly requests a human.",
      parameters: [
        {
          name: "summary",
          type: "string",
          description: "Summary of the conversation and customer issue",
          required: true,
        },
        {
          name: "urgency",
          type: "string",
          description: "Urgency level of the handoff",
          enum: ["low", "medium", "high"],
          required: true,
        },
      ],
      handler: async ({
        summary,
        urgency,
      }: {
        summary: string;
        urgency: string;
      }) => {
        console.log("[handoff_to_human]", { summary, urgency });

        const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (slackWebhookUrl) {
          try {
            await fetch(slackWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `[K2 Handoff] Urgency: ${urgency}\nSummary: ${summary}`,
              }),
            });
          } catch (err) {
            console.error("[handoff_to_human] Slack webhook failed:", err);
          }
        }

        return "You have been connected to a human agent. Please hold while we transfer your conversation.";
      },
    },
    {
      name: "check_system_health",
      description:
        "Checks the health of the Bugflix application by querying monitoring systems for active alerts, incidents, and recent errors. Call this whenever a user reports problems, slowness, errors, or asks about the status of the application.",
      parameters: [],
      handler: async () => {
        console.log("[check_system_health] ▶ Querying Datadog via MCP...");
        const result = await checkBugflixHealth();
        console.log(`[check_system_health] ✓ Got ${result.length} chars`);
        return result;
      },
    },
];

const agentTools = [
  defineTool({
    name: "check_system_health",
    description:
      "Checks the health of the Bugflix application by querying monitoring systems for active alerts, incidents, and recent errors. Call this whenever a user reports problems, slowness, errors, or asks about the status of the application.",
    parameters: z.object({}),
    execute: async () => {
      console.log("[check_system_health] ▶ Querying Datadog via MCP...");
      const result = await checkBugflixHealth();
      console.log(`[check_system_health] ✓ Got ${result.length} chars`);
      return result;
    },
  }),
];

const copilotRuntime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: bedrockModel,
      tools: agentTools,
      maxSteps: 5,
    }),
  } as any,
  actions: baseActions,
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime: copilotRuntime,
  serviceAdapter: new EmptyAdapter(),
  endpoint: "/api/copilotkit",
});

export const OPTIONS = () =>
  new Response(null, { status: 204 });

export const POST = async (req: NextRequest) => {
  const cloned = req.clone();
  const body = await cloned.json().catch(() => null);

  if (body?.method !== "info") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateResult = checkRateLimit(ip);
    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    if (body?.messages?.length) {
      const lastMessage = body.messages[body.messages.length - 1];
      if (lastMessage && lastMessage.content) {
        const content =
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);

        const sanitized = sanitizeInput(content);

        logAuditEvent({
          conversationId: body.threadId || "unknown",
          eventTimestamp: new Date().toISOString(),
          eventType: "user_message",
          data: { content: sanitized },
        }).catch(() => {});
      }
    }
  }

  return handleRequest(req);
};
