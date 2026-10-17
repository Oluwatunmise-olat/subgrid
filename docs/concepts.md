# Concepts

This explains how Subgrid is actually put together: the difference between
an integration and a preset, what a "bridge" is, how a plain-language
message turns into a workflow, and where the safety checks live. Read this
before touching the code — it'll save you from re-deriving things that are
already decided.

If you just want to run Subgrid, see the main [README](../README.md). This
is for people changing or extending it.

## The catalog: integrations vs. presets

Subgrid connects to "components" — Cloudflare, Coolify, Resend, R2, and so
on. The catalog (`src/common/utils/catalog-data.ts`) describes two
fundamentally different kinds of component, and the distinction matters a
lot for where you'd add a new one.

**Integrations** (`CatalogIntegration`, the `INTEGRATIONS` array) are
components that already speak [MCP](https://modelcontextprotocol.io)
natively. There's nothing for Subgrid to build — it just connects as an MCP
client. Three shapes:

- A real MCP server run as a local subprocess (`transport: "stdio"`,
  `command`/`args` — e.g. Resend's own `resend-mcp` package via `npx`)
- A vendor's hosted MCP server reached over HTTP, usually OAuth-gated
  (`transport: "http"`, `url`, `oauth: true` — e.g. Cloudflare's own
  `https://mcp.cloudflare.com/mcp`)
- A "bring your own" slot (`custom-stdio`, `custom-remote`) where the user
  supplies their own command or URL

**Presets** (`BridgePreset`, the `BRIDGE_PRESETS` array) are for services
that have **no MCP server at all** — just a plain REST API (`kind: "rest"`,
e.g. Cloudflare DNS, GoDaddy, Postmark, Coolify's REST API, Vercel) or an
S3-compatible object storage API (`kind: "s3"`, e.g. Cloudflare R2). Since
nobody ships an MCP server for these, Subgrid ships its own generic one —
that's the "bridge," covered next.

The practical test for "is this an integration or a preset": does a real
MCP server already exist for this service? If yes, it's an integration (or
just tell people to connect it as a custom component — see the
[README](../README.md#registering-real-mcp-servers)). If no, and it has a
REST or S3 API, it's a preset.

## Bridges: how presets become MCP servers

A preset has no MCP server, so Subgrid runs its own generic one as a
subprocess and feeds it a declarative spec describing the target API. There
are two bridge implementations, both under
`src/common/implementations/mcp/`:

- `http-bridge/server.ts` — generic REST bridge. Takes a `Spec` (base URL,
  auth, and a list of `Verb`s — path, method, params) and turns each `Verb`
  into one MCP tool at runtime. When that tool is called, it fills in the
  path/query/body from the tool arguments and makes the real HTTP request.
- `s3-bridge/server.ts` — generic S3 bridge. Takes an `S3Spec` (endpoint,
  region, credentials) and exposes a fixed set of S3 tools (`list_buckets`,
  `get_object`, `put_object`, etc.), signing every request with SigV4
  itself (`sigv4.ts`) — no AWS SDK involved.

**Both files are standalone scripts, not part of the main app's module
graph.** They're spawned as separate child processes and talk MCP over
stdio, the same as any other `stdio` MCP server Subgrid connects to. They
can still import shared code from `@/common/*` (bun resolves the same
`tsconfig.json` path aliases regardless of entry point — verified by
running them directly), but they never import from `src/modules/*`, since
they have no access to the DI container, the database, or an HTTP server.
Treat them as a separate, narrower runtime: pure functions, no `tsyringe`,
no repositories.

### How a preset actually gets spawned

This indirection trips people up, so it's worth tracing exactly:

1. A client registers a server referencing a preset (`preset_id`).
   `CatalogService.resolvePreset()` (`src/modules/catalog/services/catalog.service.ts`)
   resolves that to `{ transport: "stdio", command: "bun", args: bridgeArgv(preset) }`.
2. `bridgeArgv()` (`src/modules/catalog/bridge-spec.ts`) turns the preset
   into a two-element argv: a **sentinel string** (`<subgrid:http-bridge>`
   or `<subgrid:s3-bridge>`, from `BRIDGE_SENTINELS` in
   `common/implementations/mcp/bridges.ts`) followed by the JSON-encoded
   spec. This is what actually gets stored on the `mcp_servers` row.
3. When something needs to actually connect (`connectToMcpServer()` in
   `common/implementations/mcp/client.ts`), it calls
   `resolveStdioCommand()`, which notices the sentinel in the stored args
   and rewrites the command to `process.execPath` (the `bun` binary) with
   the sentinel swapped for the real file path
   (`http-bridge/server.ts`/`s3-bridge/server.ts`).

So the database never stores a literal file path — it stores a sentinel
that gets resolved at spawn time. That's deliberate: it means the bridge
implementation can move without needing a migration to fix up every
already-registered server.

## Capabilities: how Subgrid knows what a tool does

Every tool, whether it comes from a real MCP server or a bridge, gets
classified into a `ToolCapability` (`src/common/types/planning.ts`):

```ts
{ resource: string; operation: string; target: string | null; readOnly: boolean; requiredInputs: string[] }
```

This is inferred heuristically from the tool's name/description
(`src/common/utils/tool-capability.ts`), against a shared vocabulary of
operation/resource/target keywords
(`src/common/constants/tool-vocabulary.ts` — this is the single place to
extend if the planner is misclassifying a verb; don't duplicate keyword
lists elsewhere).

This classification is what lets the planner reason about requests without
calling the LLM for every single message: "list my buckets" can be scored
against every connected tool's `resource: "storage", operation: "list"`
and matched directly, with no LLM call at all (see "fast path" below).
`readOnly` is also what gates the approval flow — see Security.

## Planning: from a sentence to a workflow

`PlanningService.plan()` (`src/modules/planning/services/planning.service.ts`)
is the core pipeline. Roughly, in order:

1. **Discover tools** — fetch (and cache, 5 minutes) every connected
   server's tool manifest, score each tool for textual relevance to the
   message.
2. **Narrow by intent** — filter out documentation-only tools for
   operational requests, scope to an explicitly-named component if one was
   mentioned, filter to tools whose capability resource overlaps the
   request.
3. **Fast path** — if exactly one *read-only* tool clearly matches (high
   confidence, every required argument resolvable from entities already in
   the message — a bucket name, a domain, a zone), skip the LLM entirely
   and call it directly. This is what makes "list my buckets" instant
   instead of waiting on a model.
4. **Single strong match** — if exactly one tool scores high enough on
   capability (resource/operation/target all agree), use it directly even
   if it's a write action (it still goes through approval before running).
5. **LLM fallback** — anything ambiguous goes to the configured LLM
   (`OpenAIllmProcessor`, OpenAI or OpenRouter) with the candidate tools as
   function-calling schemas. The LLM returns tool calls, which get
   re-validated against the same capability rules before being accepted.
6. **Lookup insertion** — if a planned step needs an ID it wasn't given
   (a record id, a bucket's internal key), a lookup step is inserted ahead
   of it automatically (`common/utils/lookup-insertion.ts`) rather than
   asking the user for an internal identifier.
7. The result becomes a `Workflow` with ordered `WorkflowStep`s.

## Workflows: approval and execution

A workflow is a DAG of steps (mostly sequential, with a `parallel` mode for
independent read steps), persisted via `WorkflowsRepository`/
`WorkflowStepsRepository`. Each step carries the `ToolCapability` it was
planned with.

- A step with `capability.readOnly === false` requires explicit approval
  before it runs (`requires_approval`), unless the server has a standing
  approval for that exact tool name (`approved_tools`) or the server's
  `approval_policy` is `"auto"`.
- Step inputs can reference an earlier step's result —
  `{{step1.result.0.id}}` — resolved at execution time
  (`common/utils/step-input.ts`). This is how "delete the DNS record named
  X" works without the LLM ever seeing or guessing an internal record ID:
  the plan is `list_dns_records` then `delete_dns_record` with the id
  templated from step 1's output.
- Execution (`WorkflowRuntimeService.runSteps`) walks the DAG, skipping
  steps whose dependencies failed, and normalizes every tool result into a
  consistent shape (`common/utils/result-normalizer.ts`) before storing it.

## Security

- **Secrets** (MCP server credentials, OAuth tokens, the LLM API key) are
  encrypted at rest with AES-256-GCM (`common/utils/encrypt-decrypt.ts`),
  keyed by `ENCRYPTION_KEY`. Nothing sensitive is ever stored in plaintext.
- **Passkeys** are the only authentication this instance has — there's no
  username/password, no multi-tenant account model. The first passkey
  registered becomes the login for the whole instance
  (`modules/security/services/passkey.service.ts`).
- **Approval tokens**: writing a secret (registering credentials, setting
  the instance's LLM key) requires a short-lived JWT obtained by completing
  a fresh passkey challenge, scoped to one specific action string (e.g.
  `"store_server_secrets"`, `"store_llm_settings"`) so a token issued for
  one sensitive action can't be replayed for another.
- **Destructive tool calls** go through the same approval gate as writes,
  keyed off the capability's `readOnly` flag and a keyword check
  (`isDestructive` in `common/utils/tool-policy.ts`) for tools whose name
  suggests `delete`/`remove`/`drop`/etc.

## LLM configuration

The planner's LLM key is **instance-wide, not per-request**: set once via
`PUT /api/v1/llm-settings` (gated by the same passkey-approval flow as any
other secret write), persisted encrypted, and used for every planning
request on this instance. It falls back to `OPENAI_API_KEY`/
`OPENROUTER_API_KEY` in the environment if nothing's been configured
through the API. See `src/modules/llm-settings/`.

## Data model

| Table | What it's for |
| --- | --- |
| `projects` | A named grouping of connected components |
| `mcp_servers` | A connected component — real MCP server, catalog integration, or bridge-backed preset. `catalog_id` links back to the catalog entry it came from, if any |
| `oauth_connections` | PKCE/token state for an `mcp_servers` row connected via OAuth (one row per server) |
| `workflows` / `workflow_steps` | A plan and its ordered steps |
| `action_logs` | Immutable record of every tool call actually executed, with masked credentials |
| `webauthn_credentials` | Registered passkeys |
| `passkey_challenges` | Short-lived pending WebAuthn challenges (registration/approval), consumed on use |
| `llm_settings` | The one instance-wide LLM provider/key, if configured |
