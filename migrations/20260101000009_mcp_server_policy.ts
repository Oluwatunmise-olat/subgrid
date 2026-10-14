import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("mcp_servers", (table) => {
    table.jsonb("tool_filter").nullable();
    table.string("approval_policy").notNullable().defaultTo("prompt");
    table.jsonb("approved_tools").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("mcp_servers", (table) => {
    table.dropColumn("tool_filter");
    table.dropColumn("approval_policy");
    table.dropColumn("approved_tools");
  });
}
