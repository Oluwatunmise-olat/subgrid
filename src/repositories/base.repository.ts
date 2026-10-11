import dayjs from 'dayjs';
import Objection, { ColumnRef } from 'objection';

import BaseModel from '@/models/base.model';
import { DATETIME_FORMATS } from '@/common/enums/generic';

export default abstract class BaseRepository<T, M extends BaseModel> {
	protected model: Objection.ModelClass<M>;
	public tableName: string;

	constructor(model: Objection.ModelClass<M>) {
		this.model = model;
		this.tableName = model.tableName;
	}

	public async create(payload: Partial<T>, trx?: Objection.Transaction) {
		return await this.model.query(trx).insert(payload);
	}

	public async getById(id: string, trx?: Objection.Transaction) {
		return await this.model.query(trx).where({ id }).whereNull('deleted_at').first().skipUndefined();
	}

	public async findOne(query_identifier: Partial<T>, trx?: Objection.Transaction) {
		return await this.model.query(trx).where(query_identifier).whereNull('deleted_at').first();
	}

	public async findMany(query: Partial<T>, trx?: Objection.Transaction) {
		return await this.model.query(trx).where(query).whereNull('deleted_at').skipUndefined().orderBy('created_at', 'desc');
	}

	public async update(query_identifier: Partial<T>, payload: Partial<T>, trx?: Objection.Transaction): Promise<void> {
		await this.model.query(trx).where(query_identifier).update(payload);
	}

	public async delete(query_identifier: Partial<T>, soft_delete: boolean = true, trx?: Objection.Transaction): Promise<void> {
		if (!soft_delete) {
			await this.model.query(trx).where(query_identifier).delete();
		} else {
			const deletedAt = dayjs().format(DATETIME_FORMATS.DEFAULT);

			await this.model.query(trx).where(query_identifier).update({ deleted_at: deletedAt } as unknown as Partial<T>);
		}
	}

	public query(trx?: Objection.Transaction) {
		return this.model.query(trx);
	}
}
