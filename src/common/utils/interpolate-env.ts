export const interpolateFrom = (
  value: string,
  source: Record<string, string | undefined>,
): string =>
  value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => source[key] ?? "");

export const interpolateEnv = (value: string): string =>
  interpolateFrom(value, process.env);
