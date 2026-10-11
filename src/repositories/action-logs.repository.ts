import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { ActionLog, ActionLogType } from '@/models/action-log.model';

@injectable()
export class ActionLogsRepository extends BaseRepository<ActionLogType, ActionLog> {
	constructor() {
		super(ActionLog);
	}
}
