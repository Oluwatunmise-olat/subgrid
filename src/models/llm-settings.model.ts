import { ModelObject } from 'objection';

import BaseModel from './base.model';

export class LlmSettings extends BaseModel {
	static tableName = 'llm_settings';

	provider!: 'openai' | 'openrouter';
	secrets_cipher!: string;
	secrets_nonce!: string;
	secrets_tag!: string;
}

export type LlmSettingsType = ModelObject<LlmSettings>;
