import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { WebauthnCredential, WebauthnCredentialType } from '@/models/webauthn-credential.model';

@injectable()
export class WebauthnCredentialsRepository extends BaseRepository<WebauthnCredentialType, WebauthnCredential> {
	constructor() {
		super(WebauthnCredential);
	}

	public async getByCredentialId(credentialId: string) {
		return await this.model.query().where({ credential_id: credentialId }).whereNull('deleted_at').first();
	}
}
