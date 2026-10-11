import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('mcp_servers', (table) => {
		table.string('category').notNullable().defaultTo('other');
		table.string('provider').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('mcp_servers', (table) => {
		table.dropColumn('category');
		table.dropColumn('provider');
	});
}
