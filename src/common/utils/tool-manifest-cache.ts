import { connectToMcpServer } from "@/common/implementations/mcp/client";
import { McpServerType } from "@/models/mcp-server.model";
import { filterTools } from "@/common/utils/tool-policy";
import { CachedToolEntry } from "@/common/types/planning";
import { CacheEntry, ToolManifestMeta } from "@/common/types/tool-manifest";
import { inferToolCapability } from "./tool-capability";

const MANIFEST_TTL_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 1000;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

const compactProperty = (value: unknown): Record<string, any> => {
  const property = (value || {}) as Record<string, any>;

  return {
    type: property.type,
    description:
      typeof property.description === "string"
        ? property.description.slice(0, 180)
        : undefined,
    enum: Array.isArray(property.enum) ? property.enum.slice(0, 20) : undefined,
  };
};

const compactProperties = (
  properties: unknown,
): Record<string, any> | undefined => {
  if (!properties || typeof properties !== "object") return undefined;

  const compacted: Record<string, any> = {};

  for (const [name, value] of Object.entries(properties)) {
    compacted[name] = compactProperty(value);
  }

  return compacted;
};

const compactSchema = (schema: Record<string, any>): Record<string, any> => ({
  type: schema.type || "object",
  required: Array.isArray(schema.required) ? schema.required : undefined,
  properties: compactProperties(schema.properties),
});

const loadManifest = async (
  server: McpServerType,
): Promise<CachedToolEntry[]> => {
  const client = await connectToMcpServer(server);

  let tools: CachedToolEntry[] | undefined;
  let loadError: unknown;

  try {
    const { tools: listedTools } = await client.listTools();

    tools = listedTools.map((tool) => {
      const schema = compactSchema(
        (tool.inputSchema as Record<string, any>) || {
          type: "object",
          properties: {},
        },
      );

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

const buildCacheEntry = (tools: CachedToolEntry[]): CacheEntry => {
  const now = Date.now();

  return {
    tools,
    expiresAt: now + MANIFEST_TTL_MS,
    lastGoodAt: now,
    staleSince: null,
    lastError: null,
    nextAttemptAt: 0,
  };
};

const degradeCacheEntry = (previous: CacheEntry, err: unknown): CacheEntry => {
  const message = err instanceof Error ? err.message : String(err);

  return {
    ...previous,
    staleSince: previous.staleSince ?? Date.now(),
    lastError: message,
    nextAttemptAt: Date.now() + RETRY_DELAY_MS,
  };
};

const loadManifestEntry = async (server: McpServerType): Promise<CacheEntry> => {
  try {
    const tools = await loadManifest(server);
    const fresh = buildCacheEntry(tools);

    cache.set(server.id, fresh);

    return fresh;
  } catch (err) {
    const previous = cache.get(server.id);

    if (!previous) throw err;

    const degraded = degradeCacheEntry(previous, err);

    cache.set(server.id, degraded);

    return degraded;
  }
};

const refresh = async (server: McpServerType): Promise<CacheEntry> => {
  const pending = inFlight.get(server.id);

  if (pending) return pending;

  const request = loadManifestEntry(server);
  inFlight.set(server.id, request);

  let result: CacheEntry | undefined;
  let loadError: unknown;

  try {
    result = await request;
  } catch (err) {
    loadError = err;
  }

  inFlight.delete(server.id);

  if (loadError) throw loadError;

  return result!;
};

export const getCachedToolManifest = async (
  server: McpServerType,
): Promise<CachedToolEntry[]> => {
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
    return {
      stale: false,
      staleSince: null,
      lastGoodAt: null,
      lastError: null,
    };
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
