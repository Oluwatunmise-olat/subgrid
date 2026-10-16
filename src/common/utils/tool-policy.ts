import { McpServerType } from '@/models/mcp-server.model';
import type { McpToolFilter } from '@/models/types';

export const DEFAULT_APPROVAL_POLICY = 'prompt';

const DESTRUCTIVE_KEYWORDS = [
	'delete',
	'remove',
	'drop',
	'destroy',
	'revoke',
	'purge',
];

export const isDestructive = (toolName: string): boolean =>
	DESTRUCTIVE_KEYWORDS.some((keyword) =>
		(toolName || '').toLowerCase().includes(keyword),
	);

const matchesPattern = (name: string, pattern: string): boolean => {
	const value = (pattern || '').trim();
	if (!value) return false;
	if (value.endsWith('*')) return name.startsWith(value.slice(0, -1));
	return name === value;
};

const normalize = (filter: McpToolFilter) => ({
	include: (filter?.include || []).map((p) => p.trim()).filter(Boolean),
	exclude: (filter?.exclude || []).map((p) => p.trim()).filter(Boolean),
});

export const isToolAllowed = (
	toolName: string,
	filter: McpToolFilter,
): boolean => {
	const { include, exclude } = normalize(filter);

	if (exclude.some((pattern) => matchesPattern(toolName, pattern)))
		return false;
	if (include.length > 0 && !include.some((pattern) => matchesPattern(toolName, pattern)))
		return false;

	return true;
};

export const filterTools = <T extends { toolName: string }>(
	tools: T[],
	filter: McpToolFilter,
): T[] => tools.filter((tool) => isToolAllowed(tool.toolName, filter));

export const resolveRequiresApproval = (
	server: Pick<McpServerType, 'approval_policy' | 'approved_tools'>,
	toolName: string,
	declared = false,
): boolean => {
	const granted = (server.approved_tools || []).some((pattern) =>
		matchesPattern(toolName, pattern),
	);
	if (granted) return false;

	if (declared) return true;

	switch (server.approval_policy || DEFAULT_APPROVAL_POLICY) {
		case 'auto':
			return false;
		case 'always':
			return true;
		default:
			return isDestructive(toolName);
	}
};
