# Deep Technical Deconstruction Masterclass: NeuralDesk (AI Support Engine)

---

# Module 1: System Architecture & Topology (The Monorepo)

## Introduction to the NeuralDesk Topology

The NeuralDesk platform is engineered as a modern, production-grade **Turborepo** monorepo. This architectural pattern allows the system to share dependencies, configuration files (TypeScript, ESLint), and core business logic (UI components, backend schemas) across multiple distinct applications without code duplication.

## The Monorepo Structure

The monorepo is divided into two primary directories, configured via `pnpm-workspace.yaml`:
- `apps/*`: The customer-facing and deployable entry points.
- `packages/*`: The internal libraries and shared business/UI logic.

### 1. `apps/` - Deployable Applications
The system contains three primary Next.js/React applications:

#### `apps/web` (The Main SaaS Platform)
- **Role**: This is the core B2B dashboard for organization admins and support agents. It's built with Next.js 15 (App Router) and React 19.
- **Key Responsibilities**:
  - Handles Clerk authentication and organization management.
  - Interfaces directly with the Convex backend for real-time dashboard analytics, billing, and settings management.
  - Integrates `@sentry/nextjs` for full-stack edge and server observability.
  - Contains all the pricing and Stripe integration logic.

#### `apps/widget` (The Customer-Facing Chat Interface)
- **Role**: A lightweight React application designed to be embedded into the end-customer's website.
- **Key Responsibilities**:
  - Connects to the same Convex backend but via restricted `public` API routes to prevent unauthorized access.
  - Facilitates real-time chatting with the AI agent.
  - Initiates WebRTC/Vapi voice calls based on the organization's widget settings.

#### `apps/embed` (The Delivery Mechanism)
- **Role**: A Vite-built vanilla TypeScript/JavaScript library that acts as the loader for the widget.
- **Key Responsibilities**:
  - It generates a script (`embed.ts`) that customers add to their `<head>` or `<body>`.
  - It dynamically injects the `apps/widget` iframe or web component into the host DOM, handling resizing, message passing (via `postMessage`), and initialization without polluting the host site's CSS/JS scope.

### 2. `packages/` - Shared Libraries
The packages directory contains internal dependencies linked across the apps using `workspace:*`.

#### `packages/backend` (The Convex Engine)
- **Role**: The centralized database, real-time sync engine, and serverless compute layer.
- **Key Features**:
  - Uses `@convex-dev/agent` and `@convex-dev/rag` to orchestrate AI workflows directly alongside the data.
  - Uses `@ai-sdk/google` and `@ai-sdk/openai` to power the LLM interactions.
  - Handles webhooks via `svix` (Clerk, Stripe) and connects to `@vapi-ai/server-sdk` for voice logic.
  - Exposes its types to `apps/web` and `apps/widget` so that frontend database queries are fully type-safe end-to-end.

#### `packages/ui` (The Design System)
- **Role**: A centralized UI component library built around `shadcn/ui`, Radix primitives, and Tailwind CSS.
- **Benefits**: Ensures that `apps/web` and `apps/widget` share identical design tokens, buttons, dialogs, and typography, maintaining a cohesive aesthetic across the platform.

#### `packages/typescript-config` & `packages/eslint-config`
- **Role**: Standardized tooling configurations. Guarantees that strict typing and linting rules apply uniformly to both backend and frontend environments.

---

> [!IMPORTANT]
> ## Architect's Defense
> **Why Turborepo over independent repos?**
> In a multi-interface system like NeuralDesk (where a Web Dashboard and an Embedded Widget both talk to the same database), keeping the Convex schema and shared UI components in a monorepo eliminates schema drift. When a new column is added to the database, the frontend types update instantly in the IDE, breaking the build if there are mismatches, preventing runtime errors in production.
> 
> **Why a separate Embed script and Widget app?**
> Injecting a full React app directly into a customer's website risks CSS collisions and global variable conflicts. By having `apps/embed` act as a lightweight, conflict-free loader that summons `apps/widget` via an iframe, we guarantee the widget looks and behaves identically regardless of the host site's architecture.

---

# Module 2: Data Domain & Backend Core (Convex)

## Introduction to the Convex Backend

NeuralDesk uses **Convex** as its backend-as-a-service (BaaS), providing a real-time transactional database, serverless TypeScript functions, and file storage. The entire backend resides in `packages/backend/convex`.

