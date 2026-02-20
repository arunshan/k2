# K2 Support Agent

AI-powered customer support agent built with CopilotKit, Amazon Bedrock, and Next.js. Features dual chat paths, tool calling, RAG, an admin panel, and full observability.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│                                                         │
│   ┌──────────────┐              ┌────────────────────┐  │
│   │ CopilotPopup │ (primary)   │    Admin Dashboard  │  │
│   │  (CopilotKit)│              │  conversations /    │  │
│   └──────┬───────┘              │  documents / audit  │  │
│          │                      └────────┬───────────┘  │
└──────────┼───────────────────────────────┼──────────────┘
           │                               │
    POST /api/copilotkit            GET /api/conversations
                                    GET|POST|DELETE /api/documents
           │                               │
┌──────────▼───────────────────────────────▼──────────────┐
│                    Next.js 14 (App Router)               │
│                                                         │
│  ┌─────────────────────┐   ┌──────────────────────────┐ │
│  │  CopilotKit Runtime │   │     Strands Agent        │ │
│  │  + BuiltInAgent     │   │  /api/chat (SSE)         │ │
│  │  + EmptyAdapter     │   │  + RAG context           │ │
│  └─────────┬───────────┘   └────────────┬─────────────┘ │
│            │                            │               │
│            ▼                            ▼               │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Amazon Bedrock                      │    │
│  │     Claude 3.5 Sonnet (us-west-2)               │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ DynamoDB │  │    S3    │  │ Bedrock  │  │Datadog │  │
│  │ messages │  │   docs   │  │   KB     │  │  APM   │  │
│  │ sessions │  │          │  │  (RAG)   │  │        │  │
│  │  audit   │  │          │  │          │  │        │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Dual Chat Paths

The app has two chat backends that share the same Bedrock model and tool definitions:

| Path | Entry Point | Stack | Use Case |
|------|-------------|-------|----------|
| **CopilotKit** (primary) | `CopilotPopup` on `/` | `CopilotRuntime` + `BuiltInAgent` + `@ai-sdk/amazon-bedrock` | Full-featured agent UI with built-in thread management |
| **Strands** (alternate) | `ChatWidget` component | `@strands-agents/sdk` Agent + `BedrockModel` + RAG | SSE streaming chat with knowledge base citations |

### Tool Actions

Both paths expose the same four tools:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `create_ticket` | subject, description, priority | Creates a support ticket |
| `request_refund` | order_id, reason, amount | Submits a refund request |
| `schedule_call` | customer_name, phone, preferred_time | Schedules a callback |
| `handoff_to_human` | summary, urgency | Transfers to a human agent (optionally posts to Slack) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, CopilotKit UI |
| AI Runtime | CopilotKit Runtime + BuiltInAgent (`@copilotkitnext/agent`) |
| LLM | Amazon Bedrock — Claude 3.5 Sonnet v2 |
| RAG | Bedrock Knowledge Bases + OpenSearch Serverless |
| Data | DynamoDB (conversations, sessions, audit log), S3 (documents) |
| Auth | NextAuth.js with credentials provider |
| Guardrails | Input sanitization, system prompt enforcement, rate limiting (60 req/min) |
| Observability | Datadog APM, custom LLM/RAG metrics, dd-trace |
| Testing | Vitest |
| Deploy | ECS Fargate + ALB via AWS CDK |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with Providers wrapper
│   ├── page.tsx                # Home page with CopilotPopup
│   ├── providers.tsx           # SessionProvider + CopilotKit
│   ├── login/page.tsx          # Admin login form
│   ├── admin/page.tsx          # Admin dashboard (protected)
│   └── api/
│       ├── copilotkit/route.ts # CopilotKit runtime endpoint
│       ├── chat/route.ts       # Strands SSE chat endpoint
│       ├── conversations/      # Conversation history + audit
│       ├── documents/          # S3 document management
│       └── auth/[...nextauth]/ # NextAuth handler
├── components/
│   ├── chat-widget.tsx         # SSE-based chat UI
│   ├── chat-message.tsx        # Message bubble renderer
│   ├── citation-card.tsx       # RAG citation display
│   ├── action-card.tsx         # Tool call result card
│   ├── admin-dashboard.tsx     # Tabbed admin panel
│   ├── audit-log.tsx           # Audit log viewer
│   └── document-upload.tsx     # Drag-and-drop file upload
├── lib/
│   ├── auth.ts                 # NextAuth config (credentials provider)
│   ├── bedrock.ts              # Strands Agent + BedrockModel
│   ├── bedrock-credentials.ts  # AWS credential helpers
│   ├── dynamodb.ts             # DynamoDB operations
│   ├── guardrails.ts           # sanitizeInput(), buildSystemPrompt()
│   ├── knowledge-base.ts       # Bedrock KB retrieval (RAG)
│   ├── rate-limit.ts           # Token bucket rate limiter
│   ├── s3.ts                   # S3 document operations
│   ├── tools.ts                # Strands tool definitions
│   ├── datadog.ts              # Datadog init + custom metrics
│   └── utils.ts                # cn(), formatTimestamp(), generateId()
├── types/index.ts              # Shared TypeScript types
├── middleware.ts               # Auth middleware for /admin/*
├── instrumentation.ts          # Datadog tracer init (production)
└── __tests__/
    └── bedrock.test.ts         # Bedrock credential + provider tests
