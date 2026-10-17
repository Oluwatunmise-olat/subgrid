export const interpolateEnv = (value: string): string =>
  value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => process.env[key] ?? "");
