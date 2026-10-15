import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { McpServer, McpServerType } from '@/models/mcp-server.model';

@injectable()
export class McpServersRepository extends BaseRepository<McpServerType, McpServer> {
	constructor() {
		super(McpServer);
	}

	public async getBySlug(slug: string) {
		return await this.model.query().where({ slug }).whereNull('deleted_at').first();
	}

	public async getBySlugIncludingDeleted(slug: string) {
		return await this.model.query().where({ slug }).first();
	}
}
