"use client";

import { SessionProvider } from "next-auth/react";
import { CopilotKit } from "@copilotkit/react-core";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CopilotKit runtimeUrl="/api/copilotkit">
        {children}
      </CopilotKit>
    </SessionProvider>
  );
}
