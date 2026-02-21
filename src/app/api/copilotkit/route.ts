import {
  CopilotRuntime,
  EmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { BuiltInAgent } from "@copilotkitnext/agent";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
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
];

let healthCache: { data: string; ts: number } | null = null;
const HEALTH_CACHE_TTL = 30_000;

async function getHealthContext(): Promise<string> {
  if (healthCache && Date.now() - healthCache.ts < HEALTH_CACHE_TTL) {
    return healthCache.data;
  }
  try {
    console.log("[copilotkit] Fetching Datadog health context...");
    const data = await checkBugflixHealth();
    healthCache = { data, ts: Date.now() };
    console.log(`[copilotkit] Health context: ${data.length} chars`);
    return data;
  } catch (err: any) {
    console.error("[copilotkit] Health fetch failed:", err.message);
    return "";
  }
}

function buildPrompt(healthData: string): string {
  const healthSection = healthData
    ? `\n\nCURRENT SYSTEM STATUS:\n${healthData}`
    : "\n\nCURRENT SYSTEM STATUS: All systems operating normally.";

  return `You are K2, a friendly customer support agent for Bugflix, a video streaming app.
${healthSection}

RULES:
- Respond DIRECTLY to the user. Never output your thinking or reasoning.
- Use the system status above to give informed answers. If there are active issues, proactively tell the user.
- Never mention Datadog, monitors, metrics, alerts, health checks, or internal tools.
- If system load is high, tell users "we're experiencing some server load that may cause slowness."
- If DRM auth errors are spiking, tell users "we're aware of an issue affecting video playback authentication."
- Be empathetic, concise (2-4 sentences), and offer to create a support ticket or escalate.
- When there are active issues, ALWAYS end your response with: "For more technical details about current incidents, visit our status page: https://d1daof2cvyr19c.cloudfront.net/status.html"
- If the user asks for more details or technical information, direct them to the status page link above.`;
}

let cachedHandleRequest: ((req: NextRequest) => Promise<Response>) | null = null;
let cachedHealthForPrompt: string = "";

function getHandleRequest(healthData: string) {
  if (cachedHandleRequest && cachedHealthForPrompt === healthData) {
    return cachedHandleRequest;
  }

  const prompt = buildPrompt(healthData);
  console.log("[copilotkit] Building runtime with prompt length:", prompt.length);

  const copilotRuntime = new CopilotRuntime({
    agents: {
      default: new BuiltInAgent({
        model: bedrockModel,
        prompt: prompt,
        maxSteps: 3,
        forwardDeveloperMessages: true,
      }),
    } as any,
    actions: baseActions,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: new EmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  cachedHandleRequest = handleRequest;
  cachedHealthForPrompt = healthData;
  return handleRequest;
}

export const OPTIONS = () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });

export const POST = async (req: NextRequest) => {
  const bodyText = await req.text();
  let body: any;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }

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

  const healthData = await getHealthContext();
  const handleRequest = getHandleRequest(healthData);

  const freshReq = new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: bodyText,
  });

  return handleRequest(freshReq);
};
