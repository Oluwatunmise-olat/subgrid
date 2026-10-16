import { join } from 'node:path';

export const BRIDGE_SENTINELS = {
	http: '<subgrid:http-bridge>',
	s3: '<subgrid:s3-bridge>',
} as const;

const BRIDGE_FILES: Record<string, string> = {
	[BRIDGE_SENTINELS.http]: join(__dirname, 'http-bridge', 'server.ts'),
	[BRIDGE_SENTINELS.s3]: join(__dirname, 's3-bridge', 'server.ts'),
};

export const resolveStdioCommand = (command: string | null, args: string[] | null) => {
	const list = args || [];
	const bridge = list.find((arg) => arg in BRIDGE_FILES);

	if (!bridge) return { command: command || '', args: list };

	return {
		command: process.execPath,
		args: list.map((arg) => BRIDGE_FILES[arg] ?? arg),
	};
};
