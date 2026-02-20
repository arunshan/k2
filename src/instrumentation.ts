export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.DD_API_KEY &&
    process.env.NODE_ENV === "production"
  ) {
    const { initDatadog } = await import("./lib/datadog");
    initDatadog();
  }
}
