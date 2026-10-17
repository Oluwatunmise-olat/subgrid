import { McpServerType } from "@/models/mcp-server.model";
import { ToolCapability } from "@/common/types/planning";
import { extractEntities } from "@/common/utils/entity-extraction";
import { singularize, tokenize } from "@/common/utils/tokenize";
import {
  DNS_KEYWORDS,
  EMAIL_KEYWORDS,
  READ_OPERATIONS,
  STORAGE_KEYWORDS,
  TARGET_KEYWORDS,
  WRITE_OPERATIONS,
  WRITE_OPERATION_FAMILIES,
} from "@/common/constants/tool-vocabulary";

const OPERATIONS = [...WRITE_OPERATIONS, ...READ_OPERATIONS];

const inferOperation = (text: string) => {
  const words = tokenize(text).map(singularize);

  return (
    OPERATIONS.find((operation) => words.includes(singularize(operation))) ||
    "execute"
  );
};

const inferTarget = (text: string) => {
  const words = tokenize(text);

  const match = TARGET_KEYWORDS.find(
    ([, keywords]) =>
      keywords.find((keyword) => words.includes(keyword)) !== undefined,
  );

  return match ? match[0] : null;
};

const inferResource = (server: McpServerType, text: string) => {
  if (server.category && server.category !== "other") return server.category;

  const words = tokenize(text);

  if (STORAGE_KEYWORDS.find((keyword) => words.includes(keyword)) !== undefined) {
    return "storage";
  }

  if (DNS_KEYWORDS.find((keyword) => words.includes(keyword)) !== undefined) {
    return "dns";
  }

  if (EMAIL_KEYWORDS.find((keyword) => words.includes(keyword)) !== undefined) {
    return "email";
  }

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

export const isConfidentOperation = (operation: string) =>
  operation !== "execute";

export const isReadOnlyOperation = (operation: string) =>
  READ_OPERATIONS.includes(operation);

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
