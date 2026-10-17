# Subgrid

End dashboard fatigue. A self-hosted control plane for the infrastructure
you already run: connect Cloudflare, Coolify, Resend, R2, any real MCP
server, or any plain REST API or S3-compatible storage service through
Subgrid's own bridges, then direct them in plain language, "add an A record
for secrets.example.com",
"send a receipt to this customer", instead of logging into a dozen separate
dashboards. Every action is planned, shown for approval before it runs, and
logged.

Runs entirely on infrastructure you control. Your secrets, your database,
your audit log: nothing phones home.

## How it works

1. You connect a component. That can be a real MCP server someone else
   publishes (Coolify, Resend), or a plain REST API or S3-compatible storage
   service wired up through one of Subgrid's own bridges (Cloudflare DNS,
   R2, and more) with no MCP server required on the vendor's side. Either
   way, its credentials are encrypted at rest.
2. You describe what you want done, in a sentence.
3. Subgrid resolves that into one or more concrete tool calls across your
   connected components, and shows you the plan before anything runs.
4. Destructive or write actions pause for explicit approval. Read actions
   that only need to look something up (a record id, a zone) happen
   automatically as part of building the plan, rather than being shown to you.
5. Every call is logged immutably, with credentials masked.

## Self-hosting

**With Docker** (recommended):

```bash
cp .env.example .env
```

The `DB_*` variables are the only ones actually checked at boot; they
already default to match the `postgres` service below, so leave them alone
unless you're pointing at your own Postgres. Set these in `.env` before you
actually _use_ the app, though: the server will start fine without them, but
fails the moment the corresponding feature is touched.

| Variable                                 | Needed for                                | Notes                                                                                                       |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ENCRYPTION_KEY`                         | connecting any component with credentials | `openssl rand -hex 32`. Encrypts stored component credentials. Fails on first use, not at boot.              |
| `APPROVAL_SECRET`                        | signing in at all                         | `openssl rand -hex 32`. Signs the passkey session/approval tokens. Also fails on first use.                  |
| `RP_ID` / `RP_ORIGIN`                    | passkey sign-in                           | WebAuthn relying party. `localhost` only works for local use; set to your real domain for a real deployment. |
| `CLIENT_URL`                             | CORS                                      | where `subgrid-ui` is served from. Defaults to `http://localhost:5173`.                                       |
| `OPENAI_API_KEY` or `OPENROUTER_API_KEY` | the plain-language planner (`/plan`)      | optional; everything else works without it, `/plan` just returns a clear error.                              |

```bash
docker compose up -d
```

This builds the app image (which bundles the `subgrid-ui` frontend into the
same image at build time), starts Postgres, runs migrations automatically on
boot, and serves both the API and the UI on `:8081` — open that URL directly,
there's nothing separate to start (Adminer, a Postgres UI, is on `:8083` if
you want to inspect the database directly).

A pre-built image is also published to GHCR on every push to `main` and on
version tags (`.github/workflows/docker-publish.yml`), if you'd rather pull
than build locally:

```bash
docker pull ghcr.io/oluwatunmise-olat/subgrid:latest
```

(`docker-compose.yml`'s `app` service builds from source by default; swap
`build: .` for `image: ghcr.io/oluwatunmise-olat/subgrid:latest` there if you
want compose to use the published image instead.)

**From source** (for development):

```bash
docker compose up -d postgres adminer
cp .env.example .env
bun install
bun run migrate
bun run dev                 # http://localhost:8081, API only
```

`docker-compose.yml` maps Postgres to host port **5434**, not 5432, to avoid
colliding with other local Postgres instances. Adjust `.env` if you're
pointing at a different Postgres.

Running from source only starts the API — the UI bundling happens in the
Docker build, not `bun run dev`. For frontend development, run `subgrid-ui`
separately per its own README, pointed at this API via `VITE_API_BASE_URL`.

## Trust model: bridges vs. community MCP servers

There are two different kinds of "component" in Subgrid, and they carry very
different trust:

- **Built-in catalog presets** (Cloudflare DNS, R2, Coolify's REST shape,
  etc.) run through Subgrid's own `http-bridge`/`s3-bridge`: a single,
  auditable piece of code in this repo (`src/common/implementations/mcp/`)
  that only ever calls the specific REST verbs declared for that preset, over
  a fixed host, with path/segment validation and no followed redirects. No
  third-party package ever sees your credentials for these; they stay inside
  Subgrid's own process.
- **Community MCP servers**, the `npx -y <package>` ones in the table below,
  are not that. They're arbitrary third-party code, written and maintained
  by someone else, that receives your API keys as environment variables and
  runs as a subprocess with that access. **Subgrid doesn't vet or audit
  community MCP packages.** Connecting one means extending your trust to
  whoever publishes it, same as installing any other dependency that touches
  secrets. Use them when you trust the author; prefer a catalog preset (or
  write one) when you don't.

## Registering real MCP servers

**The built-in catalog is currently limited.** It covers a handful of
common integrations (below), not every service you might run. Anything else
that speaks MCP can still be connected as a custom `stdio`/`sse`/`http`
component; it just won't have a one-click preset in the catalog yet, and per
the trust model above, if it's a community package rather than a catalog
preset, that's a third party you're choosing to trust. PRs adding verified
presets (backed by the bridge, not a community package) are welcome (see
Contributing).

