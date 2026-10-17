import { connectToMcpServer } from "@/common/implementations/mcp/client";
import { McpServerType } from "@/models/mcp-server.model";
import { filterTools } from "@/common/utils/tool-policy";
import { CachedToolEntry } from "@/common/types/planning";
import { inferToolCapability } from "./tool-capability";

const MANIFEST_TTL_MS =
  process.env.TOOL_MANIFEST_TTL_MS !== undefined
    ? Number(process.env.TOOL_MANIFEST_TTL_MS)
    : 5 * 60 * 1000;

const RETRY_BASE_MS = 30 * 1000;
const RETRY_MAX_MS = 10 * 60 * 1000;

const retryDelay = (failures: number) =>
  Math.min(RETRY_BASE_MS * 2 ** Math.max(0, failures - 1), RETRY_MAX_MS);

type CacheEntry = {
  tools: CachedToolEntry[];
  expiresAt: number;
  lastGoodAt: number;
  staleSince: number | null;
  lastError: string | null;
  failureCount: number;
  nextAttemptAt: number;
};

export type ToolManifestMeta = {
  stale: boolean;
  staleSince: number | null;
  lastGoodAt: number | null;
  lastError: string | null;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

const compactSchema = (schema: Record<string, any>): Record<string, any> => {
  const properties = schema.properties && typeof schema.properties === "object"
    ? Object.fromEntries(Object.entries(schema.properties).map(([name, value]) => {
        const property = (value || {}) as Record<string, any>;
        return [name, {
          type: property.type,
          description: typeof property.description === "string" ? property.description.slice(0, 180) : undefined,
          enum: Array.isArray(property.enum) ? property.enum.slice(0, 20) : undefined,
        }];
      }))
    : undefined;

  return {
    type: schema.type || "object",
    required: Array.isArray(schema.required) ? schema.required : undefined,
    properties,
  };
};

const loadManifest = async (server: McpServerType): Promise<CachedToolEntry[]> => {
  const client = await connectToMcpServer(server);

  let tools: CachedToolEntry[] | undefined;
  let loadError: unknown;

  try {
    const { tools: listedTools } = await client.listTools();
    tools = listedTools.map((tool) => {
      const schema = compactSchema((tool.inputSchema as Record<string, any>) || { type: "object", properties: {} });
      const description = (tool.description || tool.name).slice(0, 240);

      return {
        serverId: server.id,
        serverName: server.name,
        toolName: tool.name,
        description,
        schema,
        capability: inferToolCapability(server, tool.name, description, schema),
      };
    });
  } catch (err) {
    loadError = err;
  }

  await client.close();

  if (loadError) throw loadError;

  return tools!;
};

const refresh = (server: McpServerType): Promise<CacheEntry> => {
  const pending = inFlight.get(server.id);
  if (pending) return pending;

  const request = loadManifest(server)
    .then((tools): CacheEntry => {
      const now = Date.now();
      const fresh: CacheEntry = {
        tools,
        expiresAt: now + MANIFEST_TTL_MS,
        lastGoodAt: now,
        staleSince: null,
        lastError: null,
        failureCount: 0,
        nextAttemptAt: 0,
      };
      cache.set(server.id, fresh);
      return fresh;
    })
    .catch((err): CacheEntry => {
      const previous = cache.get(server.id);
      const message = err instanceof Error ? err.message : String(err);

      if (!previous) throw err;

      const failureCount = previous.failureCount + 1;
      const degraded: CacheEntry = {
        ...previous,
        staleSince: previous.staleSince ?? Date.now(),
        lastError: message,
        failureCount,
        nextAttemptAt: Date.now() + retryDelay(failureCount),
      };
      cache.set(server.id, degraded);
      return degraded;
    })
    .finally(() => inFlight.delete(server.id));

  inFlight.set(server.id, request);
  return request;
};

export const getCachedToolManifest = async (server: McpServerType): Promise<CachedToolEntry[]> => {
  const entry = cache.get(server.id);
  const now = Date.now();

  if (entry && (entry.expiresAt > now || entry.nextAttemptAt > now)) {
    return filterTools(entry.tools, server.tool_filter);
  }

  const settled = await refresh(server);
  return filterTools(settled.tools, server.tool_filter);
};

export const getToolManifestMeta = (serverId: string): ToolManifestMeta => {
  const entry = cache.get(serverId);

  if (!entry) {
    return { stale: false, staleSince: null, lastGoodAt: null, lastError: null };
  }

  return {
    stale: entry.staleSince !== null,
    staleSince: entry.staleSince,
    lastGoodAt: entry.lastGoodAt,
    lastError: entry.lastError,
  };
};

export const invalidateToolManifest = (serverId: string) => {
  cache.delete(serverId);
};
