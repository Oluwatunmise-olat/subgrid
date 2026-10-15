import { ModelObject } from 'objection';

import BaseModel from './base.model';
import type { WorkflowStepStatus } from './types';

export class WorkflowStep extends BaseModel {
	static tableName = 'workflow_steps';

	workflow_id!: string;
	order!: number;
	depends_on!: string[];
	server_id!: string;
	capability!: Record<string, any>;
	tool_name!: string;
	title!: string | null;
	intent!: string | null;
	input!: Record<string, any>;
	status!: WorkflowStepStatus;
	requires_approval!: boolean;
	output!: Record<string, any> | null;
	error!: string | null;
	action_log_id!: string | null;

	static get jsonAttributes() {
		return ['depends_on', 'capability', 'input', 'output'];
	}
}

export type WorkflowStepType = ModelObject<WorkflowStep>;
