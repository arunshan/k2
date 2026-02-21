import { checkBugflixHealthDetailed } from "@/lib/datadog-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
  const detail = await checkBugflixHealthDetailed();
  return new Response(JSON.stringify(detail, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
};
