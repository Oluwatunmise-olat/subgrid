import { injectable } from "tsyringe";

import { McpServersRepository } from "@/repositories";
import { McpServerType } from "@/models/mcp-server.model";
import { NotFoundError } from "@/common/utils/errors/app.error";
import {
  getCachedToolManifest,
  invalidateToolManifest,
} from "./tool-manifest-cache";
import { ProjectCapabilitySnapshot } from "../types/planning.types";

@injectable()
export class CapabilityRegistryService {
  constructor(private readonly mcpServersRepository: McpServersRepository) {}

  private async loadServers(projectId: string) {
    const servers = (await this.mcpServersRepository.findMany({
      project_id: projectId,
    } as Partial<McpServerType>)) as unknown as McpServerType[];

    if (!servers) throw new NotFoundError("Project not found");

    return servers;
  }

  public async getSnapshot(
    projectId: string,
  ): Promise<ProjectCapabilitySnapshot> {
    const servers = await this.loadServers(projectId);

    const perServer = await Promise.all(
      servers.map(async (server) => {
        try {
          const tools = await getCachedToolManifest(server);
          return tools.map((tool) => ({
            id: `${server.id}:${tool.toolName}`,
            serverId: server.id,
            serverName: server.name,
            provider: server.provider,
            toolName: tool.toolName,
            description: tool.description,
            ...tool.capability,
          }));
        } catch {
          return [];
        }
      }),
    );

    const version = servers
      .map((server) => `${server.id}:${server.updated_at}`)
      .sort()
      .join("|");

    return {
      projectId,
      version,
      generatedAt: new Date().toISOString(),
      capabilities: perServer.flat(),
    };
  }

  public async refresh(projectId: string): Promise<ProjectCapabilitySnapshot> {
    const servers = await this.loadServers(projectId);
    servers.forEach((server) => invalidateToolManifest(server.id));
    return this.getSnapshot(projectId);
  }
}
