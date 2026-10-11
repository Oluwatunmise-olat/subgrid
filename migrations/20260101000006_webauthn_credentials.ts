import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('webauthn_credentials', (table) => {
		table.string('id').primary();
		table.string('credential_id').notNullable().unique();
		table.text('public_key').notNullable();
		table.bigInteger('counter').notNullable().defaultTo(0);
		table.jsonb('transports').nullable();
		table.string('label').nullable();
		table.timestamp('last_used_at').nullable();
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
		table.timestamp('updated_at').nullable();
		table.timestamp('deleted_at').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('webauthn_credentials');
}
