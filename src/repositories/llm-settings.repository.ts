import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { LlmSettings, LlmSettingsType } from '@/models/llm-settings.model';

@injectable()
export class LlmSettingsRepository extends BaseRepository<LlmSettingsType, LlmSettings> {
	constructor() {
		super(LlmSettings);
	}

	public async getCurrent() {
		return await this.model.query().whereNull('deleted_at').orderBy('created_at', 'desc').first();
	}
}
