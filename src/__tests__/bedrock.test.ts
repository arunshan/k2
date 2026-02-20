import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateText } from "ai";
import {
  getBedrockCredentials,
  getBedrockRegion,
} from "@/lib/bedrock-credentials";

describe("getBedrockCredentials", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns undefined when no credentials are set", () => {
    delete process.env.BEDROCK_ACCESS_KEY_ID;
    delete process.env.BEDROCK_SECRET_ACCESS_KEY;
    expect(getBedrockCredentials()).toBeUndefined();
  });

  it("returns credentials when both key and secret are set", () => {
    process.env.BEDROCK_ACCESS_KEY_ID = "AKIATEST";
    process.env.BEDROCK_SECRET_ACCESS_KEY = "secret123";
    delete process.env.BEDROCK_SESSION_TOKEN;
    const creds = getBedrockCredentials();
    expect(creds).toEqual({
      accessKeyId: "AKIATEST",
      secretAccessKey: "secret123",
    });
  });

  it("includes sessionToken when set", () => {
    process.env.BEDROCK_ACCESS_KEY_ID = "AKIATEST";
    process.env.BEDROCK_SECRET_ACCESS_KEY = "secret123";
    process.env.BEDROCK_SESSION_TOKEN = "tok";
    const creds = getBedrockCredentials();
    expect(creds).toEqual({
      accessKeyId: "AKIATEST",
      secretAccessKey: "secret123",
      sessionToken: "tok",
    });
  });

  it("returns undefined when only key is set (no secret)", () => {
    process.env.BEDROCK_ACCESS_KEY_ID = "AKIATEST";
    delete process.env.BEDROCK_SECRET_ACCESS_KEY;
    expect(getBedrockCredentials()).toBeUndefined();
  });
});

describe("getBedrockRegion", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns BEDROCK_REGION when set", () => {
    process.env.BEDROCK_REGION = "eu-west-1";
    expect(getBedrockRegion()).toBe("eu-west-1");
  });

  it("falls back to AWS_REGION", () => {
    delete process.env.BEDROCK_REGION;
    process.env.AWS_REGION = "ap-southeast-1";
    expect(getBedrockRegion()).toBe("ap-southeast-1");
  });

  it("defaults to us-west-2", () => {
    delete process.env.BEDROCK_REGION;
    delete process.env.AWS_REGION;
    expect(getBedrockRegion()).toBe("us-west-2");
  });
});

describe("createAmazonBedrock provider", () => {
  it("creates a provider instance without errors", () => {
    const bedrock = createAmazonBedrock({
      region: "us-west-2",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    });
    expect(bedrock).toBeDefined();
    expect(typeof bedrock).toBe("function");
  });

  it("creates a language model from the provider", () => {
    const bedrock = createAmazonBedrock({
      region: "us-west-2",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    });
    const model = bedrock("us.anthropic.claude-3-5-sonnet-20241022-v2:0");
    expect(model).toBeDefined();
    expect(model.modelId).toBe(
      "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    );
  });
});

describe("Bedrock integration (requires real AWS credentials)", () => {
  const hasCredentials =
    !!process.env.BEDROCK_ACCESS_KEY_ID &&
    !!process.env.BEDROCK_SECRET_ACCESS_KEY;

  it.skipIf(!hasCredentials)(
    "generates text using Bedrock with real credentials",
    async () => {
      const creds = getBedrockCredentials()!;
      const region = getBedrockRegion();
      const modelId =
        process.env.BEDROCK_MODEL_ID ||
        "us.anthropic.claude-3-5-sonnet-20241022-v2:0";

      const bedrock = createAmazonBedrock({
        region,
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      });

      const { text } = await generateText({
        model: bedrock(modelId),
        prompt: "Reply with exactly: hello",
        maxTokens: 20,
      });

      expect(text).toBeTruthy();
      expect(text.toLowerCase()).toContain("hello");
    },
  );
});
