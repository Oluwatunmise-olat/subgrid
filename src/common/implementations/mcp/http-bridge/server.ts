import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { REQUEST_TIMEOUT_MS, SAFE_SEGMENT, placeholderPattern } from './constants';
import { Auth, Spec, Verb } from './types';

const interpolateEnv = (value: string): string =>
	value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => process.env[key] ?? '');

const readSpec = (): Spec => {
	const fromArgv = process.argv[2];
	if (fromArgv && fromArgv.trim().startsWith('{')) return JSON.parse(fromArgv) as Spec;

	const inline = process.env.SUBGRID_HTTP_SPEC;
	const file = process.env.SUBGRID_HTTP_SPEC_FILE;

	if (inline) return JSON.parse(inline) as Spec;
	if (file) return JSON.parse(readFileSync(file, 'utf8')) as Spec;

	throw new Error('No spec: pass it as an argument, or set SUBGRID_HTTP_SPEC / SUBGRID_HTTP_SPEC_FILE');
};

const spec = readSpec();

if (!spec.base_url || !Array.isArray(spec.verbs) || spec.verbs.length === 0) {
	throw new Error('Spec needs a base_url and at least one verb');
}

const resolvedBaseUrl = interpolateEnv(spec.base_url);

if (!resolvedBaseUrl) {
	const referenced = [...spec.base_url.matchAll(/\$\{([A-Za-z0-9_]+)\}/g)].map(
		(match) => match[1],
	);

	throw new Error(
		referenced.length
			? `base_url "${spec.base_url}" resolved to empty — ${referenced.join(', ')} is not set on this component`
			: 'base_url is empty',
	);
}

const base = new URL(resolvedBaseUrl);
const baseOrigin = base.origin;

const authEnvRefs = (auth?: Auth): string[] => {
	if (!auth) return [];

	const values =
		'basic' in auth
			? [auth.basic.username, auth.basic.password]
			: 'oauth2' in auth
				? [auth.oauth2.clientId, auth.oauth2.clientSecret, auth.oauth2.username || '', auth.oauth2.password || '']
				: [auth.value];

	return [...values.join(' ').matchAll(/\$\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]);
};

let cachedToken: { value: string; expiresAt: number } | null = null;

