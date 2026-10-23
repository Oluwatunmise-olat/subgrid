const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// e.g. 'Result: [{"id":1}]\nDone.' -> [{ id: 1 }]
const extractJson = (text: string): unknown => {
  const start = text.search(/[[{]/);

  if (start === -1) return undefined;

  const open = text[start];
  const close = open === "[" ? "]" : "}";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const character = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;

      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === open) {
      depth++;
    } else if (character === close) {
      depth--;

      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }

  return undefined;
};

const payloadOf = (output: unknown): unknown => {
  if (!isObject(output) || typeof output.raw !== "string") return output;

  const parsed = extractJson(output.raw);

  return parsed === undefined ? output : parsed;
};

const findInArray = (
  items: unknown[],
  field: string,
  wanted: string,
): unknown => {
  const matcher = (item: unknown) => {
    if (!isObject(item)) return false;

    if (field === "*") {
      return (
        Object.values(item).find(
          (v) =>
            typeof v === "string" && v.toLowerCase() === wanted.toLowerCase(),
        ) !== undefined
      );
    }

    return String(item[field]).toLowerCase() === wanted.toLowerCase();
  };

  return items.find(matcher);
};

const readKey = (current: Record<string, unknown>, key: string): unknown => {
  if (key in current) return current[key];

  // e.g. "database_id" -> current.id
  if (/(_id|_uuid)$/i.test(key) && "id" in current) return current.id;

  if (key === "id" && !("id" in current)) {
    // e.g. { database_id: "x" } -> current.database_id
    const alt = Object.keys(current).find((k) => /(_id|_uuid)$/i.test(k));
    if (alt) return current[alt];
  }

  return undefined;
};

const readPath = (value: unknown, path: string): unknown => {
  let current = value;

  for (const rawSegment of path.split(".")) {
    if (current === null || current === undefined) return undefined;

    // e.g. "result[*=prod]" -> key "result", filter field "*", filter value "prod"
    const match = rawSegment.match(/^([\w-]+)(?:\[([\w*-]+)=([^\]]+)\])?$/);

    const key = match ? match[1] : rawSegment;

    const filterField = match?.[2];

    const filterValue = match?.[3];

    if (key === "result" && Array.isArray(current)) {
    } else if (Array.isArray(current)) {
      current = /^\d+$/.test(key) ? current[Number(key)] : undefined;
    } else if (isObject(current)) {
      current = readKey(current, key);
    } else {
      return undefined;
    }

    if (filterField && filterValue !== undefined && Array.isArray(current)) {
      current = findInArray(current, filterField, filterValue);
    }
  }

  return current;
};

export const referencedStepIndexes = (input: unknown): number[] => {
  const text = JSON.stringify(input ?? null);

  const indexes = new Set<number>();

  // e.g. "{{step2.result[*=prod].id}}" -> step index 2
  for (const match of text.matchAll(/\{\{step(\d+)\.([\w.\-[\]*=]+)\}\}/g)) {
    indexes.add(Number(match[1]));
  }

  // e.g. "{{select:step2}}" -> step index 2
  for (const match of text.matchAll(/\{\{select:step(\d+)\}\}/g)) {
    indexes.add(Number(match[1]));
  }

  return [...indexes].sort((a, b) => a - b);
};

export const pendingSelection = (
  input: unknown,
): { stepIndex: number; field: string } | null => {
  if (!isObject(input)) return null;

  for (const [field, value] of Object.entries(input)) {
    if (typeof value !== "string") continue;

    // e.g. "{{select:step2}}" -> step index 2
    const match = value.match(/^\{\{select:step(\d+)\}\}$/);

    if (match) return { stepIndex: Number(match[1]), field };
  }

  return null;
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
    return value.map((item, index) =>
      resolveInValue(item, `${path}[${index}]`, lookup),
    );
  }

  if (isObject(value)) {
    const resolved: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      resolved[key] = resolveInValue(
        item,
        path ? `${path}.${key}` : key,
        lookup,
      );
    }
    return resolved;
  }

  if (typeof value !== "string" || !value.includes("{{")) return value;

  // e.g. "{{step2.result[*=prod].id}}" -> step index 2, path "result[*=prod].id"
  const matches = [...value.matchAll(/\{\{step(\d+)\.([\w.\-[\]*=]+)\}\}/g)];
  if (!matches.length) return value;

  const where = path || "input";

  if (matches.length === 1 && matches[0][0] === value) {
    return resolveReference(matches[0], where, lookup);
  }

  let resolved = value;
  for (const match of matches) {
    resolved = resolved.replace(
      match[0],
      String(resolveReference(match, where, lookup)),
    );
  }
  return resolved;
};

export const resolveStepInput = (
  input: unknown,
  lookup: (stepIndex: number) => unknown,
): unknown => resolveInValue(input, "", lookup);

export const stripUnavailableReferences = (
  input: unknown,
  position: number,
): unknown => {
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

      if (!referencesUnavailableStep)
        kept[key] = stripUnavailableReferences(value, position);
    }

    return kept;
  }

  return input;
};
