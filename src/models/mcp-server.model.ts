import { ModelObject } from 'objection';

import BaseModel from './base.model';
import type {
	McpApprovalPolicy,
	McpHealth,
	McpToolFilter,
	McpTransport,
	ResourceCategory,
} from './types';

export class McpServer extends BaseModel {
	static tableName = 'mcp_servers';

	name!: string;
	slug!: string;
	project_id!: string | null;
	category!: ResourceCategory;
	provider!: string | null;
	transport!: McpTransport;
	command!: string | null;
	args!: string[] | null;
	url!: string | null;
	secrets_cipher!: string | null;
	secrets_nonce!: string | null;
	secrets_tag!: string | null;
	health!: McpHealth;
	last_health_check_at!: string | null;
	last_error!: string | null;
	tool_filter!: McpToolFilter;
	approval_policy!: McpApprovalPolicy;
	approved_tools!: string[] | null;
	catalog_id!: string | null;

	static get jsonAttributes() {
		return ['args', 'tool_filter', 'approved_tools'];
	}
}

export type McpServerType = ModelObject<McpServer>;
