import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { canonicalUri, signRequest } from './sigv4';

type S3Spec = {
	name?: string;
	endpoint: string;
	region?: string;
	accessKeyId: string;
	secretAccessKey: string;
};

const DEFAULT_REGION = 'auto';
const DEFAULT_SERVICE = 's3';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_INLINE_BYTES = 1_000_000;

const interpolateEnv = (value: string): string =>
	value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => process.env[key] ?? '');

const readSpec = (): S3Spec => {
	const fromArgv = process.argv[2];
	const raw = fromArgv && fromArgv.trim().startsWith('{') ? fromArgv : process.env.SUBGRID_S3_SPEC;
	if (!raw) throw new Error('No spec: pass it as an argument, or set SUBGRID_S3_SPEC');

	const parsed = JSON.parse(raw) as S3Spec;

	return {
		name: parsed.name,
		endpoint: interpolateEnv(parsed.endpoint),
		region: interpolateEnv(parsed.region || DEFAULT_REGION),
		accessKeyId: interpolateEnv(parsed.accessKeyId || ''),
		secretAccessKey: interpolateEnv(parsed.secretAccessKey || ''),
	};
};

const spec = readSpec();

if (!spec.endpoint || !spec.accessKeyId || !spec.secretAccessKey) {
	throw new Error('Spec needs endpoint, accessKeyId and secretAccessKey');
}

const endpoint = new URL(spec.endpoint);
const endpointOrigin = endpoint.origin;

const SAFE_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

const assertBucket = (bucket: unknown) => {
	const value = String(bucket ?? '');
	if (!SAFE_BUCKET.test(value)) throw new Error(`Refusing bucket ${JSON.stringify(value)}: not a valid bucket name`);
	return value;
};

const assertKey = (key: unknown) => {
	const value = String(key ?? '');
	if (!value) throw new Error('A key is required');
	if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error('Refusing key: control characters are not allowed');
	if (value.startsWith('/')) throw new Error('Refusing key: must not start with "/"');
	if (value.split('/').includes('..')) throw new Error('Refusing key: ".." segments are not allowed');
	return value;
};

type S3Result = { ok: boolean; status: number; body: string; contentType: string | null };

const request = async (
	method: string,
	path: string,
	query: Record<string, string | number | undefined>,
	body?: Buffer,
	contentType?: string,
): Promise<S3Result> => {
	const url = new URL(endpointOrigin + canonicalUri(path));
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
	}

	if (url.origin !== endpointOrigin) throw new Error(`Refusing to leave ${endpointOrigin}`);

	const payload = body ?? Buffer.alloc(0);

	const extraHeaders: Record<string, string> = {};
	if (contentType) extraHeaders['content-type'] = contentType;

	const { authorization, headers } = signRequest({
		method,
		url,
		payload,
		region: spec.region,
		accessKeyId: spec.accessKeyId,
		secretAccessKey: spec.secretAccessKey,
		extraHeaders,
	});

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			method,
			headers: { ...headers, authorization },
			body: method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(payload),
			redirect: 'manual',
			signal: controller.signal,
		});

		const contentTypeHeader = response.headers.get('content-type');
		const buffer = Buffer.from(await response.arrayBuffer());
		const looksTextual = /^(text\/|application\/(json|xml))/.test(contentTypeHeader || '');
		const bodyText =
			looksTextual || buffer.length === 0
				? buffer.toString('utf8')
				: `[binary ${buffer.length} bytes, base64]\n${buffer.subarray(0, MAX_INLINE_BYTES).toString('base64')}`;

		return { ok: response.ok, status: response.status, body: bodyText, contentType: contentTypeHeader };
	} finally {
		clearTimeout(timer);
	}
};

const tools = [
	{
		name: 'list_buckets',
		description: 'List the buckets available to these credentials',
		inputSchema: { type: 'object' as const, properties: {} },
		run: async () => request('GET', '/', {}),
	},
	{
		name: 'list_objects',
		description: 'List objects in a bucket (S3 ListObjectsV2), optionally filtered by prefix',
		inputSchema: {
			type: 'object' as const,
			properties: {
				bucket: { type: 'string', description: 'bucket name' },
				prefix: { type: 'string', description: 'only keys starting with this prefix' },
				max_keys: { type: 'number', description: 'page size, 1-1000' },
				continuation_token: { type: 'string', description: 'token from a previous page' },
			},
			required: ['bucket'],
		},
		run: async (args: any) =>
			request('GET', `/${assertBucket(args.bucket)}`, {
				'list-type': 2,
				prefix: args.prefix,
				'max-keys': args.max_keys,
				'continuation-token': args.continuation_token,
			}),
	},
	{
		name: 'head_object',
		description: 'Object metadata (size, content type, etag) without downloading it',
		inputSchema: { type: 'object' as const, properties: { bucket: { type: 'string' }, key: { type: 'string' } }, required: ['bucket', 'key'] },
		run: async (args: any) => request('HEAD', `/${assertBucket(args.bucket)}/${assertKey(args.key)}`, {}),
	},
	{
		name: 'get_object',
		description: "Read an object's contents. Binary content is returned as base64.",
		inputSchema: { type: 'object' as const, properties: { bucket: { type: 'string' }, key: { type: 'string' } }, required: ['bucket', 'key'] },
		run: async (args: any) => request('GET', `/${assertBucket(args.bucket)}/${assertKey(args.key)}`, {}),
	},
	{
		name: 'put_object',
		description: 'Write an object. content is utf8 unless body_encoding is base64.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				bucket: { type: 'string' },
				key: { type: 'string' },
				content: { type: 'string', description: 'the object body' },
				body_encoding: { type: 'string', enum: ['utf8', 'base64'] },
				content_type: { type: 'string', description: 'e.g. text/plain, image/png' },
			},
			required: ['bucket', 'key', 'content'],
		},
		run: async (args: any) =>
			request(
				'PUT',
				`/${assertBucket(args.bucket)}/${assertKey(args.key)}`,
				{},
				Buffer.from(String(args.content), args.body_encoding === 'base64' ? 'base64' : 'utf8'),
				args.content_type || (args.body_encoding === 'base64' ? 'application/octet-stream' : 'text/plain; charset=utf-8'),
			),
	},
	{
		name: 'delete_object',
		description: 'Delete an object',
		inputSchema: { type: 'object' as const, properties: { bucket: { type: 'string' }, key: { type: 'string' } }, required: ['bucket', 'key'] },
		run: async (args: any) => request('DELETE', `/${assertBucket(args.bucket)}/${assertKey(args.key)}`, {}),
	},
];

const byName = new Map(tools.map((tool) => [tool.name, tool]));

const server = new Server(
	{ name: spec.name ? `subgrid-s3:${spec.name}` : 'subgrid-s3', version: '1.0.0' },
	{ capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request_) => {
	const tool = byName.get(request_.params.name);

	if (!tool) {
		return { isError: true, content: [{ type: 'text', text: `Unknown tool "${request_.params.name}"` }] };
	}

	try {
		const result = await tool.run((request_.params.arguments || {}) as any);
		const text = [`HTTP ${result.status}`, result.contentType ? `content-type: ${result.contentType}` : '', '', result.body]
			.filter(Boolean)
			.join('\n');

		return { ...(result.ok ? {} : { isError: true }), content: [{ type: 'text', text }] };
	} catch (err) {
		return { isError: true, content: [{ type: 'text', text: (err as Error).message }] };
	}
});

const main = async () => {
	await server.connect(new StdioServerTransport());
};

main().catch((err) => {
	process.stderr.write(`[s3-bridge] fatal: ${(err as Error).message}\n`);
	process.exit(1);
});
