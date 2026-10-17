# Examples

Worked examples for extending Subgrid, for real vendors that aren't already
in `catalog-data.ts`. The point is to show what a real PR adding one of
these would look like, not to re-quote code you can already read directly
in the repo. Double-check paths/fields against the vendor's live docs
before actually merging either one — APIs move.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md#adding-a-bridge-preset-rest-or-s3-api-with-no-mcp-server)
for the rules around contributing a catalog entry, and
[`concepts.md`](concepts.md#bridges-how-presets-become-mcp-servers) for what
a preset/bridge actually is.

## A new bridge preset: DigitalOcean (REST, no MCP server exists for it)

DigitalOcean has no MCP server, just a REST API — base URL
`https://api.digitalocean.com`, bearer-token auth, same as Cloudflare DNS
or Coolify already in the catalog. A full PR would cover more than
Droplets (volumes, domains, etc.); this is trimmed to show the shape:

```ts
{
  id: "digitalocean",
  kind: "rest",
  name: "DigitalOcean",
  category: "paas",
  provider: "digitalocean",
  description: "Droplets (VMs) on your DigitalOcean account",
  docs: "https://docs.digitalocean.com/reference/api/digitalocean/",
  baseUrl: "https://api.digitalocean.com",
  auth: { header: "authorization", value: "Bearer ${DIGITALOCEAN_TOKEN}" },
  fields: [
    {
      key: "DIGITALOCEAN_TOKEN",
      label: "API token",
      type: "password",
      help: "DigitalOcean → API → Tokens → Generate New Token, with read/write scope.",
    },
  ],
  verbs: [
    {
      name: "list_droplets",
      method: "GET",
      path: "/v2/droplets",
      description: "All Droplets on the account",
      params: { tag_name: { in: "query" }, page: { type: "number", in: "query" } },
    },
    {
      name: "create_droplet",
      method: "POST",
      path: "/v2/droplets",
      description: "Create a new Droplet",
      requiresApproval: true,
      params: {
        name: { in: "body", required: true, description: "hostname, e.g. web-01" },
        region: { in: "body", required: true, description: "region slug, e.g. nyc3" },
        size: { in: "body", required: true, description: "size slug, e.g. s-1vcpu-1gb" },
        image: { in: "body", required: true, description: "image slug, e.g. ubuntu-22-04-x64" },
      },
    },
    {
      name: "delete_droplet",
      method: "DELETE",
      path: "/v2/droplets/{droplet_id}",
      description: "Permanently destroy a Droplet",
      requiresApproval: true,
      params: { droplet_id: { description: "id from list_droplets" } },
    },
  ],
}
```

Why `requiresApproval: true` on both writes, not just the delete:
`create_droplet` starts billing a real resource and `verbRequiresApproval()`
has no way to know that from the verb name alone (unlike
`delete_droplet`/`cancel_*`-style names, which the general destructive-
keyword heuristic already catches) — see
[`CONTRIBUTING.md`](../CONTRIBUTING.md) for how the two approval paths
differ. A real PR should also set `region`/`size`/`image` as `enum` lists if
DigitalOcean's docs give a stable, enumerable set — skipped here to keep
the example short.

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

## Registering a server directly (not a catalog contribution at all)

The two sections above are about *contributing* a reusable entry to this
repo. You don't need any of that to connect a specific server to your own
instance right now — `POST /api/v1/mcp-servers`
(`src/modules/mcp-registry/`) takes a server directly, with no
`integration_id`/`preset_id`, for exactly this case. Both examples below
need a `project_id` first (`POST /api/v1/projects` or `GET /api/v1/projects`
to find one you already have).

### A community `stdio` package, registered ad hoc (never touches the catalog)

Reusing the GitHub server from above, but *without* adding it to
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