infra/                          # AWS CDK stacks
├── lib/
│   ├── bedrock-stack.ts
│   ├── data-stack.ts
│   ├── network-stack.ts
│   ├── api-stack.ts
│   ├── frontend-stack.ts
│   └── ecs-stack.ts
└── cdk.json
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and configure
cp .env.example .env.local
# Edit .env.local with your AWS credentials, Bedrock model access, etc.

# 3. Run dev server
npm run dev

# 4. Run tests
npm test
```

Open [http://localhost:3000](http://localhost:3000) for the chat widget.
Open [http://localhost:3000/admin](http://localhost:3000/admin) for the admin panel.

Default admin credentials: `admin@example.com` / `admin123`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BEDROCK_ACCESS_KEY_ID` | Yes | AWS access key for Bedrock |
| `BEDROCK_SECRET_ACCESS_KEY` | Yes | AWS secret key for Bedrock |
| `BEDROCK_SESSION_TOKEN` | If STS | Session token for temporary credentials |
| `BEDROCK_REGION` | No | AWS region (default: `us-west-2`) |
| `BEDROCK_MODEL_ID` | No | Model ID (default: `us.anthropic.claude-3-5-sonnet-20241022-v2:0`) |
| `BEDROCK_KNOWLEDGE_BASE_ID` | No | Bedrock KB ID for RAG |
| `AWS_ACCESS_KEY_ID` | Yes | AWS credentials for DynamoDB/S3 |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS credentials for DynamoDB/S3 |
| `NEXTAUTH_SECRET` | Yes | NextAuth JWT secret |
| `NEXTAUTH_URL` | Yes | App URL (e.g. `http://localhost:3000`) |
| `ADMIN_EMAIL` | No | Admin login email |
| `ADMIN_PASSWORD` | No | Admin login password |
| `DD_API_KEY` | No | Datadog API key (enables observability) |
| `SLACK_WEBHOOK_URL` | No | Slack webhook for human handoff notifications |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/copilotkit` | POST | CopilotKit runtime — agent chat, info, tool execution |
| `/api/chat` | POST | Strands agent SSE streaming with RAG |
| `/api/conversations` | GET | List conversations, message history, audit log |
| `/api/documents` | GET/POST/DELETE | Document upload and management |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth.js authentication |

## Deploy to AWS

```bash
# 1. Bootstrap CDK (first time only)
cd infra && npm install
cdk bootstrap

# 2. Deploy all stacks
cdk deploy --all

# 3. Create Bedrock Knowledge Base
#    AWS Console > Bedrock > Knowledge Bases
#    - Point to the S3 bucket from CDK output
#    - Use Titan Embeddings V2
#    - Note the Knowledge Base ID

# 4. Build and push Docker image
#    Use commands from CDK output "DockerImagePushInstructions"

# 5. Set BEDROCK_KNOWLEDGE_BASE_ID and DD_API_KEY in ECS task definition
```

## Datadog Dashboard

Import `datadog-dashboard.json` via the Datadog API or Dashboard UI to get:
- LLM request latency (p50/p95)
- Request volume and error rate
- Token usage (input/output)
- RAG retrieval hit rate and latency
