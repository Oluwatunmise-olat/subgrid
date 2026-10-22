# Contributing

Issues and pull requests are welcome. For anything beyond a small typo or
obvious fix, open an issue first so the scope can be agreed before code is
written.

## Before you start

Read the document that matches the change:

- [`docs/concepts.md`](docs/concepts.md) explains integrations, bridge presets,
  planning, workflows, and the security model.
- [`docs/examples.md`](docs/examples.md) shows the shape of catalog
  contributions.
- [`docs/api.md`](docs/api.md) lists the main API routes.
- [`docs/troubleshooting.md`](docs/troubleshooting.md) covers common local
  setup problems.

Keep pull requests focused. A catalog entry, a documentation fix, and an
unrelated refactor should be separate changes.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/modules/` | Feature modules, controllers, routes, and services |
| `src/common/` | Shared utilities, middleware, constants, types, and MCP implementations |
| `src/repositories/` | Database access |
| `src/models/` | Objection models and persisted types |
| `migrations/` | Database schema changes |
| `docs/` | Architecture, examples, API, and troubleshooting documentation |

## Local development

```bash
docker compose up -d postgres adminer
cp .env.example .env
# Set ENCRYPTION_KEY and APPROVAL_SECRET in .env using separate values from:
# openssl rand -hex 32
bun install
bun run migrate
bun run dev
```

The API runs at `http://localhost:8081`. Adminer is available at
`http://localhost:8083`. See the main [README](README.md) for Docker image and
frontend-development instructions.

## Checks before opening a PR

Run the checks that apply to your change:

```bash
bunx tsc --noEmit -p .
git diff --check
```

If you change a catalog integration or preset, verify its package name,
authentication fields, endpoints, and tool list against the vendor's current
documentation. Do not commit credentials or real API responses.

If you change workflows, planning, authentication, credential handling, or
MCP process execution, include a focused test or a reproducible verification
step in the PR description.

## Contribution guidelines

- Preserve the existing TypeScript and module structure.
- Validate input at the route boundary and keep errors actionable.
- Keep secrets encrypted and out of logs, fixtures, and documentation.
- Keep write and destructive actions behind the approval model.
- Prefer a catalog entry over a bridge when a vendor already provides a real
  MCP server.
- Update the relevant documentation when behavior or setup changes.
