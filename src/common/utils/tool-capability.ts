import { McpServerType } from "@/models/mcp-server.model";
import { ToolCapability } from "@/common/types/planning";
import { extractEntities } from "@/common/utils/entity-extraction";
import { tokenize } from "@/common/utils/tokenize";

const WRITE_OPERATIONS = [
  "delete", "remove", "destroy", "revoke", "purge",
  "update", "edit", "modify", "configure",
  "create", "add", "provision", "send", "deploy", "invite", "publish", "upload", "grant", "point",
  "set", "change", "rename", "assign", "attach", "enable", "disable",
];
const READ_OPERATIONS = [
  "list", "search", "browse", "enumerate",
  "get", "read", "fetch", "describe", "inspect", "check", "status",
];
const OPERATIONS = [...WRITE_OPERATIONS, ...READ_OPERATIONS];

const WRITE_OPERATION_FAMILIES: Record<string, string> = {
  delete: "delete", remove: "delete", destroy: "delete", revoke: "delete", purge: "delete",
  update: "update", edit: "update", modify: "update", configure: "update", set: "update",
  change: "update", rename: "update", assign: "update", attach: "update", point: "update",
  enable: "update", disable: "update",
  create: "create", add: "create", provision: "create",
  send: "send", deploy: "send", invite: "send", publish: "send", upload: "send", grant: "send",
};

const TARGET_KEYWORDS: Array<[string, string[]]> = [
  ["objects", ["object", "objects", "file", "files", "content", "contents", "key", "keys"]],
  ["buckets", ["bucket", "buckets"]],
  ["records", ["record", "records", "dns", "zone", "zones"]],
  ["domains", ["domain", "domains", "project", "projects", "deployment", "deployments"]],
  ["messages", ["message", "messages", "email", "emails", "mail"]],
  ["servers", ["server", "servers", "service", "services", "instance", "instances"]],
];

const STORAGE_KEYWORDS = ["s3", "r2", "storage", "bucket", "object"];
const DNS_KEYWORDS = ["dns", "domain", "record", "zone"];
const EMAIL_KEYWORDS = ["email", "mail", "message"];

const singularize = (word: string) =>
  word.length > 4 && word.endsWith("ies")
    ? `${word.slice(0, -3)}y`
    : word.length > 4 && word.endsWith("s")
      ? word.slice(0, -1)
      : word;

const inferOperation = (text: string) => {
  const words = tokenize(text).map(singularize);
  return OPERATIONS.find((operation) => words.includes(singularize(operation))) || "execute";
};

const inferTarget = (text: string) => {
  const words = tokenize(text);
  const match = TARGET_KEYWORDS.find(
    ([, keywords]) => keywords.find((keyword) => words.includes(keyword)) !== undefined,
  );
  return match ? match[0] : null;
};

const inferResource = (server: McpServerType, text: string) => {
  if (server.category && server.category !== "other") return server.category;

  const words = tokenize(text);
  if (STORAGE_KEYWORDS.find((keyword) => words.includes(keyword)) !== undefined) return "storage";
  if (DNS_KEYWORDS.find((keyword) => words.includes(keyword)) !== undefined) return "dns";
  if (EMAIL_KEYWORDS.find((keyword) => words.includes(keyword)) !== undefined) return "email";
  return "other";
};

export const inferToolCapability = (
  server: McpServerType,
  toolName: string,
  description: string,
  schema: Record<string, any>,
): ToolCapability => {
  const text = `${toolName} ${description}`;
  const operation = inferOperation(text);
  const target = inferTarget(text);
  const requiredInputs = Array.isArray(schema.required) ? schema.required : [];

  return {
    resource: inferResource(server, text),
    operation,
    target,
    readOnly: !WRITE_OPERATIONS.includes(operation),
    requiredInputs,
  };
};

export const isConfidentOperation = (operation: string) => operation !== "execute";
export const isReadOnlyOperation = (operation: string) => READ_OPERATIONS.includes(operation);
export const writeOperationFamily = (operation: string): string | null =>
  WRITE_OPERATION_FAMILIES[operation] ?? null;

export const inferRequestCapability = (message: string) => {
  const lower = message.toLowerCase();
  const operation = inferOperation(lower);
  const target = inferTarget(lower);
  const resource = inferResource({ category: "other" } as McpServerType, lower);
  const entities = extractEntities(message);

  return { resource, operation, target, entities };
};
