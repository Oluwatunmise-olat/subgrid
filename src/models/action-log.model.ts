import { ModelObject } from 'objection';

import BaseModel from './base.model';
import type { ActionLogStatus } from './types';

export class ActionLog extends BaseModel {
	static tableName = 'action_logs';

	static get jsonAttributes() {
		return ['input', 'output'];
	}

	mcp_server_id!: string;
	project_id!: string | null;
	tool_name!: string;
	input!: Record<string, any>;
	output!: Record<string, any> | null;
	status!: ActionLogStatus;
	requires_approval!: boolean;
	error!: string | null;
}

export type ActionLogType = ModelObject<ActionLog>;
