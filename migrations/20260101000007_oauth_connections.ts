import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('oauth_connections', (table) => {
		table.string('id').primary();
		table.string('mcp_server_id').notNullable().unique().references('id').inTable('mcp_servers');
		table.text('issuer').nullable();
		table.jsonb('discovery_state').nullable();
		table.text('client_info_cipher').nullable();
		table.text('client_info_nonce').nullable();
		table.text('client_info_tag').nullable();
		table.text('tokens_cipher').nullable();
		table.text('tokens_nonce').nullable();
		table.text('tokens_tag').nullable();
		table.timestamp('token_expires_at').nullable();
		table.text('code_verifier').nullable();
		table.text('oauth_state').nullable();
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
		table.timestamp('updated_at').nullable();
		table.timestamp('deleted_at').nullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('oauth_connections');
}