Convex replaces traditional REST/GraphQL APIs and ORMs. It generates end-to-end typed queries and mutations, ensuring that the frontend (`apps/web` and `apps/widget`) can safely interact with the database.

## 1. The Data Schema (`schema.ts`)

The database schema is strictly defined and relies heavily on indexing for multi-tenant data access.

### Core Tables:
- **`subscriptions`**: Tracks Stripe subscription status (`status: v.string()`) per `organizationId`.
- **`widgetSettings`**: Stores the customization details for the chat widget, including the `greetMessage`, suggested prompts, and linked `vapiSettings` (Voice AI).
- **`plugins`**: Maps an `organizationId` and a `service` (e.g., `"vapi"`) to a `secretName`. Secrets themselves are stored securely in Convex's environment variables or AWS Secrets Manager.
- **`conversations`**: Links an AI `threadId` to an `organizationId` and a `contactSessionId`. It tracks the `status` (`unresolved`, `escalated`, `resolved`).
- **`contactSessions`**: Represents the ephemeral or persistent identity of an end-customer chatting via the widget. Stores rich `metadata` (browser, timezone, referrer) to give agents context.
- **`users`**: A simplified user table, largely deferring identity to Clerk via webhooks.

### Multi-Tenancy Design
Almost every table uses `.index("by_organization_id", ["organizationId"])`. This is the fundamental pillar of NeuralDesk's multi-tenancy. Every query and mutation filters by `organizationId` to ensure data isolation.

## 2. Directory Architecture & Access Control

The backend functions are separated into three distinct directories to enforce security at the architectural level:

### `convex/private/` (The Dashboard API)
- **Purpose**: Functions accessed exclusively by authenticated organization members via `apps/web`.
- **Security Mechanism**: Every handler calls `ctx.auth.getUserIdentity()`. If the identity is null, or if the extracted `orgId` doesn't match the requested resource's `organizationId`, the function throws an `UNAUTHORIZED` or `NOT_FOUND` ConvexError.
- **Example**: `private/conversations.ts:updateStatus` ensures that an agent can only resolve a conversation belonging to their own organization.

### `convex/public/` (The Widget API)
- **Purpose**: Functions accessed by unauthenticated end-customers visiting a website where the `apps/widget` is embedded.
- **Security Mechanism**: These endpoints do not require `ctx.auth.getUserIdentity()`. Instead, they rely on a valid `organizationId` being passed by the widget, and they only return safe, public-facing data.
- **Example**: `public/widgetSettings.ts:getByOrganizationId` fetches the `greetMessage` and Vapi configuration without requiring login.

### `convex/system/` (Internal Microservices)
- **Purpose**: Functions meant strictly for server-to-server communication, webhooks, or background tasks.
- **Security Mechanism**: These use `internalQuery` and `internalMutation` instead of `query` and `mutation`. They cannot be called from the frontend, making them invisible to the client.
- **Example**: `system/plugins.ts:upsert` creates or updates plugin configurations (like Vapi secrets).

## 3. Real-time Capabilities

Because NeuralDesk is a customer support platform, real-time sync is critical. When a customer sends a message via the widget (stored via `@convex-dev/agent`), Convex instantly pushes that update to the `apps/web` dashboard without requiring WebSockets, polling, or manual cache invalidation. Next.js simply uses `useQuery(api.private.conversations.getMany)`, and the UI updates reactively.

---

> [!IMPORTANT]
> ## Architect's Defense
> **Why strict directory segregation (`public`, `private`, `system`)?**
> In a SaaS product where unauthenticated users (website visitors) interact with the same database as authenticated admins, the risk of IDOR (Insecure Direct Object Reference) is massive. By separating files into `public` and `private`, and enforcing `internalQuery` for `system` logic, we eliminate the chance of accidentally exposing an administrative mutation to the public internet.
> 
> **Why use Convex instead of Postgres + Prisma?**
> Customer support chat requires sub-second real-time sync. Building WebSockets, Redis pub/sub, and handling cache invalidation over a Postgres database is complex and prone to edge-case bugs. Convex provides ACID transactions and reactive real-time queries out of the box, allowing the team to focus purely on product features rather than infrastructure plumbing.

---

# Module 3: Authentication, Identity & Multi-Tenancy (Clerk)

## Introduction to Identity in NeuralDesk

NeuralDesk uses **Clerk** to handle authentication (AuthN) and organization-based multi-tenancy (AuthZ). Instead of building custom user tables, password reset flows, and organization invitation logic, NeuralDesk offloads this entirely to Clerk.

