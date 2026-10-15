import { ModelObject } from 'objection';

import BaseModel from './base.model';

export class OAuthConnection extends BaseModel {
	static tableName = 'oauth_connections';

	mcp_server_id!: string;
	issuer!: string | null;
	discovery_state!: Record<string, any> | null;
	client_info_cipher!: string | null;
	client_info_nonce!: string | null;
	client_info_tag!: string | null;
	tokens_cipher!: string | null;
	tokens_nonce!: string | null;
	tokens_tag!: string | null;
	token_expires_at!: string | null;
	code_verifier!: string | null;
	oauth_state!: string | null;

	static get jsonAttributes() {
		return ['discovery_state'];
	}
}

export type OAuthConnectionType = ModelObject<OAuthConnection>;
