import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('mcp_servers', (table) => {
		table.string('project_id').nullable().references('id').inTable('projects');
		table.text('secrets_cipher').nullable();
		table.text('secrets_nonce').nullable();
		table.text('secrets_tag').nullable();
		table.dropColumn('env');
		table.dropColumn('headers');
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('mcp_servers', (table) => {
		table.dropColumn('project_id');
		table.dropColumn('secrets_cipher');
		table.dropColumn('secrets_nonce');
		table.dropColumn('secrets_tag');
		table.jsonb('env').nullable();
		table.jsonb('headers').nullable();
	});
}
