import { McpServerType } from "@/models/mcp-server.model";
import type { McpToolFilter } from "@/models/types";

export const DEFAULT_APPROVAL_POLICY = "prompt";

const DESTRUCTIVE_KEYWORDS = [
  "delete",
  "remove",
  "drop",
  "destroy",
  "revoke",
  "purge",
];

const includesAny = (text: string, keywords: string[]): boolean => {
  for (const keyword of keywords) {
    if (text.includes(keyword)) return true;
  }
  return false;
};

export const isDestructive = (toolName: string) =>
  includesAny((toolName || "").toLowerCase(), DESTRUCTIVE_KEYWORDS);

const matchesPattern = (name: string, pattern: string) => {
  const value = (pattern || "").trim();
  if (!value) return false;
  if (value.endsWith("*")) return name.startsWith(value.slice(0, -1));
  return name === value;
};

const matchesAnyPattern = (name: string, patterns: string[]): boolean => {
  for (const pattern of patterns) {
    if (matchesPattern(name, pattern)) return true;
  }
  return false;
};

const normalize = (filter: McpToolFilter) => ({
  include: (filter?.include || []).map((p) => p.trim()).filter(Boolean),
  exclude: (filter?.exclude || []).map((p) => p.trim()).filter(Boolean),
});

export const isToolAllowed = (toolName: string, filter: McpToolFilter) => {
  const { include, exclude } = normalize(filter);

  if (matchesAnyPattern(toolName, exclude)) return false;
  if (include.length > 0 && !matchesAnyPattern(toolName, include)) return false;

  return true;
};

export const filterTools = <T extends { toolName: string }>(
  tools: T[],
  filter: McpToolFilter,
): T[] => tools.filter((tool) => isToolAllowed(tool.toolName, filter));

export const resolveRequiresApproval = (
  server: Pick<McpServerType, "approval_policy" | "approved_tools">,
  toolName: string,
  catalogRequiresApproval = false,
) => {
  const alreadyApproved = matchesAnyPattern(toolName, server.approved_tools || []);

  if (alreadyApproved) return false;

  if (catalogRequiresApproval) return true;

  const policy = server.approval_policy || DEFAULT_APPROVAL_POLICY;

  if (policy === "auto") return false;
  if (policy === "always") return true;

  return isDestructive(toolName);
};
