import { McpServerType } from '@/models/mcp-server.model';
import { ToolCapability } from '../types/planning.types';
import { extractEntities } from '@/common/utils/entity-extraction';

const WRITE_OPERATIONS = [
	'delete', 'remove', 'destroy', 'revoke', 'purge',
	'update', 'edit', 'modify', 'configure',
	'create', 'add', 'provision', 'send', 'deploy', 'invite', 'publish', 'upload', 'grant', 'point',
	'set', 'change', 'rename', 'assign', 'attach', 'enable', 'disable',
];
const READ_OPERATIONS = [
	'list', 'search', 'browse', 'enumerate',
	'get', 'read', 'fetch', 'describe', 'inspect', 'check', 'status',
];
const OPERATIONS = [...WRITE_OPERATIONS, ...READ_OPERATIONS];

const WRITE_OPERATION_FAMILIES: Record<string, string> = {
	delete: 'delete', remove: 'delete', destroy: 'delete', revoke: 'delete', purge: 'delete',
	update: 'update', edit: 'update', modify: 'update', configure: 'update', set: 'update',
	change: 'update', rename: 'update', assign: 'update', attach: 'update', point: 'update',
	enable: 'update', disable: 'update',
	create: 'create', add: 'create', provision: 'create',
	send: 'send', deploy: 'send', invite: 'send', publish: 'send', upload: 'send', grant: 'send',
};

const TARGETS: Array<[string, RegExp]> = [
	['objects', /\b(objects?|files?|contents?|keys?)\b/],
	['buckets', /\bbuckets?\b/],
	['records', /\b(records?|dns|zones?)\b/],
	['domains', /\b(domains?|projects?|deployments?)\b/],
	['messages', /\b(messages?|emails?|mail)\b/],
	['servers', /\b(servers?|services?|instances?)\b/],
];

const tokenise = (value: string) =>
	value.toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2').match(/[a-z0-9]+/g) || [];

const singularise = (value: string) =>
	value.length > 4 && value.endsWith('ies')
		? `${value.slice(0, -3)}y`
		: value.length > 4 && value.endsWith('s')
			? value.slice(0, -1)
			: value;

const inferOperation = (text: string) =>
	OPERATIONS.find((operation) => tokenise(text).map(singularise).includes(singularise(operation))) || 'execute';

const inferTarget = (text: string) => {
	for (const [target, pattern] of TARGETS) {
		if (pattern.test(text)) return target;
	}
	return null;
};

const inferResource = (server: McpServerType, text: string) => {
	if (server.category && server.category !== 'other') return server.category;
	if (/\b(s3|r2|storage|bucket|object)\b/.test(text)) return 'storage';
	if (/\b(dns|domain|record|zone)\b/.test(text)) return 'dns';
	if (/\b(email|mail|message)\b/.test(text)) return 'email';
	return 'other';
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

export const isConfidentOperation = (operation: string) => operation !== 'execute';
export const isReadOnlyOperation = (operation: string) => READ_OPERATIONS.includes(operation);
export const writeOperationFamily = (operation: string): string | null =>
	WRITE_OPERATION_FAMILIES[operation] ?? null;

export const inferRequestCapability = (message: string) => {
	const lower = message.toLowerCase();
	const operation = inferOperation(lower);
	const target = inferTarget(lower);
	const resource = inferResource({ category: 'other' } as McpServerType, lower);
	const entities = extractEntities(message);

	return { resource, operation, target, entities };
};
