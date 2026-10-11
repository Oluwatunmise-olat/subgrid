import Knex from 'knex';
import Objection from 'objection';
import { ulid } from 'ulid';

import { MODEL_TYPE_PREFIXES } from './models.enum';
import knexConfig from '../../knexfile';

Objection.Model.knex(Knex(knexConfig));

export default abstract class BaseModel extends Objection.Model {
	id!: string;

	created_at!: string;

	updated_at!: string;

	deleted_at!: string | null;

	static get idColumn() {
		return ['id'];
	}

	static makeId(): string {
		const prefix = MODEL_TYPE_PREFIXES[this.tableName];
		return prefix ? `${prefix}_${ulid()}` : ulid();
	}

	$beforeInsert(): void {
		if (!this.id) {
			this.id = (this.constructor as typeof BaseModel).makeId();
		}

		this.created_at = new Date().toISOString();
	}

	$beforeUpdate(): void {
		this.updated_at = new Date().toISOString();
	}
}