Crucially, Convex trusts Clerk as the ultimate source of truth via JWT (JSON Web Token) validation.

## 1. Next.js App Router Middleware (`middleware.ts`)

The entry point for security on the frontend is `apps/web/middleware.ts`. 

### The Routing Logic
```typescript
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isOrgFreeRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/org-selection(.*)"]);
```
- **Public Routes**: Accessible by anyone.
- **Protected Routes**: Handled by `await auth.protect()`. If a user is not logged in, Clerk automatically redirects them to the sign-in page.
- **Organization Enforcement**: 
  ```typescript
  if (userId && !orgId && !isOrgFreeRoute(req)) {
    // Redirect to /org-selection
  }
  ```
  NeuralDesk is a strict B2B multi-tenant application. A user **must** belong to an organization to view the dashboard. If they log in but haven't created or joined an organization, the middleware traps them and forces a redirect to `/org-selection`.

## 2. Convex + Clerk Integration (`auth.config.ts`)

For the Convex backend to know who is making a request, the Next.js client passes the Clerk JWT to Convex on every query/mutation via the `<ConvexProviderWithClerk>` (configured in the Next.js root layout).

Convex verifies the cryptographic signature of this JWT using the config:
```typescript
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ]
};
```
Because Convex verifies the token independently, backend functions are mathematically guaranteed that the user identity is authentic.

## 3. The Multi-Tenancy Access Pattern

In a typical system, you might sync users and organizations from Clerk to your database via Webhooks. While NeuralDesk can do this, it primarily relies on **Stateless JWT Claims** for speed and simplicity.

Inside a Convex backend function (e.g., `updateStatus` in `conversations.ts`), the identity is extracted:
```typescript
const identity = await ctx.auth.getUserIdentity();
const orgId = ((identity.orgId ?? (identity as any).org_id)) as string;
```
Clerk embeds the user's currently active `org_id` directly into the JWT.

### The Security Check
1. **Authentication Check**: `if (identity === null) throw "UNAUTHORIZED"`
2. **Tenancy Check**: `if (!orgId) throw "Missing organization"`
3. **Data Access Check**: 
   ```typescript
   const conversation = await ctx.db.get(args.conversationId);
   if (conversation.organizationId !== orgId) throw "Invalid Organization ID"
   ```

---

> [!IMPORTANT]
> ## Architect's Defense
> **Why rely on JWT claims instead of syncing to a `Users` and `Organizations` table?**
> Syncing via webhooks introduces eventual consistency. A user might accept an invite to an org, but if the webhook fails or is delayed, they can't access their data in Convex. By having Clerk inject the `org_id` directly into the JWT, the token itself becomes the source of truth. The moment Clerk issues the token, Convex inherently trusts it, resulting in zero sync latency and a dramatically simpler database schema.
>
> **Why trap users at the middleware level for Organization selection?**
> If a user enters the dashboard without an active `orgId`, all Convex queries will fail (throwing errors) because the backend strictly requires an `orgId` to partition data. By trapping this at the Edge (Middleware), we prevent the frontend from rendering broken states or leaking un-scoped components.

---

# Module 4: The AI & Real-time Communications Engine (Gemini & Vapi)

## Introduction

The core value proposition of NeuralDesk is its AI-driven customer support. NeuralDesk does not rely on simple wrapper APIs; instead, it uses state-of-the-art framework primitives to orchestrate LLM execution and Voice AI directly within the database layer.

## 1. The `@convex-dev/agent` Architecture

Traditional AI applications require a heavy Node.js or Python backend to manage LLM state, parse streaming responses, and manually write conversation history to a database like Postgres. NeuralDesk circumvents this by using the `@convex-dev/agent` framework.

### `supportAgent.ts` Implementation
```typescript
import { google } from "@ai-sdk/google";
import { Agent } from "@convex-dev/agent";

export const supportAgent = new Agent(components.agent, {
  name: "support",
  languageModel: google("gemini-2.5-flash") as any,
  instructions: SUPPORT_AGENT_PROMPT,
});
```

