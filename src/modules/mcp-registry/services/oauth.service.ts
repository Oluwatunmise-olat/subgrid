import { injectable } from 'tsyringe';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

import { McpServersRepository, OAuthConnectionsRepository } from '@/repositories';
import { BadRequestError, McpConnectionError, NotFoundError } from '@/common/utils/errors/app.error';
import { McpServerType } from '@/models/mcp-server.model';
import { SubgridOAuthProvider } from '@/common/implementations/mcp/oauth-provider';

@injectable()
export class McpOAuthService {
	constructor(
		private readonly mcpServersRepository: McpServersRepository,
		private readonly oauthConnectionsRepository: OAuthConnectionsRepository,
	) {}

	public async initiate(serverId: string) {
		const server = await this.getServerOrThrow(serverId);
		const provider = new SubgridOAuthProvider(serverId, this.oauthConnectionsRepository);

		const result = await auth(provider, { serverUrl: server.url! });

		if (result === 'AUTHORIZED') {
			return { status: true, message: 'Already connected', data: { already_connected: true } };
		}

		if (!provider.capturedAuthorizeUrl) {
			throw new McpConnectionError('Could not start the OAuth flow for this server');
		}

		return { status: true, message: 'Authorization URL generated', data: { authorize_url: provider.capturedAuthorizeUrl } };
	}

	public async handleCallback(serverId: string, code: string, state: string) {
		const server = await this.getServerOrThrow(serverId);
		const provider = new SubgridOAuthProvider(serverId, this.oauthConnectionsRepository);

		const storedState = await provider.getStoredState();

		if (!storedState || storedState !== state) {
			throw new BadRequestError('OAuth state mismatch - start the connection again');
		}

		try {
			const result = await auth(provider, { serverUrl: server.url!, authorizationCode: code });

			if (result !== 'AUTHORIZED') {
				throw new McpConnectionError('OAuth authorization did not complete');
			}
		} finally {
			await provider.clearTransientState();
		}
	}

	public async status(serverId: string) {
		await this.getServerOrThrow(serverId);
		const row = await this.oauthConnectionsRepository.getByServerId(serverId);

		return {
			status: true,
			message: 'OAuth status',
			data: {
				connected: Boolean(row?.tokens_cipher),
				expires_at: row?.token_expires_at || null,
				issuer: row?.issuer || null,
			},
		};
	}

	public async disconnect(serverId: string) {
		await this.getServerOrThrow(serverId);
		const provider = new SubgridOAuthProvider(serverId, this.oauthConnectionsRepository);
		await provider.disconnect();

		return { status: true, message: 'Disconnected' };
	}

	private async getServerOrThrow(id: string): Promise<McpServerType> {
		const server = (await this.mcpServersRepository.getById(id)) as unknown as McpServerType | undefined;

		if (!server) throw new NotFoundError('Server not found');
		if (server.transport !== 'sse' && server.transport !== 'http') {
			throw new BadRequestError('OAuth only applies to sse/http transport servers');
		}
		if (!server.url) throw new BadRequestError('Server has no url configured');

		return server;
	}
}
