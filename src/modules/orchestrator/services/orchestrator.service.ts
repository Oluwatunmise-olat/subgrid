import { injectable } from "tsyringe";

import { McpServersRepository, ActionLogsRepository } from "@/repositories";
import {
  NotFoundError,
  BadRequestError,
} from "@/common/utils/errors/app.error";
import { connectToMcpServer } from "@/common/implementations/mcp/client";
import { ActionLogType } from "@/models/action-log.model";
import { McpServerType } from "@/models/mcp-server.model";
import { CallToolDto } from "../dto/validation.dto";
import { normalizeMcpResult } from "@/common/utils/mcp-result";
import {
  getCachedToolManifest,
  getToolManifestMeta,
} from "@/common/utils/tool-manifest-cache";
import {
  isToolAllowed,
  resolveRequiresApproval,
} from "@/common/utils/tool-policy";
import { CatalogService } from "@/modules/catalog/services/catalog.service";
import { looksLikeError } from "@/common/utils/result-normalizer";
import { buildExecToolCall, isExecWrappedTool } from "@/common/utils/tool-exec-bridge";

@injectable()
export class OrchestratorService {
  private readonly MCP_TOOL_TIMEOUT_MS = 30_000;

  constructor(
    private readonly mcpServersRepository: McpServersRepository,
    private readonly actionLogsRepository: ActionLogsRepository,
    private readonly catalogService: CatalogService,
  ) {}

  public async listTools(serverId: string) {
    const server = (await this.mcpServersRepository.getById(serverId)) as any;

    if (!server) throw new NotFoundError("Server not found");

    const tools = await getCachedToolManifest(server);

    const meta = getToolManifestMeta(server.id);

    return {
      status: true,
      message: "Tools retrieved",
      data: {
        tools: tools.map((tool) => ({
          name: tool.toolName,
          description: tool.description,
          inputSchema: tool.schema,
        })),
        stale: meta.stale,
        stale_since: meta.staleSince,
        last_error: meta.lastError,
        tool_filter: server.tool_filter ?? null,
        approval_policy: server.approval_policy ?? "prompt",
        approved_tools: server.approved_tools ?? [],
      },
    };
  }

  public async callTool(serverId: string, payload: CallToolDto) {
    const server = (await this.mcpServersRepository.getById(serverId)) as any;

    if (!server) throw new NotFoundError("Server not found");

    const outcome = await this.executeToolCall(
      server,
      payload.tool_name,
      payload.input,
      Boolean(payload.approved),
    );

    if (outcome.kind === "approval_required") {
      return {
        status: true,
        message:
          "This action is destructive and requires explicit approval before it runs",
        data: { requires_approval: true, action_log: outcome.action_log },
      };
    }

    return {
      status: true,
      message: "Tool call executed",
      data: { result: outcome.result, action_log: outcome.action_log },
    };
  }

  public async executeToolCall(
    server: McpServerType,
    toolName: string,
    input: Record<string, any>,
    approved: boolean,
  ): Promise<
    | { kind: "approval_required"; action_log: ActionLogType }
    | { kind: "executed"; result: unknown; action_log: ActionLogType }
  > {
    if (!isToolAllowed(toolName, server.tool_filter)) {
      throw new BadRequestError(
        `"${toolName}" is not enabled on "${server.name}". Adjust this component's tool access to allow it.`,
      );
    }

    const requiresApproval = resolveRequiresApproval(
      server,
      toolName,
      this.catalogService.verbRequiresApproval(server.catalog_id, toolName),
    );

    if (requiresApproval && !approved) {
      const pendingLog = await this.actionLogsRepository.create({
        mcp_server_id: server.id,
        project_id: server.project_id,
        tool_name: toolName,
        input,
        output: null,
        status: "pending_approval",
        requires_approval: true,
        error: null,
      });

      return {
        kind: "approval_required",
        action_log: pendingLog as ActionLogType,
      };
    }

    const client = await connectToMcpServer(server);

    let outcome: {
      kind: "executed";
      result: unknown;
      action_log: ActionLogType;
    };

    let failure: BadRequestError | null = null;

    const call = isExecWrappedTool(server, toolName)
      ? buildExecToolCall(server, toolName, input)
      : { name: toolName, arguments: input };

    try {
      const result = await client.callTool(call, undefined, {
        timeout: this.MCP_TOOL_TIMEOUT_MS,
      });

      const raw = this.resultText(result);

      const reportedError =
        (result as { isError?: boolean })?.isError === true ||
        looksLikeError(raw);

      const log = await this.actionLogsRepository.create({
        mcp_server_id: server.id,
        project_id: server.project_id,
        tool_name: toolName,
        input,
        output: result as Record<string, any>,
        status: reportedError ? "failed" : "succeeded",
        requires_approval: requiresApproval,
        error: reportedError ? raw.slice(0, 500) : null,
      });

      outcome = {
        kind: "executed",
        result: normalizeMcpResult(result),
        action_log: log as ActionLogType,
      };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);

      const errorMessage = `Tool call failed: ${rawMessage}`;

      const log = await this.actionLogsRepository.create({
        mcp_server_id: server.id,
        project_id: server.project_id,
        tool_name: toolName,
        input,
        output: null,
        status: "failed",
        requires_approval: requiresApproval,
        error: errorMessage,
      });

      failure = new BadRequestError(errorMessage, {
        action_log: log,
      });
    }

    await client.close();

    if (failure) throw failure;

    return outcome!;
  }

  public async history(serverId?: string, projectId?: string) {
    if (!serverId && !projectId) {
      return {
        status: true,
        message: "Action log retrieved (no scope given)",
        data: { logs: [] },
      };
    }

    const filter: Partial<ActionLogType> = {};

    if (serverId) filter.mcp_server_id = serverId;

    if (projectId) filter.project_id = projectId;

    const logs = await this.actionLogsRepository.findMany(filter);

    return { status: true, message: "Action log retrieved", data: { logs } };
  }

  private resultText(result: unknown): string {
    const content = (result as { content?: unknown })?.content;

    if (!Array.isArray(content)) {
      return typeof result === "string" ? result : JSON.stringify(result ?? "");
    }

    const parts = content as { text?: unknown }[];

    return parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }
}
