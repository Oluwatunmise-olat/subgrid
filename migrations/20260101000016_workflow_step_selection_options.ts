import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('workflow_steps', (table) => {
		table.jsonb('selection_options').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('workflow_steps', (table) => {
		table.dropColumn('selection_options');
	});
}