### How it Works:
1. **The Component Model**: `@convex-dev/agent` is a "Convex Component" (an isolated database+logic microservice living inside Convex).
2. **State Management**: When a user chats via the widget, their message is passed to `supportAgent`. The component automatically manages the `threadId`, writes the user's message to a hidden `messages` table, and triggers the LLM.
3. **The LLM**: NeuralDesk uses Google's `gemini-2.5-flash` via the Vercel AI SDK (`@ai-sdk/google`) for incredibly fast, low-latency reasoning.
4. **Streaming & Reactivity**: As Gemini streams tokens back, the Agent component writes them to Convex. Because `apps/web` and `apps/widget` are subscribed to Convex queries, the chat UI updates instantly without Next.js needing to manage SSE (Server-Sent Events) or WebSockets.

## 2. Voice AI Integration (Vapi)

Text chat is handled by Gemini, but Voice chat is powered by **Vapi**.

### Secure Credentials (`private/vapi.ts`)
Vapi requires a Private API key to interact with their servers, but NeuralDesk is multi-tenant. We cannot hardcode one Vapi key for all customers.

Instead, when an organization connects their Vapi account:
1. They input their keys in the dashboard.
2. The key is securely stored in AWS Secrets Manager (or Convex Environment Variables) and registered in the `plugins` table.
3. When the dashboard needs to fetch the organization's Vapi Assistants or Phone Numbers, it calls `getAssistants`.

### The Security Flow:
```typescript
const plugin = await ctx.runQuery(internal.system.plugins.getByOrganizationIdAndService, { organizationId: orgId, service: "vapi" });
const secretValue = await getSecretValue(plugin.secretName);
const vapiClient = new VapiClient({ token: secretData.privateApiKey });
const assistants = await vapiClient.assistants.list();
```
This guarantees that Organization A can never accidentally query or use Organization B's Vapi billing/minutes.

## 3. The Widget Delivery Mechanism

The AI is delivered to the end-user via a two-part system (`apps/embed` and `apps/widget`).

1. **The Embed Script**: Built with Vite, it compiles into a tiny `embed.js` file. Customers add `<script src="https://neuraldesk.com/embed.js"></script>` to their HTML.
2. **The Iframe Injection**: The script creates an invisible `<iframe>` pointing to the hosted `apps/widget` Next.js application. 
3. **Communication**: When the user clicks the "Chat" button, `postMessage` is used between the host DOM and the iframe to animate the widget opening.
4. **Voice Fallback**: If the organization has linked a Vapi assistant in their `widgetSettings`, the widget displays a phone/voice button, utilizing WebRTC to connect the user directly to the Vapi Voice Agent.

---

> [!IMPORTANT]
> ## Architect's Defense
> **Why use `@convex-dev/agent` instead of Next.js Route Handlers + Vercel AI SDK?**
> If you stream AI responses through Next.js route handlers, you are tying the execution to the Edge or Serverless function timeout (often 10-60 seconds on Vercel). Furthermore, you have to manually handle database persistence. If the function crashes, the chat history is lost. By moving the Agent execution *inside* the database (Convex), the execution can run asynchronously for up to 5 minutes, state is guaranteed to persist, and frontend streaming is handled purely via standard database subscriptions. This is vastly more robust.

---

# Module 5: Subscription Billing & Feature Gating (Stripe)

## Introduction

Monetizing a multi-tenant B2B application introduces significant complexity regarding organization limits, seat counts, and premium feature gating. NeuralDesk simplifies this by leveraging **Clerk's native B2B Billing** which acts as a bridge to Stripe.

## 1. The Clerk Pricing Table Integration

In `apps/web`, NeuralDesk does not build custom Stripe Checkout sessions. Instead, it utilizes Clerk's `<PricingTable />` component.
- Clerk handles the rendering of the Stripe products, pricing tiers, and the checkout redirect.
- Crucially, Clerk automatically associates the Stripe checkout session with the user's active `organization_id`.

## 2. Webhook Synchronization (`http.ts`)

When an organization successfully pays via Stripe, Stripe notifies Clerk. Clerk then fires a generic webhook to the Convex backend to inform the database of the new subscription state.

### The Convex HTTP Router
Convex exposes public HTTP endpoints via `convex/http.ts`:
```typescript
import { Webhook } from "svix";
import { httpRouter } from "convex/server";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request); // Verifies Svix signature
    
    if (event.type === "subscription.updated") {
      // Process Billing update
    }
  })
});
```
NeuralDesk uses `svix` to cryptographically verify the webhook signature to prevent malicious spoofing of subscription upgrades.

## 3. Two-Tiered Feature Gating

NeuralDesk enforces premium limits in two distinct places simultaneously when a webhook arrives.

