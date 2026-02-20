import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { ToolCallResult } from "@/types";

export const createTicketTool = tool({
  name: "create_ticket",
  description:
    "Creates a support ticket for the customer. Use when the customer reports an issue that needs to be tracked.",
  inputSchema: z.object({
    subject: z.string().describe("Brief subject of the ticket"),
    description: z.string().describe("Detailed description of the issue"),
    priority: z
      .enum(["low", "medium", "high"])
      .describe("Priority level of the ticket"),
  }),
  callback: async (input) => {
    const ticketId = uuidv4();
    console.log("[create_ticket]", input);
    return {
      ticketId,
      message: `Support ticket created successfully. Ticket ID: ${ticketId}. A representative will follow up shortly.`,
    };
  },
});

export const requestRefundTool = tool({
  name: "request_refund",
  description:
    "Submits a refund request for an order. Use when the customer wants a refund.",
  inputSchema: z.object({
    order_id: z.string().describe("The order ID to refund"),
    reason: z.string().describe("Reason for the refund request"),
    amount: z.number().describe("Refund amount in the order currency"),
  }),
  callback: async (input) => {
    const refundRequestId = uuidv4();
    console.log("[request_refund]", input);
    return {
      refundRequestId,
      message: `Refund request submitted for order ${input.order_id}. You will receive a confirmation email within 24 hours.`,
    };
  },
});

export const scheduleCallTool = tool({
  name: "schedule_call",
  description:
    "Schedules a callback for the customer. Use when the customer requests to be called back.",
  inputSchema: z.object({
    customer_name: z.string().describe("Name of the customer"),
    phone: z.string().describe("Phone number for the callback"),
    preferred_time: z
      .string()
      .describe("Customer's preferred callback time"),
  }),
  callback: async (input) => {
    const callbackId = uuidv4();
    console.log("[schedule_call]", input);
    return {
      callbackId,
      message: `Callback scheduled for ${input.preferred_time}. We will call you at ${input.phone}.`,
    };
  },
});

export const handoffToHumanTool = tool({
  name: "handoff_to_human",
  description:
    "Hands off the conversation to a human agent. Use when the customer needs human assistance, the issue is complex, or the customer explicitly requests a human.",
  inputSchema: z.object({
    summary: z
      .string()
      .describe("Summary of the conversation and customer issue"),
    urgency: z
      .enum(["low", "medium", "high"])
      .describe("Urgency level of the handoff"),
  }),
  callback: async (input) => {
    console.log("[handoff_to_human]", input);

    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      try {
        await fetch(slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `[K2 Handoff] Urgency: ${input.urgency}\nSummary: ${input.summary}`,
          }),
        });
      } catch (err) {
        console.error("[handoff_to_human] Slack webhook failed:", err);
      }
    }

    return {
      message:
        "You have been connected to a human agent. Please hold while we transfer your conversation.",
    };
  },
});

export const ALL_TOOLS = [
  createTicketTool,
  requestRefundTool,
  scheduleCallTool,
  handoffToHumanTool,
];

export function buildToolCallResult(
  toolName: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  status: "success" | "error" = "success",
): ToolCallResult {
  return {
    id: uuidv4(),
    toolName,
    input,
    output,
    status,
  };
}
