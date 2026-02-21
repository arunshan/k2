#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load Bedrock credentials from .env.local
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  export BEDROCK_ACCESS_KEY_ID=$(grep '^BEDROCK_ACCESS_KEY_ID=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
  export BEDROCK_SECRET_ACCESS_KEY=$(grep '^BEDROCK_SECRET_ACCESS_KEY=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
  export BEDROCK_SESSION_TOKEN=$(grep '^BEDROCK_SESSION_TOKEN=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
  export BEDROCK_REGION=$(grep '^BEDROCK_REGION=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
fi

cd "$PROJECT_ROOT/infra"

exec env \
  -u AWS_SESSION_TOKEN \
  -u AWS_SDK_LOAD_CONFIG \
  AWS_ACCESS_KEY_ID= \
  AWS_SECRET_ACCESS_KEY="" \
  AWS_DEFAULT_REGION=us-west-2 \
  AWS_REGION=us-west-2 \
  CDK_DEFAULT_ACCOUNT= \
  CDK_DEFAULT_REGION=us-west-2 \
  BEDROCK_ACCESS_KEY_ID="$BEDROCK_ACCESS_KEY_ID" \
  BEDROCK_SECRET_ACCESS_KEY="$BEDROCK_SECRET_ACCESS_KEY" \
  BEDROCK_SESSION_TOKEN="$BEDROCK_SESSION_TOKEN" \
  BEDROCK_REGION="${BEDROCK_REGION:-us-west-2}" \
  npx cdk deploy --all --require-approval never --outputs-file cdk-outputs.json
