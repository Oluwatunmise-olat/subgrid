import { injectable } from "tsyringe";
import dayjs from "dayjs";

import { McpServersRepository, OAuthConnectionsRepository, ProjectsRepository } from "@/repositories";
import {
  BadRequestError,
  NotFoundError,
} from "@/common/utils/errors/app.error";
import { McpServerType } from "@/models/mcp-server.model";
import type { McpServerSecrets } from "@/models/types";
import { RegisterServerDto, UpdateServerDto } from "../dto/validation.dto";
import { connectToMcpServer } from "@/common/implementations/mcp/client";
import { DATETIME_FORMATS } from "@/common/enums/generic";
import { decryptJson, encryptJson } from "@/common/utils/encrypt-decrypt";
import { PasskeyService } from "@/modules/security/services/passkey.service";
import { CatalogService } from "@/modules/catalog/catalog.service";

const SECRET_APPROVAL_ACTION = "store_server_secrets";

@injectable()
export class McpRegistryService {
  constructor(
    private readonly mcpServersRepository: McpServersRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly passkeyService: PasskeyService,
    private readonly catalogService: CatalogService,
    private readonly oauthConnectionsRepository: OAuthConnectionsRepository,
  ) {}

  public async register(payload: RegisterServerDto) {
    const project = await this.projectsRepository.getById(payload.project_id);

    if (!project) throw new NotFoundError("Project not found");

    const existing = await this.mcpServersRepository.getBySlug(payload.slug);

    if (existing)
      throw new BadRequestError(
        `A server with slug "${payload.slug}" is already registered`,
      );

    const hasSecrets = Boolean(
      payload.env ||
        payload.headers ||
        (payload.reuse_keys && Object.keys(payload.reuse_keys).length),
    );

    await this.guardSecretWrite(hasSecrets, payload.approval_token);

    const env: Record<string, string> = { ...(payload.env || {}) };
    const headers: Record<string, string> = { ...(payload.headers || {}) };

    await this.applyReusedSecrets(payload.reuse_keys, env, headers);

    const encrypted = hasSecrets
      ? encryptJson({
          env: Object.keys(env).length ? env : null,
          headers: Object.keys(headers).length ? headers : null,
        })
      : null;

    const resolved = payload.preset_id
      ? this.catalogService.resolvePreset(payload.preset_id)
      : payload.integration_id
        ? this.catalogService.resolveIntegration(payload.integration_id)
        : null;

    const clientSuppliesCommand = !resolved || Boolean(resolved.custom);

    const transport = resolved?.transport ?? payload.transport;

    if (!transport) {
      throw new BadRequestError("transport is required for a component you define yourself");
    }

    const server: Partial<McpServerType> = {
      project_id: payload.project_id,
      name: payload.name,
      slug: payload.slug,
      category: (resolved?.category as McpServerType["category"]) ?? payload.category,
      provider: resolved?.provider ?? payload.provider ?? null,
      transport,
      catalog_id: payload.preset_id ?? payload.integration_id ?? null,
      command: clientSuppliesCommand ? payload.command || null : resolved.command ?? null,
      args: clientSuppliesCommand ? payload.args || null : resolved.args ?? null,
      url: clientSuppliesCommand ? payload.url || null : resolved.url ?? null,
      secrets_cipher: encrypted?.cipher_text || null,
      secrets_nonce: encrypted?.nonce || null,
      secrets_tag: encrypted?.tag || null,
      tool_filter: payload.tool_filter ?? null,
      approval_policy: payload.approval_policy ?? "prompt",
      approved_tools: payload.approved_tools ?? null,
      health: "unknown",
    };

    const existingDeleted =
      await this.mcpServersRepository.getBySlugIncludingDeleted(payload.slug);

    if (existingDeleted && (existingDeleted as unknown as McpServerType).deleted_at) {
      await this.mcpServersRepository.update(
        {
          id: (existingDeleted as unknown as McpServerType).id,
        } as Partial<McpServerType>,
        { ...server, deleted_at: null } as Partial<McpServerType>,
      );

      const restored = await this.mcpServersRepository.getById(
        (existingDeleted as unknown as McpServerType).id,
      );

      return {
        status: true,
        message: "MCP server reconnected",
        data: { server: this.redact(restored as Partial<McpServerType>) },
      };
    }

    try {
      const created = await this.mcpServersRepository.create(server);

      return {
        status: true,
        message: "MCP server registered",
        data: { server: this.redact(created as Partial<McpServerType>) },
      };
    } catch (err) {
      if ((err as { code?: string })?.code === "23505") {
        throw new BadRequestError(
          `A server with slug "${payload.slug}" is already registered`,
        );
      }

      throw err;
    }
  }