const fetchOAuthToken = async (oauth: Extract<Auth, { oauth2: unknown }>['oauth2']): Promise<string> => {
	if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

	const form = new URLSearchParams({
		grant_type: oauth.grantType === 'password' ? 'password' : 'client_credentials',
		client_id: interpolateEnv(oauth.clientId),
		client_secret: interpolateEnv(oauth.clientSecret),
	});

	if (oauth.grantType === 'password') {
		form.set('username', interpolateEnv(oauth.username || ''));
		form.set('password', interpolateEnv(oauth.password || ''));
	}

	if (oauth.scope) form.set('scope', interpolateEnv(oauth.scope));

	const response = await fetch(oauth.tokenUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
		body: form,
		redirect: 'manual',
	});

	const text = await response.text();

	if (!response.ok) {
		throw new Error(`Token request to ${oauth.tokenUrl} failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
	}

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(text) as Record<string, unknown>;
	} catch {
		throw new Error(`Token response from ${oauth.tokenUrl} was not JSON`);
	}

	const field = oauth.tokenField || 'access_token';
	const token = body[field];

	if (!token) throw new Error(`Token response from ${oauth.tokenUrl} had no "${field}"`);

	const ttlSeconds = Number(body.expires_in) || 300;
	cachedToken = { value: String(token), expiresAt: Date.now() + Math.max(30, ttlSeconds - 30) * 1000 };

	return String(token);
};

const resolveAuthHeader = async (auth: Auth): Promise<[string, string]> => {
	if ('basic' in auth) {
		const username = interpolateEnv(auth.basic.username);
		const password = interpolateEnv(auth.basic.password);

		return ['authorization', `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`];
	}

	if ('oauth2' in auth) {
		return ['authorization', `Bearer ${await fetchOAuthToken(auth.oauth2)}`];
	}

	return [auth.header, interpolateEnv(auth.value)];
};

for (const key of authEnvRefs(spec.auth)) {
	if (!process.env[key]) {
		process.stderr.write(`[http-bridge] warning: ${key} is not set; auth will be incomplete\n`);
	}
}

const slug = (value: string) => value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();

const resolveLocation = (verb: Verb, name: string): 'path' | 'query' | 'body' => {
	const explicit = verb.params?.[name]?.in;
	if (explicit) return explicit;

	placeholderPattern.lastIndex = 0;
	for (const [, key] of verb.path.matchAll(placeholderPattern)) {
		if (key === name) return 'path';
	}

	const method = verb.method || 'GET';
	return method === 'GET' || method === 'DELETE' ? 'query' : 'body';
};

const jsonType = (type?: string) => (type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : 'string');

const fillTemplate = (template: unknown, args: Record<string, any>, used: Set<string>): unknown => {
	if (typeof template === 'string') {
		let out = template;

		placeholderPattern.lastIndex = 0;
		for (const [match, name] of template.matchAll(placeholderPattern)) {
			const value = args[name];

			if (value === undefined || value === null || value === '') {
				throw new Error(`Missing required parameter "${name}"`);
			}

			out = out.replace(match, String(value));
			used.add(name);
		}

		return out;
	}

	if (Array.isArray(template)) {
		return template.map((item) => fillTemplate(item, args, used));
	}

	if (template && typeof template === 'object') {
		return Object.fromEntries(
			Object.entries(template as Record<string, unknown>).map(([key, value]) => [key, fillTemplate(value, args, used)]),
		);
	}

	return template;
};

const buildTool = (verb: Verb) => {
	const properties: Record<string, any> = {};
	const required: string[] = [];

	placeholderPattern.lastIndex = 0;
	const inPath = new Set([...verb.path.matchAll(placeholderPattern)].map((m) => m[1]));

	for (const name of inPath) {
		const p = verb.params?.[name];
		properties[name] = {
			type: jsonType(p?.type),
			description: p?.description || `${name} substituted into the request path`,
			...(p?.enum ? { enum: p.enum } : {}),
		};
		required.push(name);
	}

	for (const [name, p] of Object.entries(verb.params || {})) {
		if (properties[name]) continue;

		properties[name] = {
			type: jsonType(p.type),
			description: p.description,
			...(p.enum ? { enum: p.enum } : {}),
		};

		if (p.required) required.push(name);
	}

	return {
		name: slug(verb.name),
		description:
			verb.description ||
			`${verb.method || 'GET'} ${verb.path} on ${baseOrigin}`,
		inputSchema: {
			type: 'object' as const,
			properties,
			...(required.length ? { required } : {}),
		},
	};
};

const tools = spec.verbs.map(buildTool);
const verbByToolName = new Map(spec.verbs.map((verb) => [slug(verb.name), verb]));

const callVerb = async (verb: Verb, args: Record<string, any>) => {
	const method = verb.method || 'GET';

	const values: Record<string, any> = { ...args };
	for (const [name, param] of Object.entries(verb.params || {})) {
		const supplied = values[name];

		if ((supplied === undefined || supplied === '') && param.default !== undefined) {
			values[name] = param.default;
		}
	}

	let path = verb.path;
	const leftovers: Record<string, any> = { ...values };

	path = path.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => {
		const value = process.env[key];
		if (!value) throw new Error(`Path references ${key} but it is not set`);
		if (!SAFE_SEGMENT.test(value)) {
			throw new Error(`Refusing ${key}: ${JSON.stringify(value)} is not a single path segment`);
		}
		return encodeURIComponent(value);
	});

	placeholderPattern.lastIndex = 0;
	for (const [match, name] of verb.path.matchAll(placeholderPattern)) {
		const raw = args[name];

		if (raw === undefined || raw === null || raw === '') {
			throw new Error(`Missing required path parameter "${name}"`);
		}

		const value = String(raw);
		if (!SAFE_SEGMENT.test(value)) {
			throw new Error(
				`Refusing "${name}": path parameters may only contain letters, digits, dot, dash, underscore, tilde. Got ${JSON.stringify(value)}.`,
			);
		}

		path = path.replace(match, encodeURIComponent(value));
		delete leftovers[name];
	}

	const query: Record<string, any> = {};
	const templated: Record<string, any> = {};
	const fromTemplate = new Set<string>();

	if (verb.body_template !== undefined) {
		Object.assign(templated, fillTemplate(verb.body_template, values, fromTemplate) as Record<string, any>);
	}

	for (const [name, value] of Object.entries(leftovers)) {
		if (value === undefined) continue;
		if (fromTemplate.has(name)) continue;
		const location = resolveLocation(verb, name);
		if (location === 'query') query[name] = value;
		else if (location === 'body') templated[name] = value;
	}

	const body = templated;

	const url = new URL(base.origin + path);
	for (const [name, value] of Object.entries(query)) {
		url.searchParams.set(name, String(value));
	}

	if (url.origin !== baseOrigin) {
		throw new Error(`Refusing to leave ${baseOrigin} (resolved ${url.origin})`);
	}

	const headers: Record<string, string> = { accept: 'application/json', ...(spec.headers || {}) };
	if (spec.auth) {
		const [name, value] = await resolveAuthHeader(spec.auth);
		headers[name] = value;
	}

	for (const name of spec.unique_headers || []) {
		headers[name] = randomUUID();
	}

	let payload: string | undefined;
	if (method !== 'GET' && method !== 'DELETE') {
		headers['content-type'] = 'application/json';
		payload = JSON.stringify(verb.bodyArray ? [body] : body);
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			method,
			headers,
			body: payload,
			redirect: 'manual',
			signal: controller.signal,
		});

		const text = await response.text();

		return {
			ok: response.ok,
			status: response.status,
			url: url.toString(),
			body: text,
		};
	} finally {
		clearTimeout(timer);
	}
};

const server = new Server(
	{ name: spec.name ? `subgrid-http:${spec.name}` : 'subgrid-http', version: '1.0.0' },
	{ capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const verb = verbByToolName.get(request.params.name);

	if (!verb) {
		return {
			isError: true,
			content: [{ type: 'text', text: `Unknown tool "${request.params.name}"` }],
		};
	}

	try {
		const result = await callVerb(verb, (request.params.arguments || {}) as Record<string, any>);
		const text = `HTTP ${result.status}\n${result.url}\n\n${result.body}`;

		return {
			...(result.ok ? {} : { isError: true }),
			content: [{ type: 'text', text }],
		};
	} catch (err) {
		return {
			isError: true,
			content: [{ type: 'text', text: (err as Error).message }],
		};
	}
});

const main = async () => {
	await server.connect(new StdioServerTransport());
};

main().catch((err) => {
	process.stderr.write(`[http-bridge] fatal: ${(err as Error).message}\n`);
	process.exit(1);
});
