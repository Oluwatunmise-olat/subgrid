import { ModelObject } from 'objection';

import BaseModel from './base.model';

export class Project extends BaseModel {
	static tableName = 'projects';

	name!: string;
	slug!: string;
	description!: string | null;
	dismissed_suggestions!: string[] | null;

	static get jsonAttributes() {
		return ['dismissed_suggestions'];
	}
}

export type ProjectType = ModelObject<Project>;
