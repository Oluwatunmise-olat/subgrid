export type VerbParam = {
	type?: 'string' | 'number' | 'boolean';
	in?: 'path' | 'query' | 'body';
	required?: boolean;
	description?: string;
	enum?: string[];
	default?: string | number | boolean;
};

export type Verb = {
	name: string;
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	path: string;
	description?: string;
	params?: Record<string, VerbParam>;
	bodyArray?: boolean;
	body_template?: unknown;
};

export type Auth =
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

export type Spec = {
	name?: string;
	base_url: string;
	headers?: Record<string, string>;
	unique_headers?: string[];
	auth?: Auth;
	verbs: Verb[];
};

export type BridgeResult = {
	ok: boolean;
	status: number;
	url: string;
	body: string;
};
