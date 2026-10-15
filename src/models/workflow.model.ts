import { ModelObject } from 'objection';

import BaseModel from './base.model';
import type {
	WorkflowExecutionMode,
	WorkflowMode,
	WorkflowStatus,
} from './types';

export class Workflow extends BaseModel {
	static tableName = 'workflows';

	project_id!: string;
	request!: string;
	mode!: WorkflowMode;
	execution_mode!: WorkflowExecutionMode;
	status!: WorkflowStatus;
	note!: string | null;
	version!: number;
	suggestions!: Record<string, any>[] | null;

	static get jsonAttributes() {
		return ['suggestions'];
	}
}

export type WorkflowType = ModelObject<Workflow>;