Verified against the live npm registry; these are real, installable
servers, not placeholders. None of them are vetted or audited by Subgrid;
see the trust model above before connecting one with real credentials.

### Zero-config test server (no credentials needed)

Confirms the whole pipeline works: register, list tools, call a tool.

```bash
curl -X POST localhost:8081/api/v1/mcp-servers -H "Content-Type: application/json" -d '{
  "name": "Everything (test)",
  "slug": "everything-test",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-everything", "stdio"]
}'
```

### Coolify ([`coolify-mcp-server`](https://www.npmjs.com/package/coolify-mcp-server) on npm)

Full Coolify v4.1.1+ API coverage: servers, projects, environments, applications, deployments. Token: Coolify dashboard → **Security → API Tokens**.

```bash
curl -X POST localhost:8081/api/v1/mcp-servers -H "Content-Type: application/json" -d '{
  "name": "Coolify",
  "slug": "coolify",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "coolify-mcp-server"],
  "env": {
    "COOLIFY_BASE_URL": "https://your-coolify-instance.com",
    "COOLIFY_TOKEN": "your-api-token"
  }
}'
```

### Cloudflare DNS ([`@thelord/mcp-cloudflare`](https://www.npmjs.com/package/@thelord/mcp-cloudflare) on npm)

List/create/update/delete DNS records on a zone. Token: Cloudflare dashboard → **API Tokens** → Zone:Edit template. Zone ID is on the domain's overview page.

```bash
curl -X POST localhost:8081/api/v1/mcp-servers -H "Content-Type: application/json" -d '{
  "name": "Cloudflare DNS",
  "slug": "cloudflare-dns",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@thelord/mcp-cloudflare"],
  "env": {
    "CLOUDFLARE_API_TOKEN": "your-api-token",
    "CLOUDFLARE_ZONE_ID": "your-zone-id"
  }
}'
```

Note: Cloudflare's _official_ MCP (`https://mcp.cloudflare.com/mcp`, covers R2, Workers, zones broadly) is remote and gated behind OAuth, not a bare API token. Out of scope for the current `sse`/`http` transport, which only sends static headers.

### More, verified the same way (checked each package's actual README, not guessed)

All `stdio`, `npx -y <package>`, env vars exactly as published:

| Component          | Package                                                                                                                                      | Env vars                                                                                 | Category |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| S3 / Cloudflare R2 | [`s3-mcp-server`](https://www.npmjs.com/package/s3-mcp-server) (via `npx -y github:AM1010101/s3-mcp-server`)                                 | `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`                   | storage  |
| Cloudinary         | [`cloudinary-mcp-server`](https://www.npmjs.com/package/cloudinary-mcp-server)                                                               | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`                   | storage  |
| Resend             | [`resend-mcp`](https://www.npmjs.com/package/resend-mcp)                                                                                     | `RESEND_API_KEY`                                                                         | email    |
| ZeptoMail (Zoho)   | [`zeptomail-mcp`](https://www.npmjs.com/package/zeptomail-mcp), templates only, needs a Zoho OAuth app + refresh token, not just an API key | `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`                             | email    |
| Vercel             | [`vercel-mcp-pro`](https://www.npmjs.com/package/vercel-mcp-pro)                                                                             | `VERCEL_TOKEN`, `VERCEL_TEAM_ID` (optional)                                              | paas     |
| Contabo            | [`@kieksme/contabo-mcp`](https://www.npmjs.com/package/@kieksme/contabo-mcp)                                                                 | `CONTABO_CLIENT_ID`, `CONTABO_CLIENT_SECRET`, `CONTABO_API_USER`, `CONTABO_API_PASSWORD` | paas     |
| GoDaddy DNS        | [`@appouse/godaddy-dns-mcp`](https://www.npmjs.com/package/@appouse/godaddy-dns-mcp)                                                         | `GODADDY_API_KEY`, `GODADDY_API_SECRET` (must be a _Production_ key, not OTE)            | dns      |

**Checked and ruled out, not omitted by accident:**

- **Sanity**: the local `@sanity/mcp-server` package is deprecated/archived. Sanity moved to a remote, OAuth-only server at `mcp.sanity.io`. No static-token option exists today.
- **Cloudflare Workers** (deploy/manage, as opposed to R2 storage): no dedicated static-token MCP server found. The official `mcp.cloudflare.com` covers it but is OAuth-gated, same limitation as above.

Both need an OAuth credential flow in Subgrid before they can be wired up.

After registering, `GET /api/v1/mcp-servers/:server_id/tools` lists what each
server actually exposes. Tool names/args vary by server version, so check
that instead of assuming.

## Contributing

Issues and PRs are welcome. See [`docs/concepts.md`](docs/concepts.md) for
how the pieces fit together (bridges, planning, security model),
[`docs/examples.md`](docs/examples.md) for real catalog/preset entries to
copy from, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the project layout,
code style, and step-by-step guides for adding a catalog integration, a
bridge preset, or a new module.
