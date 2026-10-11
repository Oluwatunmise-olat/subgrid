import { ModelObject } from 'objection';

import BaseModel from './base.model';

export type McpTransport = 'stdio' | 'sse' | 'http';
export type McpHealth = 'unknown' | 'healthy' | 'unreachable';
export type ResourceCategory = 'storage' | 'paas' | 'dns' | 'email' | 'database' | 'other';

export class McpServer extends BaseModel {
	static tableName = 'mcp_servers';

	name: string;
	slug: string;
	project_id: string | null;
	category: ResourceCategory;
	provider: string | null;
	transport: McpTransport;
	command: string | null;
	args: string[] | null;
	url: string | null;
	secrets_cipher: string | null;
	secrets_nonce: string | null;
	secrets_tag: string | null;
	health: McpHealth;
	last_health_check_at: string | null;
	last_error: string | null;

	static get jsonAttributes() {
		return ['args'];
	}
}

export type McpServerType = ModelObject<McpServer>;

export type McpServerSecrets = {
	env: Record<string, string> | null;
	headers: Record<string, string> | null;
};
