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

// @Oluwatunmise-olat cleanup later
const DESTRUCTIVE_KEYWORDS = [
  "delete",
  "remove",
  "drop",
  "destroy",
  "revoke",
  "purge",
];

const isDestructive = (toolName: string) =>
  DESTRUCTIVE_KEYWORDS.some((keyword) =>
    toolName.toLowerCase().includes(keyword),
  );

@injectable()
export class OrchestratorService {
  constructor(
    private readonly mcpServersRepository: McpServersRepository,
    private readonly actionLogsRepository: ActionLogsRepository,
  ) {}

  public async listTools(serverId: string) {
    const server = (await this.mcpServersRepository.getById(
      serverId,
    )) as unknown as McpServerType | undefined;

    if (!server) throw new NotFoundError("Server not found");

    const client = await connectToMcpServer(server);

    try {
      const { tools } = await client.listTools();

      return { status: true, message: "Tools retrieved", data: { tools } };
    } finally {
      await client.close();
    }
  }

  public async callTool(serverId: string, payload: CallToolDto) {
    const server = (await this.mcpServersRepository.getById(
      serverId,
    )) as unknown as McpServerType | undefined;

    if (!server) throw new NotFoundError("Server not found");

    const requiresApproval = isDestructive(payload.tool_name);

    if (requiresApproval && !payload.approved) {
      const pendingLog = await this.actionLogsRepository.create({
        mcp_server_id: server.id,
        tool_name: payload.tool_name,
        input: payload.input,
        output: null,
        status: "pending_approval",
        requires_approval: true,
        error: null,
      });

      return {
        status: true,
        message:
          "This action is destructive and requires explicit approval before it runs",
        data: { requires_approval: true, action_log: pendingLog },
      };
    }

    const client = await connectToMcpServer(server);

    try {
      const result = await client.callTool({
        name: payload.tool_name,
        arguments: payload.input,
      });

      const log = await this.actionLogsRepository.create({
        mcp_server_id: server.id,
        tool_name: payload.tool_name,
        input: payload.input,
        output: result as Record<string, any>,
        status: "succeeded",
        requires_approval: requiresApproval,
        error: null,
      } as Partial<ActionLogType>);

      return {
        status: true,
        message: "Tool call executed",
        data: { result, action_log: log },
      };
    } catch (err) {
      const log = await this.actionLogsRepository.create({
        mcp_server_id: server.id,
        tool_name: payload.tool_name,
        input: payload.input,
        output: null,
        status: "failed",
        requires_approval: requiresApproval,
        error: (err as Error).message,
      } as Partial<ActionLogType>);

      throw new BadRequestError(`Tool call failed: ${(err as Error).message}`, {
        action_log: log,
      });
    } finally {
      await client.close();
    }
  }

  public async history(serverId?: string) {
    const logs = await this.actionLogsRepository.findMany(
      serverId ? ({ mcp_server_id: serverId } as Partial<ActionLogType>) : {},
    );

    return { status: true, message: "Action log retrieved", data: { logs } };
  }
}
