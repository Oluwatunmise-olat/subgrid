import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('llm_settings', (table) => {
		table.string('id').primary();
		table.string('provider').notNullable();
		table.text('secrets_cipher').notNullable();
		table.text('secrets_nonce').notNullable();
		table.text('secrets_tag').notNullable();
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
		table.timestamp('updated_at').nullable();
		table.timestamp('deleted_at').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('llm_settings');
}
