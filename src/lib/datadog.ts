import tracer from "dd-trace";

let initialized = false;

export function initDatadog() {
  if (initialized) return;

  tracer.init({
    service: process.env.DD_SERVICE || "k2-support-agent",
    env: process.env.DD_ENV || "development",
    logInjection: true,
    runtimeMetrics: true,
    profiling: true,
  });

  initialized = true;
  console.log("[datadog] Tracing initialized");
}

export function traceLLMCall<T>(
  operation: string,
  metadata: {
    model?: string;
    conversationId?: string;
    inputLength?: number;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan("llm.request", {
    tags: {
      "llm.operation": operation,
      "llm.model": metadata.model || "anthropic.claude-3-5-sonnet",
      "llm.conversation_id": metadata.conversationId || "",
      "llm.input_length": metadata.inputLength || 0,
    },
  });

  const startTime = Date.now();

  return fn()
    .then((result) => {
      const latencyMs = Date.now() - startTime;
      span.setTag("llm.latency_ms", latencyMs);
      span.setTag("llm.status", "success");

      tracer.dogstatsd.distribution("llm.request.latency", latencyMs, {
        operation,
      });
      tracer.dogstatsd.increment("llm.request.count", 1, { operation });

      return result;
    })
    .catch((err) => {
      span.setTag("llm.status", "error");
      span.setTag("error", true);
      span.setTag("error.message", err instanceof Error ? err.message : String(err));

      tracer.dogstatsd.increment("llm.request.errors", 1, { operation });

      throw err;
    })
    .finally(() => {
      span.finish();
    });
}

export function recordTokenUsage(
  inputTokens: number,
  outputTokens: number,
  model: string = "anthropic.claude-3-5-sonnet",
) {
  tracer.dogstatsd.distribution("llm.tokens.input", inputTokens, { model });
  tracer.dogstatsd.distribution("llm.tokens.output", outputTokens, { model });
  tracer.dogstatsd.distribution("llm.tokens.total", inputTokens + outputTokens, { model });
}

export function recordRAGMetrics(
  citationCount: number,
  topScore: number,
  latencyMs: number,
) {
  tracer.dogstatsd.distribution("rag.retrieval.count", citationCount);
  tracer.dogstatsd.distribution("rag.retrieval.top_score", topScore);
  tracer.dogstatsd.distribution("rag.retrieval.latency", latencyMs);
}

export { tracer };
