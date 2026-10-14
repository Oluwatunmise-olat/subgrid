import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('workflows', (table) => {
		table.string('id').primary();
		table.string('project_id').notNullable().references('id').inTable('projects');
		table.text('request').notNullable();
		table.string('mode').notNullable().defaultTo('plan');
		table.string('execution_mode').notNullable().defaultTo('sequential');
		table.string('status').notNullable().defaultTo('draft');
		table.text('note').nullable();
		table.integer('version').notNullable().defaultTo(1);
		table.jsonb('suggestions').nullable();
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
		table.timestamp('updated_at').nullable();
		table.timestamp('deleted_at').nullable();
	});

	await knex.schema.createTable('workflow_steps', (table) => {
		table.string('id').primary();
		table.string('workflow_id').notNullable().references('id').inTable('workflows');
		table.integer('order').notNullable();
		table.jsonb('depends_on').notNullable().defaultTo('[]');
		table.string('server_id').notNullable().references('id').inTable('mcp_servers');
		table.jsonb('capability').notNullable();
		table.string('tool_name').notNullable();
		table.string('title').nullable();
		table.text('intent').nullable();
		table.jsonb('input').notNullable().defaultTo('{}');
		table.string('status').notNullable().defaultTo('pending');
		table.boolean('requires_approval').notNullable().defaultTo(false);
		table.jsonb('output').nullable();
		table.text('error').nullable();
		table.string('action_log_id').nullable().references('id').inTable('action_logs');
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
		table.timestamp('updated_at').nullable();
		table.timestamp('deleted_at').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('workflow_steps');
	await knex.schema.dropTableIfExists('workflows');
}
