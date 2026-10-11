import { ModelObject } from 'objection';

import BaseModel from './base.model';

export class Project extends BaseModel {
	static tableName = 'projects';

	name: string;
	slug: string;
}

export type ProjectType = ModelObject<Project>;
