const DD_API_KEY = process.env.DATADOG_API_KEY || process.env.DD_API_KEY || "";
const DD_APP_KEY = process.env.DATADOG_APP_KEY || "";
const DD_SITE = process.env.DATADOG_SITE || process.env.DD_SITE || "datadoghq.com";

const BASE = `https://api.${DD_SITE}/api`;

async function ddGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "DD-API-KEY": DD_API_KEY,
      "DD-APPLICATION-KEY": DD_APP_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Datadog ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function ddPost(path: string, body: any): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "DD-API-KEY": DD_API_KEY,
      "DD-APPLICATION-KEY": DD_APP_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Datadog ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

export interface MonitorDetail {
  id: number;
  name: string;
  status: string;
  type: string;
  query: string;
  message: string;
  tags: string[];
  created: string;
  modified: string;
}

export interface HealthDetail {
  monitors: MonitorDetail[];
  errorLogs: { timestamp: string; message: string; service: string }[];
  fetchedAt: string;
  hasActiveIncidents: boolean;
}

export async function checkBugflixHealthDetailed(): Promise<HealthDetail> {
  const result: HealthDetail = {
    monitors: [],
    errorLogs: [],
    fetchedAt: new Date().toISOString(),
    hasActiveIncidents: false,
  };

  if (!DD_API_KEY || !DD_APP_KEY) return result;

  const [allMonitors, logs] = await Promise.allSettled([
    ddGet("/v1/monitor"),
    ddPost("/v2/logs/events/search", {
      filter: { query: "service:bugflix status:error", from: "now-1h", to: "now" },
      sort: "timestamp",
      page: { limit: 10 },
    }),
  ]);

  if (allMonitors.status === "fulfilled" && Array.isArray(allMonitors.value)) {
    const data = allMonitors.value;
    const alerting = data.filter((m: any) => m.overall_state === "Alert" || m.overall_state === "Warn");
    const bugflixMonitors = data.filter((m: any) => (m.name || "").toLowerCase().includes("bugflix"));
    const relevant = [...new Map([...alerting, ...bugflixMonitors].map((m: any) => [m.id, m])).values()];

    result.monitors = relevant.map((m: any) => ({
      id: m.id,
      name: m.name || "Unknown",
      status: m.overall_state || "Unknown",
      type: m.type || "unknown",
      query: m.query || "",
      message: m.message || "",
      tags: m.tags || [],
      created: m.created || "",
      modified: m.modified || "",
    }));
    result.hasActiveIncidents = alerting.length > 0;
  }

  if (logs.status === "fulfilled") {
    const events = logs.value?.data || [];
    result.errorLogs = events.slice(0, 10).map((e: any) => {
      const attrs = e.attributes || {};
      return {
        timestamp: attrs.timestamp || "",
        message: attrs.message || attrs.status || "error",
        service: attrs.service || "bugflix",
      };
    });
  }

  return result;
}

export async function checkBugflixHealth(): Promise<string> {
  if (!DD_API_KEY || !DD_APP_KEY) {
    console.warn("[dd-health] Missing DATADOG_API_KEY or DATADOG_APP_KEY");
    return "";
  }

  const sections: string[] = [];

  const [allMonitors, logs] = await Promise.allSettled([
    ddGet("/v1/monitor"),
    ddPost("/v2/logs/events/search", {
      filter: { query: "service:bugflix status:error", from: "now-1h", to: "now" },
      sort: "timestamp",
      page: { limit: 10 },
    }),
  ]);

  if (allMonitors.status === "fulfilled") {
    const data = allMonitors.value;
    if (Array.isArray(data)) {
      const alerting = data.filter((m: any) =>
        m.overall_state === "Alert" || m.overall_state === "Warn"
      );
      const bugflixMonitors = data.filter((m: any) =>
        (m.name || "").toLowerCase().includes("bugflix")
      );
      const relevant = [...new Map([...alerting, ...bugflixMonitors].map((m: any) => [m.id, m])).values()];

      if (relevant.length > 0) {
        const summary = relevant.map((m: any) => {
          return `- Monitor "${m.name}": status=${m.overall_state}, type=${m.type}, query="${(m.query || "").slice(0, 300)}", message="${(m.message || "").slice(0, 300)}"`;
        }).join("\n");
        sections.push(`## Alerting & Bugflix Monitors\n${summary}`);
        console.log(`[dd-health] Found ${relevant.length} relevant monitors (${alerting.length} alerting, ${bugflixMonitors.length} bugflix)`);
      } else {
        sections.push("## Monitors\nAll monitors are healthy. No alerts.");
      }
    }
  } else {
    console.error("[dd-health] Monitors failed:", allMonitors.reason?.message);
    sections.push(`## Monitors\nFailed to fetch: ${allMonitors.reason?.message}`);
  }

  if (logs.status === "fulfilled") {
    const data = logs.value;
    const events = data?.data || [];
    if (events.length > 0) {
      const logSummary = events.slice(0, 5).map((e: any) => {
        const attrs = e.attributes || {};
        return `- [${attrs.timestamp}] ${attrs.message || attrs.status || "error"}`;
      }).join("\n");
      sections.push(`## Recent Error Logs (last 1h)\nFound ${events.length} errors:\n${logSummary}`);
      console.log(`[dd-health] Found ${events.length} error logs`);
    } else {
      sections.push("## Error Logs\nNo recent errors in the last hour.");
    }
  } else {
    console.error("[dd-health] Logs failed:", logs.reason?.message);
    sections.push(`## Error Logs\nFailed to fetch: ${logs.reason?.message}`);
  }

  return sections.join("\n\n");
}
