import { ToolEntry } from "../types/planning.types";
import {
  inferRequestCapability,
  isConfidentOperation,
  isReadOnlyOperation,
  writeOperationFamily,
} from "./tool-capability";
import { RequestEntities } from "@/common/types/entities";

export const READ_ONLY_ACTIONS = [
  "list",
  "get",
  "read",
  "describe",
  "search",
  "fetch",
  "check",
  "verify",
  "find",
  "status",
  "inspect",
];
const ROUTING_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "do",
  "for",
  "i",
  "me",
  "my",
  "of",
  "please",
  "the",
  "to",
  "with",
  "want",
  "can",
  "you",
  ...READ_ONLY_ACTIONS,
]);
const DOCUMENTATION_TOOLS = new Set([
  "docs",
  "documentation",
  "search_docs",
  "find_docs",
  "web_search",
]);
const DOCUMENTATION_INTENT = [
  "docs",
  "documentation",
  "document",
  "guide",
  "reference",
  "explain",
  "research",
  "how does",
  "how do",
];
export const OPERATIONAL_INTENT = [
  "list",
  "show",
  "get",
  "create",
  "add",
  "update",
  "configure",
  "connect",
  "delete",
  "remove",
  "send",
  "deploy",
  "run",
];

const tokenize = (value: string): string[] =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];

const normalizeRoutingToken = (token: string) => {
  if (token.length > 4 && token.endsWith("ies"))
    return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
};

export const resourceTokens = (value: string) =>
  tokenize(value)
    .map(normalizeRoutingToken)
    .filter((token) => !ROUTING_STOPWORDS.has(token));

export const resourceOverlap = (
  message: string,
  tool: { name: string; description: string; serverName: string },
) => {
  const requested = new Set(resourceTokens(message));
  const exposed = new Set(
    resourceTokens(`${tool.name} ${tool.description} ${tool.serverName}`),
  );
  return [...requested].filter((token) => exposed.has(token));
};

export const actionOverlap = (message: string, toolName: string) => {
  const requestedActions = tokenize(message).filter((token) =>
    READ_ONLY_ACTIONS.includes(token),
  );
  const toolActions = tokenize(toolName).filter((token) =>
    READ_ONLY_ACTIONS.includes(token),
  );
  return requestedActions.filter((action) => toolActions.includes(action));
};

export const isDocumentationRequest = (message: string) =>
  DOCUMENTATION_INTENT.some((term) => message.toLowerCase().includes(term));
export const isDocumentationTool = (toolName: string) =>
  DOCUMENTATION_TOOLS.has(toolName.toLowerCase());

export const capabilityLabel = (message: string, resources: string[]) => {
  const lower = message.toLowerCase();
  if (lower.includes("r2") || lower.includes("bucket"))
    return "R2 bucket operations";
  if (lower.includes("dns") || lower.includes("record"))
    return "DNS operations";
  return resources.slice(0, 3).join(", ");
};

export const relevanceScore = (
  message: string,
  tool: { name: string; description: string; serverName: string },
) => {
  const requestTokens = new Set(tokenize(message));
  const haystack = tokenize(
    `${tool.name} ${tool.description} ${tool.serverName}`,
  );
  return [...requestTokens].reduce((score, token) => {
    if (token.length < 3) return score;
    const normalized = normalizeRoutingToken(token);
    return (
      score +
      (haystack.includes(token) ||
      haystack.map(normalizeRoutingToken).includes(normalized)
        ? ROUTING_STOPWORDS.has(normalized)
          ? 1
          : 6
        : 0)
    );
  }, 0);
};

const ENTITY_ARG_ALIASES: Record<keyof RequestEntities, string[]> = {
  bucket: ["bucket", "Bucket", "bucket_name", "BucketName"],
  domain: ["domain", "Domain", "domain_name"],
  zone: ["zone", "Zone", "zone_id", "ZoneId", "zone_name"],
  recipient: ["to", "recipient", "email", "To", "Recipient"],
  project: ["project", "Project", "project_name", "app", "App"],
  record: ["record", "Record", "name", "Name", "record_name"],
};

export const resolveArgsFromEntities = (entry: ToolEntry, entities: RequestEntities) => {
  const required: string[] = Array.isArray(entry.schema?.required)
    ? entry.schema.required
    : [];
  const args: Record<string, any> = {};
  let missingField: string | null = null;

  for (const field of required) {
    let value: string | undefined;
    for (const [entityKey, aliases] of Object.entries(ENTITY_ARG_ALIASES) as [
      keyof RequestEntities,
      string[],
    ][]) {
      if (aliases.includes(field) && entities[entityKey]) {
        value = entities[entityKey];
        break;
      }
    }
    if (value) args[field] = value;
    else if (!missingField) missingField = field;
  }

  return { args, satisfied: !missingField, missingField };
};

export const isFastPathCandidate = (
  message: string,
  tool: { entry: ToolEntry; score: number },
  entities: RequestEntities,
) => {
  const action = tokenize(tool.entry.toolName).find((token) =>
    READ_ONLY_ACTIONS.includes(token),
  );

  return (
    tool.score >= 6 &&
    resourceOverlap(message, {
      name: tool.entry.toolName,
      description: tool.entry.description,
      serverName: tool.entry.server.name,
    }).length > 0 &&
    READ_ONLY_ACTIONS.includes(action) &&
    resolveArgsFromEntities(tool.entry, entities).satisfied
  );
};

export const capabilityScore = (
  request: ReturnType<typeof inferRequestCapability>,
  tool: ToolEntry,
) => {
  const capability = tool.capability;
  if (
    request.target &&
    capability.target &&
    request.target !== capability.target &&
    request.resource !== capability.resource
  )
    return -100;

  if (
    isConfidentOperation(request.operation) &&
    isReadOnlyOperation(request.operation) !== capability.readOnly
  )
    return -100;

  const requestFamily = writeOperationFamily(request.operation);
  const capabilityFamily = writeOperationFamily(capability.operation);
  if (
    !capability.readOnly &&
    requestFamily &&
    capabilityFamily &&
    requestFamily !== capabilityFamily
  )
    return -100;

  let score = 0;
  if (request.target && request.target === capability.target) score += 30;
  if (
    request.operation === capability.operation ||
    (requestFamily && requestFamily === capabilityFamily)
  )
    score += 20;
  if (request.resource === capability.resource) score += 10;
  return score;
};
