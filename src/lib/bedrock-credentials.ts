import type { AwsCredentialIdentity } from "@aws-sdk/types";

/**
 * Returns explicit Bedrock credentials when BEDROCK_ACCESS_KEY_ID is set
 * (hackathon account), otherwise returns undefined to use default credentials.
 */
export function getBedrockCredentials():
  | AwsCredentialIdentity
  | undefined {
  const accessKeyId = process.env.BEDROCK_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) return undefined;

  return {
    accessKeyId,
    secretAccessKey,
    ...(process.env.BEDROCK_SESSION_TOKEN
      ? { sessionToken: process.env.BEDROCK_SESSION_TOKEN }
      : {}),
  };
}

export function getBedrockRegion(): string {
  return process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-west-2";
}
