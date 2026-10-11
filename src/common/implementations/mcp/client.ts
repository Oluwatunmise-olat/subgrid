import { container } from 'tsyringe';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { McpConnectionError } from '@/common/utils/errors/app.error';
import { McpServerSecrets, McpServerType } from '@/models/mcp-server.model';
import { decryptJson } from '@/common/utils/encrypt-decrypt';
import { OAuthConnectionsRepository } from '@/repositories';
import { SubgridOAuthProvider } from './oauth-provider';

const getSecrets = (server: McpServerType): McpServerSecrets => {
	if (!server.secrets_cipher || !server.secrets_nonce || !server.secrets_tag) {
		return { env: null, headers: null };
	}

	return decryptJson<McpServerSecrets>({
		cipher_text: server.secrets_cipher,
		nonce: server.secrets_nonce,
		tag: server.secrets_tag,
	});
};

export const connectToMcpServer = async (server: McpServerType): Promise<Client> => {
	const client = new Client({ name: 'subgrid', version: '1.0.0' });
	const secrets = getSecrets(server);

	try {
		if (server.transport === 'stdio') {
			if (!server.command) throw new McpConnectionError(`"${server.name}" has no command configured for stdio transport`);

			const transport = new StdioClientTransport({
				command: server.command,
				args: server.args || [],
				env: { ...(process.env as Record<string, string>), ...(secrets.env || {}) },
			});

			await client.connect(transport);

			return client;
		}

		if (server.transport === 'sse' || server.transport === 'http') {
			if (!server.url) throw new McpConnectionError(`"${server.name}" has no url configured for ${server.transport} transport`);

			const oauthConnectionsRepository = container.resolve(OAuthConnectionsRepository);
			const oauthRow = await oauthConnectionsRepository.getByServerId(server.id);
			const hasOAuth = Boolean(oauthRow?.tokens_cipher);

			const authProvider = hasOAuth ? new SubgridOAuthProvider(server.id, oauthConnectionsRepository) : undefined;

			// Static API-token header auth and OAuth are mutually exclusive per server - whichever
			// was actually configured (see mcp-registry.service / oauth.service) wins.
			const TransportClass = server.transport === 'http' ? StreamableHTTPClientTransport : SSEClientTransport;

			const transport = new TransportClass(new URL(server.url), {
				...(authProvider ? { authProvider } : { requestInit: { headers: secrets.headers || {} } }),
			});

			await client.connect(transport);

			return client;
		}

		throw new McpConnectionError(`Unsupported transport "${server.transport}"`);
	} catch (err) {
		if (err instanceof McpConnectionError) throw err;

		throw new McpConnectionError(`Failed to connect to "${server.name}": ${(err as Error).message}`);
	}
};
