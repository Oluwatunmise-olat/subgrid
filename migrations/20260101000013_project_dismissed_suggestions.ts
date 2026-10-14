import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.jsonb("dismissed_suggestions").notNullable().defaultTo("[]");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("projects", (table) => {
    table.dropColumn("dismissed_suggestions");
  });
}
