import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("mcp_servers", (table) => {
    table.string("catalog_id").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("mcp_servers", (table) => {
    table.dropColumn("catalog_id");
  });
}
