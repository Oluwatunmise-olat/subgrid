import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('passkey_challenges', (table) => {
		table.string('id').primary();
		table.text('challenge').notNullable();
		table.string('type').notNullable();
		table.string('action').nullable();
		table.timestamp('expires_at').notNullable();
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
		table.timestamp('updated_at').nullable();
		table.timestamp('deleted_at').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('passkey_challenges');
}
