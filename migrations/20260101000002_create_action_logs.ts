import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('action_logs', (table) => {
		table.string('id').primary();
		table.string('mcp_server_id').notNullable().references('id').inTable('mcp_servers');
		table.string('tool_name').notNullable();
		table.jsonb('input').notNullable();
		table.jsonb('output').nullable();
		table.string('status').notNullable().defaultTo('succeeded');
		table.boolean('requires_approval').notNullable().defaultTo(false);
		table.text('error').nullable();
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
		table.timestamp('updated_at').nullable();
		table.timestamp('deleted_at').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('action_logs');
}
