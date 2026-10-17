import { ModelObject } from 'objection';

import BaseModel from './base.model';

export class PasskeyChallenge extends BaseModel {
	static tableName = 'passkey_challenges';

	challenge!: string;
	type!: 'registration' | 'approval';
	action!: string | null;
	expires_at!: string;
}

export type PasskeyChallengeType = ModelObject<PasskeyChallenge>;
