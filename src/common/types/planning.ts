import { McpServerType } from "@/models/mcp-server.model";
import { RequestEntities } from "@/common/types/entities";

export interface LlmToolSpec {
  name: string;
  description: string;
  schema: Record<string, any>;
}

export interface LlmToolCall {
  name: string;
  args: Record<string, any>;
}

export interface LlmPlanResult {
  toolCalls: LlmToolCall[];
  text: string;
}

export interface ToolEntry {
  server: McpServerType;
  toolName: string;
  description: string;
  schema: Record<string, any>;
  capability: ToolCapability;
}

export interface ToolCapability {
  resource: string;
  operation: string;
  target: string | null;
  readOnly: boolean;
  requiredInputs: string[];
}

export interface CachedToolEntry {
  serverId: string;
  serverName: string;
  toolName: string;
  description: string;
  schema: Record<string, any>;
  capability: ToolCapability;
}

export type ProjectCapability = ToolCapability & {
  id: string;
  serverId: string;
  serverName: string;
  provider: string | null;
  toolName: string;
  description: string;
};

export type ProjectCapabilitySnapshot = {
  projectId: string;
  version: string;
  generatedAt: string;
  capabilities: ProjectCapability[];
};

export type LookupTool = {
  entry: {
    server: { id: string; name: string };
    toolName: string;
    schema?: any;
    capability?: ToolCapability;
  };
};

export type LookupStep = {
  server_id: string;
  server_name: string;
  tool_name: string;
  input: Record<string, any>;
  capability: ToolCapability;
  intent: string | null;
};

export type RequestedCapability = {
  resource: string;
  operation: string;
  target: string | null;
  entities: RequestEntities;
};

export type DiscoveredTool = {
  callName: string;
  entry: ToolEntry;
  spec: LlmToolSpec;
  score: number;
};

export type ExecCatalogTool = {
  name: string;
  description: string;
  schema: Record<string, any>;
};

export type ExecWrappedProvider = {
  wrapperToolName: string;
  tools: ExecCatalogTool[];
  buildCallArguments: (
    toolName: string,
    input: Record<string, any>,
  ) => Record<string, any>;
};
