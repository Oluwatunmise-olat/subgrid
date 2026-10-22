# API overview

Subgrid's API is served from the same origin as the bundled UI. During local
development, the base URL is `http://localhost:8081`.

Unless noted otherwise, routes below are under `/api/v1` and require the
passkey session cookie. The API returns JSON; request and response details are
defined by the validation schemas and controllers in `src/modules/`.

## Health and authentication

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the server is responding. |
| `GET` | `/api/v1/security/session` | Check the current session. |
| `POST` | `/api/v1/security/session/logout` | End the current session. |
| `GET` | `/api/v1/security/passkeys/exists` | Check whether the instance has a passkey. |
| `POST` | `/api/v1/security/passkeys/registration/options` | Start passkey registration. |
| `POST` | `/api/v1/security/passkeys/registration/verify` | Complete passkey registration. |
| `POST` | `/api/v1/security/passkeys/approval/options` | Start a sensitive-action approval. |
| `POST` | `/api/v1/security/passkeys/approval/verify` | Complete a sensitive-action approval. |

The first registered passkey becomes the login for the instance. Sensitive
operations such as storing credentials require a fresh approval token.

## Catalog and projects

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/catalog` | List catalog integrations, bridge presets, and categories. |
| `POST` | `/api/v1/projects` | Create a project. |
| `GET` | `/api/v1/projects` | List projects. |
| `PUT` | `/api/v1/projects/:project_id` | Update a project. |
| `DELETE` | `/api/v1/projects/:project_id` | Delete a project. |
| `POST` | `/api/v1/projects/:project_id/suggest-components` | Suggest components for a project. |

## Connected components

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/mcp-servers` | Register an MCP server or catalog component. |
| `GET` | `/api/v1/mcp-servers` | List connected components. |
| `PUT` | `/api/v1/mcp-servers/:server_id` | Update a component. |
| `DELETE` | `/api/v1/mcp-servers/:server_id` | Remove a component. |
| `POST` | `/api/v1/mcp-servers/:server_id/health-check` | Check whether a component is reachable. |
| `GET` | `/api/v1/mcp-servers/:server_id/tools` | List the tools exposed by a component. |
| `POST` | `/api/v1/mcp-servers/:server_id/tools/call` | Call one component tool directly. |
| `POST` | `/api/v1/mcp-servers/:server_id/oauth/authorize` | Start an OAuth connection. |
| `GET` | `/api/v1/mcp-servers/:server_id/oauth/callback` | Receive the OAuth provider callback. |
| `GET` | `/api/v1/mcp-servers/:server_id/oauth/status` | Check OAuth connection status. |
| `DELETE` | `/api/v1/mcp-servers/:server_id/oauth` | Disconnect OAuth. |

## Planning and workflows

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/projects/:project_id/plan` | Turn a natural-language request into a workflow plan. |
| `GET` | `/api/v1/projects/:project_id/capabilities` | List cached component capabilities for a project. |
| `POST` | `/api/v1/projects/:project_id/capabilities/refresh` | Refresh project capabilities. |
| `GET` | `/api/v1/workflows/:workflow_id` | Retrieve a workflow and its steps. |
| `PATCH` | `/api/v1/workflows/:workflow_id` | Edit an awaiting workflow. |
| `POST` | `/api/v1/workflows/:workflow_id/approve` | Approve a workflow. |
| `POST` | `/api/v1/workflows/:workflow_id/execute` | Execute an approved workflow. |
| `POST` | `/api/v1/workflows/:workflow_id/cancel` | Cancel a workflow. |
| `POST` | `/api/v1/workflows/:workflow_id/steps/:step_id/retry` | Retry a failed step. |

## LLM settings

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/llm-settings` | Check whether instance LLM settings exist. |
| `PUT` | `/api/v1/llm-settings` | Store the instance-wide LLM provider and key. |
| `DELETE` | `/api/v1/llm-settings` | Clear the stored LLM settings. |

## Useful first request

After starting the API and signing in, fetch the catalog:

```bash
curl -b cookies.txt http://localhost:8081/api/v1/catalog
```

For authenticated requests, preserve the session cookie returned by the
passkey flow. The API is not currently documented as an OpenAPI specification;
use the route validation schemas for exact request fields.
