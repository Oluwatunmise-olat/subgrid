import { ModelObject } from 'objection';

import BaseModel from './base.model';

export class WebauthnCredential extends BaseModel {
	static tableName = 'webauthn_credentials';

	credential_id: string;
	public_key: string;
	counter: number;
	transports: string[] | null;
	label: string | null;
	last_used_at: string | null;

	static get jsonAttributes() {
		return ['transports'];
	}
}

export type WebauthnCredentialType = ModelObject<WebauthnCredential>;
