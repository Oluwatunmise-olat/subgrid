const STEP_REFERENCE = /\{\{step(\d+)\.([\w.-]+)\}\}/g;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const payloadOf = (output: unknown): unknown => {
  if (!isObject(output) || typeof output.raw !== "string") return output;

  const separator = output.raw.indexOf("\n\n");
  const body = separator >= 0 ? output.raw.slice(separator + 2) : output.raw;

  try {
    return JSON.parse(body);
  } catch {
    return output;
  }
};

const readPath = (value: unknown, path: string): unknown => {
  let current = value;

  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      current = current[Number(segment)];
      continue;
    }

    if (!isObject(current)) return undefined;
    current = current[segment];
  }

  return current;
};

export const referencedStepIndexes = (input: unknown): number[] => {
  const text = JSON.stringify(input ?? null);
  const indexes = new Set<number>();

  for (const match of text.matchAll(STEP_REFERENCE)) {
    indexes.add(Number(match[1]));
  }

  return [...indexes].sort((a, b) => a - b);
};

const resolveReference = (
  match: RegExpMatchArray,
  path: string,
  lookup: (stepIndex: number) => unknown,
): unknown => {
  const stepIndex = Number(match[1]);
  const field = match[2];
  const value = readPath(payloadOf(lookup(stepIndex)), field);

  if (value === undefined || value === null || value === "") {
    throw new Error(
      `{{step${stepIndex}.${field}}} at ${path} could not be resolved: step ${stepIndex} has no "${field}" in its result.`,
    );
  }

  return value;
};

const resolveInValue = (
  value: unknown,
  path: string,
  lookup: (stepIndex: number) => unknown,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item, index) => resolveInValue(item, `${path}[${index}]`, lookup));
  }

  if (isObject(value)) {
    const resolved: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      resolved[key] = resolveInValue(item, path ? `${path}.${key}` : key, lookup);
    }
    return resolved;
  }

  if (typeof value !== "string" || !value.includes("{{")) return value;

  const matches = [...value.matchAll(STEP_REFERENCE)];
  if (!matches.length) return value;

  const where = path || "input";

  if (matches.length === 1 && matches[0][0] === value) {
    return resolveReference(matches[0], where, lookup);
  }

  let resolved = value;
  for (const match of matches) {
    resolved = resolved.replace(match[0], String(resolveReference(match, where, lookup)));
  }
  return resolved;
};

export const resolveStepInput = (
  input: unknown,
  lookup: (stepIndex: number) => unknown,
): unknown => resolveInValue(input, "", lookup);

export const stripUnavailableReferences = (input: unknown, position: number): unknown => {
  if (Array.isArray(input)) {
    return input.map((item) => stripUnavailableReferences(item, position));
  }

  if (isObject(input)) {
    const kept: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      const referencesUnavailableStep =
        referencedStepIndexes(value).find(
          (index) => index < 1 || index >= position,
        ) !== undefined;

      if (!referencesUnavailableStep) kept[key] = stripUnavailableReferences(value, position);
    }

    return kept;
  }

  return input;
};