  public async list(projectId?: string) {
    const servers = await this.mcpServersRepository.findMany(
      projectId ? ({ project_id: projectId } as Partial<McpServerType>) : {},
    );

    const signedIn = new Set<string>();
    for (const server of servers) {
      const row = await this.oauthConnectionsRepository.getByServerId(server.id);
      if (row?.tokens_cipher) signedIn.add(server.id);
    }

    return {
      status: true,
      message: "Servers retrieved",
      data: {
        servers: servers.map((server) =>
          this.redact(
            server as Partial<McpServerType>,
            signedIn.has(server.id),
          ),
        ),
      },
    };
  }

  public async update(id: string, payload: UpdateServerDto) {
    const existing = (await this.mcpServersRepository.getById(
      id,
    )) as unknown as McpServerType | undefined;

    if (!existing) throw new NotFoundError("Server not found");

    const update: Partial<McpServerType> = {};

    if (payload.name !== undefined) update.name = payload.name;

    if (!existing.catalog_id) {
      if (payload.category !== undefined) update.category = payload.category;
      if (payload.provider !== undefined) update.provider = payload.provider || null;
      if (payload.transport !== undefined) update.transport = payload.transport;
      if (payload.command !== undefined) update.command = payload.command;
      if (payload.args !== undefined) update.args = payload.args;
      if (payload.url !== undefined) update.url = payload.url;
    }
    if (payload.tool_filter !== undefined)
      update.tool_filter = payload.tool_filter ?? null;
    if (payload.approval_policy !== undefined)
      update.approval_policy = payload.approval_policy;
    if (payload.approved_tools !== undefined)
      update.approved_tools = payload.approved_tools;

    if (
      payload.env ||
      payload.headers ||
      (payload.reuse_keys && Object.keys(payload.reuse_keys).length)
    ) {
      await this.guardSecretWrite(true, payload.approval_token);

      let current: McpServerSecrets = { env: null, headers: null };
      if (
        existing.secrets_cipher &&
        existing.secrets_nonce &&
        existing.secrets_tag
      ) {
        try {
          current = decryptJson<McpServerSecrets>({
            cipher_text: existing.secrets_cipher,
            nonce: existing.secrets_nonce,
            tag: existing.secrets_tag,
          });
        } catch {}
      }

      const env: Record<string, string> = {
        ...(current.env || {}),
        ...(payload.env || {}),
      };
      const headers: Record<string, string> = {
        ...(current.headers || {}),
        ...(payload.headers || {}),
      };

      await this.applyReusedSecrets(payload.reuse_keys, env, headers);

      const encrypted = encryptJson({
        env: Object.keys(env).length ? env : null,
        headers: Object.keys(headers).length ? headers : null,
      });
      update.secrets_cipher = encrypted.cipher_text;
      update.secrets_nonce = encrypted.nonce;
      update.secrets_tag = encrypted.tag;
    }

    if (Object.keys(update).length) {
      await this.mcpServersRepository.update(
        { id } as Partial<McpServerType>,
        update,
      );
    }

    const updated = (await this.mcpServersRepository.getById(
      id,
    )) as unknown as McpServerType | undefined;

    return {
      status: true,
      message: "Server updated",
      data: { server: this.redact(updated as Partial<McpServerType>) },
    };
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

  private redact(server: Partial<McpServerType>, oauthConnected = false) {
    const { secrets_cipher, secrets_nonce, secrets_tag, ...rest } = server;

    let secret_keys: string[] = [];
    if (secrets_cipher && secrets_nonce && secrets_tag) {
      try {
        const secrets = decryptJson<McpServerSecrets>({
          cipher_text: secrets_cipher,
          nonce: secrets_nonce,
          tag: secrets_tag,
        });
        secret_keys = [
          ...Object.keys(secrets.env || {}),
          ...Object.keys(secrets.headers || {}),
        ];
      } catch {
        secret_keys = [];
      }
    }

    return { ...rest, has_secrets: Boolean(secrets_cipher), secret_keys, oauth_connected: oauthConnected };
  }

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

  private async applyReusedSecrets(
    reuseKeys: Record<string, string> | undefined,
    env: Record<string, string>,
    headers: Record<string, string>,
  ) {
    for (const [key, sourceId] of Object.entries(reuseKeys || {})) {
      if (env[key] !== undefined || headers[key] !== undefined) continue;

      const source = (await this.mcpServersRepository.getById(
        sourceId,
      )) as unknown as McpServerType | undefined;

      if (
        !source ||
        !source.secrets_cipher ||
        !source.secrets_nonce ||
        !source.secrets_tag
      )
        continue;

      try {
        const secrets = decryptJson<McpServerSecrets>({
          cipher_text: source.secrets_cipher,
          nonce: source.secrets_nonce,
          tag: source.secrets_tag,
        });

        if (secrets.env && secrets.env[key] !== undefined)
          env[key] = secrets.env[key];
        else if (secrets.headers && secrets.headers[key] !== undefined)
          headers[key] = secrets.headers[key];
      } catch {}
    }
  }
}
