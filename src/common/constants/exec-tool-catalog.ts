import { ExecWrappedProvider } from "@/common/types/planning";

export const EXEC_WRAPPED_PROVIDERS: Record<string, ExecWrappedProvider> = {
  posthog: {
    wrapperToolName: "exec",
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
                'The HogQL SELECT query to run. Nearly everything lives in the "events" table, one row per event - there is no separate "pageviews" or "users" table. A page view is a row where event = \'$pageview\'; the URL is properties.$current_url. A person is distinct_id (or person_id); count(distinct person_id) for unique users. Example: "SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 10". Example: "SELECT properties.$current_url AS page, count() AS pageviews, count(distinct person_id) AS unique_users FROM events WHERE event = \'$pageview\' AND timestamp > now() - INTERVAL 1 YEAR GROUP BY page ORDER BY pageviews DESC".',
            },
          },
        },
      },
    ],
  },
};
