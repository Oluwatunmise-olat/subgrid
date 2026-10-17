import { RequestedCapability, ToolEntry } from "@/common/types/planning";
import {
  isConfidentOperation,
  isReadOnlyOperation,
  writeOperationFamily,
} from "./tool-capability";
import { RequestEntities } from "@/common/types/entities";
import { singularize, tokenize } from "@/common/utils/tokenize";
import {
  DOCUMENTATION_INTENT,
  DOCUMENTATION_TOOLS,
  ENTITY_ARG_ALIASES,
  READ_OPERATIONS,
  ROUTING_STOPWORDS,
} from "@/common/constants/tool-vocabulary";

const STOPWORDS = new Set([...ROUTING_STOPWORDS, ...READ_OPERATIONS]);
const DOCUMENTATION_TOOL_NAMES = new Set(DOCUMENTATION_TOOLS);

export const resourceTokens = (value: string) =>
  tokenize(value)
    .map(singularize)
    .filter((token) => !STOPWORDS.has(token));

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
    READ_OPERATIONS.includes(token),
  );

  const toolActions = tokenize(toolName).filter((token) =>
    READ_OPERATIONS.includes(token),
  );

  return requestedActions.filter((action) => toolActions.includes(action));
};

export const isDocumentationRequest = (message: string) => {
  const lowerMessage = message.toLowerCase();

  return (
    DOCUMENTATION_INTENT.find((term) => lowerMessage.includes(term)) !==
    undefined
  );
};

export const isDocumentationTool = (toolName: string) =>
  DOCUMENTATION_TOOL_NAMES.has(toolName.toLowerCase());

export const capabilityLabel = (message: string, resources: string[]) => {
  const lower = message.toLowerCase();

  if (lower.includes("r2") || lower.includes("bucket")) {
    return "R2 bucket operations";
  }

  if (lower.includes("dns") || lower.includes("record")) {
    return "DNS operations";
  }

  return resources.slice(0, 3).join(", ");
};

export const relevanceScore = (
  message: string,
  tool: { name: string; description: string; serverName: string },
) => {
  const requestTokens = new Set(tokenize(message));
  const exposedWords = tokenize(`${tool.name} ${tool.description} ${tool.serverName}`);
  const singularizedExposedWords = exposedWords.map(singularize);

  let score = 0;

  for (const token of requestTokens) {
    if (token.length < 3) continue;

    const singularizedToken = singularize(token);
    const isExposed =
      exposedWords.includes(token) ||
      singularizedExposedWords.includes(singularizedToken);

    if (!isExposed) continue;

    score += STOPWORDS.has(singularizedToken) ? 1 : 6;
  }

  return score;
};

const findEntityValueForField = (
  field: string,
  entities: RequestEntities,
): string | undefined => {
  for (const [entityKey, aliases] of Object.entries(ENTITY_ARG_ALIASES) as [
    keyof RequestEntities,
    string[],
  ][]) {
    if (aliases.includes(field) && entities[entityKey]) {
      return entities[entityKey];
    }
  }

  return undefined;
};

export const resolveArgsFromEntities = (
  entry: ToolEntry,
  entities: RequestEntities,
) => {
  const required: string[] = Array.isArray(entry.schema?.required)
    ? entry.schema.required
    : [];

  const args: Record<string, any> = {};
  let missingField: string | null = null;

  for (const field of required) {
    const value = findEntityValueForField(field, entities);

    if (value) {
      args[field] = value;
    } else if (!missingField) {
      missingField = field;
    }
  }

  return { args, satisfied: !missingField, missingField };
};

export const isFastPathCandidate = (
  message: string,
  tool: { entry: ToolEntry; score: number },
  entities: RequestEntities,
): boolean => {
  if (tool.score < 6) return false;

  const hasReadOnlyAction =
    tokenize(tool.entry.toolName).find((token) => READ_OPERATIONS.includes(token)) !==
    undefined;

  if (!hasReadOnlyAction) return false;

  const overlapsRequestedResource =
    resourceOverlap(message, {
      name: tool.entry.toolName,
      description: tool.entry.description,
      serverName: tool.entry.server.name,
    }).length > 0;

  if (!overlapsRequestedResource) return false;

  return resolveArgsFromEntities(tool.entry, entities).satisfied;
};

export const capabilityScore = (
  request: RequestedCapability,
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
