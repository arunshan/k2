#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_ROOT/infra"
LAMBDA_PKG="$PROJECT_ROOT/.lambda-package"

# ── Credentials ────────────────────────────────────────────────────────────
# CDK infra uses the personal IAM user from ~/.aws/credentials [default]
# Bedrock runtime creds come from .env.local (hackathon STS)
unset AWS_SESSION_TOKEN
export AWS_ACCESS_KEY_ID=AKIAQPKQA7SIJ7DYI74K
export AWS_SECRET_ACCESS_KEY="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"
export AWS_DEFAULT_REGION=us-west-2
export AWS_REGION=us-west-2
export CDK_DEFAULT_ACCOUNT=032916962448
export CDK_DEFAULT_REGION=us-west-2

if [ -f "$PROJECT_ROOT/.env.local" ]; then
  export BEDROCK_ACCESS_KEY_ID=$(grep '^BEDROCK_ACCESS_KEY_ID=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
  export BEDROCK_SECRET_ACCESS_KEY=$(grep '^BEDROCK_SECRET_ACCESS_KEY=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
  export BEDROCK_SESSION_TOKEN=$(grep '^BEDROCK_SESSION_TOKEN=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
  export BEDROCK_REGION=$(grep '^BEDROCK_REGION=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
  export BEDROCK_MODEL_ID=$(grep '^BEDROCK_MODEL_ID=' "$PROJECT_ROOT/.env.local" | cut -d= -f2)
fi

echo "=== K2 Deployment (Lambda + CloudFront) ==="
echo "  AWS account: $CDK_DEFAULT_ACCOUNT (personal)"
echo "  Bedrock creds: loaded from .env.local"
echo ""

# ── Step 0: Build embeddable widget ────────────────────────────────────────
echo "▸ Building embeddable widget (public/widget.js)..."
npm run build:widget
echo "  ✓ Widget built"
echo ""

# ── Step 1: Build static frontend ──────────────────────────────────────────
echo "▸ Building static frontend (S3 + CloudFront)..."
cd "$PROJECT_ROOT"

mv src/app/api src/app/_api_tmp
mv src/middleware.ts src/_middleware_tmp.ts
mv src/instrumentation.ts src/_instrumentation_tmp.ts 2>/dev/null || true

restore_api() {
  cd "$PROJECT_ROOT"
  [ -d src/app/_api_tmp ] && mv src/app/_api_tmp src/app/api
  [ -f src/_middleware_tmp.ts ] && mv src/_middleware_tmp.ts src/middleware.ts
  [ -f src/_instrumentation_tmp.ts ] && mv src/_instrumentation_tmp.ts src/instrumentation.ts
}
trap restore_api EXIT

BUILD_TARGET=static npm run build || {
  echo "✗ Static build failed"; exit 1
}

restore_api
trap - EXIT

echo "  ✓ Static export written to out/"
echo ""

# ── Step 2: Build standalone server for Lambda ─────────────────────────────
echo "▸ Building standalone server (Lambda)..."
npm run build
echo "  ✓ Standalone build complete"
echo ""

# ── Step 3: Package Lambda deployment artifact ─────────────────────────────
echo "▸ Packaging Lambda deployment..."
rm -rf "$LAMBDA_PKG"
mkdir -p "$LAMBDA_PKG"

cp -r "$PROJECT_ROOT/.next/standalone/." "$LAMBDA_PKG/"
cp -r "$PROJECT_ROOT/.next/static" "$LAMBDA_PKG/.next/static"
[ -d "$PROJECT_ROOT/public" ] && cp -r "$PROJECT_ROOT/public" "$LAMBDA_PKG/public"

cat > "$LAMBDA_PKG/run.sh" << 'BOOTSTRAP'
#!/bin/bash
exec node server.js
BOOTSTRAP
chmod +x "$LAMBDA_PKG/run.sh"

echo "  ✓ Lambda package ready at .lambda-package/"
echo ""

# ── Step 4: Install CDK dependencies ──────────────────────────────────────
echo "▸ Installing CDK dependencies..."
cd "$INFRA_DIR"
npm ci --silent
echo "  ✓ CDK deps installed"
echo ""

# ── Step 5: Bootstrap CDK (if needed) ─────────────────────────────────────
echo "▸ Checking CDK bootstrap..."
npx cdk bootstrap --require-approval never 2>&1 || true
echo "  ✓ CDK bootstrapped"
echo ""

# ── Step 6: Deploy all CDK stacks ─────────────────────────────────────────
echo "▸ Deploying CDK stacks (Data, API, Frontend)..."
npx cdk deploy --all --require-approval never --outputs-file cdk-outputs.json
echo "  ✓ CDK deploy complete"
echo ""

# ── Step 7: Print outputs ─────────────────────────────────────────────────
echo "=== Deployment Outputs ==="
if [ -f cdk-outputs.json ]; then
  python3 -c "
import json
with open('cdk-outputs.json') as f:
    outputs = json.load(f)
for stack_name, stack_outputs in outputs.items():
    for key, val in stack_outputs.items():
        print(f'  {key}: {val}')
"
fi
echo ""
echo "Done! Your K2 app is live at the CloudFront URL above."
