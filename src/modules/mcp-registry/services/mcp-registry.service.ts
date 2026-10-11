import { injectable } from "tsyringe";
import dayjs from "dayjs";

import { McpServersRepository, ProjectsRepository } from "@/repositories";
import {
  BadRequestError,
  NotFoundError,
} from "@/common/utils/errors/app.error";
import { McpServerType } from "@/models/mcp-server.model";
import { RegisterServerDto, UpdateServerDto } from "../dto/validation.dto";
import { connectToMcpServer } from "@/common/implementations/mcp/client";
import { DATETIME_FORMATS } from "@/common/enums/generic";
import { encryptJson } from "@/common/utils/encrypt-decrypt";
import { PasskeyService } from "@/modules/security/services/passkey.service";

const SECRET_APPROVAL_ACTION = "store_server_secrets";

const redact = (server: Partial<McpServerType>) => {
  const { secrets_cipher, secrets_nonce, secrets_tag, ...rest } = server;

  return { ...rest, has_secrets: Boolean(secrets_cipher) };
};

@injectable()
export class McpRegistryService {
  constructor(
    private readonly mcpServersRepository: McpServersRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly passkeyService: PasskeyService,
  ) {}

  private async guardSecretWrite(
    hasSecrets: boolean,
    approvalToken: string | undefined,
  ) {
    if (!hasSecrets) return;

    // @Oluwatunmise-olat todo
    if (!(await this.passkeyService.hasCredentials())) return;

    this.passkeyService.verifyApprovalToken(
      approvalToken,
      SECRET_APPROVAL_ACTION,
    );
  }

  public async register(payload: RegisterServerDto) {
    const project = await this.projectsRepository.getById(payload.project_id);

    if (!project) throw new NotFoundError("Project not found");

    const existing = await this.mcpServersRepository.getBySlug(payload.slug);

    if (existing)
      throw new BadRequestError(
        `A server with slug "${payload.slug}" is already registered`,
      );

    const hasSecrets = Boolean(payload.env || payload.headers);

    await this.guardSecretWrite(hasSecrets, payload.approval_token);

    const encrypted = hasSecrets
      ? encryptJson({
          env: payload.env || null,
          headers: payload.headers || null,
        })
      : null;

    const server: Partial<McpServerType> = {
      project_id: payload.project_id,
      name: payload.name,
      slug: payload.slug,
      category: payload.category,
      provider: payload.provider || null,
      transport: payload.transport,
      command: payload.command || null,
      args: payload.args || null,
      url: payload.url || null,
      secrets_cipher: encrypted?.cipher_text || null,
      secrets_nonce: encrypted?.nonce || null,
      secrets_tag: encrypted?.tag || null,
      health: "unknown",
    };

    const created = await this.mcpServersRepository.create(server);

    return {
      status: true,
      message: "MCP server registered",
      data: { server: redact(created as Partial<McpServerType>) },
    };
  }

  public async list(projectId?: string) {
    const servers = await this.mcpServersRepository.findMany(
      projectId ? ({ project_id: projectId } as Partial<McpServerType>) : {},
    );

    return {
      status: true,
      message: "Servers retrieved",
      data: {
        servers: servers.map((server) =>
          redact(server as Partial<McpServerType>),
        ),
      },
    };
  }

  public async update(id: string, payload: UpdateServerDto) {
    const existing = (await this.mcpServersRepository.getById(
      id,
    )) as unknown as McpServerType | undefined;

    if (!existing) throw new NotFoundError("Server not found");

    const update: Partial<McpServerType> = {
      name: payload.name,
      transport: payload.transport,
      command: payload.command,
      args: payload.args,
      url: payload.url,
    };

    if (payload.env || payload.headers) {
      await this.guardSecretWrite(true, payload.approval_token);

      const encrypted = encryptJson({
        env: payload.env || null,
        headers: payload.headers || null,
      });
      update.secrets_cipher = encrypted.cipher_text;
      update.secrets_nonce = encrypted.nonce;
      update.secrets_tag = encrypted.tag;
    }

    await this.mcpServersRepository.update(
      { id } as Partial<McpServerType>,
      update,
    );

    return { status: true, message: "Server updated" };
  }

  public async remove(id: string) {
    const existing = await this.mcpServersRepository.getById(id);

    if (!existing) throw new NotFoundError("Server not found");

    await this.mcpServersRepository.delete({ id } as Partial<McpServerType>);

    return { status: true, message: "Server removed" };
  }

  public async checkHealth(id: string) {
    const server = (await this.mcpServersRepository.getById(id)) as unknown as
      | McpServerType
      | undefined;

    if (!server) throw new NotFoundError("Server not found");

    const now = dayjs().format(DATETIME_FORMATS.DEFAULT);

    try {
      const client = await connectToMcpServer(server);
      await client.close();

      await this.mcpServersRepository.update(
        { id } as Partial<McpServerType>,
        {
          health: "healthy",
          last_health_check_at: now,
          last_error: null,
        } as Partial<McpServerType>,
      );

      return {
        status: true,
        message: "Server is healthy",
        data: { health: "healthy" },
      };
    } catch (err) {
      await this.mcpServersRepository.update(
        { id } as Partial<McpServerType>,
        {
          health: "unreachable",
          last_health_check_at: now,
          last_error: (err as Error).message,
        } as Partial<McpServerType>,
      );

      return {
        status: true,
        message: "Server is unreachable",
        data: { health: "unreachable", error: (err as Error).message },
      };
    }
  }
}
