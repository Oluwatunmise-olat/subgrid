# Examples

Worked examples for extending Subgrid with real vendor integrations and
presets. The point is to show what a real PR adding one of these would look
like, not to re-quote code you can already read directly in the repo.
Double-check paths/fields against the vendor's live docs before merging — APIs
move.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md#adding-a-bridge-preset-rest-or-s3-api-with-no-mcp-server)
for the rules around contributing a catalog entry, and
[`concepts.md`](concepts.md#bridges-how-presets-become-mcp-servers) for what
a preset/bridge actually is.

## A native catalog integration: DigitalOcean's official MCP server

DigitalOcean now publishes an official MCP server, so it belongs in
`INTEGRATIONS`, not `BRIDGE_PRESETS`. The local server can expose only the
services the instance needs:

```ts
{
  id: "digitalocean",
  official: true,
  name: "DigitalOcean",
  category: "paas",
  description: "Apps, droplets and databases via DigitalOcean's official MCP server",
  command: "npx",
  baseArgs: ["-y", "@digitalocean/mcp", "--services", "apps,droplets,databases"],
  fields: [
    {
      key: "DIGITALOCEAN_API_TOKEN",
      label: "API token",
      type: "password",
      help: "DigitalOcean → API → Tokens. Grant only the scopes needed for the enabled services.",
    }
  ]
}
```

The official server also has hosted OAuth endpoints, but the local form above
matches Subgrid's existing `stdio` catalog integrations and exposes the
individual service tools directly to the planner.

## A new catalog integration: the official GitHub MCP server

A real, officially-published `stdio` MCP server: `command: "npx"`,
`baseArgs: ["-y", "@modelcontextprotocol/server-github"]`, one required env
var, `GITHUB_PERSONAL_ACCESS_TOKEN`. Shaped exactly like the Resend/Coolify
entries already in `INTEGRATIONS`, just for a service that isn't
catalogued yet:

```ts
{
  id: "github",
  official: true,
  name: "GitHub",
  category: "other",
  description: "Repos, issues and PRs — official server (@modelcontextprotocol/server-github)",
  command: "npx",
  baseArgs: ["-y", "@modelcontextprotocol/server-github"],
  fields: [
    {
      key: "GITHUB_PERSONAL_ACCESS_TOKEN",
      label: "Personal access token",
      type: "password",
      help: "GitHub → Settings → Developer settings → Personal access tokens. Scope it to the repos you want this component to touch.",
    },
  ],
  docs: {
    label: "GitHub → Personal access tokens",
    url: "https://github.com/settings/tokens",
  },
}
```

## A new catalog integration: a vendor-hosted, OAuth-gated server

Notion runs its own hosted MCP server at `https://mcp.notion.com/mcp` —
no package to install, no API key field, since the credential comes from
an OAuth grant. Shaped like `resend-oauth`/`cloudflare-full` already in
`INTEGRATIONS`:

```ts
{
  id: "notion",
  official: true,
  name: "Notion",
  category: "other",
  description: "Pages, databases and search on your Notion workspace — official hosted server",
  transport: "http",
  url: "https://mcp.notion.com/mcp",
  oauth: true,
  fields: [],
}
```

Once this is in the catalog, registering it is `{ "integration_id": "notion" }`
plus the same `POST .../oauth/authorize` handshake any OAuth-gated server
uses — see the Linear example below for that flow end to end.

## A skills-first, exec-wrapped server: PostHog's hosted MCP

PostHog's hosted server (`https://mcp.posthog.com/mcp`) is OAuth-gated like
Notion above, so the catalog entry is the same shape:

```ts
{
  id: "posthog",
  official: true,
  name: "PostHog",
  category: "analytics",
  description: "Query events, insights and HogQL, and manage feature flags and annotations in one PostHog project",
  transport: "http",
  url: "https://mcp.posthog.com/mcp",
  oauth: true,
  fields: [],
}
```

The difference is seen once connected: `listTools()` returns exactly one tool, `exec`, which takes a CLI-style `command`
string and internally fans out to PostHog's full platform (700+ real
operations). See [`concepts.md`](concepts.md#skills-first-servers-when-one-tool-wraps-hundreds)
for why the planner can't use that directly. The fix is a curated entry in
`src/common/constants/exec-tool-catalog.ts`:

```ts
export const EXEC_WRAPPED_PROVIDERS: Record<string, ExecWrappedProvider> = {
  posthog: {
    wrapperToolName: "exec", // the one real tool PostHog's manifest exposes - not assumed for other providers
    // PostHog's own CLI grammar and required args - a different provider's
    // wrapper tool will want a completely different shape here.
    buildCallArguments: (toolName, input) => ({
      command: `call --json ${toolName} ${JSON.stringify(input ?? {})}`,
      context: `Running "${toolName}" on behalf of a connected Subgrid request.`,
      llm_model: "subgrid-orchestrator",
    }),
    tools: [
      {
        name: "execute-sql",
        description:
          "Run a read-only HogQL (PostHog's SQL) query against this PostHog project - pageviews, events, visitors, unique users, sessions, feature flags, funnels, breakdowns, joins, or any other ad-hoc analytics question about your product data.",
        schema: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              description:
                'The HogQL SELECT query to run. Nearly everything lives in the "events" table ... [schema facts + worked examples go here]',
            },
          },
        },
      },
    ],
  },
};
```

Both the tool `name` and its `schema` were taken from the server's own
`info --json execute-sql` response. `wrapperToolName` matters because
`expandExecWrappedTools()` only triggers when the live manifest's single
tool matches it, and `buildExecToolCall()` dispatches to it by name.
`buildCallArguments` matters because PostHog's `call --json <tool> <json>`
CLI string and its `command`/`context`/`llm_model` fields are PostHog's own
protocol, not a standard — `tool-exec-bridge.ts` never constructs this
shape itself, it just calls whatever function the provider gave it. A
future provider whose wrapper tool isn't called `exec`, or wants a
completely different argument shape, just needs its own
`wrapperToolName`/`buildCallArguments` here; nothing in
`tool-exec-bridge.ts` changes.

- The top-level `description` needs to overlap with how someone actually
  phrases a question ("pageviews", "visitors"), not just the vendor's own
  terminology ("HogQL", "ClickHouse-flavored") — `relevanceScore()` is plain
  keyword overlap, so jargon-only descriptions lose to unrelated tools that
  happen to share a stray word with the user's message.
- The `query` field's description had to spell out that PostHog has no
  `pageviews`/`users` tables — everything is rows in `events` — because the
  planner is one-shot and will never call the server's own `info`/`schema`
  commands to find that out itself. Without it, the LLM wrote plausible but
  nonexistent-table SQL that failed at execution time, not at planning
  time.

To add a second curated tool here (or a new provider that uses the same
`exec`-wrapper pattern), repeat the same two steps against the live server:
confirm the manifest really is the single wrapper tool, then pull the real
tool name and schema from its own `info`/`schema` commands before adding an
entry — never hand-write a schema for a server you haven't actually called.

## Registering a server directly (not a catalog contribution at all)

The two sections above are about _contributing_ a reusable entry to this
repo. You don't need any of that to connect a specific server to your own
instance right now — `POST /api/v1/mcp-servers`
(`src/modules/mcp-registry/`) takes a server directly, with no
`integration_id`/`preset_id`, for exactly this case. Both examples below
need a `project_id` first (`POST /api/v1/projects` or `GET /api/v1/projects`
to find one you already have).

### A community `stdio` package, registered ad hoc (never touches the catalog)

Reusing the GitHub server from above, but _without_ adding it to
`catalog-data.ts` first — you'd do this for literally any `npx`-installable
MCP server you want to try once, following whatever its own README
documents for the command/env vars:

```bash
curl -X POST localhost:8081/api/v1/mcp-servers -H "Content-Type: application/json" -d '{
  "project_id": "<your project id>",
  "name": "GitHub",
  "slug": "github",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token" }
}'
```

Per the [trust model](../README.md#trust-model-bridges-vs-community-mcp-servers):
this runs as a subprocess with your token as an env var — fine for an
official, widely-used server like this one, but the same mechanism works
for any third-party package, which Subgrid doesn't vet.

### A vendor-hosted, OAuth-gated server not in the catalog

Linear ships its own officially hosted MCP server at
`https://mcp.linear.app/mcp`, OAuth 2.1, not yet in `catalog-data.ts`.
Register it with a plain `url`, no `integration_id`, since nothing
resolves it from the catalog:

```bash
curl -X POST localhost:8081/api/v1/mcp-servers -H "Content-Type: application/json" -d '{
  "project_id": "<your project id>",
  "name": "Linear",
  "slug": "linear",
  "transport": "http",
  "url": "https://mcp.linear.app/mcp"
}'
```

Then complete the OAuth grant (`src/modules/oauth/`, PKCE under the hood —
`common/implementations/mcp/oauth-provider.ts`); this part is identical
whether the server came from the catalog or not, since it works off the
stored `server.url`, not a catalog entry:

```bash
# 1. ask for an authorize URL
curl -X POST localhost:8081/api/v1/mcp-servers/<server_id>/oauth/authorize
# -> { "data": { "authorize_url": "https://..." } }

# 2. open that URL in a browser, sign in with the vendor, approve

# 3. the vendor redirects to our own callback, which exchanges the code and
#    then redirects your browser to ${CLIENT_URL}/?oauth=connected&server_id=...
#    (GET /api/v1/mcp-servers/:server_id/oauth/callback — you don't call this yourself)

# 4. confirm it's connected
curl localhost:8081/api/v1/mcp-servers/<server_id>/oauth/status
```

If Linear were added to the catalog instead (as a `CatalogIntegration` with
`transport: "http"`, `url: "https://mcp.linear.app/mcp"`, `oauth: true`),
step 1 would stay identical — you'd just pass `"integration_id": "linear"`
instead of `transport`/`url` in the registration call.

## The verification rule

Don't guess field names or endpoints for either kind of entry — check every
path/param (presets) or package name/env var (integrations) against the
vendor's current docs before committing. A bad path just 404s, but a wrong
field name can get silently dropped or misread by the vendor's API, so
check both. Once registered and tool-listed for real, add a row to the
table in the main [README](../README.md#registering-real-mcp-servers).
