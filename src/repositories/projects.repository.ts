import { injectable } from 'tsyringe';

import BaseRepository from './base.repository';
import { Project, ProjectType } from '@/models/project.model';

@injectable()
export class ProjectsRepository extends BaseRepository<ProjectType, Project> {
	constructor() {
		super(Project);
	}

	public async getBySlug(slug: string) {
		return await this.model.query().where({ slug }).whereNull('deleted_at').first();
	}

	public async getBySlugIncludingDeleted(slug: string) {
		return await this.model.query().where({ slug }).first();
	}
}
