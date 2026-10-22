# Troubleshooting

## The app fails to start because environment variables are missing

Subgrid validates its database settings and core security secrets at startup.
Set every variable named in the startup error. Generate separate values for
the encryption and approval secrets:

```bash
openssl rand -hex 32
```

Use one generated value for `ENCRYPTION_KEY` and another for
`APPROVAL_SECRET`. Do not commit either value.

LLM credentials remain optional at startup. `OPENAI_API_KEY` or
`OPENROUTER_API_KEY` is needed only when planning falls back to an LLM, and an
LLM can also be configured later through Subgrid's settings. Read-only
fast-path requests can work without one.

## Passkey registration or login fails

`RP_ORIGIN` must exactly match the origin in the browser, including scheme,
host, and port.

- Bundled Docker app: `http://localhost:8081`
- Separate frontend dev server: usually `http://localhost:5173`

Set `RP_ID` to the matching host (`localhost` for local development) and
restart the app after changing the values.

## The API cannot reach Postgres

When the API runs from the host and Postgres runs through Docker Compose, use
the host-mapped database port from `docker-compose.yml` (currently `5434`).
When the API runs inside Docker, use the service name `postgres` and port
`5432` instead.

Check the database settings in `.env` and confirm the container is healthy:

```bash
docker compose ps
docker compose logs postgres
```

## The UI is missing when running from source

`bun run dev` starts the API only. The Docker build bundles the separate
`subgrid-ui` frontend into the app image. For frontend development, run the UI
project separately and set:

```env
VITE_API_BASE_URL=http://localhost:8081
CLIENT_URL=http://localhost:5173
RP_ORIGIN=http://localhost:5173
```

## An MCP server cannot be connected

Check these in order:

1. Confirm the command, URL, transport, and environment-variable names match
   the server's current documentation.
2. For a local `stdio` server, run the command manually with a test credential
   and confirm it starts without writing non-protocol output to stdout.
3. For a remote server, confirm the URL is reachable and whether it expects
   static headers or OAuth.
4. Use `POST /api/v1/mcp-servers/:server_id/health-check` and inspect the
   server logs.

Community MCP packages run as subprocesses with access to the credentials you
give them. Prefer a verified catalog preset or official vendor server when
available.

## Planning does not use the LLM

That can be expected. Subgrid has a fast path for a single, confident,
read-only match whose required inputs can be extracted from the request. The
LLM is used for ambiguous requests and multi-step plans. If the request needs
LLM fallback, configure an API key through the environment or the instance
LLM-settings endpoint.
