import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { Workflow, WorkflowType } from '@/models/workflow.model';

@injectable()
export class WorkflowsRepository extends BaseRepository<WorkflowType, Workflow> {
	constructor() {
		super(Workflow);
	}
}
