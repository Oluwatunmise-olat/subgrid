import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('mcp_servers', (table) => {
		table.string('id').primary();
		table.string('name').notNullable();
		table.string('slug').notNullable().unique();
		table.string('transport').notNullable();
		table.string('command').nullable();
		table.jsonb('args').nullable();
		table.string('url').nullable();
		table.jsonb('env').nullable();
		table.jsonb('headers').nullable();
		table.string('health').notNullable().defaultTo('unknown');
		table.timestamp('last_health_check_at').nullable();
		table.text('last_error').nullable();
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
		table.timestamp('updated_at').nullable();
		table.timestamp('deleted_at').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('mcp_servers');
}
