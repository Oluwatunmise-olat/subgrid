import { McpServerType } from "@/models/mcp-server.model";
import { CachedToolEntry } from "@/common/types/planning";
import { EXEC_WRAPPED_PROVIDERS } from "@/common/constants/exec-tool-catalog";
import { inferToolCapability } from "./tool-capability";

export const expandExecWrappedTools = (
  server: McpServerType,
  tools: CachedToolEntry[],
): CachedToolEntry[] => {
  const config = getProviderConfigFor(server);

  const isExecWrapped =
    config &&
    tools.length === 1 &&
    tools[0].toolName === config.wrapperToolName;

  if (!isExecWrapped) return tools;

  return config.tools.map((tool) => ({
    serverId: server.id,
    serverName: server.name,
    toolName: tool.name,
    description: tool.description,
    schema: tool.schema,
    capability: inferToolCapability(
      server,
      tool.name,
      tool.description,
      tool.schema,
    ),
  }));
};

export const isExecWrappedTool = (
  server: McpServerType,
  toolName: string,
): boolean => {
  const config = getProviderConfigFor(server);

  if (!config) return false;

  return config.tools.find((tool) => tool.name === toolName) !== undefined;
};

export const buildExecToolCall = (
  server: McpServerType,
  toolName: string,
  input: Record<string, any>,
) => {
  const config = getProviderConfigFor(server);

  return {
    name: config!.wrapperToolName,
    arguments: config!.buildCallArguments(toolName, input),
  };
};

const getProviderConfigFor = (server: McpServerType) =>
  server.provider ? EXEC_WRAPPED_PROVIDERS[server.provider] : null;
