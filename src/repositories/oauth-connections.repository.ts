import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { OAuthConnection, OAuthConnectionType } from '@/models/oauth-connection.model';

@injectable()
export class OAuthConnectionsRepository extends BaseRepository<OAuthConnectionType, OAuthConnection> {
	constructor() {
		super(OAuthConnection);
	}

	public async getByServerId(mcpServerId: string) {
		return await this.model.query().where({ mcp_server_id: mcpServerId }).whereNull('deleted_at').first();
	}

	public async getOrCreateForServer(mcpServerId: string) {
		const existing = await this.getByServerId(mcpServerId);
		if (existing) return existing;

		return await this.create({ mcp_server_id: mcpServerId });
	}
}
