import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import type { Citation } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { getBedrockCredentials, getBedrockRegion } from "@/lib/bedrock-credentials";

export async function retrieveContext(
  query: string
): Promise<{ context: string; citations: Citation[] }> {
  const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID;
  if (!knowledgeBaseId) {
    return { context: "", citations: [] };
  }

  try {
    const bedrockCredentials = getBedrockCredentials();
    const client = new BedrockAgentRuntimeClient({
      region: getBedrockRegion(),
      ...(bedrockCredentials ? { credentials: bedrockCredentials } : {}),
    });

    const response = await client.send(
      new RetrieveCommand({
        knowledgeBaseId,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 5,
          },
        },
      })
    );

    const results = response.retrievalResults ?? [];
    const citations: Citation[] = results.map((result, index) => {
      const text = result.content?.text ?? "";
      const documentName =
        result.location?.s3Location?.uri ??
        (result.location as { webLocation?: { url?: string } })?.webLocation
          ?.url ??
        "Unknown";
      const score = result.score ?? 0;

      return {
        id: uuidv4(),
        text,
        documentName,
        score,
      };
    });

    const context = citations
      .map((c) => `[Source: ${c.documentName}]\n\n${c.text}`)
      .join("\n\n---\n\n");

    return { context, citations };
  } catch (err) {
    console.error("[retrieveContext] Error:", err);
    return { context: "", citations: [] };
  }
}

export async function syncKnowledgeBase(): Promise<void> {
  console.log("Knowledge base sync triggered");
}
