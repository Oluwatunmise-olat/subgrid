import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("action_logs", (table) => {
    table.string("project_id").nullable().references("id").inTable("projects");
    table.index("project_id");
  });

  await knex.raw(`
		update action_logs
		set project_id = mcp_servers.project_id
		from mcp_servers
		where mcp_servers.id = action_logs.mcp_server_id
		  and action_logs.project_id is null
	`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("action_logs", (table) => {
    table.dropIndex("project_id");
    table.dropColumn("project_id");
  });
}
