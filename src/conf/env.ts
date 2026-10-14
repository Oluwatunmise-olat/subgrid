import 'dotenv/config';
import * as process from 'process';
require('dotenv').config();

const RUNTIME_REQUIRED_ENVS = ['DB_HOST', 'DB_PASSWORD', 'DB_PORT', 'DB_USERNAME', 'DB_DATABASE'];

export const app = {
	name: 'subgrid',
	port: Number(process.env.PORT) || 8081,
	address: process.env.SERVER_ADDRESS || '0.0.0.0',
	env: process.env.NODE_ENV || 'development',
	url: process.env.APP_URL || 'http://localhost:8081',
	client_url: process.env.CLIENT_URL || 'http://localhost:5173',
	client_origin: process.env.CLIENT_URL || 'http://localhost:5173',
	encryption_key: process.env.ENCRYPTION_KEY,
};

export const embedders = {
	openai: {
		apiKey: process.env.OPENAI_API_KEY,
		chat_model: process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo',
	},
	openrouter: {
		apiKey: process.env.OPENROUTER_API_KEY,
		model: process.env.OPENROUTER_MODEL || 'google/gemini-flash-1.5-8b',
		baseUrl: 'https://openrouter.ai/api/v1',
	},
};

export const llm = {
	timeout_ms: Number(process.env.LLM_TIMEOUT_MS) || 30_000,
	max_output_tokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 1500,
};

export const webauthn = {
	rp_name: process.env.RP_NAME || 'Subgrid',
	rp_id: process.env.RP_ID || 'localhost',
	origin: process.env.RP_ORIGIN || 'http://localhost:5173',
	approval_secret: process.env.APPROVAL_SECRET,
	approval_ttl_seconds: 300,
	session_cookie_name: 'subgrid_session',
	session_ttl_seconds: 60 * 60 * 24 * 30,
};

const getDbSslConfig = () => {
	if (process.env.DB_SSL === 'false') return false;
	if (process.env.NODE_ENV !== 'production') return false;

	return { rejectUnauthorized: false };
};

export const database = {
	knex: {
		client: process.env.DB_CLIENT || 'pg',
		connection: {
			database: process.env.DB_DATABASE,
			user: process.env.DB_USERNAME,
			password: process.env.DB_PASSWORD,
			port: Number(process.env.DB_PORT),
			host: process.env.DB_HOST,
			charset: 'utf8',
			ssl: getDbSslConfig(),
		},
		pool: {
			min: 2,
			max: 10,
		},
		migrations: {
			tableName: 'knex_migrations',
			directory: './migrations',
			extension: 'ts',
		},
		debug: false,
		useNullAsDefault: true,
	},
};

export const validateRuntimeEnvs = () => {
	const missingRequiredEnvsHandler = (accNullEnvs: string[], currEnv: string) => {
		const currEnvSet = process.env[currEnv.toUpperCase()];
		return currEnvSet ? accNullEnvs : [...accNullEnvs, currEnv.toUpperCase()];
	};

	const nullEnvKeys = RUNTIME_REQUIRED_ENVS.reduce(missingRequiredEnvsHandler, [] as string[]);

	const concatenatedMissingEnvs = nullEnvKeys.join(', ');

	const errMsg = `The following required env variable(s) are missing: ${concatenatedMissingEnvs}`;

	if (nullEnvKeys.length) throw new Error(errMsg);
};
