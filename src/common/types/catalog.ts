import type { ResourceCategory } from '@/models/types';

export type CatalogCategory = ResourceCategory;

export type FieldType = 'text' | 'password';

export type CatalogField = {
	key: string;
	label: string;
	type?: FieldType;
	required?: boolean;
	placeholder?: string;
	help?: string;
	defaultValue?: string;
};

export type CatalogIntegration = {
	id: string;
	name: string;
	category: CatalogCategory;
	description: string;
	official?: boolean;
	firstParty?: boolean;
	custom?: 'stdio' | 'remote' | 'bridge';
	transport?: 'stdio' | 'http' | 'sse';
	command?: string;
	baseArgs?: string[];
	url?: string;
	oauth?: boolean;
	fields: CatalogField[];
	docs?: { label: string; url: string };
	steps?: string[];
};

export type VerbParam = {
	type?: 'string' | 'number' | 'boolean';
	in?: 'path' | 'query' | 'body';
	required?: boolean;
	description?: string;
	enum?: string[];
	default?: string | number | boolean;
};

export type RestVerb = {
	name: string;
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	path: string;
	description?: string;
	params?: Record<string, VerbParam>;
	bodyArray?: boolean;
	body_template?: unknown;
	requiresApproval?: boolean;
};

export type AuthSpec =
	| { header: string; value: string }
	| { basic: { username: string; password: string } }
	| {
			oauth2: {
				tokenUrl: string;
				grantType: 'password' | 'client_credentials';
				clientId: string;
				clientSecret: string;
				username?: string;
				password?: string;
				scope?: string;
				tokenField?: string;
			};
	  };

export type BridgePreset = {
	id: string;
	kind: 'rest' | 's3';
	name: string;
	category: CatalogCategory;
	provider: string;
	description: string;
	docs?: string;
	note?: string;
	limits?: string;
	fields: CatalogField[];
	optionalFields?: CatalogField[];
	verbs: Array<RestVerb | { name: string }>;
	baseUrl?: string;
	auth?: AuthSpec;
	uniqueHeaders?: string[];
	endpoint?: string;
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
};

export type ResolvedComponent = {
	transport: 'stdio' | 'http' | 'sse';
	command?: string | null;
	args?: string[] | null;
	url?: string | null;
	provider: string;
	category: string;
	oauth?: boolean;
	custom?: boolean;
};

export type SuggestionCandidate = {
	id: string;
	name: string;
	description: string;
	category: string;
	kind: 'integration' | 'preset';
	provider: string;
	capability: string;
	keywords: string[];
};

export type ScoredSuggestionCandidate = {
	candidate: SuggestionCandidate;
	matched: string[];
	score: number;
};
