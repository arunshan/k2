import React from "react";
import { createRoot } from "react-dom/client";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";

// @ts-expect-error -- resolved by esbuild plugin at build time
import copilotStyles from "@copilotkit/react-ui/styles.css";

function getApiUrl(): string {
  if (typeof (window as any).__K2_API_URL === "string") {
    return (window as any).__K2_API_URL;
  }

  const scripts = Array.from(document.querySelectorAll("script[src]"));
  for (const s of scripts) {
    const src = (s as HTMLScriptElement).src;
    if (src.includes("widget.js")) {
      try {
        const url = new URL(src);
        return `${url.origin}/api/copilotkit`;
      } catch {
        // fall through
      }
    }
  }

  return "/api/copilotkit";
}

function injectStyles() {
  if (document.getElementById("k2-widget-styles")) return;
  const style = document.createElement("style");
  style.id = "k2-widget-styles";
  style.textContent = copilotStyles;
  document.head.appendChild(style);
}

function K2Widget() {
  const runtimeUrl = getApiUrl();

  return (
    <CopilotKit runtimeUrl={runtimeUrl}>
      <CopilotPopup
        instructions={`You are K2, a friendly customer support agent for the Bugflix streaming app. Respond DIRECTLY to the user. Do NOT describe your thinking or reasoning. Do NOT say what you plan to do. Just answer.

You already have real-time system health data injected as a system message. USE that data to give informed answers. Translate any technical details into simple, friendly language.

RESPONSE RULES:
- NEVER mention monitors, Datadog, metrics, alerts, system health checks, or internal tools
- NEVER describe your reasoning process or what steps you will take
- NEVER say "Let me check" or "I will investigate" -- you already have the data, just answer
- If there are known issues, say "We're aware of an issue affecting..." and explain the impact simply
- If a user reports video playback issues and you see DRM auth errors, tell them there's a known issue with video playback authentication being investigated by the team
- Be empathetic, concise, and offer to create a support ticket or escalate if needed
- Keep responses to 2-4 sentences unless more detail is needed`}
        labels={{
          title: "K2 Support Agent",
          initial:
            "Hi! I'm K2, your AI support assistant. I can help you with questions, create support tickets, process refunds, schedule callbacks, or connect you with a human agent. How can I help?",
          placeholder: "Type your message...",
        }}
        defaultOpen={false}
        clickOutsideToClose={false}
      />
    </CopilotKit>
  );
}

function mount() {
  injectStyles();

  let container = document.getElementById("k2-widget-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "k2-widget-root";
    document.body.appendChild(container);
  }

  const root = createRoot(container);
  root.render(<K2Widget />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
