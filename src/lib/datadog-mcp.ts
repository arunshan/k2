import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const globalForMcp = globalThis as any;
let mcpClient: Client | null = globalForMcp.__mcpClient || null;
let mcpTransport: StdioClientTransport | null = globalForMcp.__mcpTransport || null;
let toolsCache: any[] | null = globalForMcp.__mcpToolsCache || null;

function getMcpEnv() {
  return {
    DATADOG_API_KEY: process.env.DATADOG_API_KEY || process.env.DD_API_KEY || "",
    DATADOG_APP_KEY: process.env.DATADOG_APP_KEY || "",
    DATADOG_SITE: process.env.DATADOG_SITE || process.env.DD_SITE || "datadoghq.com",
  };
}

async function ensureClient(): Promise<Client> {
  if (mcpClient) return mcpClient;

  const env = getMcpEnv();
  if (!env.DATADOG_API_KEY || !env.DATADOG_APP_KEY) {
    throw new Error("DATADOG_API_KEY and DATADOG_APP_KEY are required");
  }

  mcpTransport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@winor30/mcp-server-datadog"],
    env: { ...process.env, ...env } as Record<string, string>,
  });

  mcpClient = new Client({ name: "k2-agent", version: "1.0.0" }, { capabilities: {} });
  await mcpClient.connect(mcpTransport);
  globalForMcp.__mcpClient = mcpClient;
  globalForMcp.__mcpTransport = mcpTransport;
  return mcpClient;
}

function mcpSchemaToCopilotParams(inputSchema: any): any[] {
  if (!inputSchema?.properties) return [];
  const required = new Set(inputSchema.required || []);
  return Object.entries(inputSchema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type || "string",
    description: prop.description || name,
    required: required.has(name),
    ...(prop.enum ? { enum: prop.enum } : {}),
  }));
}

export async function getDatadogActions(): Promise<any[]> {
  try {
    const client = await ensureClient();

    if (!toolsCache) {
      const { tools } = await client.listTools();
      toolsCache = tools;
      globalForMcp.__mcpToolsCache = tools;
      console.log(`[datadog-mcp] Discovered ${tools.length} tools: ${tools.map((t: any) => t.name).join(", ")}`);
    }

    return toolsCache.map((tool: any) => ({
      name: `dd_${tool.name}`,
      description: `[Datadog] ${tool.description || tool.name}`,
      parameters: mcpSchemaToCopilotParams(tool.inputSchema),
      handler: async (args: Record<string, any>) => {
        console.log(`[datadog-mcp] ▶ Calling tool: ${tool.name}`, JSON.stringify(args).slice(0, 200));
        try {
          const result = await client.callTool({ name: tool.name, arguments: args });
          const text = (result.content as any[])
            ?.map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
            .join("\n");
          console.log(`[datadog-mcp] ✓ Tool ${tool.name} returned ${text?.length || 0} chars`);
          return text || "No data returned from Datadog.";
        } catch (err: any) {
          console.error(`[datadog-mcp] ✗ Tool ${tool.name} failed:`, err.message);
          return `Error querying Datadog: ${err.message}`;
        }
      },
    }));
  } catch (err: any) {
    console.error("[datadog-mcp] Failed to initialize:", err.message);
    return [];
  }
}

export async function shutdownMcp() {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    mcpTransport = null;
    toolsCache = null;
  }
}
