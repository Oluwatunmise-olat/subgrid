import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { WorkflowStep, WorkflowStepType } from '@/models/workflow-step.model';

@injectable()
export class WorkflowStepsRepository extends BaseRepository<WorkflowStepType, WorkflowStep> {
	constructor() {
		super(WorkflowStep);
	}

	public async findByWorkflow(workflowId: string) {
		return await this.model.query().where({ workflow_id: workflowId }).whereNull('deleted_at').orderBy('order', 'asc');
	}
}
