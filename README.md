# K2 Support Agent

AI-powered customer support agent with RAG, tool calling, and full observability.

## Features

- **Chat Widget** — Streaming AI responses with citations from your knowledge base
- **Tool Calling** — Create tickets, process refunds, schedule calls, hand off to humans
- **RAG** — Upload documents; the agent answers from your knowledge base with citations
- **Admin Panel** — Document management, conversation browser, audit log viewer
- **Auth** — NextAuth.js protected admin routes
- **Guardrails** — Prompt injection defense, source-only mode, rate limiting
- **Observability** — Datadog APM, custom LLM metrics, dashboard template

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and configure
cp .env.example .env.local
# Edit .env.local with your AWS credentials, Bedrock model access, etc.

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the chat widget.
Open [http://localhost:3000/admin](http://localhost:3000/admin) for the admin panel.

Default admin credentials: `admin@example.com` / `admin123`

## AWS Prerequisites

1. **AWS CLI** configured with credentials (`aws configure`)
2. **Bedrock model access** enabled in the AWS Console:
   - Claude 3.5 Sonnet (`anthropic.claude-3-5-sonnet-20241022-v2:0`)
   - Titan Embeddings V2 (`amazon.titan-embed-text-v2:0`)
3. **Datadog account** with API key (for observability)
4. **CDK CLI** installed: `npm install -g aws-cdk`

## Deploy to AWS

```bash
# 1. Bootstrap CDK (first time only)
cd infra && npm install
cdk bootstrap

# 2. Deploy all stacks
cdk deploy --all

# 3. Create Bedrock Knowledge Base
#    Go to AWS Console > Bedrock > Knowledge Bases
#    - Create KB pointing to the S3 bucket from CDK output
#    - Use Titan Embeddings V2 as embedding model
#    - Note the Knowledge Base ID

# 4. Build and push Docker image
#    Use the commands from the CDK output "DockerImagePushInstructions"

# 5. Update ECS task with real image
#    Update the task definition in ECS console to use the ECR image
#    Set BEDROCK_KNOWLEDGE_BASE_ID and DD_API_KEY environment variables
```

## Architecture

| Component | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS |
| LLM | Amazon Bedrock Claude 3.5 Sonnet |
| RAG | Bedrock Knowledge Bases + OpenSearch Serverless |
| Data | DynamoDB (conversations, sessions, audit) + S3 (documents) |
| Auth | NextAuth.js credentials provider |
| Deploy | ECS Fargate + ALB via CDK |
| Observability | Datadog APM + LLM metrics |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/chat` | POST | Streaming chat (SSE) with RAG + tool calling |
| `/api/documents` | GET/POST/DELETE | Document upload and management |
| `/api/conversations` | GET | List conversations, get history, audit log |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth.js authentication |

## Datadog Dashboard

Import `datadog-dashboard.json` via the Datadog API or Dashboard UI to get:
- LLM request latency (p50/p95)
- Request volume and error rate
- Token usage (input/output)
- RAG retrieval hit rate and latency
