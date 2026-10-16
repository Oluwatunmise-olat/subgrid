export const STEP_REFERENCE_PATTERN =
  /\{\{\s*step(\d+)\.([A-Za-z0-9_.-]+)\s*\}\}/g;

const WHOLE_REFERENCE_PATTERN = /^\{\{\s*step(\d+)\.([A-Za-z0-9_.-]+)\s*\}\}$/;

export class UnresolvedStepReferenceError extends Error {}

const isPlainObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const payloadOf = (output: unknown): unknown => {
  if (!isPlainObject(output)) return output;

  if (typeof output.raw !== "string") return output;

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
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }

    if (!isPlainObject(current)) return undefined;
    current = current[segment];
  }

  return current;
};

export const referencedStepIndexes = (input: unknown): number[] => {
  const text = JSON.stringify(input ?? null) || "";
  const found = new Set<number>();

  STEP_REFERENCE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(STEP_REFERENCE_PATTERN)) {
    found.add(Number(match[1]));
  }

  return [...found].sort((a, b) => a - b);
};

export const resolveStepInput = (
  input: unknown,
  lookup: (stepIndex: number) => unknown,
): unknown => {
  const resolve = (stepIndex: number, field: string, where: string) => {
    const value = readPath(payloadOf(lookup(stepIndex)), field);

    if (value === undefined || value === null || value === "") {
      throw new UnresolvedStepReferenceError(
        `{{step${stepIndex}.${field}}} at ${where} could not be resolved: step ${stepIndex} has no "${field}" in its result.`,
      );
    }

    return value;
  };

  const walk = (value: unknown, path: string): unknown => {
    if (typeof value === "string") {
      if (!value.includes("{{")) return value;

      const where = path || "input";

      const whole = value.trim().match(WHOLE_REFERENCE_PATTERN);
      if (whole) return resolve(Number(whole[1]), whole[2], where);

      let out = value;

      for (const match of value.matchAll(STEP_REFERENCE_PATTERN)) {
        out = out.replace(
          match[0],
          String(resolve(Number(match[1]), match[2], where)),
        );
      }

      return out;
    }

    if (Array.isArray(value))
      return value.map((item, index) => walk(item, `${path}[${index}]`));

    if (isPlainObject(value))
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          walk(item, path ? `${path}.${key}` : key),
        ]),
      );

    return value;
  };

  return walk(input, "");
};

export const stripUnavailableReferences = (input: unknown, position: number): unknown => {
  if (Array.isArray(input))
    return input.map((item) => stripUnavailableReferences(item, position));

  if (isPlainObject(input)) {
    const kept = Object.entries(input).filter(
      ([, value]) =>
        !referencedStepIndexes(value).some(
          (index) => index < 1 || index >= position,
        ),
    );

    return Object.fromEntries(
      kept.map(([key, value]) => [
        key,
        stripUnavailableReferences(value, position),
      ]),
    );
  }

  return input;
};