### Level 1: Clerk B2B Limits (Seat Count)
```typescript
const newMaxAllowedMemberships = subscription.status === "active" ? 5 : 1;

await clerkClient.organizations.updateOrganization(organizationId, {
  maxAllowedMemberships: newMaxAllowedMemberships,
});
```
If an organization downgrades, the backend uses the `@clerk/backend` SDK to instantly clamp the maximum allowed users to 1. Clerk's own UI and APIs will immediately block the organization admin from inviting new users, without us writing any custom user-limit logic.

### Level 2: Database Gating (Premium Features)
```typescript
await ctx.runMutation(internal.system.subscriptions.upsert, {
  organizationId,
  status: subscription.status,
});
```
Convex writes the `"active"` or `"past_due"` status to the `subscriptions` table. 

This enables the frontend to gate access to premium pages (e.g., Knowledge Base, Vapi Customization).
1. `apps/web` fetches the organization's subscription status via Convex.
2. If `status !== "active"`, the UI renders an upgrade overlay, and backend API routes reject requests for premium features by checking the `subscriptions` table first.

---

> [!IMPORTANT]
> ## Architect's Defense
> **Why use Clerk's Pricing Tables instead of direct Stripe Webhooks?**
> Connecting Stripe directly to a B2B app means you have to manually map Stripe Customer IDs to your Organization IDs. You also have to handle Stripe's customer portal, plan upgrades, and prorations. Clerk's B2B Billing abstracts this completely. Clerk handles the Stripe Customer mapping, meaning our Convex webhook simply receives `"subscription.updated"` along with our own internal `organization_id`. This reduces billing integration code by over 80%.

---

# Module 6: Observability & Production Readiness

## Introduction

A production-grade AI support platform handles tens of thousands of conversations. If a backend webhook fails or a frontend component crashes, the engineering team must know instantly. NeuralDesk achieves production readiness through comprehensive **Sentry** integration.

## 1. Sentry Integration in Next.js

NeuralDesk leverages Sentry for full-stack observability. Next.js 15 supports native instrumentation, which allows Sentry to automatically wrap all API routes, server actions, and edge functions without manual `try/catch` blocks.

### The Instrumentation Hook (`apps/web/instrumentation.ts`)
```typescript
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
```

### Server & Edge Configurations
The configuration files (`sentry.server.config.ts` and `sentry.edge.config.ts`) define how Sentry behaves in different Vercel runtimes:
```typescript
Sentry.init({
  dsn: "https://<KEY>@ingest.sentry.io/<PROJECT_ID>",
  tracesSampleRate: 1, // Capture 100% of traces for performance monitoring
  enableLogs: true,
});
```

## 2. Production Readiness Checklist

As a Staff Engineer reviewing this system for production, the architecture satisfies several critical requirements:

### ✅ 1. Edge-Safe Security
Because Clerk middleware traps unauthenticated users at the Edge, invalid requests never even reach the Node.js server or the Convex backend. This prevents DDOS attacks from overwhelming backend compute.

### ✅ 2. Schema Drift Prevention
By putting Convex in the `packages/backend` directory and importing its types directly into `apps/web` and `apps/widget`, the system is protected against schema drift. If an engineer renames a column in `schema.ts`, the frontend build will fail immediately in CI/CD before the bug hits production.

### ✅ 3. Isolation of Concerns
- The **Web** app only cares about UI and Organization settings.
- The **Widget** app only cares about customer chatting.
- The **Embed** script only cares about injecting the widget without breaking host CSS.
- The **Backend** only cares about data validation and AI execution.

### ✅ 4. Distributed Tracing
When a user clicks a button in `apps/web` that triggers a server action, which in turn calls a Convex mutation, Sentry can track that entire distributed trace. The `tracesSampleRate: 1` ensures that latency bottlenecks (e.g., if the Vapi API is responding slowly) are highly visible in the Sentry dashboard.

---

> [!IMPORTANT]
> ## Architect's Defense
> **Why use Next.js `instrumentation.ts` instead of just dropping Sentry in `_app.tsx`?**
> In Next.js App Router, much of the execution happens on the Server or the Edge via Server Components and Route Handlers. Dropping Sentry in a client-side layout only catches browser errors. The `instrumentation.ts` file is a Next.js primitive that hooks directly into the underlying Node.js and Edge runtimes, guaranteeing that 100% of unhandled promise rejections, out-of-memory errors, and API timeouts are caught and reported.
