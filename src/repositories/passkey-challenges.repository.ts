import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { PasskeyChallenge, PasskeyChallengeType } from '@/models/passkey-challenge.model';

@injectable()
export class PasskeyChallengesRepository extends BaseRepository<PasskeyChallengeType, PasskeyChallenge> {
	constructor() {
		super(PasskeyChallenge);
	}

	public async deleteExpired(): Promise<void> {
		await this.model.query().where('expires_at', '<', new Date().toISOString()).delete();
	}
}
