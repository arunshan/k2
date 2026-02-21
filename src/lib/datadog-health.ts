import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const globalForMcp = globalThis as any;

function getMcpEnv() {
  return {
    DATADOG_API_KEY: process.env.DATADOG_API_KEY || process.env.DD_API_KEY || "",
    DATADOG_APP_KEY: process.env.DATADOG_APP_KEY || "",
    DATADOG_SITE: process.env.DATADOG_SITE || process.env.DD_SITE || "datadoghq.com",
  };
}

async function getClient(): Promise<Client> {
  if (globalForMcp.__ddHealthClient) return globalForMcp.__ddHealthClient;

  const env = getMcpEnv();
  if (!env.DATADOG_API_KEY || !env.DATADOG_APP_KEY) {
    throw new Error("DATADOG_API_KEY and DATADOG_APP_KEY are required");
  }

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@winor30/mcp-server-datadog"],
    env: { ...process.env, ...env } as Record<string, string>,
  });

  const client = new Client({ name: "k2-health", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  globalForMcp.__ddHealthClient = client;
  return client;
}

function extractText(result: any): string {
  return (result.content as any[])
    ?.map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
    .join("\n") || "";
}

export async function checkBugflixHealth(): Promise<string> {
  const sections: string[] = [];

  try {
    const client = await getClient();

    const [monitors, incidents, logs] = await Promise.allSettled([
      client.callTool({ name: "get_monitors", arguments: { tags: "app:bugflix" } }),
      client.callTool({ name: "list_incidents", arguments: {} }),
      client.callTool({ name: "get_logs", arguments: { query: "app:bugflix status:error", from: "now-1h", to: "now", limit: 10 } }),
    ]);

    if (monitors.status === "fulfilled") {
      const text = extractText(monitors.value);
      sections.push(`## Monitors (app:bugflix)\n${text || "No monitors found."}`);
      console.log(`[dd-health] Monitors: ${text.length} chars`);
    } else {
      sections.push(`## Monitors\nUnable to fetch: ${monitors.reason?.message}`);
    }

    if (incidents.status === "fulfilled") {
      const text = extractText(incidents.value);
      sections.push(`## Incidents\n${text || "No active incidents."}`);
      console.log(`[dd-health] Incidents: ${text.length} chars`);
    } else {
      sections.push(`## Incidents\nUnable to fetch: ${incidents.reason?.message}`);
    }

    if (logs.status === "fulfilled") {
      const text = extractText(logs.value);
      sections.push(`## Recent Error Logs (last 1h)\n${text || "No error logs found."}`);
      console.log(`[dd-health] Logs: ${text.length} chars`);
    } else {
      sections.push(`## Error Logs\nUnable to fetch: ${logs.reason?.message}`);
    }
  } catch (err: any) {
    console.error("[dd-health] Failed:", err.message);
    return `Unable to check system health: ${err.message}`;
  }

  return sections.join("\n\n");
}
