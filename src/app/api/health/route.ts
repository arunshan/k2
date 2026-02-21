import { checkBugflixHealth } from "@/lib/datadog-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
  const health = await checkBugflixHealth();
  return new Response(JSON.stringify({ health }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
